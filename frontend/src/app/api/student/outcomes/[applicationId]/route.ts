import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOutcomeAnalysis } from "@/server/outcome-intelligence";
import { jsonError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

type Params = { params: Promise<{ applicationId: string }> };

/**
 * Phase 20 — GET /api/student/outcomes/[applicationId]
 * Full per-application outcome analysis: derived outcome, evidence with
 * provenance, non-causal observations, observed gaps, next focus, reflection,
 * and interview feedback. Ownership enforced (403 on foreign ids).
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { applicationId } = await params;

  try {
    const detail = await getOutcomeAnalysis(session.user.id, applicationId);
    return NextResponse.json(detail);
  } catch (error) {
    return jsonError(error, "Failed to load outcome analysis");
  }
}
