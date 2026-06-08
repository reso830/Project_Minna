import { loadWorkflow } from "./core/config.js";
import { resolveProjectContext } from "./core/project-context.js";
import { listFeatures, recordDecision, recordManualTest, startFeature } from "./core/state.js";
import { getNextAction } from "./core/workflow.js";

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (command) {
    case "status":
      await status();
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
      await import("./server/mcp.js");
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
  const project = getFlag(args, "--project");
  const title = getFlag(args, "--title");

  if (!title) {
    throw new Error("Usage: start-feature [--project <key>] --title <title>");
  }

  const context = await resolveProjectContext({ projectKey: project });

  const feature = await startFeature(context.key, title);
  console.log(JSON.stringify(feature, null, 2));
}

async function recordDecisionCommand(args: string[]): Promise<void> {
  const feature = getFlag(args, "--feature");
  const question = getFlag(args, "--question");
  const answer = getFlag(args, "--answer");

  if (!feature || !question || !answer) {
    throw new Error("Usage: record-decision --feature <id> --question <question> --answer <answer>");
  }

  console.log(JSON.stringify(await recordDecision(feature, question, answer), null, 2));
}

async function recordManualTestCommand(args: string[]): Promise<void> {
  const feature = getFlag(args, "--feature");
  const passed = getFlag(args, "--passed");
  const notes = getFlag(args, "--notes") ?? "";

  if (!feature || !passed) {
    throw new Error("Usage: record-manual-test --feature <id> --passed <true|false> --notes <notes>");
  }

  console.log(JSON.stringify(await recordManualTest(feature, passed === "true", notes), null, 2));
}

function getFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp(): void {
  console.log(`Project_Minna

Commands:
  status
  start-feature [--project <key>] --title <title>
  record-decision --feature <id> --question <question> --answer <answer>
  record-manual-test --feature <id> --passed <true|false> --notes <notes>
  serve-mcp`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
