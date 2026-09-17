import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listResumeVersions, saveResumeVersion } from "@/server/resume-intelligence";
import { resumeVersionCreateSchema } from "@/lib/validations/resume";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    return NextResponse.json(await listResumeVersions(id, session.user.id));
  } catch (error) {
    return jsonError(error, "Failed to load resume versions");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = resumeVersionCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid resume version payload.");
    }

    const version = await saveResumeVersion({
      variantId: id,
      userId: session.user.id,
      label: parsed.data.label ?? null,
      changeSummary: { type: "manual_snapshot", source: "builder" },
    });
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to save the resume version");
  }
}
