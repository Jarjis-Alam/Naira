import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createResumeVariant, listResumeVariants } from "@/server/resume-intelligence";
import { resumeVariantCreateSchema } from "@/lib/validations/resume";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await listResumeVariants(session.user.id));
  } catch (error) {
    return jsonError(error, "Failed to load resume variants");
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = resumeVariantCreateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid resume variant payload.");
    }
    const input = parsed.data;

    const variant = await createResumeVariant({
      userId: session.user.id,
      sourceFileId: input.sourceFileId ?? null,
      label: input.label ?? null,
      companyId: input.companyId ?? null,
      companyName: input.companyName ?? null,
      roleId: input.roleId ?? null,
      roleName: input.roleName ?? null,
      makePrimary: input.makePrimary,
      jobDescriptionRaw: input.jobDescription?.raw ?? null,
      jobDescriptionSource: input.jobDescription?.source ?? "paste",
      jobDescriptionRoleTitle: input.jobDescription?.providedRoleTitle ?? null,
      jobDescriptionCompanyName: input.jobDescription?.providedCompanyName ?? null,
    });

    return NextResponse.json(variant, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to create the resume variant");
  }
}
