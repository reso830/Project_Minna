import type { DatabaseSync } from "node:sqlite";
import { initDb, openDb } from "../core/db.js";
import { readWorkItems } from "../core/work-items.js";

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> = {},
  db?: DatabaseSync,
): Promise<unknown> {
  switch (name) {
    case "status":
      return db ? readWorkItems(db) : withDefaultDb(readWorkItems);
    case "start_feature":
    case "record_decision":
    case "record_manual_test":
      throw new Error("Tool disabled in M1.");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function withDefaultDb<T>(action: (db: DatabaseSync) => Promise<T>): Promise<T> {
  await initDb();
  const db = openDb();
  try {
    return await action(db);
  } finally {
    db.close();
  }
}
