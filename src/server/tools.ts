import { resolveProjectContext } from "../core/project-context.js";
import { listFeatures, recordDecision, recordManualTest, startFeature } from "../core/state.js";

export async function handleToolCall(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  switch (name) {
    case "status":
      return listFeatures();
    case "start_feature": {
      const context = await resolveProjectContext({ projectKey: String(args.project) });
      return startFeature(context.key, String(args.title));
    }
    case "record_decision":
      return recordDecision(String(args.featureId), String(args.question), String(args.answer));
    case "record_manual_test":
      return recordManualTest(
        String(args.featureId),
        Boolean(args.passed),
        String(args.notes ?? "")
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
