import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tests, testQuestions, testSections, questionPools, attempts } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { AdminTestList, type AdminTestItem } from "@/components/admin/test-list";
import { getEffectiveTestStatus } from "@/lib/lifecycle";

export default async function AdminTestsPage() {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const now = new Date();

  // Fetch all tests with full inventory metadata
  const allTests = await db
    .select({
      id: tests.id,
      title: tests.title,
      description: tests.description,
      type: tests.type,
      duration: tests.duration,
      difficulty: tests.difficulty,
      totalMarks: tests.totalMarks,
      status: tests.status,
      attemptLimit: tests.attemptLimit,
      negativeMarkingEnabled: tests.negativeMarkingEnabled,
      negativeMarkRate: tests.negativeMarkRate,
      randomizeQuestions: tests.randomizeQuestions,
      randomizeOptions: tests.randomizeOptions,
      scheduledStartAt: tests.scheduledStartAt,
      scheduledEndAt: tests.scheduledEndAt,
      scheduleTimezone: tests.scheduleTimezone,
      isPublished: tests.isPublished,
      createdAt: tests.createdAt,
      updatedAt: tests.updatedAt,
    })
    .from(tests)
    .orderBy(desc(tests.createdAt));

  const testsWithStats: AdminTestItem[] = await Promise.all(
    allTests.map(async (t) => {
      const [qCountRes, poolCountRes, secCountRes, attemptsCountRes] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(testQuestions)
          .where(eq(testQuestions.testId, t.id)),
        db
          .select({ sum: sql<number>`COALESCE(sum(${questionPools.selectionCount}), 0)` })
          .from(questionPools)
          .where(eq(questionPools.testId, t.id)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(testSections)
          .where(eq(testSections.testId, t.id)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(attempts)
          .where(eq(attempts.testId, t.id)),
      ]);

      const questionCount =
        Number(qCountRes[0]?.count || 0) + Number(poolCountRes[0]?.sum || 0);
      const sectionCount = Number(secCountRes[0]?.count || 0);
      const attemptCount = Number(attemptsCountRes[0]?.count || 0);

      const effectiveStatus = getEffectiveTestStatus(t, now);

      return {
        ...t,
        effectiveStatus,
        questionCount,
        sectionCount,
        attemptCount,
        negativeMarkRate: Number(t.negativeMarkRate || 0),
      };
    })
  );

  return (
    <div className="space-y-8 pb-28">
      <div>
        <h1 className="text-headline-lg font-bold text-text-primary">
          <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text block mb-1">
            Assessment Operations
          </span>
          Test Inventory & Management
        </h1>
        <p className="text-body-md text-text-secondary mt-1 max-w-2xl">
          Curate, configure, preview, and deploy modular placement exams across engineering curriculum tracks.
        </p>
      </div>

      <AdminTestList initialTests={testsWithStats} />
    </div>
  );
}
