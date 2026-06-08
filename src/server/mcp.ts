import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { listFeatures, recordDecision, recordManualTest, startFeature } from "../core/state.js";

const server = new Server(
  {
    name: "project-minna",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "status",
      description: "List tracked orchestration features.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "start_feature",
      description: "Start a new feature cycle for a registered project.",
      inputSchema: {
        type: "object",
        required: ["project", "title"],
        properties: {
          project: { type: "string" },
          title: { type: "string" }
        }
      }
    },
    {
      name: "record_decision",
      description: "Record an operator clarification or approval decision.",
      inputSchema: {
        type: "object",
        required: ["featureId", "question", "answer"],
        properties: {
          featureId: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" }
        }
      }
    },
    {
      name: "record_manual_test",
      description: "Record an operator manual test result.",
      inputSchema: {
        type: "object",
        required: ["featureId", "passed", "notes"],
        properties: {
          featureId: { type: "string" },
          passed: { type: "boolean" },
          notes: { type: "string" }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const args = request.params.arguments ?? {};

  switch (request.params.name) {
    case "status":
      return textResult(await listFeatures());
    case "start_feature":
      return textResult(await startFeature(String(args.project), String(args.title)));
    case "record_decision":
      return textResult(
        await recordDecision(String(args.featureId), String(args.question), String(args.answer))
      );
    case "record_manual_test":
      return textResult(
        await recordManualTest(String(args.featureId), Boolean(args.passed), String(args.notes ?? ""))
      );
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
