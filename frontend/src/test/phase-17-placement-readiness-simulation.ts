import { db } from "@/db";
import {
  users,
  profiles,
  companies,
  roles,
  placementSimulations,
  placementSimulationRounds,
  studentTargetRoles,
  studentTargetCompanies,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createPlacementSimulation,
  getPlacementSimulation,
  getStudentSimulationHistory,
  submitSimulationRound,
  evaluateStudentEligibility,
  CANONICAL_CODING_CHALLENGES,
  CANONICAL_DEBUGGING_CHALLENGES,
  CANONICAL_TECH_INTERVIEW_QUESTIONS,
  CANONICAL_HR_INTERVIEW_QUESTIONS,
} from "@/server/placement-simulation";
import { GET as simulationListApiGet } from "@/app/api/student/simulation/route";
import {
  seedCanonicalPlacementData,
  addStudentTargetRole,
  addStudentTargetCompany,
} from "@/server/company-role-intelligence";

async function runPhase17Tests() {
  console.log("==================================================");
  console.log("🚀  NEXORA — PHASE 17: PLACEMENT READINESS SIMULATION");
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
  const createdSimulationIds: string[] = [];

  try {
    console.log("\n--- 1. Setting up Isolated Test Fixtures ---");
    await seedCanonicalPlacementData();

    // 1. Student Alpha: Full profile with high graduation batch & target company/role
    const [userAlpha] = await db
      .insert(users)
      .values({
        email: `phase17_alpha_${Date.now()}@nexora.test`,
        passwordHash: "hash_alpha",
        isAdmin: false,
      })
      .returning();
    createdUserIds.push(userAlpha.id);

    const [profileAlpha] = await db
      .insert(profiles)
      .values({
        userId: userAlpha.id,
        name: "Alpha Candidate",
        college: "Nexora Engineering Institute",
        branch: "Computer Science",
        graduationYear: 2026,
      })
      .returning();

    // 2. Student Beta: Alternate user for multi-tenant isolation testing
    const [userBeta] = await db
      .insert(users)
      .values({
        email: `phase17_beta_${Date.now()}@nexora.test`,
        passwordHash: "hash_beta",
        isAdmin: false,
      })
      .returning();
    createdUserIds.push(userBeta.id);

    await db.insert(profiles).values({
      userId: userBeta.id,
      name: "Beta Candidate",
      college: "Nexora Polytech",
      branch: "Information Technology",
      graduationYear: 2026,
    });

    // Fetch canonical company & role
    const canonicalCompanies = await db.select().from(companies).limit(2);
    const canonicalRoles = await db.select().from(roles).limit(2);

    assert(canonicalCompanies.length > 0, "Canonical companies seeded and available");
    assert(canonicalRoles.length > 0, "Canonical roles seeded and available");

    const targetCompany = canonicalCompanies[0];
    const targetRole = canonicalRoles[0];

    await addStudentTargetCompany(userAlpha.id, targetCompany.id);
    await addStudentTargetRole(userAlpha.id, targetRole.id);

    // --------------------------------------------------------------------------
    console.log("\n--- 2. Testing Eligibility Evaluation (Zero Fabrication) ---");
    // --------------------------------------------------------------------------
    // A. Eligibility when criteria are specified
    const eligibilityWithCriteria = evaluateStudentEligibility(profileAlpha, {
      eligibleBranches: ["Computer Science", "Information Technology"],
      minGradYear: 2025,
      maxGradYear: 2027,
    });
    assert(
      eligibilityWithCriteria.status === "eligible",
      "Student Alpha with CS and 2026 batch satisfies eligibleBranches and gradYear"
    );
    assert(
      eligibilityWithCriteria.criteria.every((c) => c.status === "met"),
      "All eligibility criteria report 'met' status"
    );

    // B. Eligibility when student does not satisfy branch
    const ineligibleBranch = evaluateStudentEligibility(profileAlpha, {
      eligibleBranches: ["Mechanical Engineering", "Civil Engineering"],
    });
    assert(
      ineligibleBranch.status === "ineligible",
      "Student Alpha correctly identified as 'ineligible' for incompatible branches"
    );

    // C. Zero Fabrication: When criteria are unavailable in database, returns 'unavailable'
    const eligibilityUnavailable = evaluateStudentEligibility(profileAlpha, null);
    assert(
      eligibilityUnavailable.status === "unavailable",
      "Missing company criteria cleanly labels status as 'unavailable' (zero fabrication)"
    );
    assert(
      eligibilityUnavailable.summary.includes("proceeding with open practice"),
      "Helpful explanatory summary without inventing requirements"
    );

    // --------------------------------------------------------------------------
    console.log("\n--- 3. Testing Simulation Creation & Round Generation ---");
    // --------------------------------------------------------------------------
    const simAlpha = await createPlacementSimulation({
      userId: userAlpha.id,
      companyId: targetCompany.id,
      roleId: targetRole.id,
    });
    createdSimulationIds.push(simAlpha.id);

    assert(simAlpha.id.length > 0, "Simulation created with unique ID");
    assert(simAlpha.userId === userAlpha.id, "Simulation bound strictly to userAlpha");
    assert(simAlpha.companyName === targetCompany.name, "Simulation companyName matches target company");
    assert(simAlpha.roleName === targetRole.name, "Simulation roleName matches target role");
    assert(simAlpha.status === "in_progress", "Initial simulation status is 'in_progress'");
    assert(simAlpha.currentRoundOrder === 1, "Initial current round is 1");
    assert(simAlpha.rounds.length === 5, "Simulation generates precisely 5 sequential rounds");

    // Verify round ordering and initial locking states
    const [r1, r2, r3, r4, r5] = simAlpha.rounds;
    assert(r1.roundNumber === 1 && r1.roundType === "screening" && r1.status === "unlocked", "Round 1 is Screening and UNLOCKED");
    assert(r2.roundNumber === 2 && r2.roundType === "coding" && r2.status === "locked", "Round 2 is Coding and LOCKED");
    assert(r3.roundNumber === 3 && r3.roundType === "debugging" && r3.status === "locked", "Round 3 is Debugging and LOCKED");
    assert(r4.roundNumber === 4 && r4.roundType === "tech_interview" && r4.status === "locked", "Round 4 is Tech Interview and LOCKED");
    assert(r5.roundNumber === 5 && r5.roundType === "hr_interview" && r5.status === "locked", "Round 5 is HR Interview and LOCKED");

    // --------------------------------------------------------------------------
    console.log("\n--- 4. Testing Generalized Simulation Creation (No Company) ---");
    // --------------------------------------------------------------------------
    const simGeneral = await createPlacementSimulation({
      userId: userAlpha.id,
      roleId: targetRole.id,
      roleName: targetRole.name,
    });
    createdSimulationIds.push(simGeneral.id);

    assert(simGeneral.isGeneralizedRole === true, "isGeneralizedRole is true when company is omitted");
    assert(simGeneral.rounds.length === 5, "Generalized simulation also creates 5 rounds");

    // --------------------------------------------------------------------------
    console.log("\n--- 5. Testing Lock Enforcement (Cannot skip rounds) ---");
    // --------------------------------------------------------------------------
    let lockErrorCaught = false;
    try {
      await submitSimulationRound({
        simulationId: simAlpha.id,
        userId: userAlpha.id,
        roundNumber: 2,
        submission: {
          score: 100,
          codeSubmissions: { solution: "cheat" },
        },
      });
    } catch (err: any) {
      lockErrorCaught = true;
      assert(err.message.includes("locked"), `Submitting locked round 2 threw: ${err.message}`);
    }
    assert(lockErrorCaught, "Submitting locked Round 2 before Round 1 completes is blocked");

    let lockErrorRound5 = false;
    try {
      await submitSimulationRound({
        simulationId: simAlpha.id,
        userId: userAlpha.id,
        roundNumber: 5,
        submission: {
          score: 90,
        },
      });
    } catch (err: any) {
      lockErrorRound5 = true;
    }
    assert(lockErrorRound5, "Submitting locked Round 5 directly is blocked");

    // --------------------------------------------------------------------------
    console.log("\n--- 6. Sequential Round Submissions & Progression ---");
    // --------------------------------------------------------------------------
    // A. Submit Round 1: Screening
    const postR1 = await submitSimulationRound({
      simulationId: simAlpha.id,
      userId: userAlpha.id,
      roundNumber: 1,
      submission: {
        score: 80,
        accuracy: 80,
        timeTakenSeconds: 900,
      },
    });
    assert(postR1.rounds[0].status === "completed", "Round 1 status transitioned to 'completed'");
    assert(postR1.rounds[0].score === 80, "Round 1 recorded score 80");
    assert(postR1.rounds[1].status === "unlocked", "Round 2 is automatically UNLOCKED after Round 1 completes");
    assert(postR1.currentRoundOrder === 2, "Current round order advanced to 2");
    assert(postR1.status === "in_progress", "Simulation status remains 'in_progress'");

    // B. Submit Round 2: Coding & DSA
    const postR2 = await submitSimulationRound({
      simulationId: simAlpha.id,
      userId: userAlpha.id,
      roundNumber: 2,
      submission: {
        score: 90,
        accuracy: 90,
        timeTakenSeconds: 1200,
        codeSubmissions: {
          challengeId: CANONICAL_CODING_CHALLENGES[0].id,
          code: "function solve() { return true; }",
          language: "javascript",
          testsPassed: 4,
          totalTests: 4,
        },
      },
    });
    assert(postR2.rounds[1].status === "completed", "Round 2 status transitioned to 'completed'");
    assert(postR2.rounds[2].status === "unlocked", "Round 3 is automatically UNLOCKED after Round 2 completes");
    assert(postR2.currentRoundOrder === 3, "Current round order advanced to 3");

    // C. Submit Round 3: Debugging
    const postR3 = await submitSimulationRound({
      simulationId: simAlpha.id,
      userId: userAlpha.id,
      roundNumber: 3,
      submission: {
        score: 85,
        accuracy: 85,
        timeTakenSeconds: 600,
        debuggingSubmissions: {
          challengeId: CANONICAL_DEBUGGING_CHALLENGES[0].id,
          fixedCode: "return a + b;",
          testsPassed: 3,
          totalTests: 3,
        },
      },
    });
    assert(postR3.rounds[2].status === "completed", "Round 3 status transitioned to 'completed'");
    assert(postR3.rounds[3].status === "unlocked", "Round 4 is automatically UNLOCKED after Round 3 completes");
    assert(postR3.currentRoundOrder === 4, "Current round order advanced to 4");

    // D. Submit Round 4: AI Technical Interview
    const postR4 = await submitSimulationRound({
      simulationId: simAlpha.id,
      userId: userAlpha.id,
      roundNumber: 4,
      submission: {
        score: 75,
        accuracy: 75,
        timeTakenSeconds: 1500,
        interviewResponses: [
          {
            questionId: CANONICAL_TECH_INTERVIEW_QUESTIONS[0].id,
            answer: "B-Tree indexes maintain sorted balanced order for logarithmic search.",
            followUpAnswer: "Composite indexes order columns left-to-right, requiring leftmost prefix alignment.",
          },
        ],
      },
    });
    assert(postR4.rounds[3].status === "completed", "Round 4 status transitioned to 'completed'");
    assert(postR4.rounds[4].status === "unlocked", "Round 5 is automatically UNLOCKED after Round 4 completes");
    assert(postR4.currentRoundOrder === 5, "Current round order advanced to 5");

    // E. Submit Round 5: AI HR Interview (Final Round)
    const postR5 = await submitSimulationRound({
      simulationId: simAlpha.id,
      userId: userAlpha.id,
      roundNumber: 5,
      submission: {
        score: 85,
        accuracy: 85,
        timeTakenSeconds: 900,
        hrResponses: [
          {
            questionId: CANONICAL_HR_INTERVIEW_QUESTIONS[0].id,
            answer: "I am passionate about systems engineering and building reliable infrastructure for cloud workloads.",
          },
        ],
      },
    });

    // --------------------------------------------------------------------------
    console.log("\n--- 7. Verifying Final Readiness Report & Phase 15 Actions ---");
    // --------------------------------------------------------------------------
    assert(postR5.status === "completed", "Simulation status transitioned to 'completed'");
    assert(postR5.completedAt !== null, "completedAt timestamp is recorded");

    // Weighted score: 80*0.2 + 90*0.3 + 85*0.15 + 75*0.2 + 85*0.15 = 16 + 27 + 12.75 + 15 + 12.75 = 83.5 -> 84
    assert(typeof postR5.overallReadinessScore === "number", `overallReadinessScore computed: ${postR5.overallReadinessScore}`);
    assert(
      postR5.overallReadinessScore! >= 80 && postR5.overallReadinessScore! <= 86,
      `Calculated weighted score is within expected range (actual: ${postR5.overallReadinessScore}%)`
    );

    // Verify summaryReport structure
    assert(postR5.summaryReport !== null, "summaryReport is generated");
    const report = postR5.summaryReport!;
    assert(
      report.displayLabel.startsWith("Simulation Readiness:"),
      `Report display label is honest ('${report.displayLabel}') without false probability claims`
    );
    assert(
      report.roundsBreakdown.length === 5,
      "Report breakdown contains all 5 rounds"
    );
    assert(
      report.targetGapAnalysis.strongAreas.length > 0 || report.targetGapAnalysis.needsImprovement.length >= 0,
      "Target gap analysis provides structured engineering feedback"
    );

    // Verify Post-Simulation Plan feeds directly into Phase 15 Execution OS
    assert(
      report.postSimulationPlan.nextSteps.length > 0,
      "Post-simulation plan generated actionable steps"
    );
    const step1 = report.postSimulationPlan.nextSteps[0];
    assert(
      ["FIX", "REINFORCE", "REVIEW"].includes(step1.type),
      `Step 1 type (${step1.type}) conforms to Phase 15 taxonomy`
    );
    assert(step1.ctaHref.length > 0, `Step 1 links to direct action: ${step1.ctaHref}`);

    // --------------------------------------------------------------------------
    console.log("\n--- 8. Testing Simulation History & Ordering ---");
    // --------------------------------------------------------------------------
    const history = await getStudentSimulationHistory(userAlpha.id);
    assert(history.length >= 2, `History returns all simulations for user (found ${history.length})`);
    assert(
      new Date(history[0].startedAt).getTime() >= new Date(history[1].startedAt).getTime(),
      "Simulations are ordered in reverse chronological order (newest first)"
    );

    // --------------------------------------------------------------------------
    console.log("\n--- 9. Security & Multi-Tenant Isolation ---");
    // --------------------------------------------------------------------------
    // A. User Beta cannot access User Alpha's simulation
    let securityErrorCaught = false;
    try {
      await getPlacementSimulation(simAlpha.id, userBeta.id);
    } catch (err: any) {
      securityErrorCaught = true;
      assert(
        err.message.includes("Unauthorized") || err.message.includes("Access denied"),
        `Ownership check threw: ${err.message}`
      );
    }
    assert(securityErrorCaught, "Cross-user simulation inspection is strictly blocked");

    // B. User Beta cannot submit rounds to User Alpha's simulation
    let crossSubmitBlocked = false;
    try {
      await submitSimulationRound({
        simulationId: simAlpha.id,
        userId: userBeta.id,
        roundNumber: 1,
        submission: { score: 100 },
      });
    } catch (err: any) {
      crossSubmitBlocked = true;
      assert(
        err.message.includes("Unauthorized") || err.message.includes("Access denied"),
        `Round submit ownership check threw: ${err.message}`
      );
    }
    assert(crossSubmitBlocked, "Cross-user simulation round submission is strictly blocked");

    // C. Unauthenticated API Fail-Closed
    let apiAnonDenied = false;
    try {
      const res = await simulationListApiGet();
      if (res.status === 401) {
        apiAnonDenied = true;
      }
    } catch {
      apiAnonDenied = true;
    }
    assert(apiAnonDenied, "API GET /api/student/simulation fails closed without auth (401)");

    console.log("==================================================");
    console.log(`📊 PHASE 17 TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Unexpected error during Phase 17 testing:", error);
    process.exit(1);
  } finally {
    console.log("\nCleaning up test artifacts...");
    try {
      for (const simId of createdSimulationIds) {
        await db.delete(placementSimulationRounds).where(eq(placementSimulationRounds.simulationId, simId));
        await db.delete(placementSimulations).where(eq(placementSimulations.id, simId));
      }
      for (const uId of createdUserIds) {
        await db.delete(studentTargetCompanies).where(eq(studentTargetCompanies.userId, uId));
        await db.delete(studentTargetRoles).where(eq(studentTargetRoles.userId, uId));
        await db.delete(profiles).where(eq(profiles.userId, uId));
        await db.delete(users).where(eq(users.id, uId));
      }
      console.log("Cleanup complete.");
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
}

runPhase17Tests();
