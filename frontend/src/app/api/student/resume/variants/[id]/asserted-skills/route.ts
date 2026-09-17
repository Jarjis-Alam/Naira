import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setStudentAssertedSkill } from "@/server/resume-intelligence";
import { studentAssertedSkillSchema } from "@/lib/validations/resume";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

/**
 * Record a skill the student confirms they really have.
 *
 * This is the only path by which a skill can enter the match without appearing
 * in the resume text, and it is always stored with `student_asserted`
 * provenance rather than being presented as resume evidence.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = studentAssertedSkillSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid skill confirmation payload.");
    }

    const variant = await setStudentAssertedSkill({
      variantId: id,
      userId: session.user.id,
      skill: parsed.data.skill,
      asserted: parsed.data.asserted,
      note: parsed.data.note ?? null,
    });
    return NextResponse.json(variant);
  } catch (error) {
    return jsonError(error, "Failed to record the confirmed skill");
  }
}
