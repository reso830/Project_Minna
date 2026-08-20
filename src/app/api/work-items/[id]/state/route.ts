import { join } from "node:path";
import { NextResponse } from "next/server";
import { listRegisteredProjects } from "../../../../../core/registry";
import { createRepositories } from "../../../../../core/repositories/factory";
import { IllegalStateTransitionError, validateStateTransition } from "../../../../../core/work-item-model";
import type { BlockedReason, ClosedReason, WorkItemState } from "../../../../../core/types";

export const runtime = "nodejs";

const workItemStates: WorkItemState[] = ["parked", "active", "blocked", "closed"];
const blockedReasons: BlockedReason[] = ["clarification-required", "approval-required", "external-dependency", "ci-pending", "failed"];
const closedReasons: ClosedReason[] = ["done", "dropped", "failed"];

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  if (typeof body.project !== "string" || !body.project) return badRequest("Missing required field: project");
  if (typeof body.state !== "string" || !workItemStates.includes(body.state as WorkItemState)) {
    return badRequest("state must be one of: parked, active, blocked, closed.");
  }
  if (body.state === "closed" && (typeof body.closed_reason !== "string" || !closedReasons.includes(body.closed_reason as ClosedReason))) {
    return badRequest("closed_reason is required when state is 'closed'.");
  }
  if (body.state === "blocked" && (typeof body.blocked_reason !== "string" || !blockedReasons.includes(body.blocked_reason as BlockedReason))) {
    return badRequest("blocked_reason must be one of: clarification-required, approval-required, external-dependency, ci-pending, failed.");
  }

  const project = (await listRegisteredProjects()).find(candidate => candidate.id === body.project);
  if (!project) return NextResponse.json({ error: `Project '${body.project}' not found.` }, { status: 404 });

  const { id } = await context.params;
  const repositories = await createRepositories({ dbPath: join(project.path, ".minna", "minna.db"), projectKey: body.project, projectPath: project.path });
  try {
    const existing = (await repositories.workItems.list({ project: body.project })).find(item => item.id === id);
    if (!existing) {
      return NextResponse.json({ error: `Work item '${id}' was not found.` }, { status: 404 });
    }
    validateStateTransition(existing.state, body.state as WorkItemState);
    const workItem = await repositories.workItems.updateState("human", id, {
      state: body.state as WorkItemState,
      blocked_reason: typeof body.blocked_reason === "string" ? body.blocked_reason as BlockedReason : null,
      closed_reason: typeof body.closed_reason === "string" ? body.closed_reason as ClosedReason : null,
    });
    return NextResponse.json(workItem);
  } catch (error) {
    if (error instanceof IllegalStateTransitionError) {
      return NextResponse.json({ error: error.message, from: error.from, to: error.to, allowed: error.allowed }, { status: 422 });
    }
    return badRequest(error instanceof Error ? error.message : String(error));
  } finally {
    repositories.close();
  }
}
