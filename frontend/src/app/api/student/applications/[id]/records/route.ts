import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  recordAssessment,
  recordOffer,
  updateAssessment,
} from "@/server/application-intelligence";
import {
  assessmentCreateSchema,
  assessmentUpdateSchema,
  offerCreateSchema,
} from "@/lib/validations/applications";
import { jsonError, validationError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Phase 19 — assessment + offer sub-resources.
 *
 * `POST  ?kind=assessment`               → record a new assessment
 * `PATCH ?kind=assessment&assessmentId=` → update an assessment (status/score/notes)
 * `POST  ?kind=offer`                    → record an offer (status moves to OFFER)
 *
 * Status transitions live on the application resource itself (PATCH /applications/[id]).
 */
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind");

  try {
    const body = await req.json().catch(() => ({}));

    if (kind === "assessment") {
      const parsed = assessmentCreateSchema.safeParse(body);
      if (!parsed.success) {
        return validationError(parsed.error.issues[0]?.message ?? "Invalid assessment payload");
      }
      const assessment = await recordAssessment(session.user.id, id, parsed.data);
      return NextResponse.json(assessment, { status: 201 });
    }

    if (kind === "offer") {
      const parsed = offerCreateSchema.safeParse(body);
      if (!parsed.success) {
        return validationError(parsed.error.issues[0]?.message ?? "Invalid offer payload");
      }
      const offer = await recordOffer(session.user.id, id, parsed.data);
      return NextResponse.json(offer, { status: 201 });
    }

    return validationError("kind must be 'assessment' or 'offer'");
  } catch (error) {
    return jsonError(error, "Failed to record application sub-resource");
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const assessmentId = url.searchParams.get("assessmentId");

  try {
    if (kind !== "assessment" || !assessmentId) {
      return validationError("PATCH requires kind='assessment' and an assessmentId query parameter");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = assessmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid assessment payload");
    }
    const assessment = await updateAssessment(session.user.id, id, assessmentId, parsed.data);
    return NextResponse.json(assessment);
  } catch (error) {
    return jsonError(error, "Failed to update assessment");
  }
}
