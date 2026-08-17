import { NextResponse } from "next/server";
import { join } from "node:path";
import { listRegisteredProjects } from "../../../core/registry";
import { createRepositories } from "../../../core/repositories/factory";

export const runtime = "nodejs";

async function projectFor(key: string) {
  return (await listRegisteredProjects()).find(project => project.id === key);
}

function badRequest(message: string) {
  return NextResponse.json({ error: "Bad Request", message }, { status: 400 });
}

export async function GET(request: Request) {
  const projectKey = new URL(request.url).searchParams.get("project");
  if (!projectKey) {
    return badRequest("Missing required query parameter: project");
  }
  const project = await projectFor(projectKey);
  if (!project) {
    return NextResponse.json({ error: "Not Found", message: `Project '${projectKey}' not found.` }, { status: 404 });
  }
  const repositories = await createRepositories({ dbPath: join(project.path, ".minna", "minna.db"), projectKey, projectPath: project.path });
  try {
    return NextResponse.json(await repositories.workItems.list({ project: projectKey }));
  } finally {
    repositories.close();
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  if (typeof body.project !== "string" || !body.project) return badRequest("Missing required field: project");
  if (typeof body.title !== "string" || !body.title.trim()) return badRequest("Title is required.");
  if (typeof body.description !== "string") return badRequest("Missing required field: description");
  if (body.description.length > 100) return badRequest("Description cannot exceed 100 characters.");

  const project = await projectFor(body.project);
  if (!project) return NextResponse.json({ error: "Not Found", message: `Project '${body.project}' not found.` }, { status: 404 });
  const repositories = await createRepositories({ dbPath: join(project.path, ".minna", "minna.db"), projectKey: body.project, projectPath: project.path });
  try {
    const workItem = await repositories.workItems.create("human", {
      title: body.title,
      description: body.description,
      work_item_type: "feature",
      project: body.project,
      details_text: typeof body.detailsText === "string" ? body.detailsText : typeof body.attachedFileContent === "string" ? body.attachedFileContent : undefined,
    });
    return NextResponse.json({ workItem });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  } finally {
    repositories.close();
  }
}
