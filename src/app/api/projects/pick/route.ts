import { NextResponse } from "next/server";
import { DirectoryPickerCancelledError, pickDirectory } from "../../../../core/native-directory-picker";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json({ path: await pickDirectory() });
  } catch (error) {
    if (error instanceof DirectoryPickerCancelledError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Failed to launch native OS directory picker: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
