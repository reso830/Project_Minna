import { NextResponse } from "next/server";
import { join } from "node:path";
import { listRegisteredProjects } from "../../../../../core/registry";
import { createRepositories } from "../../../../../core/repositories/factory";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ error: "Bad Request", message }, { status: 400 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  if (typeof body.project !== "string" || !body.project) return badRequest("Missing required field: project");

  const project = (await listRegisteredProjects()).find(candidate => candidate.id === body.project);
  if (!project) return NextResponse.json({ error: "Not Found", message: `Project '${body.project}' not found.` }, { status: 404 });
  const { id } = await context.params;
  const repositories = await createRepositories({ dbPath: join(project.path, ".minna", "minna.db"), projectKey: body.project, projectPath: project.path });
  try {
    const existing = (await repositories.workItems.list({ project: body.project })).find(item => item.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Not Found", message: `Work item with ID '${id}' not found.` }, { status: 404 });
    }
    if (existing.state === "closed") {
      return badRequest("Cannot drop work item in terminal state 'closed'.");
    }
    const workItem = await repositories.workItems.updateState("human", id, { state: "closed", closed_reason: "dropped" });
    return NextResponse.json({ workItem });
  } finally {
    repositories.close();
  }
}
