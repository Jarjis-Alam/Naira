import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getResumeWorkspace } from "@/server/resume-intelligence";
import { jsonError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspace = await getResumeWorkspace(session.user.id);
    return NextResponse.json(workspace);
  } catch (error) {
    return jsonError(error, "Failed to load resume workspace");
  }
}
