import type { FeatureState, WorkflowConfig, WorkflowPhase } from "./types.js";

export function getCurrentPhase(workflow: WorkflowConfig, feature: FeatureState): WorkflowPhase {
  const phase = workflow.phases.find(candidate => candidate.id === feature.phase);

  if (!phase) {
    throw new Error(`Workflow phase not found: ${feature.phase}`);
  }

  return phase;
}

export function getNextAction(workflow: WorkflowConfig, feature: FeatureState): string {
  const phase = getCurrentPhase(workflow, feature);

  if (phase.id === "done") {
    return "Feature cycle is complete.";
  }

  if (phase.gate) {
    return `${phase.owner} owns ${phase.id}; gate ${phase.gate} must be satisfied before moving to ${phase.next}.`;
  }

  return `${phase.owner} owns ${phase.id}; next phase is ${phase.next}.`;
}
