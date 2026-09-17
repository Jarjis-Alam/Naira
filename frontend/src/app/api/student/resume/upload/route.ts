import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadResumeFile } from "@/server/resume-intelligence";
import { MAX_RESUME_FILE_BYTES } from "@/lib/resume/text-extraction";
import { jsonError } from "@/lib/resume/api-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Upload the resume as multipart/form-data with a 'file' field." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No resume file was included in the request." }, { status: 400 });
    }

    // Size is checked before the body is buffered so an oversized upload never
    // consumes memory on the server.
    if (file.size > MAX_RESUME_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The maximum supported resume size is 5 MB.`,
        },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadResumeFile({
      userId: session.user.id,
      bytes,
      fileName: file.name,
      mimeType: file.type || null,
    });

    // A file the parser cannot read is reported as a 400 with the reason, while
    // the record is still stored so the student can see what happened.
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error?.message ?? "This resume could not be read.", upload: result },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to process the uploaded resume");
  }
}
