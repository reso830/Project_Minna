import type { DatabaseSync } from "node:sqlite";
import type {
  BlockedReason,
  Phase,
  WorkItem,
  WorkItemActor,
  WorkItemEvent,
  WorkItemEventType,
  WorkItemState,
  WorkItemType,
} from "./types.js";
import { derivePhaseGroup, getPhaseSequence } from "./work-item-model.js";

export interface CreateWorkItemInput {
  id: string;
  title: string;
  description: string;
  work_item_type: WorkItemType;
  project: string;
  state?: WorkItemState;
  phase?: Phase;
  blocked_reason?: BlockedReason | null;
  assignee?: string | null;
  branch?: string | null;
  pr_url?: string | null;
}

export interface AppendWorkItemEventInput {
  work_item_id: string;
  actor: WorkItemActor;
  type: WorkItemEventType;
  summary: string;
  artifact_path?: string | null;
  payload?: unknown;
}

export interface UpdateWorkItemStateInput {
  state: WorkItemState;
  phase?: Phase;
  blocked_reason?: BlockedReason | null;
}

function assertBlockedReasonConsistency(state: WorkItemState, blockedReason: BlockedReason | null | undefined): void {
  if (state === "blocked" && !blockedReason) {
    throw new Error("blocked_reason is required when state is 'blocked'.");
  }
  if (state !== "blocked" && blockedReason) {
    throw new Error(`blocked_reason must be null unless state is 'blocked' (got state '${state}').`);
  }
}

function assertPhaseBelongsToType(type: WorkItemType, phase: Phase): void {
  const sequence = getPhaseSequence(type);
  if (!sequence.includes(phase)) {
    throw new Error(`phase '${phase}' is not valid for work_item_type '${type}' (expected one of: ${sequence.join(", ")}).`);
  }
}

interface WorkItemRow {
  id: string;
  title: string;
  description: string;
  state: WorkItemState;
  phase: Phase;
  work_item_type: WorkItemType;
  blocked_reason: BlockedReason | null;
  assignee: string | null;
  project: string;
  branch: string | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string;
}

function toWorkItem(row: WorkItemRow): WorkItem {
  return { ...row, phase_group: derivePhaseGroup(row.phase) };
}

function readWorkItemRow(db: DatabaseSync, id: string): WorkItem {
  const row = db.prepare(
    `SELECT id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at
     FROM work_items WHERE id = ?`,
  ).get(id) as WorkItemRow | undefined;

  if (!row) {
    throw new Error(`Work item '${id}' was not found after journal write.`);
  }
  return toWorkItem(row);
}

export async function createWorkItem(db: DatabaseSync, actor: WorkItemActor, input: CreateWorkItemInput): Promise<WorkItem> {
  const state = input.state ?? "parked";
  const phase = input.phase ?? getPhaseSequence(input.work_item_type)[0];
  const blockedReason = input.blocked_reason ?? null;

  assertPhaseBelongsToType(input.work_item_type, phase);
  assertBlockedReasonConsistency(state, blockedReason);

  const timestamp = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    const existing = db.prepare("SELECT 1 FROM work_items WHERE id = ?").get(input.id);
    if (existing) {
      throw new Error(`Work item '${input.id}' already exists.`);
    }

    db.prepare(
      `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
       VALUES (?, ?, 'work_item.created', ?, ?, ?, NULL)`,
    ).run(timestamp, actor, JSON.stringify({ ...input, state, phase, blocked_reason: blockedReason }), input.id, `Created: ${input.title}`);

    db.prepare(
      `INSERT INTO work_items (id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.id, input.title, input.description, state, phase, input.work_item_type, blockedReason,
      input.assignee ?? null, input.project, input.branch ?? null, input.pr_url ?? null, timestamp, timestamp,
    );

    db.exec("COMMIT TRANSACTION");
  } catch (error) {
    try { db.exec("ROLLBACK TRANSACTION"); } catch { /* trigger may have already rolled back */ }
    throw error;
  }

  return readWorkItemRow(db, input.id);
}

export async function updateWorkItemState(
  db: DatabaseSync,
  actor: WorkItemActor,
  id: string,
  next: UpdateWorkItemStateInput,
): Promise<WorkItem> {
  const current = readWorkItemRow(db, id);
  const phase = next.phase ?? current.phase;
  const blockedReason = next.blocked_reason ?? null;

  assertPhaseBelongsToType(current.work_item_type, phase);
  assertBlockedReasonConsistency(next.state, blockedReason);

  const timestamp = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
       VALUES (?, ?, 'work_item.state_changed', ?, ?, ?, NULL)`,
    ).run(timestamp, actor, JSON.stringify({ state: next.state, phase, blocked_reason: blockedReason }), id, `State changed to '${next.state}'`);

    const result = db.prepare(
      `UPDATE work_items SET state = ?, phase = ?, blocked_reason = ?, updated_at = ? WHERE id = ?`,
    ).run(next.state, phase, blockedReason, timestamp, id);

    if (result.changes !== 1) {
      throw new Error(`Work item '${id}' was not found.`);
    }

    db.exec("COMMIT TRANSACTION");
  } catch (error) {
    try { db.exec("ROLLBACK TRANSACTION"); } catch { /* trigger may have already rolled back */ }
    throw error;
  }

  return readWorkItemRow(db, id);
}

export async function appendWorkItemEvent(
  db: DatabaseSync,
  input: AppendWorkItemEventInput,
): Promise<WorkItemEvent & { id: number }> {
  const timestamp = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    timestamp, input.actor, input.type, JSON.stringify(input.payload ?? {}),
    input.work_item_id, input.summary, input.artifact_path ?? null,
  );

  return {
    id: Number(result.lastInsertRowid),
    work_item_id: input.work_item_id,
    timestamp,
    actor: input.actor,
    type: input.type,
    summary: input.summary,
    artifact_path: input.artifact_path ?? null,
    payload: input.payload ?? {},
  };
}

export async function readWorkItems(db: DatabaseSync, filter?: { project?: string }): Promise<WorkItem[]> {
  const rows = (filter?.project === undefined
    ? db.prepare(
        `SELECT id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at
         FROM work_items ORDER BY created_at ASC`,
      ).all()
    : db.prepare(
        `SELECT id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at
         FROM work_items WHERE project = ? ORDER BY created_at ASC`,
      ).all(filter.project)) as unknown as WorkItemRow[];

  return rows.map(toWorkItem);
}

export async function readWorkItemEvents(db: DatabaseSync, workItemId: string): Promise<Array<WorkItemEvent & { id: number }>> {
  const rows = db.prepare(
    `SELECT id, timestamp, actor, type, summary, artifact_path, payload
     FROM events WHERE work_item_id = ? ORDER BY id ASC`,
  ).all(workItemId) as Array<{
    id: number; timestamp: string; actor: string; type: string;
    summary: string | null; artifact_path: string | null; payload: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    work_item_id: workItemId,
    timestamp: row.timestamp,
    actor: row.actor as WorkItemActor,
    type: row.type as WorkItemEventType,
    summary: row.summary ?? "",
    artifact_path: row.artifact_path,
    payload: JSON.parse(row.payload) as unknown,
  }));
}
