import { loadWorkflow } from "./core/config.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { exportFeatureJournal, initDb, openDb, readEvents, verifyDb } from "./core/db.js";
import { listFeatures } from "./core/state.js";
import { getNextAction } from "./core/workflow.js";

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  await initDb();

  switch (command) {
    case "status":
      await status();
      return;
    case "log":
      await logCommand(args);
      return;
    case "verify":
      await verifyCommand();
      return;
    case "export":
      await exportCommand(args);
      return;
    case "start-feature":
      await startFeatureCommand(args);
      return;
    case "record-decision":
      await recordDecisionCommand(args);
      return;
    case "record-manual-test":
      await recordManualTestCommand(args);
      return;
    case "serve-mcp":
      await (await import("./server/mcp.js")).startMcpServer();
      return;
    default:
      printHelp();
  }
}

async function status(): Promise<void> {
  const workflow = await loadWorkflow();
  const features = await listFeatures();

  if (features.length === 0) {
    console.log("No active features.");
    return;
  }

  for (const feature of features) {
    console.log(`${feature.id} | ${feature.project} | ${feature.phase} | ${feature.title}`);
    console.log(`  ${getNextAction(workflow, feature)}`);
  }
}

async function startFeatureCommand(args: string[]): Promise<void> {
  void args;
  disableLegacyCommand();
}

async function recordDecisionCommand(args: string[]): Promise<void> {
  void args;
  disableLegacyCommand();
}

async function recordManualTestCommand(args: string[]): Promise<void> {
  void args;
  disableLegacyCommand();
}

async function logCommand(args: string[]): Promise<void> {
  const featureId = getFlag(args, "--feature");
  if (args.includes("--feature") && !featureId) {
    throw new Error("Usage: log [--feature <id>]");
  }

  await withJournal(async db => {
    const events = await readEvents(db, featureId ? { featureId } : undefined);
    if (featureId && !events.some(event => event.type === "feature.created")) {
      throw new Error(`Error: No such feature '${featureId}'`);
    }
    if (events.length === 0) {
      console.log("No events found in journal.");
      return;
    }
    for (const event of events) {
      console.log(`[${event.timestamp}] [${event.actor}] [${event.type}] - ${JSON.stringify(event.payload)}`);
    }
  });
}

async function verifyCommand(): Promise<void> {
  await withJournal(async db => {
    const result = await verifyDb(db);
    if (result.consistent) {
      console.log(`Verification successful: No drift detected (${result.featureCount} features, ${result.eventCount} events).`);
      return;
    }
    console.error(`Verification failed:\n${result.discrepancies.join("\n")}`);
    process.exitCode = 1;
  });
}

async function exportCommand(args: string[]): Promise<void> {
  const featureIndex = args.indexOf("--feature");
  const featureId = featureIndex === -1 ? undefined : args[featureIndex + 1];
  const remainingArgs = args.filter((_, index) => index !== featureIndex && index !== featureIndex + 1);
  const targetDirectory = remainingArgs.length === 1 && !remainingArgs[0].startsWith("--")
    ? remainingArgs[0]
    : undefined;

  if (!featureId || !targetDirectory) {
    throw new Error("Usage: export --feature <id> <dir>");
  }

  await withJournal(async db => {
    const markdown = await exportFeatureJournal(db, featureId);
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, "journal.md"), markdown, "utf8");
  });
}

async function withJournal<T>(action: (db: DatabaseSync) => Promise<T>): Promise<T> {
  const db = openDb();
  try {
    return await action(db);
  } finally {
    db.close();
  }
}

function disableLegacyCommand(): void {
  console.error("Error: Command disabled in M1. Event Journal write API is the sole state mutation path; integration is deferred to M2.");
  process.exitCode = 1;
}

function getFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp(): void {
  console.log(`Project_Minna

Commands:
  status
  log [--feature <id>]
  verify
  export --feature <id> <dir>
  start-feature [DISABLED in M1] [--project <key>] --title <title>
  record-decision [DISABLED in M1] --feature <id> --question <question> --answer <answer>
  record-manual-test [DISABLED in M1] --feature <id> --passed <true|false> --notes <notes>
  serve-mcp`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
