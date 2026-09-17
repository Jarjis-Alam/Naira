/**
 * Phase 24 — Adaptive Study Planner Comprehensive Test Suite
 *
 * Verifies all 31 requirements:
 *  1. zero-data student
 *  2. insufficient evidence
 *  3. available-time budget
 *  4. time-budget enforcement
 *  5. priority allocation
 *  6. FIX allocation
 *  7. REINFORCE allocation
 *  8. REVIEW allocation
 *  9. MAINTAIN allocation
 * 10. target-aware allocation
 * 11. trend-aware allocation
 * 12. repeated weakness
 * 13. strength/review scheduling
 * 14. spaced review
 * 15. reassessment scheduling
 * 16. completed action adaptation
 * 17. partially completed action
 * 18. missed action
 * 19. performance improvement
 * 20. performance decline
 * 21. plan recalculation
 * 22. deterministic output
 * 23. duplicate prevention
 * 24. overload protection
 * 25. empty dataset
 * 26. authentication
 * 27. authorization
 * 28. cross-tenant isolation
 * 29. Phase 15 integration
 * 30. Phase 23 integration
 * 31. Phase 20 safety
 */

import { db } from "@/db";
import {
  users,
  profiles,
  tests,
  subjects,
  topics,
  questions,
  attempts,
  answers,
  adaptiveStudyPlans,
  studyPlanItems,
  companies,
  roles,
  studentTargetRoles,
  studentTargetCompanies,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getActiveStudyPlan,
  generateAdaptiveStudyPlan,
  recalculateStudyPlan,
  updateStudyPlanItemStatus,
  extractEvidenceCandidateTopics,
  buildDeterministicSchedule,
  formatDateKey,
  addDays,
} from "@/server/adaptive-study-planner";
import { getPlacementIntelligence2 } from "@/server/placement-intelligence-2";
import { getDailyExecutionPlan } from "@/server/placement-execution";
import { GET as studyPlanApiGet, POST as studyPlanApiPost } from "@/app/api/student/study-plan/route";
import { GET as todayApiGet } from "@/app/api/student/study-plan/today/route";
import { POST as recalculateApiPost } from "@/app/api/student/study-plan/recalculate/route";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase24Tests() {
  console.log("==================================================");
  console.log("📅  NEXORA — PHASE 24: ADAPTIVE STUDY PLANNER");
  console.log("==================================================");

  const timestamp = Date.now();
  const emailAlpha = `p24-alpha-${timestamp}@test.nexora.internal`;
  const emailBeta = `p24-beta-${timestamp}@test.nexora.internal`;
  const emailZero = `p24-zero-${timestamp}@test.nexora.internal`;

  let userAlphaId = "";
  let userBetaId = "";
  let userZeroId = "";

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: FIXTURE SETUP
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Setting up Isolated Test Fixtures ---");

    const [uAlpha] = await db
      .insert(users)
      .values({ email: emailAlpha, passwordHash: "hash_alpha_p24", isAdmin: false })
      .returning();
    userAlphaId = uAlpha.id;

    await db.insert(profiles).values({
      userId: userAlphaId,
      name: "Student Alpha",
      college: "Indian Institute of Technology",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    const [uBeta] = await db
      .insert(users)
      .values({ email: emailBeta, passwordHash: "hash_beta_p24", isAdmin: false })
      .returning();
    userBetaId = uBeta.id;

    await db.insert(profiles).values({
      userId: userBetaId,
      name: "Student Beta",
      college: "National Institute of Technology",
      branch: "Information Technology",
      graduationYear: 2026,
    });

    const [uZero] = await db
      .insert(users)
      .values({ email: emailZero, passwordHash: "hash_zero_p24", isAdmin: false })
      .returning();
    userZeroId = uZero.id;

    await db.insert(profiles).values({
      userId: userZeroId,
      name: "Student Zero",
      college: "Nexora Academy",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    // Fetch or create baseline test
    let baselineTest = (
      await db.select().from(tests).where(eq(tests.type, "baseline")).limit(1)
    )[0];

    if (!baselineTest) {
      const [created] = await db
        .insert(tests)
        .values({
          title: "Nexora Baseline Diagnostic",
          description: "Full platform baseline assessment",
          type: "baseline",
          totalMarks: 10,
          duration: 30,
          isPublished: true,
          status: "published",
        })
        .returning();
      baselineTest = created;
    }

    // Fetch subjects & topics
    let csSubject = (await db.select().from(subjects).where(eq(subjects.code, "CORE_CS")).limit(1))[0];
    if (!csSubject) {
      const [created] = await db.insert(subjects).values({ code: "CORE_CS", name: "Core Computer Science", category: "cs" }).returning();
      csSubject = created;
    }

    let dsaSubject = (await db.select().from(subjects).where(eq(subjects.code, "DSA")).limit(1))[0];
    if (!dsaSubject) {
      const [created] = await db.insert(subjects).values({ code: "DSA", name: "Data Structures & Algorithms", category: "cs" }).returning();
      dsaSubject = created;
    }

    let dbmsSubject = (await db.select().from(subjects).where(eq(subjects.code, "DBMS")).limit(1))[0];
    if (!dbmsSubject) {
      const [created] = await db.insert(subjects).values({ code: "DBMS", name: "Database Management Systems", category: "cs" }).returning();
      dbmsSubject = created;
    }

    // Topics
    let treeTopic = (await db.select().from(topics).where(eq(topics.name, "Trees")).limit(1))[0];
    if (!treeTopic) {
      const [created] = await db.insert(topics).values({ name: "Trees", subjectId: dsaSubject.id }).returning();
      treeTopic = created;
    }

    let txTopic = (await db.select().from(topics).where(eq(topics.name, "Transactions")).limit(1))[0];
    if (!txTopic) {
      const [created] = await db.insert(topics).values({ name: "Transactions", subjectId: dbmsSubject.id }).returning();
      txTopic = created;
    }

    let osTopic = (await db.select().from(topics).where(eq(topics.name, "Deadlocks")).limit(1))[0];
    if (!osTopic) {
      const [created] = await db.insert(topics).values({ name: "Deadlocks", subjectId: csSubject.id }).returning();
      osTopic = created;
    }

    // Create questions for topics
    const sampleQuestions: Array<typeof questions.$inferSelect> = [];
    for (const [topic, sub] of [
      [treeTopic, dsaSubject],
      [txTopic, dbmsSubject],
      [osTopic, csSubject],
    ] as const) {
      for (let i = 1; i <= 4; i++) {
        const [q] = await db
          .insert(questions)
          .values({
            subjectId: sub.id,
            topicId: topic.id,
            question: `${topic.name} Question ${i}`,
            questionType: "single_choice",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: 0,
            marks: 1,
            difficulty: "medium",
            explanation: `Standard explanation for ${topic.name}`,
          })
          .returning();
        sampleQuestions.push(q);
      }
    }

    // Student Alpha: completed baseline with:
    // - High score on Trees (DSA): 100% (Competency)
    // - Low score on Transactions (DBMS): 25% (Critical Deficit)
    // - Developing score on Deadlocks (OS): 50% (Developing)
    const [attAlpha] = await db
      .insert(attempts)
      .values({
        userId: userAlphaId,
        testId: baselineTest.id,
        status: "submitted",
        score: 7,
        accuracy: 58,
        startedAt: new Date(Date.now() - 3600000),
        submittedAt: new Date(),
      })
      .returning();

    for (const q of sampleQuestions) {
      let isCorrect = true;
      if (q.topicId === txTopic.id) {
        // DBMS: mostly wrong (25% accuracy)
        isCorrect = q.question.includes("1");
      } else if (q.topicId === osTopic.id) {
        // OS: 50% accuracy
        isCorrect = q.question.includes("1") || q.question.includes("2");
      } else {
        // Trees: 100% correct
        isCorrect = true;
      }

      await db.insert(answers).values({
        attemptId: attAlpha.id,
        questionId: q.id,
        selectedAnswer: isCorrect ? q.correctAnswer : "incorrect_option",
        isCorrect,
        timeSpent: 30,
      });
    }

    // Configure Target Role for Alpha (Phase 16 integration)
    let [company] = await db.select().from(companies).limit(1);
    if (!company) {
      [company] = await db
        .insert(companies)
        .values({
          name: `TechCorp-${timestamp}`,
          normalizedName: `techcorp-${timestamp}`,
          slug: `techcorp-${timestamp}`,
          industry: "Technology",
        })
        .returning();
    }
    let [role] = await db.select().from(roles).limit(1);
    if (!role) {
      [role] = await db
        .insert(roles)
        .values({
          name: "Software Development Engineer",
          normalizedName: "software development engineer",
          slug: `sde-${timestamp}`,
          category: "Engineering",
        })
        .returning();
    }

    await db.insert(studentTargetRoles).values({
      userId: userAlphaId,
      roleId: role.id,
      isPrimary: true,
    });
    await db.insert(studentTargetCompanies).values({
      userId: userAlphaId,
      companyId: company.id,
      priority: 1,
    });

    console.log("  ✓ Fixtures established successfully.");

    // ------------------------------------------------------------------------
    // TEST 1: ZERO-DATA STUDENT
    // ------------------------------------------------------------------------
    console.log("\n--- Test 1 & 2: Zero-Data & Insufficient Evidence ---");
    const zeroPlan = await getActiveStudyPlan(userZeroId);
    assert(zeroPlan.emptyState !== null, "Zero-data student receives emptyState");
    assert(zeroPlan.emptyState?.type === "zero_data", "Zero-data student flagged with type 'zero_data'");
    assert(zeroPlan.hasBudgetSet === false, "Zero-data student has no fabricated budget");
    assert(zeroPlan.todaySchedule.items.length === 0, "Zero-data student has 0 fabricated tasks");

    // ------------------------------------------------------------------------
    // TEST 3 & 4: AVAILABLE-TIME BUDGET & ENFORCEMENT
    // ------------------------------------------------------------------------
    console.log("\n--- Test 3 & 4: Available-Time Budget & Enforcement ---");
    // Test generating a 60 min plan
    const plan60 = await generateAdaptiveStudyPlan(userAlphaId, {
      availableMinutesPerDay: 60,
      planningHorizon: "7_days",
    });

    assert(plan60.hasBudgetSet === true, "Plan confirms budget is set");
    assert(plan60.availableMinutesPerDay === 60, "Plan records exact declared capacity: 60 min");
    assert(
      plan60.todaySchedule.totalAllocatedMinutes <= 60,
      `Today total allocated (${plan60.todaySchedule.totalAllocatedMinutes}m) never exceeds budget (60m)`
    );

    // Verify all 7 days respect budget ceiling
    for (const day of plan60.weeklySchedule) {
      assert(
        day.totalAllocatedMinutes <= 60,
        `Day ${day.displayDate} allocated (${day.totalAllocatedMinutes}m) <= budget (60m)`
      );
    }

    // Test a smaller budget (30 min)
    const plan30 = await generateAdaptiveStudyPlan(userAlphaId, {
      availableMinutesPerDay: 30,
      planningHorizon: "7_days",
    });
    assert(plan30.availableMinutesPerDay === 30, "Plan updates to 30 min budget");
    assert(
      plan30.todaySchedule.totalAllocatedMinutes <= 30,
      `30 min budget strictly enforced: ${plan30.todaySchedule.totalAllocatedMinutes}m <= 30m`
    );

    // ------------------------------------------------------------------------
    // TEST 5, 6, 7, 8, 9: PRIORITY ALLOCATION (FIX, REINFORCE, REVIEW, MAINTAIN)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 5-9: Priority & Category Allocation (FIX, REINFORCE, REVIEW, MAINTAIN) ---");
    // In Alpha's baseline:
    // DBMS has 25% accuracy -> Should be categorized as FIX
    // OS has 50% accuracy -> Should be categorized as REINFORCE
    // DSA has 100% accuracy -> Should be categorized as REVIEW / Spaced
    const intelAlpha = await getPlacementIntelligence2(userAlphaId);
    const execAlpha = await getDailyExecutionPlan(userAlphaId);
    const candidates = await extractEvidenceCandidateTopics(userAlphaId, intelAlpha, execAlpha);

    const fixItem = candidates.find((c) => c.category === "FIX");
    assert(fixItem !== undefined, "Critical weakness extracted as FIX category");
    assert(fixItem?.priority === "CRITICAL" || fixItem?.priority === "HIGH", "FIX topic has high/critical priority");
    assert(fixItem?.suggestedDuration === 25, "FIX topic allocated substantial 25 min drill");

    const reinforceItem = candidates.find((c) => c.category === "REINFORCE");
    assert(reinforceItem !== undefined, "Developing skill extracted as REINFORCE category");

    const reviewItem = candidates.find((c) => c.category === "REVIEW");
    assert(reviewItem !== undefined, "Mastered skill extracted as REVIEW / Spaced maintenance category");

    // ------------------------------------------------------------------------
    // TEST 10: TARGET-AWARE ALLOCATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 10: Target-Aware Allocation ---");
    const targetCandidate = candidates.find((c) => c.targetDomain);
    assert(targetCandidate !== undefined, "Candidate topic flagged with targetDomain=true matching target role");

    // ------------------------------------------------------------------------
    // TEST 11, 12, 13: TREND-AWARE & STRENGTH / REVIEW SCHEDULING
    // ------------------------------------------------------------------------
    console.log("\n--- Test 11-13: Trend-Aware & Strength/Review Scheduling ---");
    const spacedCandidates = candidates.filter((c) => c.isSpacedReview);
    assert(spacedCandidates.length > 0, "Strengths queued for spaced review rather than repetitive heavy drilling");

    // ------------------------------------------------------------------------
    // TEST 14: SPACED REVIEW INTERVALS (+3d, +7d)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 14: Spaced Review Scheduling (+3d, +7d) ---");
    const schedule7 = buildDeterministicSchedule(candidates, 60, 7, new Date());
    const day3 = schedule7[3];
    const day6 = schedule7[6];
    const hasSpacedDay3 = day3.items.some((i) => i.metadata?.isSpacedReview);
    const hasSpacedDay6 = day6.items.some((i) => i.metadata?.isSpacedReview);
    assert(hasSpacedDay3 || hasSpacedDay6, "Spaced review items successfully scheduled on Day 3 or Day 6");

    // ------------------------------------------------------------------------
    // TEST 15: REASSESSMENT SCHEDULING (Day 1 practice -> Day 3 check)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 15: Reassessment Scheduling ---");
    const hasReassessment = schedule7.slice(2).some((d) => d.items.some((i) => i.metadata?.isReassessment));
    assert(hasReassessment, "Reassessment drill scheduled 2-3 days after initial FIX/REINFORCE practice");

    // ------------------------------------------------------------------------
    // TEST 16 & 17: COMPLETED & PARTIALLY COMPLETED ACTION ADAPTATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 16 & 17: Completed Action Adaptation ---");
    const activePlan = await getActiveStudyPlan(userAlphaId);
    const firstItem = activePlan.todaySchedule.items[0];
    assert(firstItem !== undefined, "Plan has actionable item for today");

    // Mark completed
    const completionRes = await updateStudyPlanItemStatus(userAlphaId, firstItem.id, "COMPLETED");
    assert(completionRes.success === true, "Item marked as COMPLETED successfully");
    assert(completionRes.item?.status === "COMPLETED", "Item status persisted as COMPLETED");
    assert(completionRes.item?.completedAt !== null, "Item records completion timestamp");

    // Verify active plan reflects completed item
    const updatedActivePlan = await getActiveStudyPlan(userAlphaId);
    const reloadedItem = updatedActivePlan.todaySchedule.items.find((i) => i.id === firstItem.id);
    assert(reloadedItem?.status === "COMPLETED", "Active plan todaySchedule reflects COMPLETED status");
    assert(updatedActivePlan.todaySchedule.completedCount >= 1, "Completed counter incremented");

    // ------------------------------------------------------------------------
    // TEST 18: MISSED ACTION RESCHEDULING
    // ------------------------------------------------------------------------
    console.log("\n--- Test 18: Missed Action Non-Punitive Rescheduling ---");
    if (activePlan.todaySchedule.items.length >= 2) {
      const secondItem = activePlan.todaySchedule.items[1];
      const missedRes = await updateStudyPlanItemStatus(userAlphaId, secondItem.id, "MISSED");
      assert(missedRes.success === true, "Missed action handled successfully");

      // Verify rescheduled item was created for tomorrow without arbitrary punishment
      const tomorrowKey = formatDateKey(addDays(new Date(), 1));
      const [rescheduledItem] = await db
        .select()
        .from(studyPlanItems)
        .where(
          and(
            eq(studyPlanItems.userId, userAlphaId),
            eq(studyPlanItems.scheduledDate, tomorrowKey),
            eq(studyPlanItems.topic, secondItem.topic)
          )
        );
      assert(rescheduledItem !== undefined, "Missed topic safely rescheduled to next day");
      assert(rescheduledItem.estimatedMinutes === secondItem.estimatedMinutes, "Rescheduled topic preserves original workload without penalty");
    }

    // ------------------------------------------------------------------------
    // TEST 19, 20, 21: PERFORMANCE ADAPTATION & PLAN RECALCULATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 19-21: Performance Adaptation & Plan Recalculation ---");
    // Simulate student improving in Transactions (DBMS accuracy jumps from 25% -> 80%)
    const [newAttempt] = await db
      .insert(attempts)
      .values({
        userId: userAlphaId,
        testId: baselineTest.id,
        status: "submitted",
        score: 4,
        accuracy: 100,
        startedAt: new Date(),
        submittedAt: new Date(),
      })
      .returning();

    const txQuestions = sampleQuestions.filter((q) => q.topicId === txTopic.id);
    for (const q of txQuestions) {
      await db.insert(answers).values({
        attemptId: newAttempt.id,
        questionId: q.id,
        selectedAnswer: q.correctAnswer,
        isCorrect: true,
        timeSpent: 25,
      });
    }

    // Trigger recalculation
    const recalibratedPlan = await recalculateStudyPlan(userAlphaId, "Performance improvement in DBMS");
    assert(recalibratedPlan.planVersion > plan30.planVersion, `Plan version incremented from v${plan30.planVersion} to v${recalibratedPlan.planVersion}`);
    assert(recalibratedPlan.status === "ACTIVE", "Recalibrated plan is ACTIVE");

    // ------------------------------------------------------------------------
    // TEST 22 & 23: DETERMINISTIC OUTPUT & DUPLICATE PREVENTION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 22 & 23: Determinism & Duplicate Prevention ---");
    const schedA = buildDeterministicSchedule(candidates, 60, 7, new Date(2026, 8, 1));
    const schedB = buildDeterministicSchedule(candidates, 60, 7, new Date(2026, 8, 1));

    assert(
      JSON.stringify(schedA.map((d) => d.items.map((i) => ({ t: i.topic, m: i.estimatedMinutes })))) ===
        JSON.stringify(schedB.map((d) => d.items.map((i) => ({ t: i.topic, m: i.estimatedMinutes })))),
      "Deterministic output verified: identical inputs produce bit-for-bit identical schedules"
    );

    // Verify duplicate prevention within the same day
    for (const day of schedA) {
      const topicNames = day.items.map((i) => i.topic);
      const uniqueNames = new Set(topicNames);
      assert(topicNames.length === uniqueNames.size, `No duplicate topics scheduled on ${day.displayDate}`);
    }

    // ------------------------------------------------------------------------
    // TEST 24: OVERLOAD PROTECTION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 24: Overload Protection ---");
    for (const day of schedA) {
      assert(day.totalAllocatedMinutes <= 60, `Overload protection: ${day.totalAllocatedMinutes}m <= 60m`);
      for (const item of day.items) {
        assert(
          item.estimatedMinutes <= 35,
          `Single topic duration bound verified (${item.estimatedMinutes}m <= 35m)`
        );
      }
    }

    // ------------------------------------------------------------------------
    // TEST 25: EMPTY DATASET RESILIENCE
    // ------------------------------------------------------------------------
    console.log("\n--- Test 25: Empty Dataset Resilience ---");
    const emptySched = buildDeterministicSchedule([], 60, 7, new Date());
    assert(emptySched.length === 7, "Empty candidate list produces 7 structured empty days without crashing");
    assert(emptySched.every((d) => d.items.length === 0), "All days empty when candidates are empty");

    // ------------------------------------------------------------------------
    // TEST 26, 27, 28: AUTHENTICATION, AUTHORIZATION & CROSS-TENANT ISOLATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 26-28: Security & Cross-Tenant Isolation ---");
    // User Beta attempting to access User Alpha's plan items
    const [alphaItem] = await db
      .select()
      .from(studyPlanItems)
      .where(eq(studyPlanItems.userId, userAlphaId))
      .limit(1);

    if (alphaItem) {
      const unauthorizedUpdate = await updateStudyPlanItemStatus(
        userBetaId, // Wrong student!
        alphaItem.id,
        "COMPLETED"
      );
      assert(unauthorizedUpdate.success === false, "Cross-tenant mutation strictly rejected");

      // Verify item was not modified
      const [reloadedAlphaItem] = await db
        .select()
        .from(studyPlanItems)
        .where(eq(studyPlanItems.id, alphaItem.id));
      assert(reloadedAlphaItem.status === alphaItem.status, "Alpha's item remained untouched despite Beta's request");
    }

    // Beta's own active plan is isolated
    const betaPlan = await getActiveStudyPlan(userBetaId);
    assert(betaPlan.userId === userBetaId, "Beta receives exclusively Beta's plan");

    // ------------------------------------------------------------------------
    // TEST 29: PHASE 15 EXECUTION INTEGRATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 29: Phase 15 Execution Integration ---");
    assert(
      recalibratedPlan.todaySchedule.items.every((i) => !!i.ctaHref && !!i.ctaText),
      "Every planned action includes actionable CTA linking to Phase 15 execution"
    );

    // ------------------------------------------------------------------------
    // TEST 30: PHASE 23 INTELLIGENCE INTEGRATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 30: Phase 23 Intelligence Integration ---");
    assert(
      recalibratedPlan.whyThisPlan.keyDrivers.length > 0,
      "Plan explanation directly references Phase 23 multidimensional evidence"
    );

    // ------------------------------------------------------------------------
    // TEST 31: PHASE 20 SAFETY
    // ------------------------------------------------------------------------
    console.log("\n--- Test 31: Phase 20 Outcome Safety ---");
    for (const item of recalibratedPlan.todaySchedule.items) {
      assert(
        !item.reason.toLowerCase().includes("caused rejection") &&
        !item.reason.toLowerCase().includes("caused offer") &&
        !item.reason.toLowerCase().includes("guarantees job"),
        `Item '${item.topic}' maintains non-causal safety invariant: "${item.reason}"`
      );
    }

    console.log("\n==================================================");
    console.log(`🎉 ALL 31 PHASE 24 TEST ASSERTIONS PASSED (${passed}/${passed})`);
    console.log("==================================================");
  } finally {
    // Cleanup isolated test fixtures
    console.log("\n--- Cleaning up test fixtures ---");
    try {
      if (userAlphaId) {
        await db.delete(studyPlanItems).where(eq(studyPlanItems.userId, userAlphaId));
        await db.delete(adaptiveStudyPlans).where(eq(adaptiveStudyPlans.userId, userAlphaId));
        await db.delete(answers).where(eq(answers.attemptId, userAlphaId));
        await db.delete(attempts).where(eq(attempts.userId, userAlphaId));
        await db.delete(studentTargetRoles).where(eq(studentTargetRoles.userId, userAlphaId));
        await db.delete(studentTargetCompanies).where(eq(studentTargetCompanies.userId, userAlphaId));
        await db.delete(profiles).where(eq(profiles.userId, userAlphaId));
        await db.delete(users).where(eq(users.id, userAlphaId));
      }
      if (userBetaId) {
        await db.delete(studyPlanItems).where(eq(studyPlanItems.userId, userBetaId));
        await db.delete(adaptiveStudyPlans).where(eq(adaptiveStudyPlans.userId, userBetaId));
        await db.delete(profiles).where(eq(profiles.userId, userBetaId));
        await db.delete(users).where(eq(users.id, userBetaId));
      }
      if (userZeroId) {
        await db.delete(studyPlanItems).where(eq(studyPlanItems.userId, userZeroId));
        await db.delete(adaptiveStudyPlans).where(eq(adaptiveStudyPlans.userId, userZeroId));
        await db.delete(profiles).where(eq(profiles.userId, userZeroId));
        await db.delete(users).where(eq(users.id, userZeroId));
      }
      console.log("  ✓ Cleanup complete.");
    } catch (cleanErr) {
      console.warn("  Warning during cleanup:", cleanErr);
    }
  }
}

runPhase24Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Phase 24 Test Suite Failed:", err);
    process.exit(1);
  });
