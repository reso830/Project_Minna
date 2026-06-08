import { join } from "node:path";
import type { ProjectConfig, PhaseId } from "./types.js";

export function getSpeckitPhasePath(project: ProjectConfig, featureId: string, phase: PhaseId): string {
  return join(project.path, project.speckit_dir, "features", featureId, `${phase}.md`);
}
