import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { prepareProject, registerProject, verifyProjectHealth, type ProjectRegistryPaths } from "./registry.js";
import type { ProjectContext } from "./types.js";

const CONFIG_DIRECTORY = ".minna";
const CONFIG_FILE = "config.yaml";
const LEGACY_PROJECT_FILE = "minna.project.yaml";

export interface ResolveProjectContextOptions {
  cwd?: string;
}

interface LocalProjectConfig {
  version: number;
  created_at: string;
  description: string | null;
  speckit_dir?: string;
  github?: string | null;
  default_branch?: string;
}

interface LegacyProjectConfig {
  project?: {
    speckit_dir?: string;
    github?: string | null;
    default_branch?: string;
  };
}

export async function resolveProjectContext(
  options: ResolveProjectContextOptions = {},
): Promise<ProjectContext> {
  let directory = resolve(options.cwd ?? process.cwd());

  while (true) {
    const configPath = join(directory, CONFIG_DIRECTORY, CONFIG_FILE);
    if (await fileExists(configPath)) {
      const health = await verifyProjectHealth(directory);
      if (!health.available) {
        throw new Error(`Project directory is unavailable: ${health.error}`);
      }
      return contextFromConfig(directory, parse(await readFile(configPath, "utf8")));
    }

    const legacyPath = join(directory, LEGACY_PROJECT_FILE);
    if (await fileExists(legacyPath)) {
      return migrateLegacyProject(directory, legacyPath);
    }

    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  throw new Error("No project selected. Run this command inside a project with .minna/config.yaml.");
}

export async function syncProjectContext(
  context: ProjectContext,
  paths?: ProjectRegistryPaths,
): Promise<void> {
  const health = await verifyProjectHealth(context.project.path);
  if (!health.available) {
    throw new Error(`Project directory is unavailable: ${health.error}`);
  }
  await prepareProject(context.project.path, context.key);
  await registerProject({
    id: context.key,
    name: context.project.name,
    path: context.project.path,
    last_opened_at: new Date().toISOString(),
  }, paths);
}

async function migrateLegacyProject(projectRoot: string, legacyPath: string): Promise<ProjectContext> {
  const legacyConfig = parse(await readFile(legacyPath, "utf8")) as LegacyProjectConfig;
  const createdAt = (await stat(legacyPath)).birthtime.toISOString();
  const legacyProject = legacyConfig.project ?? {};
  const config: LocalProjectConfig = {
    version: 1,
    created_at: createdAt,
    description: null,
    speckit_dir: legacyProject.speckit_dir ?? ".specify",
    github: legacyProject.github ?? null,
    default_branch: legacyProject.default_branch ?? "main",
  };
  const configDirectory = join(projectRoot, CONFIG_DIRECTORY);
  await mkdir(configDirectory, { recursive: true });
  await writeFile(join(configDirectory, CONFIG_FILE), stringify(config), "utf8");
  await rm(legacyPath);
  return contextFromConfig(projectRoot, config);
}

function contextFromConfig(projectRoot: string, config: unknown): ProjectContext {
  validateConfig(config);
  const localConfig = config as LocalProjectConfig;
  const key = basename(projectRoot);
  return {
    key,
    mode: "embedded",
    project: {
      name: key,
      path: projectRoot,
      speckit_dir: localConfig.speckit_dir ?? ".specify",
      github: localConfig.github ?? undefined,
      default_branch: localConfig.default_branch ?? "main",
    },
  };
}

function validateConfig(config: unknown): asserts config is LocalProjectConfig {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Project config.yaml must contain a mapping.");
  }
  const value = config as Record<string, unknown>;
  if (!Number.isInteger(value.version)) {
    throw new Error("Project config.yaml requires an integer version.");
  }
  if (typeof value.created_at !== "string" || Number.isNaN(Date.parse(value.created_at))) {
    throw new Error("Project config.yaml created_at must be an ISO 8601 timestamp.");
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
