import { initDb, openDb } from "../db.js";
import { SqliteEventsRepository, SqliteWorkItemsRepository } from "./sqlite.js";
import type { Repositories, RepositoriesConfig } from "./types.js";

export async function createRepositories(config: RepositoriesConfig): Promise<Repositories> {
  await initDb(config.dbPath, config.projectKey);
  const db = openDb(config.dbPath);

  return {
    workItems: new SqliteWorkItemsRepository(db, config.projectPath),
    events: new SqliteEventsRepository(db),
    close: () => db.close(),
  };
}
