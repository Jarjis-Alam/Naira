import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { startInterviewSession, InterviewType } from "@/server/interview-coach";
import { AIProviderError } from "@/server/ai";

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const interviewType: InterviewType = body.interviewType || "TECHNICAL";
    const targetRoleId: string | undefined = body.targetRoleId;
    const targetRoleName: string | undefined = body.targetRoleName;
    const companyName: string | undefined = body.companyName;
    const focusArea: string | undefined = body.focusArea;
    const maxTurns: number | undefined = body.maxTurns ? Number(body.maxTurns) : undefined;

    const result = await startInterviewSession({
      userId: session.user.id,
      interviewType,
      targetRoleId,
      targetRoleName,
      companyName,
      focusArea,
      maxTurns,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error("[api/student/interview/start] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
