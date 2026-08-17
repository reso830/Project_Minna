import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../../cli.js", import.meta.url));

test("start-feature assigns sequential numeric IDs and persists slugified titles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-cli-feature-"));
  try {
    const first = await runCli(directory, "start-feature", "--project", "checkout", "--title", "Refund Flow!");
    const second = await runCli(directory, "start-feature", "--project", "checkout", "--title", "Retry Payment");

    assert.equal(first.exitCode, 0);
    assert.match(first.stdout, /^Created 001 \| parked \| spec$/m);
    assert.equal(second.exitCode, 0);
    assert.match(second.stdout, /^Created 002 \| parked \| spec$/m);

    const status = await runCli(directory, "status");
    assert.match(status.stdout, /001 \| checkout \| spec \| refund-flow/);
    assert.match(status.stdout, /002 \| checkout \| spec \| retry-payment/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function runCli(cwd: string, ...args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: { ...process.env, MINNA_REGISTRY_HOME: join(cwd, ".registry-home") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("exit", exitCode => resolve({ exitCode, stdout, stderr }));
  });
}
