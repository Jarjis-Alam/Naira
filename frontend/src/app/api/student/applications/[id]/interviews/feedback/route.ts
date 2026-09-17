import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getInterviewFeedback,
  saveInterviewFeedback,
} from "@/server/outcome-intelligence";
import { interviewFeedbackSchema } from "@/lib/validations/outcomes";
import { jsonError, validationError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Phase 20 — interview feedback sub-resource.
 *
 * GET   → all interview feedback records for the application
 * PATCH → save student-reported feedback for one interview (interviewId in body)
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const feedback = await getInterviewFeedback(session.user.id, id);
    return NextResponse.json({ feedback });
  } catch (error) {
    return jsonError(error, "Failed to load interview feedback");
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = interviewFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid feedback payload");
    }
    const record = await saveInterviewFeedback(session.user.id, id, parsed.data);
    return NextResponse.json(record);
  } catch (error) {
    return jsonError(error, "Failed to save interview feedback");
  }
}
