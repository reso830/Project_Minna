import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { exportFeatureJournal, initDb, openDb, readEvents, verifyDb } from "./core/db.js";
import { deriveBlockedPresentation } from "./core/work-item-model.js";
import { appendWorkItemEvent, createWorkItem, readWorkItemEvents, readWorkItems } from "./core/work-items.js";
import { resolveProjectContext, syncProjectContext } from "./core/project-context.js";
import type { ProjectContext, WorkItemType } from "./core/types.js";

const [command, ...args] = process.argv.slice(2);
let journalDatabasePath: string | undefined;
let embeddedProjectContext: ProjectContext | undefined;

async function main(): Promise<void> {
  await synchronizeProjectContext(args);
  await initDb(journalDatabasePath);

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

async function synchronizeProjectContext(commandArgs: string[]): Promise<void> {
  if (getFlag(commandArgs, "--project")) {
    return;
  }

  try {
    embeddedProjectContext = await resolveProjectContext();
    await syncProjectContext(embeddedProjectContext);
    journalDatabasePath = join(embeddedProjectContext.project.path, ".minna", "minna.db");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No project selected.")) {
      return;
    }
    throw error;
  }
}

async function status(): Promise<void> {
  await withJournal(async db => {
    const items = await readWorkItems(db);

    if (items.length === 0) {
      console.log("No work items.");
      return;
    }

    for (const item of items) {
      console.log(`${item.id} | ${item.project} | ${item.phase} | ${item.title}`);
      if (item.state === "blocked" && item.blocked_reason) {
        const presentation = deriveBlockedPresentation(item.blocked_reason);
        console.log(`  ${presentation.label} (holder: ${presentation.holder}${presentation.alarm ? ", alarm" : ""})`);
      } else {
        console.log(`  state: ${item.state}`);
      }
    }
  });
}

async function startFeatureCommand(args: string[]): Promise<void> {
  const projectFlag = getFlag(args, "--project");
  const title = getFlag(args, "--title");
  const description = getFlag(args, "--description") ?? "";
  const typeFlag = getFlag(args, "--type");

  if (!title) {
    throw new Error("Usage: start-feature [--project <key>] --title <title> [--type feature|issue] [--description <text>]");
  }
  if (typeFlag !== undefined && typeFlag !== "feature" && typeFlag !== "issue") {
    throw new Error("Usage: --type must be 'feature' or 'issue'");
  }
  const workItemType: WorkItemType = (typeFlag as WorkItemType | undefined) ?? "feature";

  // In embedded mode (a local .minna/config.yaml in cwd or a parent), --project can be omitted, matching the
  // documented project-resolution behavior; an explicit --project is used verbatim without
  // central-registry validation (work_items.project is a free-text label, not a resolved key).
  const project = projectFlag ?? embeddedProjectContext?.key ?? (await resolveProjectContext()).key;

  await withJournal(async db => {
    const item = await createWorkItem(db, "human", {
      id: slugify(`${project}-${title}-${Date.now()}`),
      title,
      description,
      work_item_type: workItemType,
      project,
    });
    console.log(`Created ${item.id} | ${item.state} | ${item.phase}`);
  });
}

async function recordDecisionCommand(args: string[]): Promise<void> {
  const featureId = getFlag(args, "--feature");
  const question = getFlag(args, "--question");
  const answer = getFlag(args, "--answer");

  if (!featureId || !question || !answer) {
    throw new Error("Usage: record-decision --feature <id> --question <question> --answer <answer>");
  }

  await withJournal(async db => {
    await assertWorkItemExists(db, featureId);
    await appendWorkItemEvent(db, {
      work_item_id: featureId,
      actor: "human",
      type: "human.decided",
      summary: `${question} -> ${answer}`,
      payload: { question, answer },
    });
    console.log(`Recorded decision on ${featureId}.`);
  });
}

async function recordManualTestCommand(args: string[]): Promise<void> {
  const featureId = getFlag(args, "--feature");
  const passedFlag = getFlag(args, "--passed");
  const notes = getFlag(args, "--notes") ?? "";

  if (!featureId || (passedFlag !== "true" && passedFlag !== "false")) {
    throw new Error("Usage: record-manual-test --feature <id> --passed <true|false> [--notes <text>]");
  }
  const passed = passedFlag === "true";

  await withJournal(async db => {
    await assertWorkItemExists(db, featureId);
    await appendWorkItemEvent(db, {
      work_item_id: featureId,
      actor: "human",
      type: "human.manual_test_recorded",
      summary: `Manual test ${passed ? "passed" : "failed"}${notes ? `: ${notes}` : ""}`,
      payload: { passed, notes },
    });
    console.log(`Recorded manual test result on ${featureId}.`);
  });
}

async function assertWorkItemExists(db: DatabaseSync, id: string): Promise<void> {
  const items = await readWorkItems(db);
  if (!items.some(item => item.id === id)) {
    throw new Error(`Error: No such work item '${id}'`);
  }
}

async function logCommand(args: string[]): Promise<void> {
  const featureId = getFlag(args, "--feature");
  if (args.includes("--feature") && !featureId) {
    throw new Error("Usage: log [--feature <id>]");
  }

  await withJournal(async db => {
    if (featureId && (await readWorkItems(db)).some(item => item.id === featureId)) {
      const events = await readWorkItemEvents(db, featureId);
      for (const event of events) {
        console.log(`[${event.timestamp}] [${event.actor}] [${event.type}] - ${event.summary}`);
      }
      return;
    }

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
      console.log(`Verification successful: No drift detected (${result.featureCount} features, ${result.workItemCount} work items, ${result.eventCount} events).`);
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
    const isWorkItem = (await readWorkItems(db)).some(item => item.id === featureId);
    const markdown = isWorkItem
      ? await exportWorkItemJournal(db, featureId)
      : await exportFeatureJournal(db, featureId);
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, "journal.md"), markdown, "utf8");
  });
}

async function exportWorkItemJournal(db: DatabaseSync, id: string): Promise<string> {
  const item = (await readWorkItems(db)).find(candidate => candidate.id === id);
  if (!item) {
    throw new Error(`Error: No such work item '${id}'`);
  }

  const events = await readWorkItemEvents(db, id);
  const rows = events.map(event => (
    `| ${escapeMarkdown(event.timestamp)} | ${escapeMarkdown(event.actor)} | \`${escapeMarkdown(event.type)}\` | ${escapeMarkdown(event.summary)} |`
  ));

  return [
    `# Work Item Journal: ${item.title}`,
    "",
    `* **Work Item ID**: \`${id}\``,
    `* **State**: \`${item.state}\` | **Phase**: \`${item.phase}\``,
    "",
    "| Timestamp (UTC) | Actor | Event Type | Summary |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

async function withJournal<T>(action: (db: DatabaseSync) => Promise<T>): Promise<T> {
  const db = openDb(journalDatabasePath);
  try {
    return await action(db);
  } finally {
    db.close();
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  start-feature [--project <key>] --title <title> [--type feature|issue] [--description <text>]
  record-decision --feature <id> --question <question> --answer <answer>
  record-manual-test --feature <id> --passed <true|false> [--notes <text>]
  serve-mcp`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
