import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { initDb } from "./db.js";
import { classifyEventFamily } from "./work-item-model.js";
import {
  appendWorkItemEvent,
  createWorkItem,
  readWorkItemEvents,
  readWorkItems,
  updateWorkItemState,
} from "./work-items.js";

async function withScratchDb(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "minna-work-items-"));
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

test("creating a feature work item defaults to the first phase of the full 7-phase sequence", async () => {
  await withScratchDb(async db => {
    const item = await createWorkItem(db, "human", {
      id: "celia-100",
      title: "Feature item",
      description: "desc",
      work_item_type: "feature",
      project: "celia",
    });
    assert.equal(item.phase, "spec");
    assert.equal(item.phase_group, "define");
    assert.equal(item.state, "parked");
  });
});

test("creating an issue work item defaults to implement, skipping the define group", async () => {
  await withScratchDb(async db => {
    const item = await createWorkItem(db, "human", {
      id: "celia-101",
      title: "Issue item",
      description: "desc",
      work_item_type: "issue",
      project: "celia",
    });
    assert.equal(item.phase, "implement");
    assert.equal(item.phase_group, "create");
  });
});

test("rejects a phase that does not belong to the work item type's sequence", async () => {
  await withScratchDb(async db => {
    await assert.rejects(
      () => createWorkItem(db, "human", {
        id: "celia-102",
        title: "Bad issue",
        description: "desc",
        work_item_type: "issue",
        project: "celia",
        phase: "spec",
      }),
      /spec.*issue|issue.*spec/i,
    );
  });
});

test("every derived phase_group on read matches the pure derivation for every phase", async () => {
  await withScratchDb(async db => {
    const phases: Array<[string, string]> = [
      ["spec", "define"], ["plan", "define"], ["tasks", "define"], ["requirements-review", "define"],
      ["implement", "create"], ["review", "create"], ["integrate", "integrate"],
    ];
    let counter = 0;
    for (const [phase] of phases) {
      const id = `celia-phase-${counter++}`;
      await createWorkItem(db, "human", {
        id, title: id, description: "d", work_item_type: "feature", project: "celia",
        phase: phase as never,
      });
    }
    const items = await readWorkItems(db, { project: "celia" });
    for (const [phase, group] of phases) {
      const item = items.find(candidate => candidate.phase === phase);
      assert.ok(item, `expected an item with phase '${phase}'`);
      assert.equal(item!.phase_group, group);
    }
  });
});

test("setting state to blocked with each blocked_reason produces the item read back with that reason", async () => {
  await withScratchDb(async db => {
    const reasons = ["clarification-required", "approval-required", "external-dependency", "ci-pending", "failed"] as const;
    let counter = 0;
    for (const reason of reasons) {
      const id = `celia-blocked-${counter++}`;
      await createWorkItem(db, "human", { id, title: id, description: "d", work_item_type: "issue", project: "celia" });
      const updated = await updateWorkItemState(db, "minna", id, { state: "blocked", blocked_reason: reason });
      assert.equal(updated.state, "blocked");
      assert.equal(updated.blocked_reason, reason);
    }
  });
});

test("rejects blocked_reason when state is not blocked", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-200", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await assert.rejects(
      () => updateWorkItemState(db, "minna", "celia-200", { state: "active", blocked_reason: "ci-pending" }),
      /blocked_reason.*blocked|blocked.*blocked_reason/i,
    );
  });
});

test("rejects blocked state without a blocked_reason", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-201", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await assert.rejects(
      () => updateWorkItemState(db, "minna", "celia-201", { state: "blocked" }),
      /blocked_reason/i,
    );
  });
});

test("an execution event and an agent message both append to a work item's history and are distinguishable by family", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-300", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await appendWorkItemEvent(db, {
      work_item_id: "celia-300", actor: "minna", type: "execution.finished",
      summary: "Process exited 0.", payload: { exitCode: 0 },
    });
    await appendWorkItemEvent(db, {
      work_item_id: "celia-300", actor: "codex", type: "agent.summary",
      summary: "Implementation complete.", payload: {},
    });

    const events = await readWorkItemEvents(db, "celia-300");
    // work_item.created (lifecycle) + the two appended events
    assert.equal(events.length, 3);
    const families = events.map(event => classifyEventFamily(event.type));
    assert.deepEqual(families, ["lifecycle", "execution", "agent_message"]);
  });
});

test("the events table stays append-only for work-item-scoped events", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-400", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await appendWorkItemEvent(db, {
      work_item_id: "celia-400", actor: "minna", type: "execution.started", summary: "Started.", payload: {},
    });
    assert.throws(() => db.exec("UPDATE events SET summary = 'tampered' WHERE work_item_id = 'celia-400'"), /not allowed/i);
    assert.throws(() => db.exec("DELETE FROM events WHERE work_item_id = 'celia-400'"), /not allowed/i);
  });
});
