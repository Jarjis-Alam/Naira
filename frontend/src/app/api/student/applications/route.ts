import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createApplication, getApplicationsBoard } from "@/server/application-intelligence";
import { applicationCreateSchema } from "@/lib/validations/applications";
import { jsonError, validationError } from "@/lib/applications/api-response";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const board = await getApplicationsBoard(session.user.id);
    return NextResponse.json(board);
  } catch (error) {
    return jsonError(error, "Failed to load applications board");
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = applicationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid application payload");
    }
    const application = await createApplication(session.user.id, parsed.data);
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to create application");
  }
}
