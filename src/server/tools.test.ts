import test from "node:test";
import assert from "node:assert/strict";
import { handleToolCall } from "./tools.js";

test("MCP legacy state-mutating tools fail closed", async () => {
  for (const tool of ["start_feature", "record_decision", "record_manual_test"]) {
    await assert.rejects(
      handleToolCall(tool, {}),
      /Tool disabled in M1\./,
    );
  }
});
