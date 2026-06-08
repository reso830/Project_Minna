import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parse } from "yaml";
import type { EmbeddedProjectConfig, ProjectContext, ProjectsConfig } from "./types.js";

const CENTRAL_PROJECTS_FILE = "projects.yaml";
const EMBEDDED_PROJECT_FILE = "minna.project.yaml";

export interface ResolveProjectContextOptions {
  cwd?: string;
  projectKey?: string;
}

export async function resolveProjectContext(
  options: ResolveProjectContextOptions = {}
): Promise<ProjectContext> {
  const cwd = options.cwd ?? process.cwd();

  if (options.projectKey) {
    return resolveCentralProject(cwd, options.projectKey);
  }

  if (await fileExists(resolve(cwd, EMBEDDED_PROJECT_FILE))) {
    return resolveEmbeddedProject(cwd);
  }

  throw new Error(
    `No project selected. Pass --project <key> or add ${EMBEDDED_PROJECT_FILE} to the target project.`
  );
}

async function resolveCentralProject(cwd: string, key: string): Promise<ProjectContext> {
  const configPath = resolve(cwd, CENTRAL_PROJECTS_FILE);
  const config = parse(await readFile(configPath, "utf8")) as ProjectsConfig;
  const project = config.projects[key];

  if (!project) {
    throw new Error(`Unknown project: ${key}`);
  }

  return {
    key,
    mode: "central",
    project
  };
}

async function resolveEmbeddedProject(cwd: string): Promise<ProjectContext> {
  const configPath = resolve(cwd, EMBEDDED_PROJECT_FILE);
  const config = parse(await readFile(configPath, "utf8")) as EmbeddedProjectConfig;
  const { key, ...project } = config.project;

  return {
    key,
    mode: "embedded",
    project: {
      ...project,
      path: isAbsolute(project.path) ? project.path : resolve(cwd, project.path)
    }
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
