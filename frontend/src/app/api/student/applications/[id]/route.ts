import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteApplication,
  getApplicationDetail,
  updateApplication,
  updateApplicationStatus,
} from "@/server/application-intelligence";
import {
  applicationStatusUpdateSchema,
  applicationUpdateSchema,
} from "@/lib/validations/applications";
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
    const detail = await getApplicationDetail(session.user.id, id);
    return NextResponse.json(detail);
  } catch (error) {
    return jsonError(error, "Failed to load application");
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

    // Status transitions get their own guarded endpoint semantics on PATCH
    // ?action=status; otherwise treat the payload as a field update.
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "status") {
      const parsed = applicationStatusUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return validationError(parsed.error.issues[0]?.message ?? "Invalid status payload");
      }
      const application = await updateApplicationStatus(
        session.user.id,
        id,
        parsed.data.status,
        parsed.data.note
      );
      return NextResponse.json(application);
    }

    const parsed = applicationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid application payload");
    }
    const application = await updateApplication(session.user.id, id, parsed.data);
    return NextResponse.json(application);
  } catch (error) {
    return jsonError(error, "Failed to update application");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    return NextResponse.json(await deleteApplication(session.user.id, id));
  } catch (error) {
    return jsonError(error, "Failed to delete application");
  }
}
