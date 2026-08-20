import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  _recordEvent,
  createFeature,
  exportFeatureJournal,
  initDb,
  readEvents,
  updateFeatureStatus,
  verifyDb,
} from "./db.js";
import { appendWorkItemEvent, createWorkItem, updateWorkItem, updateWorkItemState } from "./work-items.js";

async function withScratchDb(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "minna-journal-write-"));
  const dbPath = join(dir, "minna.db");
  let db: DatabaseSync | undefined;

  try {
    await initDb(dbPath);
    db = new DatabaseSync(dbPath);
    await run(db);
  } finally {
    db?.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("initializes journal tables and append-only triggers in a scratch database", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-journal-init-"));
  const dbPath = join(dir, "minna.db");

  try {
    await initDb(dbPath);

    const db = new DatabaseSync(dbPath);
    const schemaNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'trigger')")
      .all()
      .map(row => String((row as { name: string }).name));

    for (const name of ["events", "features", "prevent_event_update", "prevent_event_delete"]) {
      assert.ok(schemaNames.includes(name), `expected ${name} to be initialized`);
    }
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("initializes the work_items projection table and the events table's work-item columns", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-journal-workitems-"));
  const dbPath = join(dir, "minna.db");

  try {
    await initDb(dbPath);

    const db = new DatabaseSync(dbPath);
    const tableNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map(row => String((row as { name: string }).name));
    assert.ok(tableNames.includes("work_items"), "expected work_items table to be initialized");

    const eventColumns = db
      .prepare("PRAGMA table_info(events)")
      .all()
      .map(row => String((row as { name: string }).name));
    for (const column of ["work_item_id", "summary", "artifact_path"]) {
      assert.ok(eventColumns.includes(column), `expected events.${column} to exist`);
    }
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("adds work-item columns to an events table created by a prior release", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-journal-upgrade-"));
  const dbPath = join(dir, "minna.db");

  try {
    // Simulate a pre-upgrade database: the original 001 schema, no work-item columns/table.
    const legacyDb = new DatabaseSync(dbPath);
    legacyDb.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE features (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacyDb.prepare(
      "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
    ).run("2026-01-01T00:00:00.000Z", "human", "feature.created", '{"id":"legacy","title":"Legacy","status":"initial"}');
    legacyDb.close();

    await initDb(dbPath);

    const db = new DatabaseSync(dbPath);
    const columns = db.prepare("PRAGMA table_info(events)").all().map(row => String((row as { name: string }).name));
    for (const column of ["work_item_id", "summary", "artifact_path"]) {
      assert.ok(columns.includes(column), `expected upgraded events.${column} to exist`);
    }

    const count = (db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number }).count;
    assert.equal(count, 1, "the pre-existing event row must survive the column migration");
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifyDb does not flag work-item journal events as unsupported", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", {
      id: "verify-wi", title: "t", description: "d", work_item_type: "issue", project: "p",
    });
    await appendWorkItemEvent(db, {
      work_item_id: "verify-wi", actor: "minna", type: "execution.started", summary: "s", payload: {},
    });

    const result = await verifyDb(db);
    assert.equal(result.consistent, true);
    assert.deepEqual(result.discrepancies, []);
    assert.equal(result.workItemCount, 1);
  });
});

test("records a project key and phase in every new work-item journal event", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", {
      id: "event-project-wi", title: "t", description: "d", work_item_type: "feature", project: "p",
    });
    await updateWorkItem(db, "human", "event-project-wi", { description: "updated" });
    await updateWorkItemState(db, "minna", "event-project-wi", { state: "active", phase: "plan" });
    await appendWorkItemEvent(db, {
      work_item_id: "event-project-wi", actor: "human", type: "human.decided", summary: "Decided.", payload: {},
    });

    const events = db.prepare("SELECT type, project, payload FROM events WHERE work_item_id = ? ORDER BY id ASC").all("event-project-wi") as Array<{ type: string; project: string | null; payload: string }>;
    assert.deepEqual(events.map(event => event.project), ["p", "p", "p", "p"]);
    assert.equal(JSON.parse(events.find(event => event.type === "work_item.state_changed")!.payload).phase, "plan");
    assert.equal((await verifyDb(db)).consistent, true);
  });
});

test("verifyDb reflects a work item's state_changed history and reports drift after direct tampering", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", {
      id: "verify-transition-wi", title: "t", description: "d", work_item_type: "issue", project: "p",
    });
    await updateWorkItemState(db, "minna", "verify-transition-wi", { state: "active" });
    await updateWorkItemState(db, "minna", "verify-transition-wi", { state: "blocked", blocked_reason: "ci-pending" });
    assert.equal((await verifyDb(db)).consistent, true);

    db.prepare("UPDATE work_items SET blocked_reason = ? WHERE id = ?").run("failed", "verify-transition-wi");
    const verification = await verifyDb(db);

    assert.equal(verification.consistent, false);
    assert.ok(verification.discrepancies.some(message => message.includes("verify-transition-wi") && message.includes("blocked_reason")));
  });
});

test("verifyDb reports an orphaned work_items projection row", async () => {
  await withScratchDb(async db => {
    db.prepare(
      `INSERT INTO work_items (id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?)`,
    ).run("orphan-wi", "Orphan", "d", "parked", "spec", "feature", "p", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");

    const verification = await verifyDb(db);

    assert.equal(verification.consistent, false);
    assert.ok(verification.discrepancies.some(message => message.includes("orphan-wi") && message.includes("no corresponding work_item.created")));
  });
});

test("rolls back an injected failure without persisting its event or projection", async () => {
  await withScratchDb(async db => {
    await assert.rejects(
      () => _recordEvent(
        db,
        "human",
        "feature.created",
        { id: "atomic-feature", title: "Atomic Feature", status: "initial" },
        { faultInjection: true },
      ),
      /fault injection/i,
    );

    assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number }).count), 0);
    assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM features").get() as { count: number }).count), 0);
  });
});

test("append-only triggers roll back the full transaction for event updates and deletes", async () => {
  for (const statement of ["UPDATE events SET actor = 'tampered' WHERE id = 1", "DELETE FROM events WHERE id = 1"]) {
    await withScratchDb(async db => {
      db.prepare(
        "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
      ).run("2026-07-17T00:00:00.000Z", "human", "feature.created", '{"id":"seed"}');

      db.exec("BEGIN TRANSACTION");
      db.prepare(
        "INSERT INTO features (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      ).run("companion", "Companion", "initial", "2026-07-17T00:00:00.000Z", "2026-07-17T00:00:00.000Z");

      assert.throws(() => db.exec(statement), /not allowed/i);
      assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM features").get() as { count: number }).count), 0);
    });
  }
});

test("rejects an update for an unknown feature without appending an event", async () => {
  await withScratchDb(async db => {
    await assert.rejects(
      () => updateFeatureStatus(db, "human", "unknown-feature", "updated"),
      /unknown|not found/i,
    );

    assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number }).count), 0);
    assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM features").get() as { count: number }).count), 0);
  });
});

test("rejects duplicate feature creation without appending a second creator event", async () => {
  await withScratchDb(async db => {
    const created = await createFeature(db, "human", "unique-feature", "Unique Feature", "initial");
    assert.equal(created.status, "initial");
    assert.equal(created.created_at, created.updated_at);

    await assert.rejects(
      () => createFeature(db, "human", "unique-feature", "Duplicate Feature", "initial"),
      /duplicate|already exists/i,
    );

    assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number }).count), 1);
    assert.equal(Number((db.prepare("SELECT COUNT(*) AS count FROM features").get() as { count: number }).count), 1);
  });
});

test("reads feature events in journal order using an exact payload id filter", async () => {
  await withScratchDb(async db => {
    await createFeature(db, "human", "journal-feature", "Journal Feature", "initial");
    await updateFeatureStatus(db, "system", "journal-feature", "updated");
    await createFeature(db, "human", "journal-feature-other", "Other Feature", "initial");

    const events = await readEvents(db, { featureId: "journal-feature" });

    assert.deepEqual(events.map(event => event.type), ["feature.created", "feature.status_updated"]);
    assert.deepEqual(events.map(event => (event.payload as { id: string }).id), ["journal-feature", "journal-feature"]);
    assert.ok((events[0].id ?? 0) < (events[1].id ?? 0));
  });
});

test("verifyDb reports field-level drift after direct projection tampering", async () => {
  await withScratchDb(async db => {
    await createFeature(db, "human", "drift-feature", "Drift Feature", "initial");
    assert.equal((await verifyDb(db)).consistent, true);

    db.prepare("UPDATE features SET status = ? WHERE id = ?").run("tampered", "drift-feature");
    const verification = await verifyDb(db);

    assert.equal(verification.consistent, false);
    assert.ok(verification.discrepancies.some(message => message.includes("drift-feature") && message.includes("status")));
  });
});

test("verifyDb reports an orphaned projection row", async () => {
  await withScratchDb(async db => {
    db.prepare(
      "INSERT INTO features (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("orphan-feature", "Orphan Feature", "initial", "2026-07-18T00:00:00.000Z", "2026-07-18T00:00:00.000Z");

    const verification = await verifyDb(db);

    assert.equal(verification.consistent, false);
    assert.ok(verification.discrepancies.some(message => message.includes("orphan-feature") && message.includes("no corresponding feature.created")));
  });
});

test("verifyDb reports duplicate feature creation events", async () => {
  await withScratchDb(async db => {
    await createFeature(db, "human", "duplicate-creator", "Duplicate Creator", "initial");
    db.prepare(
      "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
    ).run(
      "2026-07-18T00:00:01.000Z",
      "human",
      "feature.created",
      '{"id":"duplicate-creator","title":"Duplicate Creator","status":"initial"}',
    );

    const verification = await verifyDb(db);

    assert.equal(verification.consistent, false);
    assert.ok(verification.discrepancies.some(message => message.includes("duplicate-creator") && message.includes("more than one feature.created")));
  });
});

test("exports a feature timeline as Markdown and rejects an unknown feature", async () => {
  await withScratchDb(async db => {
    await createFeature(db, "human", "export-feature", "Export Feature", "initial");
    await updateFeatureStatus(db, "system", "export-feature", "updated");

    const markdown = await exportFeatureJournal(db, "export-feature");

    assert.match(markdown, /# Event Journal: Export Feature/);
    assert.match(markdown, /\| Timestamp \(UTC\) \| Actor \| Event Type \| Description \/ Detail \|/);
    assert.match(markdown, /feature\.created/);
    assert.match(markdown, /feature\.status_updated/);
    await assert.rejects(() => exportFeatureJournal(db, "missing-feature"), /No such feature 'missing-feature'/);
  });
});
