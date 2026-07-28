import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initDb } from "../core/db.js";
import { createWorkItem } from "../core/work-items.js";
import type { WorkItem } from "../core/types.js";
import { handleToolCall } from "./tools.js";

test("MCP legacy state-mutating tools fail closed", async () => {
  for (const tool of ["start_feature", "record_decision", "record_manual_test"]) {
    await assert.rejects(
      handleToolCall(tool, {}),
      /Tool disabled in M1\./,
    );
  }
});

test("MCP status tool reads work items from the journal", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-mcp-status-"));
  const dbPath = join(dir, "minna.db");
  let db: DatabaseSync | undefined;
  try {
    await initDb(dbPath);
    db = new DatabaseSync(dbPath);
    await createWorkItem(db, "human", {
      id: "mcp-001", title: "MCP item", description: "d", work_item_type: "issue", project: "p",
    });

    const result = await handleToolCall("status", {}, db) as WorkItem[];
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "mcp-001");
  } finally {
    db?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
