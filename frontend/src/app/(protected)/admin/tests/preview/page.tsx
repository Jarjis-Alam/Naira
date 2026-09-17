import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tests, testSections, testQuestions, questions, subjects, topics } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { AdminTestPreview, type PreviewDraft, type PreviewQuestion, type PreviewSection } from "@/components/admin/admin-test-preview";

export default async function AdminTestPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ testId?: string }>;
}) {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;

  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/admin/tests/preview");
  if (!isAdmin) redirect("/dashboard");

  const { testId } = await searchParams;

  let initialDraft: PreviewDraft | undefined;

  if (testId) {
    const testRecord = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

    if (testRecord.length > 0) {
      const t = testRecord[0];

      // Fetch sections
      const sectionsList = await db
        .select()
        .from(testSections)
        .where(eq(testSections.testId, testId))
        .orderBy(asc(testSections.sectionOrder));

      // Fetch questions
      const qRecords = await db
        .select({
          id: questions.id,
          question: questions.question,
          questionType: questions.questionType,
          options: questions.options,
          difficulty: questions.difficulty,
          marks: questions.marks,
          expectedTime: questions.expectedTime,
          sectionId: testQuestions.sectionId,
          questionOrder: testQuestions.questionOrder,
          subjectName: subjects.name,
          subjectCode: subjects.code,
          topicName: topics.name,
        })
        .from(testQuestions)
        .innerJoin(questions, eq(testQuestions.questionId, questions.id))
        .innerJoin(subjects, eq(questions.subjectId, subjects.id))
        .innerJoin(topics, eq(questions.topicId, topics.id))
        .where(eq(testQuestions.testId, testId))
        .orderBy(asc(testQuestions.questionOrder));

      const sectionsMap = new Map<string, typeof sectionsList[0]>();
      for (const s of sectionsList) {
        sectionsMap.set(s.id, s);
      }

      const previewSections: PreviewSection[] = sectionsList.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description || undefined,
        sectionOrder: s.sectionOrder,
      }));

      const previewQuestions: PreviewQuestion[] = qRecords.map((q) => {
        const sec = q.sectionId ? sectionsMap.get(q.sectionId) : undefined;
        return {
          id: q.id,
          question: q.question,
          questionType: q.questionType,
          options: Array.isArray(q.options) ? (q.options as string[]) : [],
          difficulty: q.difficulty,
          marks: q.marks,
          expectedTime: q.expectedTime,
          subjectName: q.subjectName,
          subjectCode: q.subjectCode,
          topicName: q.topicName,
          sectionId: q.sectionId || undefined,
          sectionTitle: sec?.title || undefined,
          sectionOrder: sec?.sectionOrder || undefined,
        };
      });

      initialDraft = {
        title: t.title,
        description: t.description || "",
        duration: t.duration,
        testType: t.type,
        negativeMarkingEnabled: t.negativeMarkingEnabled,
        negativeMarkRate: Number(t.negativeMarkRate || 0),
        randomizeQuestions: t.randomizeQuestions,
        randomizeOptions: t.randomizeOptions,
        instructions: t.instructions,
        sections: previewSections,
        questions: previewQuestions,
      };
    }
  }

  return <AdminTestPreview initialDraft={initialDraft} />;
}
