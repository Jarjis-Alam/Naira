import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeInterviewSession } from "@/server/interview-coach";
import { AIProviderError } from "@/server/ai";

export async function POST(
  _request: NextRequest,
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

    const result = await completeInterviewSession({
      sessionId: id,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error("[api/student/interview/[id]/complete] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
