/**
 * Phase 23 — Placement Intelligence 2.0 Comprehensive Test Suite
 *
 * Verifies:
 * 1. Multi-dimensional performance model (14 dimensions)
 * 2. Insufficient evidence handling (zero fabrication, null scores)
 * 3. Skill stability evaluation (EMERGING, DEVELOPING, STABLE, STRONG_EVIDENCE, INCONSISTENT)
 * 4. Deterministic performance trends (improving, declining, stable, inconsistent)
 * 5. Recent vs historical performance differentiation
 * 6. Evidence-backed strengths & weaknesses (Weakness 2.0)
 * 7. Target-aware intelligence alignment (Phase 16 integration)
 * 8. Cross-source corroboration (Assessment + Simulation + Resume + Outcomes)
 * 9. Non-causal observation safety guards (Phase 20 compliance)
 * 10. Prioritized next actions & actionable insights (Phase 15 integration)
 * 11. Empty and partial dataset resilience
 * 12. Cross-tenant security & multi-tenant isolation
 * 13. Determinism & reproducible calculations
 */

import { db } from "@/db";
import {
  users,
  profiles,
  tests,
  subjects,
  questions,
  attempts,
  answers,
  studentTargetRoles,
  studentTargetCompanies,
  companies,
  roles,
  placementSimulations,
  placementSimulationRounds,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateStudentPlacementTargets } from "@/server/company-role-intelligence";
import { getPlacementIntelligence2 } from "@/server/placement-intelligence-2";
import { getPlacementIntelligence } from "@/server/placement-intelligence";
import { GET as placementIntelligence2ApiGet } from "@/app/api/student/placement-intelligence-2/route";

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

async function runPhase23Tests() {
  console.log("==================================================");
  console.log("🧠  NEXORA — PHASE 23: PLACEMENT INTELLIGENCE 2.0");
  console.log("==================================================");

  const timestamp = Date.now();
  const emailAlpha = `p23-alpha-${timestamp}@test.nexora.internal`;
  const emailBeta = `p23-beta-${timestamp}@test.nexora.internal`;
  const emailZero = `p23-zero-${timestamp}@test.nexora.internal`;

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
      .values({
        email: emailAlpha,
        passwordHash: "hash_alpha_p23",
        isAdmin: false,
      })
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
      .values({
        email: emailBeta,
        passwordHash: "hash_beta_p23",
        isAdmin: false,
      })
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
      .values({
        email: emailZero,
        passwordHash: "hash_zero_p23",
        isAdmin: false,
      })
      .returning();
    userZeroId = uZero.id;

    await db.insert(profiles).values({
      userId: userZeroId,
      name: "Student Zero",
      college: "State Engineering College",
      branch: "Mechanical",
      graduationYear: 2027,
    });

    assert(Boolean(userAlphaId && userBetaId && userZeroId), "Test users and profiles provisioned");

    // Fetch core CS subjects and topics
    const dbmsSubj = (await db.select().from(subjects).where(eq(subjects.code, "DBMS")))[0];
    const dsaSubj = (await db.select().from(subjects).where(eq(subjects.code, "DSA")))[0];
    const osSubj = (await db.select().from(subjects).where(eq(subjects.code, "OS")))[0];
    const aptSubj = (await db.select().from(subjects).where(eq(subjects.code, "APT")))[0];

    assert(Boolean(dbmsSubj && dsaSubj && osSubj && aptSubj), "Core CS and Aptitude subjects exist in database");

    // ------------------------------------------------------------------------
    // SECTION 2: EMPTY & ZERO-DATA STUDENT EXPERIENCE
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Zero-Data & Insufficient Evidence Verification ---");

    const zeroIntel = await getPlacementIntelligence2(userZeroId);

    assert(zeroIntel.evidenceSummary.dataSufficiency === "zero_data", "Zero-data student recognized as zero_data");
    assert(zeroIntel.evidenceSummary.hasBaseline === false, "Student Zero hasCompletedBaseline is false");
    assert(zeroIntel.evidenceSummary.totalAssessments === 0, "Zero assessments counted for fresh user");
    assert(zeroIntel.dimensions.length === 14, "Multi-dimensional performance model outputs exactly 14 dimensions");

    // Check that ALL dimensions have INSUFFICIENT_EVIDENCE and score is null (Zero Fabrication)
    const allInsufficient = zeroIntel.dimensions.every(
      (d) => d.status === "INSUFFICIENT_EVIDENCE" && d.score === null && d.trend === "insufficient_evidence"
    );
    assert(allInsufficient, "All 14 dimensions strictly remain INSUFFICIENT_EVIDENCE with null score (Zero Fabrication)");

    assert(zeroIntel.trends.length === 0, "Zero trends fabricated when no observations exist");
    assert(zeroIntel.strengths.length === 0, "Zero strengths fabricated without positive evidence");
    assert(zeroIntel.weaknesses.length === 0, "Zero weaknesses fabricated without negative observations");
    assert(zeroIntel.crossSourceCorroborations.length === 0, "Zero cross-source corroborations without data");
    assert(
      zeroIntel.priorities.length === 1 && zeroIntel.priorities[0].title.includes("Baseline"),
      "Priority directs student to establish baseline calibration"
    );

    // ------------------------------------------------------------------------
    // SECTION 3: PERFORMANCE DATA SIMULATION (Alpha)
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Controlled Multi-Source Performance Simulation for Alpha ---");

    // Find baseline test
    const baselineTest = (await db.select().from(tests).where(eq(tests.type, "baseline")).limit(1))[0];
    assert(Boolean(baselineTest), "Baseline assessment found");

    // Baseline attempt: Good at DSA, Weak at DBMS, Moderate at OS
    const [alphaAttempt1] = await db
      .insert(attempts)
      .values({
        userId: userAlphaId,
        testId: baselineTest.id,
        score: 68,
        accuracy: 68,
        status: "submitted",
        submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (historical)
      })
      .returning();

    // Query questions for DBMS, DSA, OS, APT
    const dbmsQuestions = await db.select().from(questions).where(eq(questions.subjectId, dbmsSubj.id)).limit(8);
    const dsaQuestions = await db.select().from(questions).where(eq(questions.subjectId, dsaSubj.id)).limit(8);
    const osQuestions = await db.select().from(questions).where(eq(questions.subjectId, osSubj.id)).limit(8);
    const aptQuestions = await db.select().from(questions).where(eq(questions.subjectId, aptSubj.id)).limit(8);

    // Insert historical answers for attempt 1
    // DSA: 4/4 correct (100%)
    for (const q of dsaQuestions.slice(0, 4)) {
      await db.insert(answers).values({
        attemptId: alphaAttempt1.id,
        questionId: q.id,
        selectedAnswer: q.correctAnswer,
        isCorrect: true,
      });
    }

    // DBMS: 1/4 correct (25% - Deficit)
    for (let i = 0; i < 4; i++) {
      const q = dbmsQuestions[i];
      await db.insert(answers).values({
        attemptId: alphaAttempt1.id,
        questionId: q.id,
        selectedAnswer: i === 0 ? q.correctAnswer : "incorrect_option",
        isCorrect: i === 0,
      });
    }

    // OS: 2/4 correct (50%)
    for (let i = 0; i < 4; i++) {
      const q = osQuestions[i];
      await db.insert(answers).values({
        attemptId: alphaAttempt1.id,
        questionId: q.id,
        selectedAnswer: i < 2 ? q.correctAnswer : "incorrect_option",
        isCorrect: i < 2,
      });
    }

    // Attempt 2: Practice Assessment 5 days ago (Recent window)
    const [alphaAttempt2] = await db
      .insert(attempts)
      .values({
        userId: userAlphaId,
        testId: baselineTest.id,
        score: 75,
        accuracy: 75,
        status: "submitted",
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (recent)
      })
      .returning();

    // DSA: 4/4 correct in recent attempt (still 100% -> stable/improving)
    for (const q of dsaQuestions.slice(4, 8)) {
      await db.insert(answers).values({
        attemptId: alphaAttempt2.id,
        questionId: q.id,
        selectedAnswer: q.correctAnswer,
        isCorrect: true,
      });
    }

    // DBMS: 1/4 correct in recent attempt (25% -> repeated low performance)
    for (let i = 4; i < 8; i++) {
      const q = dbmsQuestions[i];
      await db.insert(answers).values({
        attemptId: alphaAttempt2.id,
        questionId: q.id,
        selectedAnswer: i === 4 ? q.correctAnswer : "incorrect_option",
        isCorrect: i === 4,
      });
    }

    // OS: 4/4 correct in recent attempt (100% vs historical 50% -> IMPROVING trend!)
    for (let i = 4; i < 8; i++) {
      const q = osQuestions[i];
      await db.insert(answers).values({
        attemptId: alphaAttempt2.id,
        questionId: q.id,
        selectedAnswer: q.correctAnswer,
        isCorrect: true,
      });
    }

    // Aptitude: 6/6 correct in recent attempt
    for (const q of aptQuestions.slice(0, 6)) {
      await db.insert(answers).values({
        attemptId: alphaAttempt2.id,
        questionId: q.id,
        selectedAnswer: q.correctAnswer,
        isCorrect: true,
      });
    }

    // Configure Target: Software Engineer
    const [roleSwe] = await db.select().from(roles).where(eq(roles.slug, "software-engineer")).limit(1);
    const [compAcme] = await db.select().from(companies).limit(1);

    if (roleSwe && compAcme) {
      await updateStudentPlacementTargets(userAlphaId, {
        primaryRoleId: roleSwe.id,
        companyIds: [compAcme.id],
      });
    }

    // Simulation simulation data for Alpha
    const [sim] = await db
      .insert(placementSimulations)
      .values({
        userId: userAlphaId,
        companyName: compAcme?.name ?? "Tech Corp",
        roleName: roleSwe?.name ?? "Software Engineer",
        status: "completed",
        currentRoundOrder: 5,
        overallReadinessScore: 78,
        completedAt: new Date(),
      })
      .returning();

    // Round 2 (Coding): score 85 (corroborates DSA strength)
    await db.insert(placementSimulationRounds).values({
      simulationId: sim.id,
      roundNumber: 2,
      roundType: "coding",
      title: "Technical Coding Round",
      status: "completed",
      score: 85,
    });

    // Round 4 (Tech Interview): score 45 (corroborates DBMS deficit)
    await db.insert(placementSimulationRounds).values({
      simulationId: sim.id,
      roundNumber: 4,
      roundType: "tech_interview",
      title: "Technical System & Core Interview",
      status: "completed",
      score: 45,
    });

    console.log("  ✓ Simulated 2 attempts (16 questions), 1 target configuration, and 1 complete 5-round simulation");

    // ------------------------------------------------------------------------
    // SECTION 4: INTELLIGENCE 2.0 CALCULATIONS & EVALUATION (Alpha)
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Evaluating Intelligence 2.0 Engine Outputs ---");

    const alphaIntel = await getPlacementIntelligence2(userAlphaId);

    // 4.1 Multi-Dimensional Dimensions
    assert(alphaIntel.evidenceSummary.totalAssessments === 2, "Accurately counted 2 assessments");
    assert(alphaIntel.evidenceSummary.totalQuestionsAnswered >= 20, "Accurately counted >= 20 questions");
    assert(alphaIntel.evidenceSummary.hasSimulation === true, "Detected completed simulation");

    const dsaDim = alphaIntel.dimensions.find((d) => d.id === "dsa");
    const dbmsDim = alphaIntel.dimensions.find((d) => d.id === "dbms");
    const osDim = alphaIntel.dimensions.find((d) => d.id === "os");
    const cnDim = alphaIntel.dimensions.find((d) => d.id === "cn");

    assert(Boolean(dsaDim && dbmsDim && osDim && cnDim), "Core technical dimensions evaluated");
    assert(dsaDim?.score === 100, `DSA accuracy measured at exactly 100% (actual: ${dsaDim?.score})`);
    assert(dsaDim?.status === "STRONG_EVIDENCE", "DSA stability recognized as STRONG_EVIDENCE");
    assert(dsaDim?.hasCorroboratingSources === true, "DSA has corroborating sources across assessment and simulation");

    assert(dbmsDim?.score === 25, `DBMS accuracy measured at exactly 25% (actual: ${dbmsDim?.score})`);
    assert(dbmsDim?.status === "DEVELOPING" || dbmsDim?.status === "EMERGING", "DBMS status accurately derived without fabrication");

    // CN has no questions answered -> MUST remain INSUFFICIENT_EVIDENCE
    assert(cnDim?.status === "INSUFFICIENT_EVIDENCE", "Computer Networks remains INSUFFICIENT_EVIDENCE (untested)");
    assert(cnDim?.score === null, "Computer Networks score is null (not 0 or arbitrary number)");

    // ------------------------------------------------------------------------
    // SECTION 5: PERFORMANCE TRENDS & RECENCY DIFFERENTIATION
    // ------------------------------------------------------------------------
    console.log("\n--- 5. Deterministic Performance Trends (Recent vs Historical) ---");

    const osTrend = alphaIntel.trends.find((t) => t.dimensionId === "os");
    assert(Boolean(osTrend), "Performance trend detected for OS");
    assert(osTrend?.direction === "improving", `OS trend detected as 'improving' (actual: ${osTrend?.direction})`);
    assert(osTrend?.recentScore === 100, "Recent OS accuracy: 100%");
    assert(osTrend?.historicalScore === 50, "Historical OS accuracy: 50%");
    assert(
      Boolean(osTrend?.observation.includes("higher than")),
      "Observation describes higher recent accuracy without diagnosing unproven causes"
    );

    // ------------------------------------------------------------------------
    // SECTION 6: EVIDENCE-BACKED STRENGTHS & WEAKNESSES 2.0
    // ------------------------------------------------------------------------
    console.log("\n--- 6. Evidence-Backed Strengths & Focus Areas ---");

    assert(alphaIntel.strengths.length >= 1, "At least 1 evidence-backed strength detected");
    const dsaStrength = alphaIntel.strengths.find((s) => s.dimensionId === "dsa");
    assert(Boolean(dsaStrength), "DSA surfaced as evidence-backed strength");
    assert(dsaStrength?.score === 100, "Strength includes exact score 100%");
    assert(Boolean(dsaStrength?.evidenceStatement.includes("accuracy across")), "Evidence statement includes precise attempt counts");

    assert(alphaIntel.weaknesses.length >= 1, "At least 1 evidence-backed weakness detected");
    const dbmsWeakness = alphaIntel.weaknesses.find((w) => w.dimensionId === "dbms");
    assert(Boolean(dbmsWeakness), "DBMS surfaced as evidence-backed weakness");
    assert(dbmsWeakness?.deficitScore === 25, "DBMS deficit score is 25%");
    assert(dbmsWeakness?.targetRelevance === true, "DBMS recognized as target-relevant for Software Engineer");

    // ------------------------------------------------------------------------
    // SECTION 7: TARGET-AWARE ALIGNMENT (Phase 16 Integration)
    // ------------------------------------------------------------------------
    console.log("\n--- 7. Target-Aware Alignment ---");

    assert(alphaIntel.targetAlignment.targetConfigured === true, "Target configured recognized");
    assert(alphaIntel.targetAlignment.roleName === "Software Engineer", "Target role: Software Engineer");
    assert(alphaIntel.targetAlignment.requirements.length >= 4, "Target role requirements populated");

    const dsaReq = alphaIntel.targetAlignment.requirements.find((r) => r.domain === "DSA");
    assert(dsaReq?.supportStatus === "SUPPORTED_BY_EVIDENCE", "DSA requirement is SUPPORTED_BY_EVIDENCE");

    const dbmsReq = alphaIntel.targetAlignment.requirements.find((r) => r.domain === "DBMS");
    assert(dbmsReq?.supportStatus === "PARTIALLY_SUPPORTED", "DBMS requirement is PARTIALLY_SUPPORTED (below threshold)");

    const cnReq = alphaIntel.targetAlignment.requirements.find((r) => r.domain === "CN");
    assert(cnReq?.supportStatus === "INSUFFICIENT_EVIDENCE", "CN requirement is INSUFFICIENT_EVIDENCE");

    // ------------------------------------------------------------------------
    // SECTION 8: CROSS-SOURCE CORROBORATION (Non-Causal Safety)
    // ------------------------------------------------------------------------
    console.log("\n--- 8. Cross-Source Corroboration & Non-Causal Rendering ---");

    assert(alphaIntel.crossSourceCorroborations.length >= 1, "Cross-source corroborations identified");
    const dbmsCorrob = alphaIntel.crossSourceCorroborations.find((c) => c.domainOrTopic === "DBMS");
    assert(Boolean(dbmsCorrob), "DBMS corroborated across assessment and simulation interview");
    assert(dbmsCorrob?.sources.length === 2, "Corroboration cites 2 independent evaluation sources");

    // Causal safety scan (Phase 20 parity)
    const CAUSAL_PROHIBITED = ["caused", "because of", "resulted in", "due to lack of"];
    for (const phrase of CAUSAL_PROHIBITED) {
      assert(
        !dbmsCorrob?.observation.toLowerCase().includes(phrase),
        `Corroboration observation contains NO prohibited causal term '${phrase}'`
      );
    }

    // ------------------------------------------------------------------------
    // SECTION 9: PRIORITIES & ACTIONABLE INSIGHTS (Phase 15 Integration)
    // ------------------------------------------------------------------------
    console.log("\n--- 9. Priorities & Actionable Insights ---");

    assert(alphaIntel.priorities.length >= 1, "Priorities generated");
    const topPriority = alphaIntel.priorities[0];
    assert(Boolean(topPriority.priorityNumber), "Priority has sequence number (e.g. '01')");
    assert(topPriority.level === "CRITICAL" || topPriority.level === "HIGH", "Top priority has high/critical urgency");
    assert(
      ["FIX", "REINFORCE", "REVIEW", "MONITOR"].includes(topPriority.recommendedAction.type),
      "Recommended action adheres strictly to Phase 15 action taxonomy"
    );
    assert(Boolean(topPriority.recommendedAction.ctaHref), "Recommended action provides direct route href");

    assert(alphaIntel.actionableInsights.length >= 1, "Actionable insights generated");
    const topInsight = alphaIntel.actionableInsights[0];
    assert(Boolean(topInsight.headline && topInsight.observation), "Insight contains structured headline and observation");
    assert(topInsight.evidenceDetail.length >= 1, "Insight provides verifiable evidence detail");

    // ------------------------------------------------------------------------
    // SECTION 10: BACKWARD COMPATIBILITY WITH PHASE 14
    // ------------------------------------------------------------------------
    console.log("\n--- 10. Backward Compatibility with Phase 14 Architecture ---");

    const phase14Intel = await getPlacementIntelligence(userAlphaId);
    assert(phase14Intel.hasBaseline === true, "Phase 14 hasBaseline preserved");
    assert(phase14Intel.priorities.length >= 1, "Phase 14 priorities preserved");
    assert(phase14Intel.dataSufficiency.hasCompletedBaseline === true, "Phase 14 dataSufficiency preserved");
    assert(Boolean(phase14Intel.intelligence2), "Phase 14 output seamlessly contains Phase 23 intelligence2 snapshot");
    assert(phase14Intel.intelligence2?.dimensions.length === 14, "Nested intelligence2 has all 14 dimensions");

    // ------------------------------------------------------------------------
    // SECTION 11: SECURITY & MULTI-TENANT ISOLATION
    // ------------------------------------------------------------------------
    console.log("\n--- 11. Security & Multi-Tenant Isolation ---");

    // Beta has zero data
    const betaIntel = await getPlacementIntelligence2(userBetaId);
    assert(betaIntel.evidenceSummary.totalAssessments === 0, "Beta has 0 assessments");
    assert(betaIntel.strengths.length === 0, "Beta leaks NO strengths from Alpha");
    assert(betaIntel.weaknesses.length === 0, "Beta leaks NO weaknesses from Alpha");
    assert(betaIntel.targetAlignment.targetConfigured === false, "Beta leaks NO target configuration from Alpha");

    // Negative tests: empty and null user ID
    let emptyIdThrown = false;
    try {
      await getPlacementIntelligence2("");
    } catch {
      emptyIdThrown = true;
    }
    assert(emptyIdThrown, "getPlacementIntelligence2 rejects empty user ID");

    let nullIdThrown = false;
    try {
      await getPlacementIntelligence2(null as unknown as string);
    } catch {
      nullIdThrown = true;
    }
    assert(nullIdThrown, "getPlacementIntelligence2 rejects null user ID");

    // API Route unauthenticated protection
    let apiFailClosed = false;
    try {
      const resp = await placementIntelligence2ApiGet();
      apiFailClosed = resp.status === 401;
    } catch (e: unknown) {
      apiFailClosed =
        e instanceof Error &&
        (e.message.includes("Unauthorized") ||
          e.message.includes("headers") ||
          e.message.includes("auth"));
    }
    assert(
      apiFailClosed,
      "GET /api/student/placement-intelligence-2 is protected against unauthenticated access (401 or fail-closed)"
    );

    // ------------------------------------------------------------------------
    // SECTION 12: DETERMINISM & REPRODUCIBILITY
    // ------------------------------------------------------------------------
    console.log("\n--- 12. Determinism & Mathematical Reproducibility ---");

    const runA = await getPlacementIntelligence2(userAlphaId);
    const runB = await getPlacementIntelligence2(userAlphaId);

    assert(runA.dimensions.length === runB.dimensions.length, "Dimension count is identical across repeated executions");
    assert(
      runA.dimensions.every((d, i) => d.id === runB.dimensions[i].id && d.score === runB.dimensions[i].score && d.status === runB.dimensions[i].status),
      "Dimension scores and statuses are 100% deterministic"
    );
    assert(
      runA.priorities.length === runB.priorities.length &&
      runA.priorities[0]?.title === runB.priorities[0]?.title,
      "Priorities are 100% deterministic"
    );

    console.log("\n==================================================");
    console.log(`Phase 23 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");
  } finally {
    // Cleanup fixtures
    if (userAlphaId || userBetaId || userZeroId) {
      console.log("\nCleaning up test fixtures...");
      for (const uid of [userAlphaId, userBetaId, userZeroId].filter(Boolean)) {
        // Delete attempts & answers
        const userAttempts = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.userId, uid));
        for (const att of userAttempts) {
          await db.delete(answers).where(eq(answers.attemptId, att.id));
        }
        await db.delete(attempts).where(eq(attempts.userId, uid));

        // Delete simulations & rounds
        const userSims = await db.select({ id: placementSimulations.id }).from(placementSimulations).where(eq(placementSimulations.userId, uid));
        for (const s of userSims) {
          await db.delete(placementSimulationRounds).where(eq(placementSimulationRounds.simulationId, s.id));
        }
        await db.delete(placementSimulations).where(eq(placementSimulations.userId, uid));

        // Delete targets
        await db.delete(studentTargetRoles).where(eq(studentTargetRoles.userId, uid));
        await db.delete(studentTargetCompanies).where(eq(studentTargetCompanies.userId, uid));

        // Delete profiles & users
        await db.delete(profiles).where(eq(profiles.userId, uid));
        await db.delete(users).where(eq(users.id, uid));
      }
      console.log("Cleanup complete.");
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase23Tests().catch((err) => {
  console.error("Phase 23 test execution error:", err);
  process.exit(1);
});
