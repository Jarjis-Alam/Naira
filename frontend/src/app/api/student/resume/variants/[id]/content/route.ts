import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateStructuredResume } from "@/server/resume-intelligence";
import { structuredResumeUpdateSchema } from "@/lib/validations/resume";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

/**
 * Builder edits. The payload is validated field by field server-side, so no
 * unvalidated blob can be stored as structured resume data, and the analysis is
 * recomputed immediately so the ATS score always reflects what is on screen.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = structuredResumeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid resume content payload.");
    }

    const updated = await updateStructuredResume({
      variantId: id,
      userId: session.user.id,
      structured: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error, "Failed to save resume changes");
  }
}
