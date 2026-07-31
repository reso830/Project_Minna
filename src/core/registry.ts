import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parse } from "yaml";
import { initDb } from "./db.js";
import type { EventEnvelope, ProjectRegistry, ProjectRegistryEntry } from "./types.js";

export interface ProjectRegistryPaths {
  databasePath: string;
  exportPath: string;
}

export interface PreparedProject {
  initialized: boolean;
}

export function getProjectRegistryPaths(homeDirectory = process.env.MINNA_REGISTRY_HOME ?? homedir()): ProjectRegistryPaths {
  const registryDirectory = join(homeDirectory, ".minna");
  return {
    databasePath: join(registryDirectory, "projects.db"),
    exportPath: join(registryDirectory, "projects.json"),
  };
}

function openRegistryDatabase(databasePath: string): DatabaseSync {
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA journal_mode = WAL;");
  return database;
}

function readProjects(database: DatabaseSync): ProjectRegistry {
  const rows = database.prepare(
    "SELECT id, name, path, last_opened_at FROM projects ORDER BY last_opened_at DESC, id ASC",
  ).all() as unknown as ProjectRegistryEntry[];

  return rows.map(project => ({
    id: project.id,
    name: project.name,
    path: project.path,
    last_opened_at: project.last_opened_at,
  }));
}

async function exportProjects(paths: ProjectRegistryPaths, projects: ProjectRegistry): Promise<void> {
  await writeJsonAtomically(paths.exportPath, projects);
}

function registryEventsExportPath(paths: ProjectRegistryPaths): string {
  return join(dirname(paths.exportPath), "registry-events.json");
}

function readRegistryEvents(database: DatabaseSync): EventEnvelope[] {
  const rows = database.prepare(
    "SELECT id, timestamp, actor, type, payload FROM events ORDER BY id ASC",
  ).all() as Array<{ id: number; timestamp: string; actor: string; type: string; payload: string }>;

  return rows.map(event => ({ ...event, payload: JSON.parse(event.payload) }));
}

async function exportRegistryEvents(paths: ProjectRegistryPaths, events: EventEnvelope[]): Promise<void> {
  await writeJsonAtomically(registryEventsExportPath(paths), events);
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function mutateRegistry(
  paths: ProjectRegistryPaths,
  mutation: (database: DatabaseSync) => void,
): Promise<ProjectRegistry> {
  const database = openRegistryDatabase(paths.databasePath);

  try {
    database.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      mutation(database);
      database.exec("COMMIT TRANSACTION");
    } catch (error) {
      database.exec("ROLLBACK TRANSACTION");
      throw error;
    }

    database.exec("BEGIN IMMEDIATE TRANSACTION");
    let projects: ProjectRegistry;
    try {
      projects = readProjects(database);
      await exportProjects(paths, projects);
      await exportRegistryEvents(paths, readRegistryEvents(database));
      database.exec("COMMIT TRANSACTION");
    } catch (error) {
      database.exec("ROLLBACK TRANSACTION");
      throw error;
    }
    return projects;
  } finally {
    database.close();
  }
}

export async function initializeProjectRegistry(
  paths = getProjectRegistryPaths(),
): Promise<void> {
  await mkdir(dirname(paths.databasePath), { recursive: true });

  const database = openRegistryDatabase(paths.databasePath);
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT UNIQUE NOT NULL,
        last_opened_at TEXT NOT NULL
      );

      CREATE TRIGGER IF NOT EXISTS prevent_registry_event_update
      BEFORE UPDATE ON events
      BEGIN
        SELECT RAISE(ROLLBACK, 'Updates are not allowed on the append-only registry events table.');
      END;

      CREATE TRIGGER IF NOT EXISTS prevent_registry_event_delete
      BEFORE DELETE ON events
      BEGIN
        SELECT RAISE(ROLLBACK, 'Deletions are not allowed on the append-only registry events table.');
      END;
    `);
  } finally {
    database.close();
  }
}

export async function listRegisteredProjects(
  paths = getProjectRegistryPaths(),
): Promise<ProjectRegistry> {
  await initializeProjectRegistry(paths);
  const database = openRegistryDatabase(paths.databasePath);
  try {
    const projects = readProjects(database);
    return Promise.all(projects.map(async project => ({
      ...project,
      available: (await verifyProjectHealth(project.path)).available,
    })));
  } finally {
    database.close();
  }
}

export async function updateProject(
  id: string,
  name: string,
  path: string,
  paths: ProjectRegistryPaths = getProjectRegistryPaths(),
  actor = "system",
): Promise<ProjectRegistryEntry> {
  await initializeProjectRegistry(paths);
  let updatedProject: ProjectRegistryEntry | undefined;

  await mutateRegistry(paths, database => {
    const existing = database.prepare(
      "SELECT id, name, path, last_opened_at FROM projects WHERE id = ?",
    ).get(id) as ProjectRegistryEntry | undefined;
    if (!existing) {
      throw new Error(`Project '${id}' is not registered.`);
    }

    const matchingPath = database.prepare(
      "SELECT id, name, path, last_opened_at FROM projects WHERE path = ?",
    ).get(path) as ProjectRegistryEntry | undefined;
    if (matchingPath && matchingPath.id !== id) {
      throw new Error(`This directory is already registered as project '${matchingPath.name}'.`);
    }

    updatedProject = { ...existing, name, path };
    const timestamp = new Date().toISOString();
    if (name !== existing.name) {
      database.prepare(
        "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
      ).run(timestamp, actor, "project.renamed", JSON.stringify({ id, name, path }));
    }
    if (path !== existing.path) {
      database.prepare(
        "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
      ).run(timestamp, actor, "project.relocated", JSON.stringify({ id, name, path }));
    }
    if (name !== existing.name || path !== existing.path) {
      database.prepare("UPDATE projects SET name = ?, path = ? WHERE id = ?").run(name, path, id);
    }
  });

  return updatedProject as ProjectRegistryEntry;
}

export async function removeProject(
  id: string,
  paths: ProjectRegistryPaths = getProjectRegistryPaths(),
  actor = "system",
): Promise<void> {
  await initializeProjectRegistry(paths);

  await mutateRegistry(paths, database => {
    const project = database.prepare(
      "SELECT id FROM projects WHERE id = ?",
    ).get(id) as { id: string } | undefined;
    if (!project) {
      throw new Error(`Project '${id}' is not registered.`);
    }
    database.prepare(
      "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
    ).run(new Date().toISOString(), actor, "project.removed", JSON.stringify({ id }));
    database.prepare("DELETE FROM projects WHERE id = ?").run(id);
  });
}

export async function registerProject(
  project: ProjectRegistryEntry,
  paths: ProjectRegistryPaths = getProjectRegistryPaths(),
  actor = "system",
): Promise<ProjectRegistryEntry> {
  await initializeProjectRegistry(paths);
  let recordedProject = project;

  await mutateRegistry(paths, database => {
    const existing = database.prepare(
      "SELECT id, name, path, last_opened_at FROM projects WHERE path = ?",
    ).get(project.path) as ProjectRegistryEntry | undefined;
    if (existing) {
      database.prepare(
        "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
      ).run(project.last_opened_at, actor, "project.opened", JSON.stringify({
        id: existing.id,
        name: existing.name,
        path: existing.path,
      }));
      database.prepare("UPDATE projects SET last_opened_at = ? WHERE path = ?").run(project.last_opened_at, project.path);
      recordedProject = { ...existing, last_opened_at: project.last_opened_at };
      return;
    }

    const baseId = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || project.id || "project";
    let id = baseId;
    let suffix = 2;
    while (database.prepare("SELECT 1 FROM projects WHERE id = ?").get(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    recordedProject = { ...project, id };
    database.prepare(
      "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
    ).run(project.last_opened_at, actor, "project.registered", JSON.stringify({
      id: recordedProject.id,
      name: recordedProject.name,
      path: recordedProject.path,
    }));
    database.prepare("INSERT INTO projects (id, name, path, last_opened_at) VALUES (?, ?, ?, ?)")
      .run(recordedProject.id, project.name, project.path, project.last_opened_at);
  });

  return recordedProject;
}

export async function openRegisteredProject(
  id: string,
  paths: ProjectRegistryPaths = getProjectRegistryPaths(),
  timestamp = new Date().toISOString(),
  actor = "system",
): Promise<ProjectRegistryEntry> {
  await initializeProjectRegistry(paths);
  let openedProject: ProjectRegistryEntry | undefined;

  await mutateRegistry(paths, database => {
    const project = database.prepare(
      "SELECT id, name, path, last_opened_at FROM projects WHERE id = ?",
    ).get(id) as ProjectRegistryEntry | undefined;

    if (!project) {
      throw new Error(`Project '${id}' is not registered.`);
    }

    database.prepare(
      "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
    ).run(timestamp, actor, "project.opened", JSON.stringify({
      id: project.id,
      name: project.name,
      path: project.path,
    }));
    database.prepare("UPDATE projects SET last_opened_at = ? WHERE id = ?").run(timestamp, id);
    openedProject = { ...project, last_opened_at: timestamp };
  });

  return openedProject as ProjectRegistryEntry;
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validateConfig(config: unknown): void {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Project config.yaml must contain a mapping.");
  }

  const record = config as Record<string, unknown>;
  if (!Number.isInteger(record.version)) {
    throw new Error("Project config.yaml requires an integer version.");
  }
  if (typeof record.created_at !== "string" || !isIsoTimestamp(record.created_at)) {
    throw new Error("Project config.yaml created_at must be an ISO 8601 timestamp.");
  }
}

export async function verifyProjectHealth(projectPath: string): Promise<{ available: boolean; error?: string }> {
  try {
    if (!(await stat(projectPath)).isDirectory()) {
      return { available: false, error: `Project path '${projectPath}' is not a directory.` };
    }
    const configPath = join(projectPath, ".minna", "config.yaml");
    validateConfig(parse(await readFile(configPath, "utf8")));
    return { available: true };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function freshConfig(): string {
  return `version: 1\ncreated_at: ${new Date().toISOString()}\ndescription: null\n`;
}

export async function prepareProject(projectPath: string, projectKey = basename(projectPath).toLowerCase()): Promise<PreparedProject> {
  const minnaDirectory = join(projectPath, ".minna");
  const configPath = join(minnaDirectory, "config.yaml");
  const databasePath = join(minnaDirectory, "minna.db");

  try {
    const minnaStats = await stat(minnaDirectory);
    if (!minnaStats.isDirectory()) {
      throw new Error("Project .minna path must be a directory.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await mkdir(minnaDirectory, { recursive: true });
    await writeFile(configPath, freshConfig(), "utf8");
    await initDb(databasePath, projectKey);
    return { initialized: true };
  }

  let configContents: string;
  try {
    configContents = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Project rejection: Missing config.yaml in existing .minna directory.");
    }
    throw error;
  }

  try {
    validateConfig(parse(configContents));
  } catch (error) {
    throw new Error(`Project config.yaml is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await access(databasePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await initDb(databasePath, projectKey);
  }

  return { initialized: false };
}
