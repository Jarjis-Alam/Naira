import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clearResumeJobDescription, setResumeJobDescription } from "@/server/resume-intelligence";
import { jobDescriptionInputSchema } from "@/lib/validations/resume";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = jobDescriptionInputSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid job description payload.");
    }

    const variant = await setResumeJobDescription({
      variantId: id,
      userId: session.user.id,
      raw: parsed.data.raw,
      source: parsed.data.source ?? "paste",
      providedRoleTitle: parsed.data.providedRoleTitle ?? null,
      providedCompanyName: parsed.data.providedCompanyName ?? null,
    });
    return NextResponse.json(variant);
  } catch (error) {
    return jsonError(error, "Failed to analyse the job description");
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
    return NextResponse.json(await clearResumeJobDescription(id, session.user.id));
  } catch (error) {
    return jsonError(error, "Failed to remove the job description");
  }
}
