import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderAtsResume } from "@/server/resume-intelligence";
import { resumeExportQuerySchema } from "@/lib/validations/resume";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

/**
 * ATS-safe export. Rendered server-side from the structured model, served as a
 * download for the authenticated owner only.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  const url = new URL(req.url);
  const parsed = resumeExportQuerySchema.safeParse({
    format: url.searchParams.get("format") ?? "txt",
  });
  if (!parsed.success) {
    return validationError("Unsupported export format. Use 'txt' or 'html'.");
  }

  try {
    const exported = await renderAtsResume({
      variantId: id,
      userId: session.user.id,
      format: parsed.data.format,
    });

    return new NextResponse(exported.content, {
      status: 200,
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${exported.fileName}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to export the resume");
  }
}
