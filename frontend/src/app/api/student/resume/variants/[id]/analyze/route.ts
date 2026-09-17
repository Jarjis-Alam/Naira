import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeResumeVariant } from "@/server/resume-intelligence";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    return NextResponse.json(await analyzeResumeVariant(id, session.user.id));
  } catch (error) {
    return jsonError(error, "Failed to analyse the resume");
  }
}
