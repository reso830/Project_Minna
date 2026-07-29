import { NextResponse } from "next/server";
import { listRegisteredProjects, updateProject, verifyProjectHealth } from "../../../../core/registry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let id: unknown;
  let name: unknown;
  let path: unknown;
  try {
    ({ id, name, path } = await request.json());
  } catch {
    return NextResponse.json({ error: "Validation Failure", details: "Request body must contain a project id, name, and path." }, { status: 400 });
  }

  if (typeof id !== "string" || !id.trim() || typeof name !== "string" || !name.trim() || typeof path !== "string" || !path.trim()) {
    return NextResponse.json({ error: "Validation Failure", details: "Request body must contain a project id, name, and path." }, { status: 400 });
  }

  try {
    const current = (await listRegisteredProjects()).find(project => project.id === id);
    if (!current) {
      return NextResponse.json({ error: "Not Found", details: `No project registered with ID '${id}'.` }, { status: 404 });
    }
    if (path !== current.path) {
      const health = await verifyProjectHealth(path);
      if (!health.available) {
        return NextResponse.json({ error: "Validation Failure", details: health.error }, { status: 400 });
      }
    }
    return NextResponse.json({ success: true, project: await updateProject(id, name, path) });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const status = details.includes("already registered") ? 400 : 500;
    return NextResponse.json(
      { error: status === 400 ? "Validation Failure" : "Internal Server Error", details },
      { status },
    );
  }
}
