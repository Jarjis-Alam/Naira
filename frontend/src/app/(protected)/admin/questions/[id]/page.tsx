import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { questions, subjects, topics, testQuestions, questionPoolQuestions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { QuestionForm, type QuestionFormData } from "@/components/admin/question-form";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { id } = await params;

  // Fetch target question with usage stats
  const qList = await db
    .select({
      id: questions.id,
      question: questions.question,
      questionType: questions.questionType,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      subjectId: questions.subjectId,
      topicId: questions.topicId,
      difficulty: questions.difficulty,
      marks: questions.marks,
      expectedTime: questions.expectedTime,
      explanation: questions.explanation,
      testCount: sql<number>`(
        SELECT count(*)::int
        FROM test_questions
        WHERE test_questions.question_id = questions.id
      )`,
      poolCount: sql<number>`(
        SELECT count(*)::int
        FROM question_pool_questions
        WHERE question_pool_questions.question_id = questions.id
      )`,
    })
    .from(questions)
    .where(eq(questions.id, id))
    .limit(1);

  if (qList.length === 0) {
    notFound();
  }

  const q = qList[0];

  const [allSubjects, allTopics] = await Promise.all([
    db
      .select({ id: subjects.id, name: subjects.name, code: subjects.code })
      .from(subjects)
      .orderBy(subjects.displayOrder),
    db
      .select({ id: topics.id, name: topics.name, subjectId: topics.subjectId })
      .from(topics)
      .orderBy(topics.displayOrder),
  ]);

  const initialData: QuestionFormData = {
    id: q.id,
    question: q.question,
    questionType: q.questionType,
    subjectId: q.subjectId,
    topicId: q.topicId,
    difficulty: q.difficulty,
    marks: q.marks,
    expectedTime: q.expectedTime || 60,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    correctAnswer: q.correctAnswer as string | string[],
    explanation: q.explanation || "",
    usage: {
      testCount: Number(q.testCount || 0),
      poolCount: Number(q.poolCount || 0),
    },
  };

  return (
    <div className="space-y-8 pb-20 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-label-xs font-mono uppercase tracking-wider text-primary-text mb-1">
          <span>Question Bank</span>
          <span>/</span>
          <span>Edit Item</span>
          <span className="text-text-muted">· {q.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <h1 className="text-headline-lg font-bold text-text-primary">
          Edit Assessment Item
        </h1>
        <p className="text-body-md text-text-secondary mt-1">
          Modify question prompt, options, answer key, and classification.
        </p>
      </div>

      <QuestionForm
        subjects={allSubjects}
        topics={allTopics}
        initialData={initialData}
        mode="edit"
      />
    </div>
  );
}
