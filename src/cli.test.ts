import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createFeature, initDb, openDb, updateFeatureStatus } from "./core/db.js";
import { readWorkItemEvents } from "./core/work-items.js";

const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url));

test("initializes the journal before handling a CLI command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-init-"));

  try {
    const result = await runCli(dir);

    assert.equal(result.exitCode, 0);
    await access(join(dir, ".minna", "minna.db"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("logs journal events in order and fails closed for an unknown feature", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-log-"));

  try {
    await seedJournal(dir);

    const log = await runCli(dir, "log", "--feature", "cli-feature");
    assert.equal(log.exitCode, 0);
    assert.match(log.stdout, /feature\.created/);
    assert.match(log.stdout, /feature\.status_updated/);
    assert.ok(log.stdout.indexOf("feature.created") < log.stdout.indexOf("feature.status_updated"));

    const unknown = await runCli(dir, "log", "--feature", "missing-feature");
    assert.equal(unknown.exitCode, 1);
    assert.match(unknown.stderr, /Error: No such feature 'missing-feature'/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifies a clean journal and reports field-level projection drift", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-verify-"));

  try {
    await seedJournal(dir);
    const clean = await runCli(dir, "verify");
    assert.equal(clean.exitCode, 0);
    assert.match(clean.stdout, /Verification successful: No drift detected/);

    const db = openDb(join(dir, ".minna", "minna.db"));
    try {
      db.prepare("UPDATE features SET status = ? WHERE id = ?").run("tampered", "cli-feature");
    } finally {
      db.close();
    }

    const drifted = await runCli(dir, "verify");
    assert.equal(drifted.exitCode, 1);
    assert.match(drifted.stderr, /cli-feature/);
    assert.match(drifted.stderr, /status/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("exports a feature timeline", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-export-"));
  const exportDir = join(dir, "export");

  try {
    await seedJournal(dir);
    const exported = await runCli(dir, "export", "--feature", "cli-feature", exportDir);
    assert.equal(exported.exitCode, 0);
    assert.match(await readFile(join(exportDir, "journal.md"), "utf8"), /# Event Journal: CLI Feature/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prints usage for all commands without any [DISABLED] markers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-help-"));
  try {
    const help = await runCli(dir);
    assert.doesNotMatch(help.stdout, /DISABLED/);
    assert.match(help.stdout, /start-feature \[--project <key>\]/);
    assert.match(help.stdout, /record-decision --feature/);
    assert.match(help.stdout, /record-manual-test --feature/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("start-feature creates a work item and status reports it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-start-feature-"));
  try {
    const created = await runCli(dir, "start-feature", "--project", "celia", "--title", "New thing");
    assert.equal(created.exitCode, 0);
    assert.match(created.stdout, /^Created celia-new-thing-\d+ \| parked \| spec$/m);

    const statusResult = await runCli(dir, "status");
    assert.equal(statusResult.exitCode, 0);
    assert.match(statusResult.stdout, /celia-new-thing-\d+ \| celia \| spec \| New thing/);
    assert.match(statusResult.stdout, /state: parked/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("running a CLI command inside a local project synchronizes its registry entry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-registry-sync-"));
  try {
    await mkdir(join(dir, ".minna"));
    await writeFile(
      join(dir, ".minna", "config.yaml"),
      "version: 1\ncreated_at: 2026-07-29T10:00:00.000Z\ndescription: null\n",
      "utf8",
    );

    const result = await runCli(dir, "status");
    assert.equal(result.exitCode, 0);

    const registry = openDb(join(dir, ".registry-home", ".minna", "projects.db"));
    try {
      const project = registry.prepare("SELECT id, name, path FROM projects").get() as { id: string; name: string; path: string };
      assert.equal(project.id, basename(dir).toLowerCase());
      assert.equal(project.name, basename(dir));
      assert.equal(project.path, dir);
    } finally {
      registry.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI synchronization slugifies a local project folder name while preserving its display name", async () => {
  const root = await mkdtemp(join(tmpdir(), "minna-cli-slug-"));
  const dir = join(root, "Project Name_UPPER");
  try {
    await mkdir(join(dir, ".minna"), { recursive: true });
    await writeFile(
      join(dir, ".minna", "config.yaml"),
      "version: 1\ncreated_at: 2026-07-29T10:00:00.000Z\ndescription: null\n",
      "utf8",
    );

    const result = await runCli(dir, "status");
    assert.equal(result.exitCode, 0);

    const registry = openDb(join(dir, ".registry-home", ".minna", "projects.db"));
    try {
      const project = registry.prepare("SELECT id, name FROM projects").get() as { id: string; name: string };
      assert.equal(project.id, "project-name-upper");
      assert.equal(project.name, "Project Name_UPPER");
    } finally {
      registry.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("start-feature accepts an arbitrary --project label without registry resolution", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-verbatim-project-"));
  try {
    const created = await runCli(dir, "start-feature", "--project", "unregistered-label", "--title", "Verbatim project");
    assert.equal(created.exitCode, 0);
    assert.match(created.stdout, /^Created unregistered-label-verbatim-project-\d+ \| parked \| spec$/m);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an explicit --project label does not synchronize a conflicting embedded project", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-explicit-project-"));
  try {
    await mkdir(join(dir, ".minna"));
    await writeFile(
      join(dir, ".minna", "config.yaml"),
      "version: 1\ncreated_at: 2026-07-29T10:00:00.000Z\ndescription: null\n",
      "utf8",
    );

    const created = await runCli(dir, "start-feature", "--project", "other-project", "--title", "Explicit scope");
    assert.equal(created.exitCode, 0);
    await assert.rejects(() => access(join(dir, ".registry-home", ".minna", "projects.db")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("start-feature --type issue defaults to the implement phase", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-start-issue-"));
  try {
    const created = await runCli(dir, "start-feature", "--project", "celia", "--title", "Fix typo", "--type", "issue");
    assert.equal(created.exitCode, 0);
    assert.match(created.stdout, /\| parked \| implement$/m);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("record-decision appends a human.decided event and fails closed for an unknown work item", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-record-decision-"));
  try {
    const created = await runCli(dir, "start-feature", "--project", "celia", "--title", "Needs a call");
    const id = created.stdout.match(/Created (\S+) \|/)?.[1];
    assert.ok(id);

    const recorded = await runCli(dir, "record-decision", "--feature", id!, "--question", "Ship it?", "--answer", "Yes");
    assert.equal(recorded.exitCode, 0);

    const db = openDb(join(dir, ".minna", "minna.db"));
    try {
      const events = await readWorkItemEvents(db, id!);
      assert.ok(events.some(event => event.type === "human.decided" && event.summary.includes("Ship it?")));
    } finally {
      db.close();
    }

    const unknown = await runCli(dir, "record-decision", "--feature", "missing-item", "--question", "q", "--answer", "a");
    assert.equal(unknown.exitCode, 1);
    assert.match(unknown.stderr, /No such work item 'missing-item'/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("record-manual-test appends a human.manual_test_recorded event", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-record-manual-test-"));
  try {
    const created = await runCli(dir, "start-feature", "--project", "celia", "--title", "Verify checkout");
    const id = created.stdout.match(/Created (\S+) \|/)?.[1];
    assert.ok(id);

    const recorded = await runCli(dir, "record-manual-test", "--feature", id!, "--passed", "false", "--notes", "Checkout button is unresponsive");
    assert.equal(recorded.exitCode, 0);

    const db = openDb(join(dir, ".minna", "minna.db"));
    try {
      const events = await readWorkItemEvents(db, id!);
      const testEvent = events.find(event => event.type === "human.manual_test_recorded");
      assert.ok(testEvent);
      assert.deepEqual(testEvent!.payload, { passed: false, notes: "Checkout button is unresponsive" });
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("log and export work for a work item created via start-feature", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-log-export-workitem-"));
  const exportDir = join(dir, "export");
  try {
    const created = await runCli(dir, "start-feature", "--project", "celia", "--title", "Loggable item");
    const id = created.stdout.match(/Created (\S+) \|/)?.[1];
    assert.ok(id);

    const log = await runCli(dir, "log", "--feature", id!);
    assert.equal(log.exitCode, 0);
    assert.match(log.stdout, /work_item\.created/);

    const exported = await runCli(dir, "export", "--feature", id!, exportDir);
    assert.equal(exported.exitCode, 0);
    assert.match(await readFile(join(exportDir, "journal.md"), "utf8"), /# Work Item Journal: Loggable item/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("start-feature resolves and migrates the project from legacy configuration when --project is omitted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-start-embedded-"));
  try {
    await writeFile(
      join(dir, "minna.project.yaml"),
      "project:\n  key: celia\n  name: Celia\n  path: .\n  speckit_dir: .specify\n",
      "utf8",
    );

    const created = await runCli(dir, "start-feature", "--title", "Embedded item");
    assert.equal(created.exitCode, 0);
    assert.match(created.stdout, new RegExp(`^Created ${basename(dir).toLowerCase()}-embedded-item-\\d+ \\| parked \\| spec$`, "m"));
    await access(join(dir, ".minna", "config.yaml"));
    await assert.rejects(() => access(join(dir, "minna.project.yaml")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("start-feature fails closed when no project can be resolved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-start-noproject-"));
  try {
    const created = await runCli(dir, "start-feature", "--title", "No project");
    assert.equal(created.exitCode, 1);
    assert.match(created.stderr, /No project selected/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("exports when the target directory precedes the feature flag", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-export-order-"));
  const exportDir = join(dir, "export");

  try {
    await seedJournal(dir);

    const exported = await runCli(dir, "export", exportDir, "--feature", "cli-feature");

    assert.equal(exported.exitCode, 0);
    assert.match(await readFile(join(exportDir, "journal.md"), "utf8"), /# Event Journal: CLI Feature/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function seedJournal(cwd: string): Promise<void> {
  const dbPath = join(cwd, ".minna", "minna.db");
  await initDb(dbPath);
  const db = openDb(dbPath);

  try {
    await createFeature(db, "human", "cli-feature", "CLI Feature", "initial");
    await updateFeatureStatus(db, "system", "cli-feature", "updated");
  } finally {
    db.close();
  }
}

function runCli(cwd: string, ...args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: { ...process.env, MINNA_REGISTRY_HOME: join(cwd, ".registry-home") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("exit", exitCode => resolve({ exitCode, stdout, stderr }));
  });
}
