export type Actor = "human" | "system" | (string & {});

export interface EventEnvelope<TPayload = unknown> {
  id?: number;
  timestamp: string;
  actor: Actor;
  type: string;
  payload: TPayload;
}

export interface FeatureProjection {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

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

export type WorkItemState = "parked" | "active" | "blocked" | "closed";

export type Phase =
  | "spec"
  | "plan"
  | "tasks"
  | "requirements-review"
  | "implement"
  | "review"
  | "integrate";

export type PhaseGroup = "define" | "create" | "integrate";

export type WorkItemType = "feature" | "issue";

export type BlockedReason =
  | "clarification-required"
  | "approval-required"
  | "external-dependency"
  | "ci-pending"
  | "failed";

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  state: WorkItemState;
  phase: Phase;
  phase_group: PhaseGroup;
  work_item_type: WorkItemType;
  blocked_reason: BlockedReason | null;
  assignee: string | null;
  project: string;
  branch: string | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkItemActor = "human" | "minna" | "claude" | "codex" | "agy";

export type ExecutionEventType =
  | "execution.started"
  | "execution.finished"
  | "process.launched"
  | "process.exited"
  | "manifest.received"
  | "review.requested"
  | "gate.passed"
  | "gate.blocked"
  | "git.branch_created"
  | "git.pr_opened"
  | "git.merged";

export type AgentMessageEventType =
  | "agent.question"
  | "agent.note"
  | "agent.finding"
  | "agent.summary";

export type LifecycleEventType =
  | "work_item.created"
  | "work_item.state_changed"
  | "human.decided"
  | "human.manual_test_recorded";

export type WorkItemEventType = ExecutionEventType | AgentMessageEventType | LifecycleEventType;

export interface WorkItemEvent {
  id?: number;
  work_item_id: string;
  timestamp: string;
  actor: WorkItemActor;
  type: WorkItemEventType;
  summary: string;
  artifact_path: string | null;
  payload: unknown;
}
