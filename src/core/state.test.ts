import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { listFeatures, startFeature } from "./state.js";

test("returns an empty feature list when no state file exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-state-empty-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(dir);
    assert.deepEqual(await listFeatures(), []);
  } finally {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test("surfaces a parse error instead of discarding a malformed state file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-state-corrupt-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(dir);
    await mkdir(join(dir, "state"), { recursive: true });
    await writeFile(join(dir, "state", "features.json"), "{ not valid json", "utf8");

    await assert.rejects(listFeatures(), SyntaxError);
    // The malformed file must not be overwritten by a subsequent mutation.
    await assert.rejects(startFeature("monica", "Decision log"), SyntaxError);
  } finally {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  }
});
