import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { handleToolCall } from "./tools.js";

test("MCP start_feature validates the project before creating state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-mcp-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(dir);

    await assert.rejects(
      handleToolCall("start_feature", {
        project: "missing",
        title: "Decision log"
      }),
      /Unknown project|ENOENT/
    );
  } finally {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  }
});
