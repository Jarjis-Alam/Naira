import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  completeInterview,
  scheduleInterview,
} from "@/server/application-intelligence";
import { interviewCompleteSchema, interviewScheduleSchema } from "@/lib/validations/applications";
import { jsonError, validationError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = interviewScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid interview payload");
    }
    const interview = await scheduleInterview(session.user.id, id, parsed.data);
    return NextResponse.json(interview, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to schedule interview");
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
    const url = new URL(req.url);
    const interviewId = url.searchParams.get("interviewId");
    if (!interviewId) {
      return validationError("interviewId query parameter is required");
    }
    const parsed = interviewCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid interview payload");
    }
    const interview = await completeInterview(session.user.id, id, interviewId, parsed.data);
    return NextResponse.json(interview);
  } catch (error) {
    return jsonError(error, "Failed to update interview");
  }
}
