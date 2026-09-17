import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteResumeVariant, getResumeVariant, updateResumeVariant } from "@/server/resume-intelligence";
import { resumeVariantUpdateSchema } from "@/lib/validations/resume";
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
    return NextResponse.json(await getResumeVariant(id, session.user.id));
  } catch (error) {
    return jsonError(error, "Failed to load the resume variant");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = resumeVariantUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid resume variant update.");
    }

    const updated = await updateResumeVariant({
      variantId: id,
      userId: session.user.id,
      patch: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error, "Failed to update the resume variant");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    return NextResponse.json(await deleteResumeVariant(id, session.user.id));
  } catch (error) {
    return jsonError(error, "Failed to delete the resume variant");
  }
}
