import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  materializePracticeSession,
  type PracticeObjective,
} from "@/server/practice-question-intelligence";

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { topicId, subjectCode, objective, questionCount, planItemId } = body;

    const sessionResult = await materializePracticeSession({
      userId: session.user.id,
      topicId: typeof topicId === "string" ? topicId : undefined,
      subjectCode: typeof subjectCode === "string" ? subjectCode : undefined,
      objective: (objective as PracticeObjective) || undefined,
      requestedCount: typeof questionCount === "number" ? questionCount : undefined,
      planItemId: typeof planItemId === "string" ? planItemId : undefined,
    });

    return NextResponse.json(sessionResult);
  } catch (error) {
    console.error("[api/student/practice/generate] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
