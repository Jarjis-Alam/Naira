import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOutcomeAnalytics } from "@/server/outcome-intelligence";
import { jsonError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

/**
 * Phase 20 — GET /api/student/outcomes/analytics
 * Cross-application outcome analytics: descriptive totals, stage
 * distribution, evidence-backed patterns, and aggregated focus candidates.
 * No probabilities, no predictions, no "best company".
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
    return jsonError(error, "Failed to load outcome analytics");
  }
}
