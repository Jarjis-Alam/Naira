import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendInterviewMessage } from "@/server/interview-coach";
import { AIProviderError } from "@/server/ai";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    let session = null;
    try {
      session = await auth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const message = body.message;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    const result = await sendInterviewMessage({
      sessionId: id,
      userId: session.user.id,
      message,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error("[api/student/interview/[id]/message] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
