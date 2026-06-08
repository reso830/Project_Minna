export type AgentRole = "operator" | "claude" | "codex";

export type PhaseId =
  | "specify"
  | "clarify"
  | "plan"
  | "tasks"
  | "implement"
  | "review"
  | "manual_acceptance"
  | "done";

export interface ProjectConfig {
  name: string;
  path: string;
  github?: string;
  speckit_dir: string;
  default_branch?: string;
}

export interface ProjectsConfig {
  projects: Record<string, ProjectConfig>;
}

export interface EmbeddedProjectConfig {
  project: ProjectConfig & {
    key: string;
  };
}

export interface ProjectContext {
  key: string;
  mode: "central" | "embedded";
  project: ProjectConfig;
}

export interface WorkflowPhase {
  id: PhaseId;
  owner: AgentRole;
  description: string;
  gate?: string;
  next?: PhaseId;
}

export interface WorkflowConfig {
  name: string;
  version: string;
  phases: WorkflowPhase[];
}

export interface FeatureState {
  id: string;
  project: string;
  title: string;
  phase: PhaseId;
  createdAt: string;
  updatedAt: string;
  decisions: OperatorDecision[];
  manualTests: ManualTestResult[];
  github?: {
    issue?: string;
    pullRequest?: string;
    branch?: string;
  };
}

export interface OperatorDecision {
  id: string;
  question: string;
  answer: string;
  recordedAt: string;
}

export interface ManualTestResult {
  id: string;
  passed: boolean;
  notes: string;
  recordedAt: string;
}
