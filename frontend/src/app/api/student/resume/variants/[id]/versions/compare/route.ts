import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { compareResumeVersions } from "@/server/resume-intelligence";
import { jsonError, validationError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return validationError("A resume variant ID is required.");

  const url = new URL(req.url);
  const fromVersionId = url.searchParams.get("from");
  const toVersionId = url.searchParams.get("to");

  if (!fromVersionId || !toVersionId) {
    return validationError("Both 'from' and 'to' version IDs are required for a comparison.");
  }
  if (fromVersionId === toVersionId) {
    return validationError("Select two different versions to compare.");
  }

  try {
    return NextResponse.json(
      await compareResumeVersions({
        variantId: id,
        userId: session.user.id,
        fromVersionId,
        toVersionId,
      })
    );
  } catch (error) {
    return jsonError(error, "Failed to compare resume versions");
  }
}
