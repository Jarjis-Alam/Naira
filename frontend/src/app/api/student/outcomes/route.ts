import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOutcomeAnalytics } from "@/server/outcome-intelligence";
import { jsonError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

/**
 * Phase 20 — GET /api/student/outcomes
 * Owner-scoped outcome analytics summary (totals, stage distribution,
 * patterns, recent outcomes, focus candidates). Descriptive only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const analytics = await getOutcomeAnalytics(session.user.id);
    return NextResponse.json(analytics);
  } catch (error) {
    return jsonError(error, "Failed to load outcomes");
  }
}
