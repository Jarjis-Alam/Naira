import { db } from "@/db";
import {
  attempts,
  answers,
  questions,
  tests,
  topics,
  subjects,
  testQuestions,
} from "@/db/schema";
import { eq, and, or, desc, sql, inArray, gte, lte } from "drizzle-orm";
import {
  getPlacementIntelligence,
  getOrCreateTargetedPracticeTest,
} from "./placement-intelligence";
import { getResumeActions, type ResumeAction } from "./resume-intelligence";

// ============================================================================
// 1. DATA CONTRACTS & ACTION MODELS
// ============================================================================

export type ExecutionActionType = "FIX" | "REINFORCE" | "REVIEW";
export type ExecutionActionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED";

export interface PreparationAction {
  id: string; // Deterministic ID: `exec-${dateStr}-${topicId}`
  order: number; // 1, 2, 3
  orderNumber: string; // "01", "02", "03"
  type: ExecutionActionType; // "FIX" | "REINFORCE" | "REVIEW"
  title: string; // "DBMS → Transactions"
  domain: string; // "DBMS"
  domainName: string; // "Database Management Systems"
  topic: string; // "Transactions"
  topicId: string;
  reason: string;
  evidence: string;
  action: string;
  targetCount: number; // 15 for FIX, 10 for REINFORCE, 5 for REVIEW
  completedQuestionsCount?: number;
  currentAccuracy: number;
  accuracy: number; // alias for currentAccuracy
  impact: string; // e.g. "Critical Deficit" | "Target Focus" | "Moderate Deficit"
  targetFocus?: boolean;
  isTargetPriority?: boolean;
  status: ExecutionActionStatus;
  ctaText: string; // "START" | "CONTINUE" | "REVIEW" | "COMPLETED"
  ctaHref: string;
  targetTestId?: string;
  practiceTarget?: {
    topicId?: string;
    subjectCode?: string;
    testId?: string;
  };
  inProgressAttemptId?: string;
  completedAttemptId?: string;
  completedAccuracy?: number;
  completedAt?: string;
  mistakesCount?: number;
}

export interface PreparationHistoryDay {
  date: string; // "YYYY-MM-DD"
  displayDate: string; // "Sep 10"
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  percent: number; // alias for progressPercent
  topicsCovered: string[];
}

export interface DailyPreparationPlan {
  userId: string;
  date: string; // "YYYY-MM-DD"
  displayDate: string; // "Sep 10, 2026"
  hasBaseline: boolean;
  hasEnoughData: boolean;
  isPartialData: boolean;
  status: "zero_data" | "partial_data" | "ready";
  actions: PreparationAction[];
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  inProgressCount: number;
  partiallyCompletedCount?: number;
  progressPercent: number;
  allCompleted: boolean;
  emptyState: {
    show: boolean;
    title: string;
    message: string;
    ctaLabel: string;
    ctaHref: string;
  } | null;
  /**
   * Phase 20 — advisory outcome context. Present only when a terminal
   * application outcome exists AND evidence-backed focus candidates overlap
   * this plan. NEVER used to rank, filter, or replace actions: Phase 15
   * ordering stays driven by measured performance alone.
   */
  outcomeContext?: {
    headline: string;
    matches: { actionId: string; topic: string; reason: string }[];
    additionalFocus: { topic: string; reason: string; actionType: string }[];
    note: string;
  };
  partialDataBanner?: {
    title: string;
    message: string;
    ctaLabel: string;
    ctaHref: string;
  } | null;
  history: PreparationHistoryDay[];
  /**
   * Phase 18 — actions contributed by resume intelligence. These are additive:
   * they never modify the FIX/REINFORCE/REVIEW actions above, and a missing
   * resume keyword alone can never create a preparation task. `ALIGN` entries
   * only appear when Placement OS has independently measured weakness.
   */
  resumeActions?: ResumeAction[];
}

// ============================================================================
// 2. HELPER UTILITIES
// ============================================================================

function formatDisplayDate(dateObj: Date): string {
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateObj: Date): string {
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ============================================================================
// 3. DAILY EXECUTION PLAN GENERATOR
// ============================================================================

export async function getDailyExecutionPlan(
  userId: string,
  targetDateStr?: string
): Promise<DailyPreparationPlan> {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Invalid or unauthenticated user ID");
  }

  // 1. Resolve date boundaries (UTC day basis for determinism)
  const now = new Date();
  const dateStr = targetDateStr || now.toISOString().split("T")[0];
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
  const displayDate = formatDisplayDate(new Date(`${dateStr}T12:00:00.000Z`));

  // 2. Fetch baseline test ID & placement intelligence in parallel
  const baselineQuery = db
    .select({ id: tests.id })
    .from(tests)
    .where(eq(tests.type, "baseline"))
    .limit(1);

  const [baselineRows, intelligence] = await Promise.all([
    baselineQuery,
    getPlacementIntelligence(userId),
  ]);

  const baselineTestId = baselineRows[0]?.id || null;

  // Phase 18: resume-sourced actions are computed best-effort. A resume problem
  // can never break the preparation plan, so failures degrade to an empty list.
  const resumeActions: ResumeAction[] = await getResumeActions(userId).catch(() => []);

  // 3. Handle Zero-Data Experience
  if (!intelligence.hasBaseline || intelligence.dataSufficiency.hasCompletedBaseline === false) {
    return {
      userId,
      date: dateStr,
      displayDate,
      hasBaseline: false,
      hasEnoughData: false,
      isPartialData: false,
      status: "zero_data",
      actions: [],
      completedCount: 0,
      totalCount: 0,
      remainingCount: 0,
      inProgressCount: 0,
      partiallyCompletedCount: 0,
      progressPercent: 0,
      allCompleted: false,
      emptyState: {
        show: true,
        title: "BUILD YOUR BASELINE",
        message: "Complete an assessment to unlock your personalized preparation plan.",
        ctaLabel: "START ASSESSMENT",
        ctaHref: baselineTestId ? `/tests/${baselineTestId}` : "/assessment",
      },
      history: [],
      resumeActions,
    };
  }

  // 4. Query user's practice attempts to determine real execution state
  // Exclude baseline diagnostic tests; only count practice / mock tests for execution
  // A. In-progress attempts
  const inProgressAttempts = await db
    .select({
      attemptId: attempts.id,
      testId: attempts.testId,
      startedAt: attempts.startedAt,
    })
    .from(attempts)
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.status, "in_progress"),
        sql`${tests.type} != 'baseline'`
      )
    )
    .orderBy(desc(attempts.startedAt));

  // Query answered question count for each in-progress attempt to detect partial completion
  const inProgressAttemptIds = inProgressAttempts.map((a) => a.attemptId);
  const inProgressAnswerCounts =
    inProgressAttemptIds.length > 0
      ? await db
          .select({
            attemptId: answers.attemptId,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(answers)
          .where(inArray(answers.attemptId, inProgressAttemptIds))
          .groupBy(answers.attemptId)
      : [];

  const inProgressAnswerMap = new Map<string, number>();
  for (const row of inProgressAnswerCounts) {
    inProgressAnswerMap.set(row.attemptId, Number(row.count || 0));
  }

  // B. Completed attempts for today (excluding baseline)
  const todaySubmittedAttempts = await db
    .select({
      attemptId: attempts.id,
      testId: attempts.testId,
      score: attempts.score,
      accuracy: attempts.accuracy,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.status, "submitted"),
        sql`${tests.type} != 'baseline'`,
        gte(attempts.submittedAt, startOfDay),
        lte(attempts.submittedAt, endOfDay)
      )
    )
    .orderBy(desc(attempts.submittedAt));

  // C. Query past mistakes across all submitted attempts (for functional REVIEW action targeting)
  const pastMistakes = await db
    .select({
      topicId: questions.topicId,
      attemptId: attempts.id,
      testId: attempts.testId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(answers)
    .innerJoin(attempts, eq(answers.attemptId, attempts.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.status, "submitted"),
        eq(answers.isCorrect, false)
      )
    )
    .groupBy(questions.topicId, attempts.id, attempts.testId)
    .orderBy(desc(attempts.submittedAt));

  const topicMistakesMap = new Map<
    string,
    { attemptId: string; testId: string; mistakeCount: number }
  >();
  for (const m of pastMistakes) {
    if (!topicMistakesMap.has(m.topicId)) {
      topicMistakesMap.set(m.topicId, {
        attemptId: m.attemptId,
        testId: m.testId,
        mistakeCount: Number(m.count || 0),
      });
    }
  }

  // Combine all intelligence priorities and strengths
  const allCandidatesMap = new Map<string, (typeof intelligence.priorities)[0]>();
  for (const p of intelligence.priorities) {
    allCandidatesMap.set(p.topicId, p);
  }
  for (const s of intelligence.strengths) {
    if (!allCandidatesMap.has(s.topicId)) {
      allCandidatesMap.set(s.topicId, s);
    }
  }

  // D. Map tests to topics for quick matching
  const allCandidateTopicIds = Array.from(allCandidatesMap.keys());
  const relevantTestIds = [
    ...todaySubmittedAttempts.map((a) => a.testId),
    ...inProgressAttempts.map((a) => a.testId),
  ];

  const testTopicMapping = await db
    .select({
      testId: testQuestions.testId,
      topicId: questions.topicId,
    })
    .from(testQuestions)
    .innerJoin(questions, eq(testQuestions.questionId, questions.id))
    .where(
      relevantTestIds.length > 0 && allCandidateTopicIds.length > 0
        ? or(
            inArray(questions.topicId, allCandidateTopicIds),
            inArray(testQuestions.testId, relevantTestIds)
          )
        : allCandidateTopicIds.length > 0
        ? inArray(questions.topicId, allCandidateTopicIds)
        : undefined
    );

  const testToTopicsMap = new Map<string, Set<string>>();
  for (const row of testTopicMapping) {
    if (!testToTopicsMap.has(row.testId)) {
      testToTopicsMap.set(row.testId, new Set());
    }
    testToTopicsMap.get(row.testId)!.add(row.topicId);
  }

  // E. Query submitted answers today grouped by topicId (practice tests only)
  const todayTopicAnswers =
    allCandidateTopicIds.length > 0
      ? await db
          .select({
            topicId: questions.topicId,
            attemptId: answers.attemptId,
            isCorrect: answers.isCorrect,
            submittedAt: attempts.submittedAt,
          })
          .from(answers)
          .innerJoin(attempts, eq(answers.attemptId, attempts.id))
          .innerJoin(tests, eq(attempts.testId, tests.id))
          .innerJoin(questions, eq(answers.questionId, questions.id))
          .where(
            and(
              eq(attempts.userId, userId),
              eq(attempts.status, "submitted"),
              sql`${tests.type} != 'baseline'`,
              gte(attempts.submittedAt, startOfDay),
              lte(attempts.submittedAt, endOfDay),
              inArray(questions.topicId, allCandidateTopicIds)
            )
          )
      : [];

  const topicCompletionMap = new Map<
    string,
    {
      attemptId: string;
      totalCount: number;
      correctCount: number;
      submittedAt: Date | null;
    }
  >();

  for (const ans of todayTopicAnswers) {
    if (!topicCompletionMap.has(ans.topicId)) {
      topicCompletionMap.set(ans.topicId, {
        attemptId: ans.attemptId,
        totalCount: 0,
        correctCount: 0,
        submittedAt: ans.submittedAt,
      });
    }
    const acc = topicCompletionMap.get(ans.topicId)!;
    acc.totalCount += 1;
    if (ans.isCorrect === true) {
      acc.correctCount += 1;
    }
  }

  // 5. Select 2 to 4 priorities for today's plan
  // Preserve any topics active or completed today so progress is never lost across refreshes
  const activeOrCompletedTopicIds = new Set<string>();
  for (const [tId] of topicCompletionMap.entries()) {
    activeOrCompletedTopicIds.add(tId);
  }
  for (const att of todaySubmittedAttempts) {
    const tSet = testToTopicsMap.get(att.testId);
    if (tSet) {
      for (const tid of tSet) activeOrCompletedTopicIds.add(tid);
    }
  }
  for (const att of inProgressAttempts) {
    const tSet = testToTopicsMap.get(att.testId);
    if (tSet) {
      for (const tid of tSet) activeOrCompletedTopicIds.add(tid);
    }
  }

  // Fetch any active/completed topics that might have been sliced out of top priorities
  for (const tId of activeOrCompletedTopicIds) {
    if (!allCandidatesMap.has(tId)) {
      const tRows = await db
        .select({
          topicId: topics.id,
          topicName: topics.name,
          subjectCode: subjects.code,
          subjectName: subjects.name,
        })
        .from(topics)
        .innerJoin(subjects, eq(topics.subjectId, subjects.id))
        .where(eq(topics.id, tId))
        .limit(1);

      if (tRows.length > 0) {
        const row = tRows[0];
        allCandidatesMap.set(tId, {
          id: `priority-${tId}`,
          priorityNumber: "01",
          category: "FIX",
          domain: row.subjectCode,
          domainName: row.subjectName,
          topic: row.topicName,
          topicId: row.topicId,
          accuracy: 100,
          totalAttempts: 1,
          correctCount: 1,
          unansweredCount: 0,
          impact: "Target Practice Completed",
          why: "Targeted practice completed today.",
          evidence: "100% accuracy recorded in today's targeted practice.",
          action: `Continue building mastery in ${row.topicName}.`,
          ctaLabel: "Practice",
          ctaHref: `/practice?topicId=${row.topicId}&subjectCode=${row.subjectCode}`,
        });
      }
    }
  }

  const targetPlanCount = Math.min(Math.max(intelligence.priorities.length, 2), 3);
  const selectedPriorities: (typeof intelligence.priorities)[0][] = [];
  const addedTopicIds = new Set<string>();

  // A. First add priorities for topics active or completed today
  for (const [tId, cand] of allCandidatesMap.entries()) {
    if (activeOrCompletedTopicIds.has(tId) && !addedTopicIds.has(tId)) {
      selectedPriorities.push(cand);
      addedTopicIds.add(tId);
    }
  }

  // B. Fill remaining plan slots with top uncompleted priorities
  for (const p of intelligence.priorities) {
    if (selectedPriorities.length >= targetPlanCount) break;
    if (!addedTopicIds.has(p.topicId)) {
      selectedPriorities.push(p);
      addedTopicIds.add(p.topicId);
    }
  }

  // If student has 0 priorities but has baseline, provide fallback
  if (selectedPriorities.length === 0) {
    return {
      userId,
      date: dateStr,
      displayDate,
      hasBaseline: true,
      hasEnoughData: false,
      isPartialData: false,
      status: "ready",
      actions: [],
      completedCount: 0,
      totalCount: 0,
      remainingCount: 0,
      inProgressCount: 0,
      partiallyCompletedCount: 0,
      progressPercent: 100,
      allCompleted: true,
      emptyState: {
        show: false,
        title: "READINESS MAINTAINED",
        message: "All verified topics meet placement benchmarks. Take a timed mock test to preserve consistency.",
        ctaLabel: "TAKE MOCK TEST",
        ctaHref: "/tests",
      },
      history: [],
      resumeActions,
    };
  }

  // 6. Build Preparation Actions
  const actions: PreparationAction[] = [];

  for (let idx = 0; idx < selectedPriorities.length; idx++) {
    const p = selectedPriorities[idx];
    const order = idx + 1;
    const orderNumber = String(order).padStart(2, "0");

    // Action type mapping: FIX (<50%), REINFORCE (50-74%), REVIEW (>=75% or reviewable mistakes)
    let type: ExecutionActionType = "FIX";
    let targetCount = 15;
    let reason = p.why;
    let actionText = p.action;
    let ctaText = "START";
    let ctaHref = `/practice?topicId=${p.topicId}&subjectCode=${p.domain}`;
    let mistakesCount: number | undefined;

    const topicMistake = topicMistakesMap.get(p.topicId);

    if (p.category === "FIX") {
      type = "FIX";
      targetCount = 15;
      ctaText = "START";
    } else if (p.category === "REINFORCE") {
      type = "REINFORCE";
      targetCount = 10;
      ctaText = "START";
    } else {
      type = "REVIEW";
      targetCount = 5;
      ctaText = "REVIEW";
      if (topicMistake && topicMistake.mistakeCount > 0) {
        mistakesCount = topicMistake.mistakeCount;
        reason = `Previous mistakes recorded in this topic (${topicMistake.mistakeCount} incorrect items). Reviewing past errors eliminates recurring conceptual gaps.`;
        actionText = `Review previous mistakes from ${p.topic} to eliminate recurring errors.`;
        ctaHref = `/tests/${topicMistake.testId}/result?attemptId=${topicMistake.attemptId}`;
      } else {
        reason = p.why || "High mastery demonstrated. Periodic review maintains peak placement readiness under timed conditions.";
        actionText = `Review key questions and patterns in ${p.topic} to maintain accuracy.`;
      }
    }

    // Check completion state
    const topicCompletion = topicCompletionMap.get(p.topicId);

    // Also check if any today submitted attempt matches a test targeting this topic
    const directCompletedAttempt = todaySubmittedAttempts.find((att) => {
      const topicSet = testToTopicsMap.get(att.testId);
      return topicSet && topicSet.has(p.topicId);
    });

    // Check if there is an in-progress attempt for this topic
    const activeAttempt = inProgressAttempts.find((att) => {
      const topicSet = testToTopicsMap.get(att.testId);
      return topicSet && topicSet.has(p.topicId);
    });

    let status: ExecutionActionStatus = "PENDING";
    let inProgressAttemptId: string | undefined;
    let completedAttemptId: string | undefined;
    let completedAccuracy: number | undefined;
    let completedAt: string | undefined;
    let completedQuestionsCount = 0;

    if (directCompletedAttempt || (topicCompletion && topicCompletion.totalCount >= targetCount)) {
      status = "COMPLETED";
      ctaText = "COMPLETED";
      completedAttemptId = directCompletedAttempt?.attemptId || topicCompletion?.attemptId;
      completedQuestionsCount = topicCompletion?.totalCount || targetCount;

      if (topicCompletion && topicCompletion.totalCount > 0) {
        completedAccuracy = Math.round(
          (topicCompletion.correctCount / topicCompletion.totalCount) * 100
        );
      } else if (
        directCompletedAttempt?.accuracy !== null &&
        directCompletedAttempt?.accuracy !== undefined
      ) {
        completedAccuracy = directCompletedAttempt.accuracy;
      }
      completedAt = (
        directCompletedAttempt?.submittedAt ||
        topicCompletion?.submittedAt ||
        new Date()
      ).toISOString();

      if (completedAttemptId) {
        ctaHref = `/tests/${directCompletedAttempt?.testId || "targeted"}/result?attemptId=${completedAttemptId}`;
      }
    } else if (topicCompletion && topicCompletion.totalCount > 0) {
      // Submitted some questions today, but fewer than targetCount
      status = "PARTIALLY_COMPLETED";
      completedQuestionsCount = topicCompletion.totalCount;
      ctaText = "CONTINUE";
      ctaHref = `/practice?topicId=${p.topicId}&subjectCode=${p.domain}`;
    } else if (activeAttempt) {
      const savedAnswers = inProgressAnswerMap.get(activeAttempt.attemptId) || 0;
      inProgressAttemptId = activeAttempt.attemptId;
      ctaHref = `/tests/${activeAttempt.testId}/attempt`;
      completedQuestionsCount = savedAnswers;

      if (savedAnswers > 0) {
        status = "PARTIALLY_COMPLETED";
        ctaText = "CONTINUE";
      } else {
        status = "IN_PROGRESS";
        ctaText = "CONTINUE";
      }
    }

    actions.push({
      id: `exec-${dateStr}-${p.topicId}`,
      order,
      orderNumber,
      type,
      title: `${p.domain} → ${p.topic}`,
      domain: p.domain,
      domainName: p.domainName,
      topic: p.topic,
      topicId: p.topicId,
      reason,
      evidence: p.evidence,
      action: actionText,
      targetCount,
      completedQuestionsCount,
      currentAccuracy: p.accuracy,
      accuracy: p.accuracy,
      impact: p.impact,
      targetFocus: p.targetRelevance?.isTargetAligned ?? false,
      isTargetPriority: p.targetRelevance?.isTargetAligned ?? false,
      status,
      ctaText,
      ctaHref,
      practiceTarget: {
        topicId: p.topicId,
        subjectCode: p.domain,
        testId: directCompletedAttempt?.testId,
      },
      inProgressAttemptId,
      completedAttemptId,
      completedAccuracy,
      completedAt,
      mistakesCount,
    });
  }

  // 7. Calculate Progress
  const completedCount = actions.filter((a) => a.status === "COMPLETED").length;
  const partiallyCompletedCount = actions.filter(
    (a) => a.status === "PARTIALLY_COMPLETED"
  ).length;
  const inProgressCount = actions.filter(
    (a) => a.status === "IN_PROGRESS" || a.status === "PARTIALLY_COMPLETED"
  ).length;
  const totalCount = actions.length;
  const remainingCount = totalCount - completedCount;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  // 8. Partial Data Banner
  const partialDataBanner =
    intelligence.dataSufficiency.status === "limited_data"
      ? {
          title: "KEEP BUILDING YOUR BASELINE",
          message:
            "You have enough data for an initial daily plan, but completing more practice will calibrate recommendation precision.",
          ctaLabel: "CONTINUE PRACTICE",
          ctaHref: "/tests",
        }
      : null;

  // 9. Preparation History (Last 5 active days based on strictly real submitted attempts - NO fabrication)
  const pastAttempts = await db
    .select({
      attemptId: attempts.id,
      submittedAt: attempts.submittedAt,
      topicName: topics.name,
    })
    .from(attempts)
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .leftJoin(answers, eq(answers.attemptId, attempts.id))
    .leftJoin(questions, eq(answers.questionId, questions.id))
    .leftJoin(topics, eq(questions.topicId, topics.id))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.status, "submitted"),
        sql`${tests.type} != 'baseline'`
      )
    )
    .orderBy(desc(attempts.submittedAt));

  const historyMap = new Map<
    string,
    { date: string; displayDate: string; attemptIds: Set<string>; topics: Set<string> }
  >();

  for (const pa of pastAttempts) {
    if (!pa.submittedAt) continue;
    const dStr = pa.submittedAt.toISOString().split("T")[0];
    if (!historyMap.has(dStr)) {
      historyMap.set(dStr, {
        date: dStr,
        displayDate: formatShortDate(pa.submittedAt),
        attemptIds: new Set<string>(),
        topics: new Set<string>(),
      });
    }
    const dayEntry = historyMap.get(dStr)!;
    dayEntry.attemptIds.add(pa.attemptId);
    if (pa.topicName) {
      dayEntry.topics.add(pa.topicName);
    }
  }

  const history: PreparationHistoryDay[] = Array.from(historyMap.values())
    .slice(0, 5)
    .map((h) => {
      const realCompleted = h.attemptIds.size;
      const realTotal = Math.max(realCompleted, 1);
      const dayProgressPercent = 100;
      return {
        date: h.date,
        displayDate: h.displayDate,
        completedCount: realCompleted,
        totalCount: realTotal,
        progressPercent: dayProgressPercent,
        percent: dayProgressPercent,
        topicsCovered: Array.from(h.topics).slice(0, 3),
      };
    });

  return {
    userId,
    date: dateStr,
    displayDate,
    hasBaseline: true,
    hasEnoughData: actions.length > 0,
    isPartialData: intelligence.dataSufficiency.status === "limited_data",
    status: partialDataBanner ? "partial_data" : "ready",
    actions,
    completedCount,
    totalCount,
    remainingCount,
    inProgressCount,
    partiallyCompletedCount,
    progressPercent,
    allCompleted,
    emptyState: null,
    partialDataBanner,
    history,
    resumeActions,
    outcomeContext: await buildOutcomeContext(userId, actions),
  };
}

/**
 * Phase 20 — builds the advisory outcome context for the daily plan.
 *
 * An outcome influences the plan ONLY when:
 *  - a terminal outcome exists, and
 *  - the outcome's focus candidates carry real evidence (Phase 14/17/19
 *    provenance), and
 *  - a candidate matches a topic already selected by the measured-performance
 *    engine (annotated in `matches`), or surfaces as a labeled advisory entry
 *    in `additionalFocus` when the plan under-fills.
 *
 * It never reorders, removes, or adds actions to the core plan.
 */
async function buildOutcomeContext(
  userId: string,
  actions: PreparationAction[]
): Promise<DailyPreparationPlan["outcomeContext"]> {
  try {
    const { getOutcomePlanContext } = await import("@/server/outcome-intelligence");
    const context = await getOutcomePlanContext(userId);
    if (!context) return undefined;

    const actionTopics = new Map<string, string>();
    for (const a of actions) {
      actionTopics.set(a.topic.toLowerCase(), a.id);
      actionTopics.set(a.domain.toLowerCase(), a.id);
    }

    const matches: NonNullable<DailyPreparationPlan["outcomeContext"]>["matches"] = [];
    const additionalFocus: NonNullable<DailyPreparationPlan["outcomeContext"]>["additionalFocus"] = [];
    for (const candidate of context.focusCandidates) {
      const actionId = actionTopics.get(candidate.topic.toLowerCase());
      if (actionId) {
        matches.push({ actionId, topic: candidate.topic, reason: candidate.reason });
      } else if (additionalFocus.length < 2 && actions.length < 3) {
        // Advisory extra only when the plan has fewer than its usual 3 actions.
        additionalFocus.push({
          topic: candidate.topic,
          reason: candidate.reason,
          actionType: candidate.actionType,
        });
      }
    }

    if (matches.length === 0 && additionalFocus.length === 0) return undefined;

    return {
      headline: context.headline,
      matches,
      additionalFocus,
      note: context.note,
    };
  } catch {
    // Outcome layer unavailable — the plan is complete without it.
    return undefined;
  }
}

// Re-export for convenience
export { getOrCreateTargetedPracticeTest };
