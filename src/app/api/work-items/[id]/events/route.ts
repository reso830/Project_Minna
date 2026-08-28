import { join } from "node:path";
import { NextResponse } from "next/server";

import { listRegisteredProjects } from "../../../../../core/registry";
import { createRepositories } from "../../../../../core/repositories/factory";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const projectId = new URL(request.url).searchParams.get("project");
  if (!projectId) return NextResponse.json({ error: "Missing required query parameter: project" }, { status: 400 });

  const project = (await listRegisteredProjects()).find(candidate => candidate.id === projectId);
  if (!project) return NextResponse.json({ error: `Project '${projectId}' not found.` }, { status: 404 });

  const { id } = await context.params;
  const repositories = await createRepositories({ dbPath: join(project.path, ".minna", "minna.db"), projectKey: projectId, projectPath: project.path });
  try {
    const workItem = (await repositories.workItems.list({ project: projectId })).find(item => item.id === id);
    if (!workItem) return NextResponse.json({ error: `Work item '${id}' was not found.` }, { status: 404 });
    return NextResponse.json(await repositories.events.read(id));
  } finally {
    repositories.close();
  }
}
