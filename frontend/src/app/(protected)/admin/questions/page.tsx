import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { questions, subjects, topics, testQuestions, questionPoolQuestions } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { QuestionBankTable } from "@/components/admin/question-bank-table";

export default async function AdminQuestionsPage() {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch all questions with subjects, topics, and usage inventory
  const allQuestions = await db
    .select({
      id: questions.id,
      question: questions.question,
      questionType: questions.questionType,
      difficulty: questions.difficulty,
      marks: questions.marks,
      expectedTime: questions.expectedTime,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
      subjectId: questions.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      topicId: questions.topicId,
      topicName: topics.name,
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
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .orderBy(desc(questions.createdAt))
    .limit(200);

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

  return (
    <div className="space-y-8 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-bold text-text-primary">
            <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text">
              Question Bank
            </span>
            <span className="mt-2 block text-headline-lg font-bold text-text-primary">
              Curriculum Repository
            </span>
          </h1>
          <p className="text-body-md text-text-secondary mt-1">
            Author, organize, and inspect assessment items across computer science and aptitude domains.
          </p>
        </div>

        <Link
          href="/admin/questions/new"
          id="btn-admin-new-question"
          className="bg-primary text-text-inverse font-semibold text-body-sm px-5 py-2.5 rounded-lg hover:bg-primary-text transition-colors inline-flex items-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Question
        </Link>
      </div>

      <QuestionBankTable
        questions={allQuestions}
        subjects={allSubjects}
        topics={allTopics}
      />
    </div>
  );
}
