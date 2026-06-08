import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { handleToolCall } from "./tools.js";

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
        required: ["featureId", "passed"],
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
  return textResult(await handleToolCall(request.params.name, args));
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
