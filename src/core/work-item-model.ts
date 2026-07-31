import type {
  AgentMessageEventType,
  BlockedReason,
  ExecutionEventType,
  LifecycleEventType,
  Phase,
  PhaseGroup,
  WorkItemEventType,
  WorkItemType,
} from "./types.js";

const PHASE_GROUP_BY_PHASE: Record<Phase, PhaseGroup> = {
  spec: "define",
  plan: "define",
  tasks: "define",
  "spec-review": "define",
  implement: "create",
  review: "create",
  integrate: "integrate",
};

export function derivePhaseGroup(phase: Phase): PhaseGroup {
  return PHASE_GROUP_BY_PHASE[phase];
}

export const FEATURE_PHASE_SEQUENCE: Phase[] = [
  "spec",
  "plan",
  "tasks",
  "spec-review",
  "implement",
  "review",
  "integrate",
];

export const ISSUE_PHASE_SEQUENCE: Phase[] = ["implement", "review", "integrate"];

export function getPhaseSequence(type: WorkItemType): Phase[] {
  return type === "feature" ? FEATURE_PHASE_SEQUENCE : ISSUE_PHASE_SEQUENCE;
}

export type BlockedHolder = "human" | "none" | "system";

export interface BlockedPresentation {
  label: string;
  holder: BlockedHolder;
  alarm?: true;
}

const BLOCKED_REASON_PRESENTATION: Record<BlockedReason, BlockedPresentation> = {
  "clarification-required": { label: "Needs You", holder: "human" },
  "approval-required": { label: "Needs You", holder: "human" },
  "external-dependency": { label: "Blocked (external)", holder: "none" },
  "ci-pending": { label: "Blocked (CI)", holder: "system" },
  failed: { label: "Needs You", holder: "human", alarm: true },
};

export function deriveBlockedPresentation(reason: BlockedReason): BlockedPresentation {
  return BLOCKED_REASON_PRESENTATION[reason];
}

const EXECUTION_EVENT_TYPES = new Set<ExecutionEventType>([
  "execution.started",
  "execution.finished",
  "process.launched",
  "process.exited",
  "manifest.received",
  "review.requested",
  "gate.passed",
  "gate.blocked",
  "git.branch_created",
  "git.pr_opened",
  "git.merged",
]);

const AGENT_MESSAGE_EVENT_TYPES = new Set<AgentMessageEventType>([
  "agent.question",
  "agent.note",
  "agent.finding",
  "agent.summary",
]);

const LIFECYCLE_EVENT_TYPES = new Set<LifecycleEventType>([
  "work_item.created",
  "work_item.state_changed",
  "human.decided",
  "human.manual_test_recorded",
]);

const ALL_WORK_ITEM_EVENT_TYPES = new Set<string>([
  ...EXECUTION_EVENT_TYPES,
  ...AGENT_MESSAGE_EVENT_TYPES,
  ...LIFECYCLE_EVENT_TYPES,
]);

export function isWorkItemEventType(type: string): type is WorkItemEventType {
  return ALL_WORK_ITEM_EVENT_TYPES.has(type);
}

export type EventFamily = "execution" | "agent_message" | "lifecycle";

export function classifyEventFamily(type: WorkItemEventType): EventFamily {
  if (EXECUTION_EVENT_TYPES.has(type as ExecutionEventType)) return "execution";
  if (AGENT_MESSAGE_EVENT_TYPES.has(type as AgentMessageEventType)) return "agent_message";
  if (LIFECYCLE_EVENT_TYPES.has(type as LifecycleEventType)) return "lifecycle";
  throw new Error(`Unknown work item event type '${type}'.`);
}
