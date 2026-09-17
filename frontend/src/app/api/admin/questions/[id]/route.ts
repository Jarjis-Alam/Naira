import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { questions, topics, testQuestions, questionPoolQuestions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { updateQuestionSchema } from "@/lib/validations/question";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const qList = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);

    if (qList.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const q = qList[0];

    // Compute usage
    const [testCountRes, poolCountRes] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(testQuestions)
        .where(eq(testQuestions.questionId, id)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(questionPoolQuestions)
        .where(eq(questionPoolQuestions.questionId, id)),
    ]);

    const usage = {
      testCount: Number(testCountRes[0]?.count || 0),
      poolCount: Number(poolCountRes[0]?.count || 0),
    };

    return NextResponse.json({ question: q, usage });
  } catch (error) {
    console.error("Failed to fetch question:", error);
    return NextResponse.json(
      { error: "Failed to fetch question" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const rawBody = await request.json();
    const parsed = updateQuestionSchema.safeParse(rawBody);

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

    // Update the question while preserving question identity and test/pool memberships.
    // Historical attempt snapshots in attemptQuestions remain untouched.
    const updated = await db
      .update(questions)
      .set({
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
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    return NextResponse.json({ success: true, question: updated[0] });
  } catch (error) {
    console.error("Failed to update question:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 }
    );
  }
}
