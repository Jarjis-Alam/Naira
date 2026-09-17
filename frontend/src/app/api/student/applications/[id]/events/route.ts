import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  addApplicationNote,
  getApplicationTimeline,
} from "@/server/application-intelligence";
import { applicationNoteSchema } from "@/lib/validations/applications";
import { jsonError, validationError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const timeline = await getApplicationTimeline(session.user.id, id);
    return NextResponse.json({ events: timeline });
  } catch (error) {
    return jsonError(error, "Failed to load application timeline");
  }
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = applicationNoteSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid event payload");
    }
    const event = await addApplicationNote(
      session.user.id,
      id,
      parsed.data.title,
      parsed.data.detail
    );
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to add application event");
  }
}
