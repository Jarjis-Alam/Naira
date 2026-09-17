import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveReflection } from "@/server/outcome-intelligence";
import { reflectionSchema } from "@/lib/validations/outcomes";
import { jsonError, validationError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Phase 20 — POST /api/student/applications/[id]/reflection
 * Saves the student's post-outcome reflection. All fields are student_note
 * evidence with confidence "student_reported" — never treated as facts.
 */
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = reflectionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid reflection payload");
    }
    const reflection = await saveReflection(session.user.id, id, parsed.data);
    return NextResponse.json(reflection, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to save reflection");
  }
}
