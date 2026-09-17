import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getResumeFile } from "@/server/resume-intelligence";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

/**
 * Private download of the originally uploaded resume.
 *
 * Files are stored in Postgres and are only ever served here, to the
 * authenticated owner. There is no public URL for resume content, and the
 * response is never cached.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume file ID is required.");

  try {
    const file = await getResumeFile({ fileId: id, userId: session.user.id });
    const safeName = file.fileName.replace(/["\r\n]/g, "").slice(0, 200) || "resume";

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(file.byteSize),
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to retrieve the resume file");
  }
}
