import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { initDb } from "../db.js";
import { createRepositories } from "../repositories/factory.js";

test("migrates legacy work-items and events schemas without losing rows", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-repositories-"));
  const databasePath = join(directory, ".minna", "minna.db");
  await mkdir(join(directory, ".minna"), { recursive: true });

  const legacy = new DatabaseSync(databasePath);
  try {
    legacy.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        work_item_id TEXT,
        summary TEXT,
        artifact_path TEXT
      );
      CREATE TABLE work_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        state TEXT NOT NULL,
        phase TEXT NOT NULL,
        work_item_type TEXT NOT NULL,
        blocked_reason TEXT,
        assignee TEXT,
        project TEXT NOT NULL,
        branch TEXT,
        pr_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacy.prepare(
      "INSERT INTO work_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("001", "legacy-item", "legacy", "parked", "requirements-review", "feature", null, null, "registry-project", null, null, "2026-07-31T00:00:00.000Z", "2026-07-31T00:00:00.000Z");
    legacy.prepare(
      "INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("2026-07-31T00:00:00.000Z", "human", "work_item.created", "{}", "001", "legacy event", null);
  } finally {
    legacy.close();
  }

  try {
    await initDb(databasePath, "registry-project");

    const migrated = new DatabaseSync(databasePath);
    try {
      const workItemColumns = new Set((migrated.prepare("PRAGMA table_info(work_items)").all() as Array<{ name: string }>).map((row) => row.name));
      assert.deepEqual(
        ["closed_reason", "feature_brief_path", "spec_path", "plan_path", "tasks_path"].map((name) => workItemColumns.has(name)),
        [true, true, true, true, true],
      );
      assert.equal((migrated.prepare("SELECT project FROM events WHERE id = 1").get() as { project: string }).project, "registry-project");
      assert.equal((migrated.prepare("SELECT title FROM work_items WHERE id = '001'").get() as { title: string }).title, "legacy-item");
      assert.equal((migrated.prepare("SELECT phase FROM work_items WHERE id = '001'").get() as { phase: string }).phase, "spec-review");
    } finally {
      migrated.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not backfill events again after the project migration is complete", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-events-project-migration-"));
  const databasePath = join(directory, ".minna", "minna.db");

  try {
    await initDb(databasePath, "initial-project");
    const db = new DatabaseSync(databasePath);
    try {
      db.prepare(
        "INSERT INTO events (timestamp, actor, type, payload, project) VALUES (?, ?, ?, ?, ?)",
      ).run("2026-07-31T00:00:00.000Z", "human", "human.decided", "{}", null);
    } finally {
      db.close();
    }

    await initDb(databasePath, "later-project");

    const migrated = new DatabaseSync(databasePath);
    try {
      assert.equal(
        (migrated.prepare("SELECT project FROM events WHERE id = 1").get() as { project: string | null }).project,
        null,
      );
    } finally {
      migrated.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("creates local repositories backed by an initialized project database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-repository-factory-"));
  const databasePath = join(directory, ".minna", "minna.db");

  try {
    const repositories = await createRepositories({ dbPath: databasePath, projectKey: "factory-project" });
    try {
      assert.deepEqual(await repositories.workItems.list({ project: "factory-project" }), []);
      assert.deepEqual(await repositories.events.read("001"), []);
    } finally {
      repositories.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("persists work items and their events through the local repositories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-repository-write-"));
  const databasePath = join(directory, ".minna", "minna.db");

  try {
    const repositories = await createRepositories({ dbPath: databasePath, projectKey: "write-project" });
    try {
      await repositories.workItems.create("human", {
        id: "001",
        title: "repository-item",
        description: "created through repository",
        work_item_type: "feature",
        project: "write-project",
      });
      await repositories.events.append({
        work_item_id: "001",
        actor: "human",
        type: "human.decided",
        summary: "Recorded a decision.",
        payload: { message: "Proceed." },
      });

      assert.equal((await repositories.workItems.list({ project: "write-project" })).length, 1);
      assert.equal((await repositories.events.read("001")).length, 2);
    } finally {
      repositories.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("state transitions update the repository projection and record one state event", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-repository-state-transition-"));
  const databasePath = join(directory, ".minna", "minna.db");

  try {
    const repositories = await createRepositories({ dbPath: databasePath, projectKey: "state-project" });
    try {
      const created = await repositories.workItems.create("human", {
        id: "001",
        title: "state-item",
        description: "transition through repository",
        work_item_type: "issue",
        project: "state-project",
      });
      await repositories.workItems.updateState("human", "001", { state: "active" });
      const closed = await repositories.workItems.updateState("human", "001", { state: "closed", closed_reason: "done" });

      assert.equal(closed.state, "closed");
      assert.equal(closed.closed_reason, "done");
      const events = await repositories.events.read("001");
      assert.equal(events.length, 3);
      assert.deepEqual(events.map(event => event.type), ["work_item.created", "work_item.state_changed", "work_item.state_changed"]);
      assert.notEqual(closed.updated_at, created.updated_at);
      assert.equal(closed.updated_at, events[2].timestamp);
      assert.deepEqual(events[2].payload, {
        from: "active",
        to: "closed",
        phase: "implement",
        blocked_reason: null,
        closed_reason: "done",
      });
    } finally {
      repositories.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an illegal repository transition leaves the work-item journal unchanged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-repository-invalid-state-"));
  const databasePath = join(directory, ".minna", "minna.db");

  try {
    const repositories = await createRepositories({ dbPath: databasePath, projectKey: "state-project" });
    try {
      await repositories.workItems.create("human", {
        id: "001",
        title: "state-item",
        description: "transition through repository",
        work_item_type: "issue",
        project: "state-project",
      });

      await assert.rejects(
        () => repositories.workItems.updateState("human", "001", { state: "blocked", blocked_reason: "ci-pending" }),
        /Illegal state transition from 'parked' to 'blocked'/,
      );

      assert.equal((await repositories.events.read("001")).length, 1);
      assert.equal((await repositories.workItems.list({ project: "state-project" }))[0].state, "parked");
    } finally {
      repositories.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
