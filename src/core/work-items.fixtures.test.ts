import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { initDb } from "./db.js";
import { readWorkItems } from "./work-items.js";
import { FIXTURE_WORK_ITEMS, seedFixtureWorkItems } from "./work-items.fixtures.js";

test("fixture data covers every state, every blocked_reason, and every phase_group", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-fixtures-"));
  const dbPath = join(dir, "minna.db");
  let db: DatabaseSync | undefined;
  try {
    await initDb(dbPath);
    db = new DatabaseSync(dbPath);
    await seedFixtureWorkItems(db);

    const items = await readWorkItems(db);
    assert.equal(items.length, FIXTURE_WORK_ITEMS.length);

    const states = new Set(items.map(item => item.state));
    for (const state of ["parked", "active", "blocked", "closed"]) {
      assert.ok(states.has(state as never), `expected fixture data to cover state '${state}'`);
    }

    const reasons = new Set(items.map(item => item.blocked_reason).filter(Boolean));
    assert.ok(reasons.has("clarification-required"));
    assert.ok(reasons.has("ci-pending"));

    const groups = new Set(items.map(item => item.phase_group));
    for (const group of ["define", "create", "integrate"]) {
      assert.ok(groups.has(group as never), `expected fixture data to cover phase_group '${group}'`);
    }
  } finally {
    db?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
