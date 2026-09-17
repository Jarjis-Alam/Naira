import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decideSuggestion } from "@/server/resume-intelligence";
import { suggestionDecisionSchema } from "@/lib/validations/resume";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

/**
 * Accept or reject a suggestion.
 *
 * Accepting applies the change to the structured resume, re-runs the analysis,
 * and snapshots a version. Suggestions that carry a placeholder the student has
 * not filled in are refused by the service, so a prompt can never be stored as
 * resume content.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A suggestion ID is required.");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = suggestionDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid suggestion decision.");
    }

    const variantId = typeof body?.variantId === "string" ? body.variantId : null;
    if (!variantId) return validationError("A resume variant ID is required.");

    const variant = await decideSuggestion({
      variantId,
      userId: session.user.id,
      suggestionId: id,
      decision: parsed.data.decision,
    });
    return NextResponse.json(variant);
  } catch (error) {
    return jsonError(error, "Failed to record the suggestion decision");
  }
}
