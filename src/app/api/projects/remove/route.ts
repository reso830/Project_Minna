import { NextResponse } from "next/server";
import { removeProject } from "../../../../core/registry";

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
    await removeProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const status = details.includes("is not registered") ? 404 : 500;
    return NextResponse.json(
      { error: status === 404 ? "Not Found" : "Internal Server Error", details },
      { status },
    );
  }
}
