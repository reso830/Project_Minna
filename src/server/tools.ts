import { listFeatures } from "../core/state.js";

export async function handleToolCall(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  switch (name) {
    case "status":
      return listFeatures();
    case "start_feature":
    case "record_decision":
    case "record_manual_test":
      throw new Error("Tool disabled in M1.");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
