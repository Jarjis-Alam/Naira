import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { questions, topics } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createQuestionSchema } from "@/lib/validations/question";

export async function POST(request: NextRequest) {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`admin_q_${ip}`, { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down authoring actions." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const rawBody = await request.json();
    const parsed = createQuestionSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || "Invalid question input payload." },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify subject/topic relationship
    const topicRecord = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.id, data.topicId), eq(topics.subjectId, data.subjectId)))
      .limit(1);

    if (topicRecord.length === 0) {
      return NextResponse.json(
        { error: "Selected topic does not belong to the specified subject." },
        { status: 400 }
      );
    }

    const newQ = await db
      .insert(questions)
      .values({
        question: data.question,
        questionType: data.questionType,
        options: data.options,
        correctAnswer: data.correctAnswer,
        subjectId: data.subjectId,
        topicId: data.topicId,
        difficulty: data.difficulty,
        marks: data.marks,
        expectedTime: data.expectedTime,
        explanation: data.explanation || null,
      })
      .returning();

    return NextResponse.json({ success: true, question: newQ[0] }, { status: 201 });
  } catch (error) {
    console.error("Failed to create question:", error);
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}
