import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { ProjectsConfig } from "./types.js";

export async function loadProjects(path = "projects.yaml"): Promise<ProjectsConfig> {
  const text = await readFile(path, "utf8");
  return parse(text) as ProjectsConfig;
}
