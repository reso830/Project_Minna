import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { listRegisteredProjects, openRegisteredProject } from "../../../../core/registry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let id: unknown;
  try {
    ({ id } = await request.json());
  } catch {
    return NextResponse.json({ error: "Validation Failure", details: "Request body must contain a project id." }, { status: 400 });
  }

  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "Validation Failure", details: "Request body must contain a project id." }, { status: 400 });
  }

  try {
    const project = (await listRegisteredProjects()).find((entry) => entry.id === id);
    if (!project) {
      return NextResponse.json({ error: "Not Found", details: `No project registered with ID '${id}'.` }, { status: 404 });
    }

    try {
      await stat(project.path);
    } catch {
      return NextResponse.json({ error: "Project Unavailable", details: `The project path '${project.path}' no longer exists.` }, { status: 410 });
    }

    return NextResponse.json({ success: true, project: await openRegisteredProject(id) });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
  }
}
