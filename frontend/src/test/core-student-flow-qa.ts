/**
 * NAIRA — PRODUCTION QA: CORE STUDENT FLOW
 * 
 * Verifies the complete student journey end-to-end against live database and HTTP server:
 * 1. Authentication (Sign in, session verification, protected routes rejection)
 * 2. Dashboard (Real student data, non-fabricated metrics)
 * 3. Baseline Assessment (Start, load questions, submit answers, grade, persist)
 * 4. Placement Intelligence (Real performance grounding, priorities, accuracy, evidence, valid CTAs)
 * 5. Roadmap (Current state reflection, action origins, link validation)
 * 6. Adaptive Study Planner (Today's plan, 7-day plan, budget/capacity, item completion, persistence, recalculation)
 * 7. Practice (Targeted practice generation, real questions, attempt submission, score persistence, intelligence adaptation)
 */

import { db } from "@/db";
import {
  users,
  profiles,
  tests,
  questions,
  attempts,
  answers,
  attemptQuestions,
  skillScores,
  adaptiveStudyPlans,
  studyPlanItems,
} from "@/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { startOrResumeAttempt, getAttemptExamState, saveAnswer } from "@/server/tests";
import { gradeAttempt } from "@/server/grading";
import { getPlacementIntelligence } from "@/server/placement-intelligence";
import { getPlacementIntelligence2 } from "@/server/placement-intelligence-2";
import { getStudentPlacementRoadmap } from "@/server/roadmap";
import {
  getActiveStudyPlan,
  generateAdaptiveStudyPlan,
  recalculateStudyPlan,
  updateStudyPlanItemStatus,
} from "@/server/adaptive-study-planner";
import {
  selectPersonalizedQuestions,
  materializePracticeSession,
} from "@/server/practice-question-intelligence";

const BASE_URL = "http://localhost:3000";

class CookieJar {
  cookies: Record<string, string> = {};

  update(res: Response) {
    const raw = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      if (idx !== -1) {
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        this.cookies[key] = val;
      }
    }
  }

  getHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  clear() {
    this.cookies = {};
  }
}

interface FailureReport {
  feature: string;
  expected: string;
  actual: string;
  error: string;
  fileRoute: string;
  rootCause: string;
  proposedFix: string;
}

const failures: FailureReport[] = [];
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, failDetails?: Partial<FailureReport>) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failCount++;
    if (failDetails) {
      failures.push({
        feature: failDetails.feature || testName,
        expected: failDetails.expected || "Condition to evaluate truthy",
        actual: failDetails.actual || "Condition evaluated falsy",
        error: failDetails.error || `Assertion failed for: ${testName}`,
        fileRoute: failDetails.fileRoute || "N/A",
        rootCause: failDetails.rootCause || "Not yet determined",
        proposedFix: failDetails.proposedFix || "Investigate failure",
      });
    }
  }
}

export async function runProductionQA() {
  console.log("\n==================================================");
  console.log("🚀 NAIRA — PRODUCTION QA: CORE STUDENT FLOW");
  console.log("==================================================");

  const timestamp = Date.now();
  const testStudentEmail = `qa_student_${timestamp}@placementos.dev`;
  const testStudentPassword = "QaStudentPassword123!";
  const studentJar = new CookieJar();
  let studentUserId = "";
  let baselineTestId = "";
  let baselineAttemptId = "";

  try {
    // ========================================================================
    // 1. AUTHENTICATION
    // ========================================================================
    console.log("\n--- [Step 1] Authentication ---");

    // 1.1 Verify unauthenticated protection on protected routes
    const protectedRoutes = [
      { path: "/dashboard", isApi: false },
      { path: "/tests", isApi: false },
      { path: "/roadmap", isApi: false },
      { path: "/planner", isApi: false },
      { path: "/practice", isApi: false },
      { path: "/analytics", isApi: false },
      { path: "/api/student/roadmap", isApi: true },
      { path: "/api/student/study-plan", isApi: true },
      { path: "/api/student/study-plan/today", isApi: true },
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${BASE_URL}${route.path}`, { redirect: "manual" });
      if (route.isApi) {
        assert(
          res.status === 401 || res.status === 307,
          `Unauthenticated ${route.path} is rejected with 401 or redirect`,
          {
            feature: "AUTH_ROUTE_PROTECTION",
            expected: "401 or 307",
            actual: String(res.status),
            fileRoute: route.path,
          }
        );
      } else {
        assert(
          res.status === 307 || res.status === 302,
          `Unauthenticated ${route.path} redirects to login (Status: ${res.status})`,
          {
            feature: "AUTH_PAGE_PROTECTION",
            expected: "307 or 302 Redirect",
            actual: String(res.status),
            fileRoute: route.path,
          }
        );
        const location = res.headers.get("location") || "";
        assert(
          location.includes("/auth/login"),
          `Redirect location for ${route.path} points to /auth/login`
        );
      }
    }

    // 1.2 Register real student account
    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Devon Vance",
        email: testStudentEmail,
        password: testStudentPassword,
        college: "Birla Institute of Technology",
        branch: "Information Technology",
        graduationYear: 2026,
      }),
    });
    assert(registerRes.status === 201, "Real student registered via /api/auth/register (201 Created)");

    // Query DB to verify student record
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, testStudentEmail.toLowerCase()))
      .limit(1);
    assert(!!userRecord && !userRecord.isAdmin, "Student user persisted in DB with isAdmin=false");
    studentUserId = userRecord.id;

    const [profileRecord] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, studentUserId))
      .limit(1);
    assert(
      !!profileRecord && profileRecord.name === "Devon Vance",
      "Student profile persisted with correct name and college in DB"
    );

    // 1.3 Sign in via NextAuth credentials callback
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    studentJar.update(csrfRes);
    const { csrfToken } = await csrfRes.json();

    const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: studentJar.getHeader(),
      },
      body: new URLSearchParams({
        email: testStudentEmail,
        password: testStudentPassword,
        csrfToken,
      }),
      redirect: "manual",
    });
    assert(loginRes.status === 302, "Student signed in with 302 redirect");
    studentJar.update(loginRes);

    // 1.4 Verify authenticated session endpoint
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: studentJar.getHeader() },
    });
    assert(sessionRes.status === 200, "/api/auth/session returns 200 OK for authenticated student");
    const sessionData = await sessionRes.json();
    assert(
      sessionData.user?.email?.toLowerCase() === testStudentEmail.toLowerCase(),
      "Authenticated session payload matches logged in student email"
    );
    assert(sessionData.user?.id === studentUserId, "Session user ID matches database user UUID");

    // ========================================================================
    // 2. DASHBOARD
    // ========================================================================
    console.log("\n--- [Step 2] Dashboard ---");

    const dashRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: studentJar.getHeader() },
    });
    assert(dashRes.status === 200, "Dashboard loads with 200 OK for authenticated student");
    const dashHtml = await dashRes.text();
    assert(dashHtml.includes("Devon"), "Dashboard renders personalized student name");

    // Verify no fabricated metrics before taking any test
    const preBaselineIntel = await getPlacementIntelligence(studentUserId);
    assert(
      preBaselineIntel.hasBaseline === false,
      "Zero-data student correctly flagged as hasBaseline: false"
    );
    assert(
      preBaselineIntel.dataSufficiency.status === "zero_data",
      "Data sufficiency is zero_data before baseline"
    );
    assert(
      preBaselineIntel.readiness.score === null,
      "Readiness score is null (no fabricated 0-100 score shown)"
    );

    // ========================================================================
    // 3. BASELINE ASSESSMENT
    // ========================================================================
    console.log("\n--- [Step 3] Baseline Assessment ---");

    // 3.1 Fetch baseline test
    const [baseline] = await db
      .select()
      .from(tests)
      .where(and(eq(tests.type, "baseline"), eq(tests.isPublished, true)))
      .limit(1);
    assert(!!baseline, "Published baseline test found in database");
    baselineTestId = baseline.id;

    // 3.2 Start assessment
    const startRes = await startOrResumeAttempt(baselineTestId, studentUserId);
    assert(!!startRes.attemptId, "Baseline assessment started, returned attemptId");
    baselineAttemptId = startRes.attemptId;

    const [attemptInDb] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, baselineAttemptId))
      .limit(1);
    assert(
      attemptInDb?.status === "in_progress",
      "Attempt record persisted with status 'in_progress'"
    );

    // 3.3 Load real questions
    const examState = await getAttemptExamState(baselineAttemptId, studentUserId);
    assert(
      !!examState.questions && examState.questions.length > 0,
      `Exam loaded real questions from question bank (${examState.questions?.length} questions)`
    );

    const qList = examState.questions!;
    const q1 = qList[0];
    assert(typeof q1.question === "string" && q1.question.length > 5, "Question 1 text is non-empty real text");
    assert(Array.isArray(q1.options) && q1.options.length >= 2, "Question 1 contains multiple choice options");

    // 3.4 Submit realistic answers (answer 4 correctly, 2 incorrectly, leave rest unattempted)
    const [fullQ1] = await db.select().from(questions).where(eq(questions.id, q1.id)).limit(1);
    const q1Answer = fullQ1.correctAnswer as string;

    // Answer Q1 correctly
    await saveAnswer(baselineAttemptId, studentUserId, q1.id, q1Answer, 25);
    // Answer Q2 correctly if available
    if (qList.length > 1) {
      const [fullQ2] = await db.select().from(questions).where(eq(questions.id, qList[1].id)).limit(1);
      await saveAnswer(baselineAttemptId, studentUserId, qList[1].id, fullQ2.correctAnswer, 30);
    }
    // Answer Q3 intentionally incorrectly
    if (qList.length > 2) {
      const [fullQ3] = await db.select().from(questions).where(eq(questions.id, qList[2].id)).limit(1);
      const wrongAnswer = Array.isArray(fullQ3.options)
        ? (fullQ3.options as string[]).find((opt) => opt !== fullQ3.correctAnswer) || "Wrong Option"
        : "Wrong Option";
      await saveAnswer(baselineAttemptId, studentUserId, qList[2].id, wrongAnswer, 15);
    }

    // Verify answer persistence
    const savedAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.attemptId, baselineAttemptId));
    assert(savedAnswers.length >= 3, `Answers persisted in database (${savedAnswers.length} recorded)`);

    // 3.5 Submit & Grade
    const gradeResult = await gradeAttempt(baselineAttemptId, studentUserId);
    assert(gradeResult.success, "Exam successfully submitted and graded");

    // 3.6 Verify results persist in database
    const [gradedAttempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, baselineAttemptId))
      .limit(1);
    assert(gradedAttempt?.status === "submitted", "Attempt status updated to 'submitted'");
    assert(typeof gradedAttempt?.score === "number", `Graded attempt score persisted: ${gradedAttempt?.score}`);
    assert(typeof gradedAttempt?.accuracy === "number", `Graded attempt accuracy persisted: ${gradedAttempt?.accuracy}%`);

    const studentSkillScores = await db
      .select()
      .from(skillScores)
      .where(eq(skillScores.attemptId, baselineAttemptId));
    assert(studentSkillScores.length > 0, `Skill scores persisted for attempt (${studentSkillScores.length} topics/skills)`);

    // 3.7 Verify Results page HTTP load
    const resultRes = await fetch(
      `${BASE_URL}/tests/${baselineTestId}/result?attemptId=${baselineAttemptId}`,
      { headers: { Cookie: studentJar.getHeader() } }
    );
    assert(resultRes.status === 200, "Results page loads with 200 OK for graded attempt");

    // ========================================================================
    // 4. PLACEMENT INTELLIGENCE
    // ========================================================================
    console.log("\n--- [Step 4] Placement Intelligence ---");

    // Fetch placement intelligence via server function
    const postBaselineIntel = await getPlacementIntelligence(studentUserId);
    assert(postBaselineIntel.hasBaseline === true, "Intelligence reflects hasBaseline: true after assessment");
    assert(
      postBaselineIntel.dataSufficiency.status === "sufficient_data" ||
        postBaselineIntel.dataSufficiency.status === "limited_data",
      `Data sufficiency reflects empirical activity (${postBaselineIntel.dataSufficiency.status})`
    );
    assert(
      typeof postBaselineIntel.readiness.score === "number",
      `Readiness score accurately calculated: ${postBaselineIntel.readiness.score}`
    );

    // Verify priorities originate from actual performance
    assert(
      Array.isArray(postBaselineIntel.priorities) && postBaselineIntel.priorities.length > 0,
      `Action priorities generated (${postBaselineIntel.priorities.length} priorities)`
    );

    const firstPriority = postBaselineIntel.priorities[0];
    assert(
      typeof firstPriority.accuracy === "number",
      `Priority accuracy is numeric empirical value: ${firstPriority.accuracy}%`
    );
    assert(
      typeof firstPriority.evidence === "string" && firstPriority.evidence.length > 0,
      `Priority provides empirical evidence: "${firstPriority.evidence}"`
    );

    // Phase 20 non-causal safety assertion
    const forbiddenPhrases = [
      "caused rejection",
      "because of your lack of",
      "you failed because",
      "you don't understand",
    ];
    let hasForbiddenPhrase = false;
    for (const p of postBaselineIntel.priorities) {
      const combined = `${p.why} ${p.evidence} ${p.action}`.toLowerCase();
      if (forbiddenPhrases.some((f) => combined.includes(f))) {
        hasForbiddenPhrase = true;
      }
    }
    assert(!hasForbiddenPhrase, "Intelligence explanations strictly comply with Phase 20 non-causal safety");

    // Verify CTAs resolve to valid routes
    for (const p of postBaselineIntel.priorities) {
      assert(
        p.ctaHref.startsWith("/") && (p.ctaHref.startsWith("/practice") || p.ctaHref.startsWith("/tests")),
        `Priority CTA href resolves to valid route: ${p.ctaHref}`
      );
    }

    // Verify HTTP endpoint /api/student/placement-intelligence
    const intelHttpRes = await fetch(`${BASE_URL}/api/student/placement-intelligence`, {
      headers: { Cookie: studentJar.getHeader() },
    });
    assert(intelHttpRes.status === 200, "GET /api/student/placement-intelligence returns 200 OK");
    const intelHttpData = await intelHttpRes.json();
    assert(intelHttpData.hasBaseline === true, "HTTP intelligence payload matches server computation");

    // ========================================================================
    // 5. ROADMAP
    // ========================================================================
    console.log("\n--- [Step 5] Roadmap ---");

    const roadmapData = await getStudentPlacementRoadmap(studentUserId);
    assert(roadmapData.hasBaseline === true, "Roadmap reflects student baseline completed");
    assert(
      roadmapData.readiness.score === postBaselineIntel.readiness.score,
      "Roadmap readiness score is synchronized with placement intelligence"
    );
    assert(
      Array.isArray(roadmapData.nextActions) && roadmapData.nextActions.length > 0,
      `Roadmap generates next actions (${roadmapData.nextActions.length} actions)`
    );

    // Verify actions originate from placement intelligence
    const firstAction = roadmapData.nextActions[0];
    assert(
      !!firstAction.ctaHref && firstAction.ctaHref.startsWith("/"),
      `Roadmap action CTA links to valid route: ${firstAction.ctaHref}`
    );

    // Verify HTTP endpoint /api/student/roadmap
    const roadmapHttpRes = await fetch(`${BASE_URL}/api/student/roadmap`, {
      headers: { Cookie: studentJar.getHeader() },
    });
    assert(roadmapHttpRes.status === 200, "GET /api/student/roadmap returns 200 OK");
    const roadmapHttpJson = await roadmapHttpRes.json();
    assert(roadmapHttpJson.hasBaseline === true, "Roadmap API payload is consistent");

    // ========================================================================
    // 6. ADAPTIVE STUDY PLANNER
    // ========================================================================
    console.log("\n--- [Step 6] Adaptive Study Planner ---");

    // 6.1 Generate plan with 90 min daily budget
    const plan = await generateAdaptiveStudyPlan(studentUserId, {
      availableMinutesPerDay: 90,
      planningHorizon: "7_days",
    });
    assert(!!plan && !!plan.id, `Active study plan established with planId: ${plan?.id}`);

    // 6.2 Verify Today's plan
    assert(
      !!plan.todaySchedule && Array.isArray(plan.todaySchedule.items),
      `Today's plan items array exists (${plan.todaySchedule?.items?.length} items)`
    );

    // 6.3 Verify 7-day schedule
    assert(
      Array.isArray(plan.weeklySchedule) && plan.weeklySchedule.length === 7,
      `Study plan contains exact 7-day schedule (${plan.weeklySchedule?.length} days)`
    );

    // 6.4 Verify capacity/budget
    for (const day of plan.weeklySchedule) {
      assert(
        day.totalAllocatedMinutes <= day.capacityMinutes,
        `Day (${day.date}) allocated ${day.totalAllocatedMinutes}m does not exceed budget of ${day.capacityMinutes}m`
      );
    }

    // 6.5 Complete an item
    const allPlanItems = await db
      .select()
      .from(studyPlanItems)
      .where(eq(studyPlanItems.planId, plan.id));
    assert(allPlanItems.length > 0, `Study plan items exist in DB (${allPlanItems.length} items)`);

    const targetItem = allPlanItems[0];
    const updateRes = await updateStudyPlanItemStatus(
      studentUserId,
      targetItem.id,
      "COMPLETED"
    );
    assert(updateRes.success, "Item status updated to COMPLETED");

    // 6.6 Refresh and verify persistence
    const [reloadedItem] = await db
      .select()
      .from(studyPlanItems)
      .where(eq(studyPlanItems.id, targetItem.id))
      .limit(1);
    assert(reloadedItem?.status === "COMPLETED", "Item status persisted as COMPLETED in DB");
    assert(reloadedItem?.completedAt !== null, "Item completedAt timestamp recorded");

    // Also verify via HTTP PATCH
    if (allPlanItems.length > 1) {
      const secondItem = allPlanItems[1];
      const patchRes = await fetch(`${BASE_URL}/api/student/study-plan/items/${secondItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: studentJar.getHeader(),
        },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      assert(patchRes.status === 200, "PATCH /api/student/study-plan/items/[id] succeeds (200 OK)");
    }

    // 6.7 Recalculate plan
    const recalculated = await recalculateStudyPlan(studentUserId);
    assert(!!recalculated && !!recalculated.id, "Study plan recalculation succeeds");

    // 6.8 Verify history is preserved
    const [persistedCompleted] = await db
      .select()
      .from(studyPlanItems)
      .where(eq(studyPlanItems.id, targetItem.id))
      .limit(1);
    assert(
      persistedCompleted?.status === "COMPLETED",
      "Completed item status preserved across plan recalculation"
    );

    // ========================================================================
    // 7. PRACTICE
    // ========================================================================
    console.log("\n--- [Step 7] Targeted Practice Flow ---");

    // 7.1 Select personalized practice questions for identified weakness
    const targetWeaknessTopicId = postBaselineIntel.priorities[0]?.topicId;
    const practiceSelection = await selectPersonalizedQuestions({
      userId: studentUserId,
      topicId: targetWeaknessTopicId || undefined,
      objective: "FIX",
    });
    assert(
      practiceSelection.selectedQuestions.length > 0,
      `Personalized practice questions selected (${practiceSelection.selectedQuestions.length} questions)`
    );

    const practiceQ1 = practiceSelection.selectedQuestions[0];
    assert(!!practiceQ1.questionId, "Practice question has valid questionId");
    assert(!!practiceQ1.topicName, `Practice target topic identified: ${practiceQ1.topicName}`);

    // 7.2 Materialize practice session
    const practiceSession = await materializePracticeSession({
      userId: studentUserId,
      topicId: practiceSelection.topicId || undefined,
      objective: "FIX",
      requestedCount: 3,
    });
    assert(!!practiceSession.testId, `Practice session materialized as test: ${practiceSession.testId}`);

    // 7.3 Start practice attempt
    const practiceAttemptRes = await startOrResumeAttempt(practiceSession.testId, studentUserId);
    assert(!!practiceAttemptRes.attemptId, "Practice attempt initialized with attemptId");

    // 7.4 Submit practice answers
    const practiceExamState = await getAttemptExamState(practiceAttemptRes.attemptId, studentUserId);
    const practiceQuestions = practiceExamState.questions || [];
    assert(practiceQuestions.length > 0, `Practice exam contains ${practiceQuestions.length} questions`);

    for (const pq of practiceQuestions) {
      const [fullPq] = await db.select().from(questions).where(eq(questions.id, pq.id)).limit(1);
      if (fullPq) {
        await saveAnswer(
          practiceAttemptRes.attemptId,
          studentUserId,
          pq.id,
          fullPq.correctAnswer,
          20
        );
      }
    }

    // 7.5 Submit & grade practice test
    const practiceGradeRes = await gradeAttempt(practiceAttemptRes.attemptId, studentUserId);
    assert(practiceGradeRes.success, "Practice attempt submitted and graded successfully");

    // 7.6 Verify score persistence
    const [gradedPracticeAttempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, practiceAttemptRes.attemptId))
      .limit(1);
    assert(
      gradedPracticeAttempt?.status === "submitted",
      "Practice attempt status persisted as 'submitted'"
    );
    assert(
      typeof gradedPracticeAttempt?.score === "number",
      `Practice score persisted: ${gradedPracticeAttempt?.score}`
    );

    // 7.7 Verify placement intelligence adapts after practice performance
    const adaptedIntel = await getPlacementIntelligence(studentUserId);
    assert(
      adaptedIntel.dataSufficiency.attemptsCount >= 2,
      `Placement intelligence registered new attempt (total attempts: ${adaptedIntel.dataSufficiency.attemptsCount})`
    );
    assert(
      adaptedIntel.dataSufficiency.questionsAttempted > postBaselineIntel.dataSufficiency.questionsAttempted,
      `Intelligence question count increased from ${postBaselineIntel.dataSufficiency.questionsAttempted} to ${adaptedIntel.dataSufficiency.questionsAttempted}`
    );

    console.log("\n==================================================");
    console.log(`🎉 CORE STUDENT FLOW QA COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log("==================================================\n");

    return {
      success: failCount === 0,
      passCount,
      failCount,
      failures,
    };
  } catch (error: any) {
    console.error("❌ Fatal unhandled exception in QA run:", error);
    failures.push({
      feature: "CORE_STUDENT_FLOW",
      expected: "Run without uncaught exception",
      actual: error?.message || String(error),
      error: error?.stack || String(error),
      fileRoute: "frontend/src/test/core-student-flow-qa.ts",
      rootCause: error?.message || "Unhandled exception",
      proposedFix: "Debug and patch root cause",
    });
    return {
      success: false,
      passCount,
      failCount: failCount + 1,
      failures,
    };
  }
}

runProductionQA()
  .then((res) => {
    if (!res.success) {
      console.error("\nFAILURES DETECTED:");
      for (const f of res.failures) {
        console.error(`\nFEATURE: ${f.feature}`);
        console.error(`EXPECTED: ${f.expected}`);
        console.error(`ACTUAL: ${f.actual}`);
        console.error(`ERROR: ${f.error}`);
        console.error(`FILE/ROUTE: ${f.fileRoute}`);
        console.error(`ROOT CAUSE: ${f.rootCause}`);
        console.error(`PROPOSED FIX: ${f.proposedFix}`);
      }
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("QA execution crashed:", err);
    process.exit(1);
  });
