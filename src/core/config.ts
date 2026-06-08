import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { ProjectsConfig, WorkflowConfig } from "./types.js";

export async function loadProjects(path = "projects.yaml"): Promise<ProjectsConfig> {
  const text = await readFile(path, "utf8");
  return parse(text) as ProjectsConfig;
}

export async function loadWorkflow(path = "workflows/speckit-feature.yaml"): Promise<WorkflowConfig> {
  const text = await readFile(path, "utf8");
  return parse(text) as WorkflowConfig;
}
