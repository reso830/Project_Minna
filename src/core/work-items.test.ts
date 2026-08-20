import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { initDb } from "./db.js";
import { classifyEventFamily, IllegalStateTransitionError } from "./work-item-model.js";
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

function runConcurrentWorkItemWriter(dbPath: string, projectPath: string, description: string): Promise<void> {
  const databaseModule = pathToFileURL(join(process.cwd(), "dist", "core", "db.js")).href;
  const workItemsModule = pathToFileURL(join(process.cwd(), "dist", "core", "work-items.js")).href;
  const input = { title: "Concurrent brief", description, work_item_type: "feature", project: "concurrent", project_path: projectPath, details_text: description };
  const script = [
    `import { openDb } from ${JSON.stringify(databaseModule)};`,
    `import { createWorkItem } from ${JSON.stringify(workItemsModule)};`,
    `const db = openDb(${JSON.stringify(dbPath)});`,
    `try { await createWorkItem(db, "human", ${JSON.stringify(input)}); } finally { db.close(); }`,
  ].join("\n");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script]);
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(stderr || `work-item writer exited with code ${code}`)));
  });
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
      ["spec", "define"], ["plan", "define"], ["tasks", "define"], ["spec-review", "define"],
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
      await updateWorkItemState(db, "minna", id, { state: "active" });
      const updated = await updateWorkItemState(db, "minna", id, { state: "blocked", blocked_reason: reason });
      assert.equal(updated.state, "blocked");
      assert.equal(updated.blocked_reason, reason);
    }
  });
});

test("rejects an illegal state transition without recording an event or changing the projection", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-invalid-transition", title: "t", description: "d", work_item_type: "issue", project: "celia" });

    await assert.rejects(
      () => updateWorkItemState(db, "human", "celia-invalid-transition", { state: "blocked", blocked_reason: "ci-pending" }),
      (error: unknown) => error instanceof IllegalStateTransitionError
        && error.from === "parked"
        && error.to === "blocked"
        && JSON.stringify(error.allowed) === JSON.stringify(["active", "closed"]),
    );

    assert.equal((await readWorkItemEvents(db, "celia-invalid-transition")).length, 1);
    assert.equal((await readWorkItems(db, { project: "celia" })).find(item => item.id === "celia-invalid-transition")?.state, "parked");
  });
});

test("allows a same-state phase update", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-phase-update", title: "t", description: "d", work_item_type: "feature", project: "celia" });

    const updated = await updateWorkItemState(db, "minna", "celia-phase-update", { state: "parked", phase: "plan" });

    assert.equal(updated.state, "parked");
    assert.equal(updated.phase, "plan");
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
    await updateWorkItemState(db, "minna", "celia-201", { state: "active" });
    await assert.rejects(
      () => updateWorkItemState(db, "minna", "celia-201", { state: "blocked" }),
      /blocked_reason/i,
    );
  });
});

test("concurrent creators allocate distinct sequential IDs and preserve both briefs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-concurrent-work-items-"));
  const dbPath = join(directory, ".minna", "minna.db");
  try {
    await initDb(dbPath);
    await Promise.all([
      runConcurrentWorkItemWriter(dbPath, directory, "first brief"),
      runConcurrentWorkItemWriter(dbPath, directory, "second brief"),
    ]);

    const db = new DatabaseSync(dbPath);
    try {
      const items = await readWorkItems(db, { project: "concurrent", project_path: directory });
      assert.deepEqual(items.map(item => item.id), ["001", "002"]);
      assert.deepEqual(
        new Set(await Promise.all(items.map(item => readFile(join(directory, item.feature_brief_path!), "utf8")))),
        new Set(["first brief", "second brief"]),
      );
    } finally {
      db.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a title whose slug exceeds 50 characters", async () => {
  await withScratchDb(async db => {
    await assert.rejects(
      () => createWorkItem(db, "human", {
        id: "celia-101a",
        title: "a".repeat(51),
        description: "desc",
        work_item_type: "feature",
        project: "celia",
      }),
      /title.*50 characters/i,
    );
  });
});

test("rejects a closed_reason unless the work item is closed", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-202", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await assert.rejects(
      () => updateWorkItemState(db, "minna", "celia-202", { state: "active", closed_reason: "dropped" }),
      /closed_reason.*closed|closed.*closed_reason/i,
    );
  });
});

test("requires a closed_reason when closing a work item", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-203", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await assert.rejects(
      () => updateWorkItemState(db, "minna", "celia-203", { state: "closed" }),
      /closed_reason/i,
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
