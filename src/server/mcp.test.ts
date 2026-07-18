import assert from "node:assert/strict";
import test from "node:test";
import { advertisedTools } from "./mcp.js";

test("MCP advertises only the supported non-mutating tools", () => {
  const names = advertisedTools.map(tool => tool.name);

  assert.deepEqual(names, ["status"]);
  for (const legacyTool of ["start_feature", "record_decision", "record_manual_test"]) {
    assert.equal(names.includes(legacyTool), false);
  }
});
