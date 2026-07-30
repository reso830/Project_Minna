import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { listRegisteredProjects, openRegisteredProject, prepareProject, registerProject } from "../../../../core/registry";

export const runtime = "nodejs";

function projectId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "project";
}

export async function POST(request: Request) {
  let path: unknown;
  try {
    ({ path } = await request.json());
  } catch {
    return NextResponse.json({ error: "Validation Failure", details: "Request body must contain a project path." }, { status: 400 });
  }

  if (typeof path !== "string" || !path.trim()) {
    return NextResponse.json({ error: "Validation Failure", details: "Request body must contain a project path." }, { status: 400 });
  }

  const projectPath = resolve(path);
  try {
    if (!(await stat(projectPath)).isDirectory()) {
      return NextResponse.json({ error: "Validation Failure", details: "Selected path must be a directory." }, { status: 400 });
    }

    await prepareProject(projectPath);
    const existingProject = (await listRegisteredProjects()).find((project) => project.path === projectPath);
    if (existingProject) {
      return NextResponse.json({ success: true, project: await openRegisteredProject(existingProject.id) });
    }
    const name = basename(projectPath);
    const project = await registerProject({
      id: projectId(name),
      name,
      path: projectPath,
      last_opened_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, project });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const status = details.startsWith("Project rejection:") || details.startsWith("Project config.yaml is invalid:")
      ? 400
      : 500;
    return NextResponse.json(
      { error: status === 400 ? "Validation Failure" : "Internal Server Error", details },
      { status },
    );
  }
}
