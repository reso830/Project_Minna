import { NextResponse } from "next/server";
import { listRegisteredProjects } from "../../../core/registry";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await listRegisteredProjects());
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
  }
}
