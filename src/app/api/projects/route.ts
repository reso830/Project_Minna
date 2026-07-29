import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { listRegisteredProjects } from "../../../core/registry";

export const runtime = "nodejs";

export async function GET() {
  try {
    const projects = await listRegisteredProjects();
    const projectsWithAvailability = await Promise.all(projects.map(async (project) => {
      try {
        await stat(project.path);
        return { ...project, available: true };
      } catch {
        return { ...project, available: false };
      }
    }));

    return NextResponse.json(projectsWithAvailability);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
  }
}
