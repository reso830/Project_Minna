import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { handleToolCall } from "./tools.js";

export const advertisedTools = [
  {
    name: "status",
    description: "List tracked work items.",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  }
];

export async function startMcpServer(): Promise<void> {
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

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: advertisedTools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const args = request.params.arguments ?? {};
    return textResult(await handleToolCall(request.params.name, args));
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startMcpServer();
}
