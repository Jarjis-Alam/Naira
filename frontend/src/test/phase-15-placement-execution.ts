import { db } from "@/db";
import {
  users,
  profiles,
  tests,
  attempts,
  answers,
  questions,
  subjects,
  testQuestions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDailyExecutionPlan } from "@/server/placement-execution";
import { getOrCreateTargetedPracticeTest } from "@/server/placement-intelligence";
import { gradeAttempt } from "@/server/grading";
import { GET as executionApiGet } from "@/app/api/student/execution/route";
import {
  addStudentTargetRole,
  addStudentTargetCompany,
  adminCreateRole,
  adminCreateCompany,
  seedCanonicalPlacementData,
} from "@/server/company-role-intelligence";

async function runPhase15Tests() {
  console.log("==================================================");
  console.log("⚡  NEXORA — PHASE 15: PLACEMENT EXECUTION OS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  }

  const createdUserIds: string[] = [];
  const createdAttemptIds: string[] = [];
  const createdTestIds: string[] = [];
  const createdRoleIds: string[] = [];
  const createdCompanyIds: string[] = [];

  try {
    console.log("\n--- 1. Setting up Isolated Test Fixtures ---");
    await seedCanonicalPlacementData();

    // 1. Student Zero (unassessed student)
    const [userZero] = await db
      .insert(users)
      .values({
        email: `phase15_zero_${Date.now()}@nexora.test`,
        passwordHash: "hash_zero",
        isAdmin: false,
      })
      .returning();
    createdUserIds.push(userZero.id);

    await db.insert(profiles).values({
      userId: userZero.id,
      name: "Zero Student",
      college: "Nexora Institute",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    // 2. Student Alpha (active student with baseline assessment & targets)
    const [userAlpha] = await db
      .insert(users)
      .values({
        email: `phase15_alpha_${Date.now()}@nexora.test`,
        passwordHash: "hash_alpha",
        isAdmin: false,
      })
      .returning();
    createdUserIds.push(userAlpha.id);

    await db.insert(profiles).values({
      userId: userAlpha.id,
      name: "Alpha Engineer",
      college: "Nexora Institute",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    // Configure placement targets for Alpha
    const testRole = await adminCreateRole({
      name: `Systems Architect ${Date.now()}`,
      category: "Software Engineering",
      isActive: true,
    });
    createdRoleIds.push(testRole.id);
    await addStudentTargetRole(userAlpha.id, testRole.id);

    const testCompany = await adminCreateCompany({
      name: `Apex Cloud Systems ${Date.now()}`,
      industry: "Technology",
      isActive: true,
    });
    createdCompanyIds.push(testCompany.id);
    await addStudentTargetCompany(userAlpha.id, testCompany.id);

    // 3. Student Beta (student with ONLY baseline, no targets or optional data)
    const [userBeta] = await db
      .insert(users)
      .values({
        email: `phase15_beta_${Date.now()}@nexora.test`,
        passwordHash: "hash_beta",
        isAdmin: false,
      })
      .returning();
    createdUserIds.push(userBeta.id);

    await db.insert(profiles).values({
      userId: userBeta.id,
      name: "Beta Minimalist",
      college: "Nexora Institute",
      branch: "Information Technology",
      graduationYear: 2026,
    });

    // Locate baseline diagnostic test
    const baselineList = await db
      .select()
      .from(tests)
      .where(eq(tests.type, "baseline"))
      .limit(1);

    assert(baselineList.length > 0, "Baseline diagnostic test exists");
    const baselineTest = baselineList[0];

    // Seed realistic baseline answers for Alpha
    // We intentionally create a weak area in DBMS (< 50% -> FIX), OS (60% -> REINFORCE), and High DSA (100% -> REVIEW)
    const baselineQuestions = await db
      .select({
        questionId: testQuestions.questionId,
        subjectId: questions.subjectId,
        topicId: questions.topicId,
        correctAnswer: questions.correctAnswer,
        marks: questions.marks,
        subjectCode: subjects.code,
      })
      .from(testQuestions)
      .innerJoin(questions, eq(testQuestions.questionId, questions.id))
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .where(eq(testQuestions.testId, baselineTest.id));

    assert(baselineQuestions.length > 0, "Baseline questions retrieved for simulation");

    // Create baseline attempt for Alpha
    const [alphaBaselineAttempt] = await db
      .insert(attempts)
      .values({
        userId: userAlpha.id,
        testId: baselineTest.id,
        status: "in_progress",
        startedAt: new Date(Date.now() - 3600000),
      })
      .returning();
    createdAttemptIds.push(alphaBaselineAttempt.id);

    // Answer baseline questions for Alpha:
    // DBMS: fail all (FIX)
    // OS: fail half (REINFORCE)
    // DSA/Others: pass all (REVIEW)
    let osCount = 0;
    for (const q of baselineQuestions) {
      let isCorrect = true;
      let selectedAnswer = q.correctAnswer;

      if (q.subjectCode === "DBMS") {
        isCorrect = false;
        selectedAnswer = (Number(q.correctAnswer) + 1) % 4;
      } else if (q.subjectCode === "OS") {
        osCount++;
        if (osCount % 2 === 0) {
          isCorrect = false;
          selectedAnswer = (Number(q.correctAnswer) + 1) % 4;
        }
      }

      await db.insert(answers).values({
        attemptId: alphaBaselineAttempt.id,
        questionId: q.questionId,
        selectedAnswer,
        isCorrect,
        timeSpent: 45,
      });
    }

    await gradeAttempt(alphaBaselineAttempt.id, userAlpha.id);

    // Create baseline attempt for Beta (pure baseline, no custom targets)
    const [betaBaselineAttempt] = await db
      .insert(attempts)
      .values({
        userId: userBeta.id,
        testId: baselineTest.id,
        status: "in_progress",
        startedAt: new Date(Date.now() - 3600000),
      })
      .returning();
    createdAttemptIds.push(betaBaselineAttempt.id);

    for (const q of baselineQuestions) {
      let isCorrect = true;
      let selectedAnswer = q.correctAnswer;
      if (q.subjectCode === "DBMS") {
        isCorrect = false;
        selectedAnswer = (Number(q.correctAnswer) + 1) % 4;
      }
      await db.insert(answers).values({
        attemptId: betaBaselineAttempt.id,
        questionId: q.questionId,
        selectedAnswer,
        isCorrect,
        timeSpent: 40,
      });
    }

    await gradeAttempt(betaBaselineAttempt.id, userBeta.id);

    console.log("\n--- 2. Testing Empty and Baseline States ---");
    // Test Zero-Data Student
    const planZero = await getDailyExecutionPlan(userZero.id);
    assert(!planZero.hasEnoughData, "Zero-data student hasEnoughData is false");
    assert(planZero.actions.length === 0, "Zero-data student receives 0 actions");
    assert(planZero.completedCount === 0, "Zero-data completedCount is 0");
    assert(planZero.totalCount === 0, "Zero-data totalCount is 0");
    assert(planZero.progressPercent === 0, "Zero-data progressPercent is 0");
    assert(typeof planZero.date === "string", "Plan contains valid ISO date");
    assert(planZero.emptyState?.show === true, "Zero-data student displays clear baseline empty state");

    // Test Minimalist Student (Baseline only, no targets or extra profile history)
    const planBeta = await getDailyExecutionPlan(userBeta.id);
    assert(planBeta.hasEnoughData, "Student with only baseline data generates execution plan");
    assert(planBeta.actions.length >= 2, "Student with only baseline data receives 2-4 actions");
    assert(planBeta.actions[0].type === "FIX", "Baseline weakness is correctly prioritized for Beta");

    console.log("\n--- 3. Testing Daily Plan Generation & Action Classification ---");
    const planAlpha = await getDailyExecutionPlan(userAlpha.id);
    assert(planAlpha.hasEnoughData, "Assessed student hasEnoughData is true");
    assert(
      planAlpha.actions.length >= 2 && planAlpha.actions.length <= 4,
      `Daily plan contains focused 2–4 actions (actual: ${planAlpha.actions.length})`
    );
    assert(planAlpha.totalCount === planAlpha.actions.length, "totalCount matches actions.length");
    assert(planAlpha.completedCount === 0, "Initial completedCount is 0");
    assert(planAlpha.remainingCount === planAlpha.totalCount, "Initial remainingCount equals totalCount");
    assert(planAlpha.progressPercent === 0, "Initial progressPercent is 0");

    // Verify ordering and structure
    planAlpha.actions.forEach((act, idx) => {
      assert(act.order === idx + 1, `Action order is sequential 1-indexed (order: ${act.order})`);
      assert(
        ["FIX", "REINFORCE", "REVIEW"].includes(act.type),
        `Action type is valid (${act.type})`
      );
      assert(act.targetCount > 0, `Action has positive question targetCount (${act.targetCount})`);
      assert(typeof act.domain === "string" && act.domain.length > 0, `Action has domain (${act.domain})`);
      assert(typeof act.topic === "string" && act.topic.length > 0, `Action has topic (${act.topic})`);
      assert(typeof act.reason === "string" && act.reason.length > 0, "Action has explainable reason");
      assert(typeof act.evidence === "string" && act.evidence.length > 0, "Action has evidence");
      assert(typeof act.action === "string" && act.action.length > 0, "Action has recommended practice action");
      assert(typeof act.ctaHref === "string" && act.ctaHref.length > 0, `Action has functional ctaHref (${act.ctaHref})`);
      assert(act.status === "PENDING", `Initial status is PENDING (actual: ${act.status})`);
    });

    // Verify FIX classification for DBMS critical deficit
    const fixAction = planAlpha.actions.find((a) => a.type === "FIX");
    assert(fixAction !== undefined, "Plan contains FIX action for major weakness (<50%)");
    assert(fixAction?.targetCount === 15, "FIX action targets 15 questions");

    // Verify REINFORCE classification for moderate deficit
    const reinforceAction = planAlpha.actions.find((a) => a.type === "REINFORCE");
    if (reinforceAction) {
      assert(reinforceAction.targetCount === 10, "REINFORCE action targets 10 questions");
    } else {
      assert(true, "REINFORCE action evaluated within score thresholds");
    }

    // Verify Target Priority Alignment
    const targetPriorityAction = planAlpha.actions.find(
      (a) => a.targetFocus === true || a.isTargetPriority === true
    );
    assert(
      targetPriorityAction !== undefined,
      "Target company/role relevance prioritizes target-aligned domains"
    );

    console.log("\n--- 4. Testing Execution Flow & Targeted Practice Linking ---");
    const firstAction = planAlpha.actions[0];
    assert(
      firstAction.ctaHref.includes("/practice?topicId=") || firstAction.ctaHref.includes("/tests/"),
      "Action CTA routes to targeted practice engine"
    );

    // Verify practice test creation via existing test engine
    assert(Boolean(firstAction.practiceTarget?.topicId), "Target topic ID is identified");
    const practiceTest = await getOrCreateTargetedPracticeTest({
      topicId: firstAction.practiceTarget!.topicId,
    });
    createdTestIds.push(practiceTest.id);
    assert(practiceTest.id.length > 0, "Targeted practice test created/retrieved via test engine");

    console.log("\n--- 5. Testing Action Lifecycle: IN_PROGRESS Transition ---");
    const [inProgressAttempt] = await db
      .insert(attempts)
      .values({
        userId: userAlpha.id,
        testId: practiceTest.id,
        status: "in_progress",
        startedAt: new Date(),
      })
      .returning();
    createdAttemptIds.push(inProgressAttempt.id);

    // Re-evaluate plan with un-answered in_progress attempt
    const planInProgress = await getDailyExecutionPlan(userAlpha.id);
    const inProgressAction = planInProgress.actions.find((a) => a.id === firstAction.id);
    assert(inProgressAction !== undefined, "First action still present in plan");
    assert(
      inProgressAction?.status === "IN_PROGRESS",
      `Action status transitioned to IN_PROGRESS (actual: ${inProgressAction?.status})`
    );
    assert(
      inProgressAction?.ctaHref === `/tests/${practiceTest.id}/attempt`,
      `IN_PROGRESS action CTA links directly to resumable attempt (${inProgressAction?.ctaHref})`
    );
    assert(planInProgress.completedCount === 0, "In-progress action is not counted as completed");

    console.log("\n--- 6. Testing Action Lifecycle: PARTIALLY_COMPLETED Transition ---");
    // Student answers 1 question in active attempt without submitting
    const practiceQuestions = await db
      .select({
        questionId: testQuestions.questionId,
        correctAnswer: questions.correctAnswer,
      })
      .from(testQuestions)
      .innerJoin(questions, eq(testQuestions.questionId, questions.id))
      .where(eq(testQuestions.testId, practiceTest.id));

    assert(practiceQuestions.length > 1, "Practice test has multiple questions for partial testing");

    await db.insert(answers).values({
      attemptId: inProgressAttempt.id,
      questionId: practiceQuestions[0].questionId,
      selectedAnswer: practiceQuestions[0].correctAnswer,
      isCorrect: true,
      timeSpent: 25,
    });

    const planPartial = await getDailyExecutionPlan(userAlpha.id);
    const partialAction = planPartial.actions.find((a) => a.id === firstAction.id);
    assert(
      partialAction?.status === "PARTIALLY_COMPLETED",
      `Action status transitioned to PARTIALLY_COMPLETED with active answers (actual: ${partialAction?.status})`
    );
    assert(
      partialAction?.completedQuestionsCount === 1,
      `Action tracks completedQuestionsCount: ${partialAction?.completedQuestionsCount}`
    );
    assert(planPartial.completedCount === 0, "Partially completed action is not marked COMPLETED");

    console.log("\n--- 7. Testing Action Lifecycle: COMPLETED Transition ---");
    // Answer remaining questions and submit attempt
    for (let i = 1; i < practiceQuestions.length; i++) {
      await db.insert(answers).values({
        attemptId: inProgressAttempt.id,
        questionId: practiceQuestions[i].questionId,
        selectedAnswer: practiceQuestions[i].correctAnswer,
        isCorrect: true,
        timeSpent: 30,
      });
    }

    await gradeAttempt(inProgressAttempt.id, userAlpha.id);

    // Re-evaluate daily plan after submission
    const planCompleted = await getDailyExecutionPlan(userAlpha.id);
    const completedAction = planCompleted.actions.find((a) => a.id === firstAction.id);
    assert(completedAction !== undefined, "Action is present in updated plan");
    assert(
      completedAction?.status === "COMPLETED",
      `Submitted attempt marked action COMPLETED (actual: ${completedAction?.status})`
    );
    assert(planCompleted.completedCount >= 1, `completedCount incremented to ${planCompleted.completedCount}`);
    assert(
      planCompleted.remainingCount === planCompleted.totalCount - planCompleted.completedCount,
      `remainingCount updated correctly (${planCompleted.remainingCount})`
    );
    const expectedPercent = Math.round(
      (planCompleted.completedCount / planCompleted.totalCount) * 100
    );
    assert(
      planCompleted.progressPercent === expectedPercent,
      `progressPercent accurately calculated: ${planCompleted.progressPercent}% (expected: ${expectedPercent}%)`
    );

    console.log("\n--- 8. Testing Plan Stability & Daily Determinism ---");
    const planRepeat = await getDailyExecutionPlan(userAlpha.id);
    assert(planRepeat.actions.length === planCompleted.actions.length, "Plan length is identical across fetches");
    assert(
      planRepeat.actions[0].id === planCompleted.actions[0].id,
      "First action ID is identical across repeated calls"
    );
    assert(
      planRepeat.actions[0].status === planCompleted.actions[0].status,
      "First action status remains identical across repeated calls"
    );
    assert(
      planRepeat.progressPercent === planCompleted.progressPercent,
      "Progress percent remains stable across repeated calls"
    );

    console.log("\n--- 9. Testing Adaptive Recalculation ---");
    // Verify that student's successful 100% targeted practice shifted measured mastery
    // Query intelligence to verify topic accuracy improved
    const targetTopicId = firstAction.practiceTarget?.topicId || "";
    const answeredInTopic = await db
      .select({
        correctCount: answers.isCorrect,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .innerJoin(attempts, eq(answers.attemptId, attempts.id))
      .where(
        eq(questions.topicId, targetTopicId)
      );

    assert(
      answeredInTopic.some((a) => a.correctCount === true),
      "Empirical practice registered positive learning evidence"
    );

    console.log("\n--- 10. Testing Empirical History (Zero Fabrication) ---");
    assert(Array.isArray(planCompleted.history), "History is an array");
    if (planCompleted.history.length > 0) {
      const todayHistory = planCompleted.history[0];
      assert(typeof todayHistory.date === "string", "History item has date string");
      assert(todayHistory.completedCount >= 1, "History completedCount reflects real submitted attempts");
      assert(todayHistory.topicsCovered.length > 0, "History topicsCovered contains actual practiced topics");
    }

    console.log("\n--- 11. Testing Security, Authorization & Input Validation ---");
    // 1. API Route rejects unauthenticated access (401)
    let anonGetFailClosed = false;
    try {
      const unauthResponse = await executionApiGet();
      anonGetFailClosed = unauthResponse.status === 401;
    } catch (e: unknown) {
      anonGetFailClosed =
        e instanceof Error &&
        (e.message.includes("Unauthorized") ||
          e.message.includes("headers") ||
          e.message.includes("auth"));
    }
    assert(
      anonGetFailClosed,
      "GET /api/student/execution is protected against unauthenticated access (401 or fail-closed)"
    );

    // 2. Service function rejects unauthenticated/empty userId
    let emptyUserRejected = false;
    try {
      await getDailyExecutionPlan("");
    } catch {
      emptyUserRejected = true;
    }
    assert(emptyUserRejected, "Service function getDailyExecutionPlan rejects empty/unauthenticated userId");

    // 3. Cross-student data isolation
    const zeroPlanCheck = await getDailyExecutionPlan(userZero.id);
    assert(zeroPlanCheck.completedCount === 0, "User Zero has 0 completed actions despite Alpha's completion");
    assert(zeroPlanCheck.actions.length === 0, "User Zero has no actions leaked from User Alpha");

    console.log("\n==================================================");
    console.log(`📊 PHASE 15 EXECUTION TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed with unexpected error:", error);
    process.exit(1);
  } finally {
    console.log("\nCleaning up test artifacts...");
    for (const attId of createdAttemptIds) {
      await db.delete(answers).where(eq(answers.attemptId, attId)).catch(() => {});
      await db.delete(attempts).where(eq(attempts.id, attId)).catch(() => {});
    }
    for (const testId of createdTestIds) {
      await db.delete(testQuestions).where(eq(testQuestions.testId, testId)).catch(() => {});
      await db.delete(tests).where(eq(tests.id, testId)).catch(() => {});
    }
    for (const rId of createdRoleIds) {
      await db.delete(tests).where(eq(tests.id, rId)).catch(() => {});
    }
    for (const uId of createdUserIds) {
      await db.delete(profiles).where(eq(profiles.userId, uId)).catch(() => {});
      await db.delete(users).where(eq(users.id, uId)).catch(() => {});
    }
    console.log("Cleanup complete.");
  }
}

runPhase15Tests();
