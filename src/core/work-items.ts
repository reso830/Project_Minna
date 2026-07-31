import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type {
  BlockedReason,
  ClosedReason,
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
  id?: string;
  title: string;
  description: string;
  work_item_type: WorkItemType;
  project: string;
  project_path?: string;
  details_text?: string;
  state?: WorkItemState;
  phase?: Phase;
  blocked_reason?: BlockedReason | null;
  assignee?: string | null;
  branch?: string | null;
  pr_url?: string | null;
}

export interface UpdateWorkItemInput {
  description: string;
  project_path?: string;
  details_text?: string;
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
  closed_reason?: ClosedReason | null;
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
  closed_reason: WorkItem["closed_reason"];
  assignee: string | null;
  project: string;
  branch: string | null;
  pr_url: string | null;
  feature_brief_path: string | null;
  spec_path: string | null;
  plan_path: string | null;
  tasks_path: string | null;
  created_at: string;
  updated_at: string;
}

function toWorkItem(row: WorkItemRow): WorkItem {
  return { ...row, phase_group: derivePhaseGroup(row.phase) };
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function assertClosedReasonConsistency(state: WorkItemState, closedReason: ClosedReason | null | undefined): void {
  if (state === "closed" && !closedReason) {
    throw new Error("closed_reason is required when state is 'closed'.");
  }
  if (state !== "closed" && closedReason) {
    throw new Error(`closed_reason must be null unless state is 'closed' (got state '${state}').`);
  }
}

function assertDescription(description: string): void {
  if (description.length > 100) {
    throw new Error("Description cannot exceed 100 characters.");
  }
}

function assertTitleLength(title: string): void {
  if (title.length > 50) {
    throw new Error("Title cannot exceed 50 characters.");
  }
}

function nextWorkItemId(db: DatabaseSync): string {
  const row = db.prepare("SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM work_items").get() as { max_id: number | null };
  return String((row.max_id ?? 0) + 1).padStart(3, "0");
}

function briefPaths(projectPath: string, id: string, title: string) {
  const directory = join(projectPath, ".minna", "features");
  const basename = `${id}-${title}`;
  return {
    directory,
    temporary: join(directory, `.${basename}.tmp`),
    final: join(directory, `${basename}.md`),
    relative: `.minna/features/${basename}.md`,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function promoteBrief(temporary: string, final: string): Promise<void> {
  try {
    await rename(temporary, final);
  } catch {
    // The committed database row retains the final path; a later read retries this rename.
  }
}

async function recoverBrief(item: WorkItem, projectPath?: string): Promise<WorkItem> {
  if (!item.feature_brief_path || !projectPath) {
    return item;
  }
  const final = join(projectPath, item.feature_brief_path);
  const temporary = join(projectPath, ".minna", "features", `.${item.id}-${item.title}.tmp`);
  if (!(await exists(final)) && await exists(temporary)) {
    await promoteBrief(temporary, final);
  }
  return { ...item, feature_brief_missing: !(await exists(final)) };
}

async function readWorkItemRow(db: DatabaseSync, id: string, projectPath?: string): Promise<WorkItem> {
  const row = db.prepare(
    `SELECT id, title, description, state, phase, work_item_type, blocked_reason, closed_reason, assignee, project, branch, pr_url,
            feature_brief_path, spec_path, plan_path, tasks_path, created_at, updated_at
     FROM work_items WHERE id = ?`,
  ).get(id) as WorkItemRow | undefined;

  if (!row) {
    throw new Error(`Work item '${id}' was not found after journal write.`);
  }
  return recoverBrief(toWorkItem(row), projectPath);
}

export async function createWorkItem(db: DatabaseSync, actor: WorkItemActor, input: CreateWorkItemInput): Promise<WorkItem> {
  assertDescription(input.description);
  const title = slugify(input.title);
  assertTitleLength(title);
  if (!title) {
    throw new Error("Title is required.");
  }
  const state = input.state ?? "parked";
  const phase = input.phase ?? getPhaseSequence(input.work_item_type)[0];
  const blockedReason = input.blocked_reason ?? null;

  assertPhaseBelongsToType(input.work_item_type, phase);
  assertBlockedReasonConsistency(state, blockedReason);

  const id = input.id ?? nextWorkItemId(db);
  const paths = input.details_text === undefined || !input.project_path
    ? undefined
    : briefPaths(input.project_path, id, title);
  if (paths) {
    await mkdir(paths.directory, { recursive: true });
    await writeFile(paths.temporary, input.details_text!, "utf8");
  }

  const timestamp = new Date().toISOString();
  let committed = false;

  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const existing = db.prepare("SELECT 1 FROM work_items WHERE id = ?").get(id);
    if (existing) {
      throw new Error(`Work item '${id}' already exists.`);
    }

    db.prepare(
      `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
       VALUES (?, ?, 'work_item.created', ?, ?, ?, NULL)`,
    ).run(timestamp, actor, JSON.stringify({ id, title, description: input.description, work_item_type: input.work_item_type, project: input.project, state, phase, blocked_reason: blockedReason }), id, `Created: ${title}`);

    db.prepare(
      `INSERT INTO work_items (id, title, description, state, phase, work_item_type, blocked_reason, closed_reason, assignee, project, branch, pr_url,
                              feature_brief_path, spec_path, plan_path, tasks_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
    ).run(
      id, title, input.description, state, phase, input.work_item_type, blockedReason,
      input.assignee ?? null, input.project, input.branch ?? null, input.pr_url ?? null, paths?.relative ?? null, timestamp, timestamp,
    );

    db.exec("COMMIT TRANSACTION");
    committed = true;
  } catch (error) {
    try { db.exec("ROLLBACK TRANSACTION"); } catch { /* trigger may have already rolled back */ }
    if (paths && !committed) {
      await rm(paths.temporary, { force: true });
    }
    throw error;
  }

  if (paths) {
    await promoteBrief(paths.temporary, paths.final);
  }
  return readWorkItemRow(db, id, input.project_path);
}

export async function updateWorkItem(
  db: DatabaseSync,
  actor: WorkItemActor,
  id: string,
  input: UpdateWorkItemInput,
): Promise<WorkItem> {
  assertDescription(input.description);
  const current = await readWorkItemRow(db, id, input.project_path);
  const paths = input.details_text === undefined || !input.project_path
    ? undefined
    : briefPaths(input.project_path, id, current.title);
  if (paths) {
    await mkdir(paths.directory, { recursive: true });
    await writeFile(paths.temporary, input.details_text!, "utf8");
  }

  const timestamp = new Date().toISOString();
  let committed = false;
  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    db.prepare(
      `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
       VALUES (?, ?, 'work_item.updated', ?, ?, ?, ?)`,
    ).run(timestamp, actor, JSON.stringify({ description: input.description }), id, "Updated work item description.", paths?.relative ?? current.feature_brief_path ?? null);
    db.prepare(
      "UPDATE work_items SET description = ?, feature_brief_path = ?, updated_at = ? WHERE id = ?",
    ).run(input.description, paths?.relative ?? current.feature_brief_path ?? null, timestamp, id);
    db.exec("COMMIT TRANSACTION");
    committed = true;
  } catch (error) {
    try { db.exec("ROLLBACK TRANSACTION"); } catch { /* trigger may have already rolled back */ }
    if (paths && !committed) {
      await rm(paths.temporary, { force: true });
    }
    throw error;
  }
  if (paths) {
    await promoteBrief(paths.temporary, paths.final);
  }
  return readWorkItemRow(db, id, input.project_path);
}

export async function updateWorkItemState(
  db: DatabaseSync,
  actor: WorkItemActor,
  id: string,
  next: UpdateWorkItemStateInput,
): Promise<WorkItem> {
  const current = await readWorkItemRow(db, id);
  const phase = next.phase ?? current.phase;
  const blockedReason = next.blocked_reason ?? null;
  const closedReason = current.closed_reason ?? next.closed_reason ?? null;

  assertPhaseBelongsToType(current.work_item_type, phase);
  assertBlockedReasonConsistency(next.state, blockedReason);
  assertClosedReasonConsistency(next.state, closedReason);

  const timestamp = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
       VALUES (?, ?, 'work_item.state_changed', ?, ?, ?, NULL)`,
    ).run(timestamp, actor, JSON.stringify({ from: current.state, to: next.state, blocked_reason: blockedReason, closed_reason: closedReason }), id, `State changed to '${next.state}'`);

    const result = db.prepare(
      `UPDATE work_items SET state = ?, phase = ?, blocked_reason = ?, closed_reason = ?, updated_at = ? WHERE id = ?`,
    ).run(next.state, phase, blockedReason, closedReason, timestamp, id);

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

export async function readWorkItems(db: DatabaseSync, filter?: { project?: string; project_path?: string }): Promise<WorkItem[]> {
  const rows = (filter?.project === undefined
    ? db.prepare(
        `SELECT id, title, description, state, phase, work_item_type, blocked_reason, closed_reason, assignee, project, branch, pr_url,
                feature_brief_path, spec_path, plan_path, tasks_path, created_at, updated_at
         FROM work_items ORDER BY created_at ASC`,
      ).all()
    : db.prepare(
        `SELECT id, title, description, state, phase, work_item_type, blocked_reason, closed_reason, assignee, project, branch, pr_url,
                feature_brief_path, spec_path, plan_path, tasks_path, created_at, updated_at
         FROM work_items WHERE project = ? ORDER BY created_at ASC`,
      ).all(filter.project)) as unknown as WorkItemRow[];

  return Promise.all(rows.map(row => recoverBrief(toWorkItem(row), filter?.project_path)));
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
