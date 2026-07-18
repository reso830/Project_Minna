import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createFeature, initDb, openDb, updateFeatureStatus } from "./core/db.js";

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

test("exports a feature timeline and disables all legacy state-mutating commands", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-cli-export-"));
  const exportDir = join(dir, "export");

  try {
    await seedJournal(dir);
    const exported = await runCli(dir, "export", "--feature", "cli-feature", exportDir);
    assert.equal(exported.exitCode, 0);
    assert.match(await readFile(join(exportDir, "journal.md"), "utf8"), /# Event Journal: CLI Feature/);

    for (const command of [
      ["start-feature", "--project", "test", "--title", "blocked"],
      ["record-decision", "--feature", "test", "--question", "q", "--answer", "a"],
      ["record-manual-test", "--feature", "test", "--passed", "true"],
    ]) {
      const result = await runCli(dir, ...command);
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /Error: Command disabled in M1\. Event Journal write API is the sole state mutation path; integration is deferred to M2\./);
    }

    const help = await runCli(dir);
    assert.match(help.stdout, /start-feature \[DISABLED in M1\]/);
    assert.match(help.stdout, /record-decision \[DISABLED in M1\]/);
    assert.match(help.stdout, /record-manual-test \[DISABLED in M1\]/);
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
    const child = spawn(process.execPath, [cliPath, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("exit", exitCode => resolve({ exitCode, stdout, stderr }));
  });
}
