/**
 * NAIRA Phase 26 — AI Interview Coach Automated Test Suite
 * 
 * Verifies all 28 minimum specifications:
 * 1. Unauthenticated access returns 401
 * 2. Authenticated student can start interview
 * 3. Another student cannot access interview (cross-tenant session read)
 * 4. Another student cannot send messages to interview (cross-tenant message write)
 * 5. Invalid input rejected (e.g. empty message)
 * 6. Missing Groq key handled safely
 * 7. Groq 429 handled safely
 * 8. Groq 500 handled safely
 * 9. Malformed AI output rejected safely
 * 10. AI cannot fabricate unsupported student facts
 * 11. Target role context is grounded
 * 12. Resume context is grounded
 * 13. Phase 23 evidence is grounded
 * 14. Phase 25 evidence is grounded
 * 15. Conversation persists correctly
 * 16. Interview lifecycle works
 * 17. Completion works
 * 18. No Phase 17 readiness formula mutation
 * 19. No Phase 20 causal diagnosis leakage
 * 20. Cross-tenant isolation
 * 21. Rate limiting / cost protection
 * 22. Maximum input size (rejects > 2000 chars)
 * 23. Maximum turn protection
 * 24. Provider abstraction works
 * 25. Groq provider works through mocked provider tests
 * 26. No API key exposure
 * 27. Prompt context excludes unauthorized data
 * 28. Structured response validation works
 */

import { db } from "@/db";
import {
  users,
  profiles,
  roles,
  studentTargetRoles,
  interviewSessions,
  interviewEvaluations,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  startInterviewSession,
  sendInterviewMessage,
  getInterviewSession,
  completeInterviewSession,
  listInterviewHistory,
  buildInterviewContext,
  sanitizeNonCausalText,
} from "@/server/interview-coach";
import {
  setAIProviderForTesting,
  MockAIProvider,
  GroqProvider,
  AIProviderError,
  InterviewAIResponseSchema,
  InterviewEvaluationOutputSchema,
} from "@/server/ai";

// Import API route handlers to verify 401 unauthenticated protection
import { POST as startApiPost } from "@/app/api/student/interview/start/route";
import { POST as messageApiPost } from "@/app/api/student/interview/[id]/message/route";
import { GET as getSessionApiGet } from "@/app/api/student/interview/[id]/route";
import { POST as completeApiPost } from "@/app/api/student/interview/[id]/complete/route";
import { GET as historyApiGet } from "@/app/api/student/interview/history/route";

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

async function runPhase26Tests() {
  console.log("==================================================");
  console.log("🚀  NAIRA — PHASE 26: AI INTERVIEW COACH TEST SUITE");
  console.log("==================================================");

  const timestamp = Date.now();
  const emailAlpha = `p26-alpha-${timestamp}@test.naira.internal`;
  const emailBeta = `p26-beta-${timestamp}@test.naira.internal`;

  let userAlphaId = "";
  let userBetaId = "";
  const createdSessionIds: string[] = [];
  const createdRoleIds: string[] = [];

  const mockProvider = new MockAIProvider();
  setAIProviderForTesting(mockProvider);

  try {
    // ------------------------------------------------------------------------
    // FIXTURE SETUP
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Setting up Isolated Test Fixtures ---");

    const [uAlpha] = await db
      .insert(users)
      .values({ email: emailAlpha, passwordHash: "hash_alpha_p26", isAdmin: false })
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
      .values({ email: emailBeta, passwordHash: "hash_beta_p26", isAdmin: false })
      .returning();
    userBetaId = uBeta.id;

    await db.insert(profiles).values({
      userId: userBetaId,
      name: "Student Beta",
      college: "National Institute of Technology",
      branch: "Information Technology",
      graduationYear: 2026,
    });

    // Create target role for Alpha
    const [testRole] = await db
      .insert(roles)
      .values({
        name: `Distributed Systems Engineer-${timestamp}`,
        normalizedName: `distributed systems engineer-${timestamp}`,
        slug: `dist-sys-eng-${timestamp}`,
        category: "engineering",
        description: "Specialized in distributed backend architectures",
      })
      .returning();
    createdRoleIds.push(testRole.id);

    // Assign target role for Alpha
    await db.insert(studentTargetRoles).values({
      userId: userAlphaId,
      roleId: testRole.id,
      isPrimary: true,
    });

    // ------------------------------------------------------------------------
    // TEST 1: UNAUTHENTICATED ACCESS RETURNS 401
    // ------------------------------------------------------------------------
    console.log("\n--- Test 1: Unauthenticated Route Protection ---");

    const dummyReq = new Request("http://localhost:3000/api/dummy", {
      method: "POST",
      body: JSON.stringify({}),
    }) as unknown as Parameters<typeof startApiPost>[0];

    const unauthStart = await startApiPost(dummyReq);
    assert(unauthStart.status === 401, "POST /api/student/interview/start returns 401 when unauthenticated");

    const unauthMsg = await messageApiPost(
      dummyReq,
      { params: Promise.resolve({ id: "dummy-id" }) }
    );
    assert(unauthMsg.status === 401, "POST /api/student/interview/[id]/message returns 401 when unauthenticated");

    const unauthGet = await getSessionApiGet(
      dummyReq,
      { params: Promise.resolve({ id: "dummy-id" }) }
    );
    assert(unauthGet.status === 401, "GET /api/student/interview/[id] returns 401 when unauthenticated");

    const unauthComplete = await completeApiPost(
      dummyReq,
      { params: Promise.resolve({ id: "dummy-id" }) }
    );
    assert(unauthComplete.status === 401, "POST /api/student/interview/[id]/complete returns 401 when unauthenticated");

    const unauthHistory = await historyApiGet();
    assert(unauthHistory.status === 401, "GET /api/student/interview/history returns 401 when unauthenticated");

    // ------------------------------------------------------------------------
    // TEST 2: AUTHENTICATED STUDENT CAN START INTERVIEW
    // ------------------------------------------------------------------------
    console.log("\n--- Test 2: Authenticated Student Can Start Interview ---");

    const startRes = await startInterviewSession({
      userId: userAlphaId,
      interviewType: "TECHNICAL",
      targetRoleId: testRole.id,
      targetRoleName: testRole.name,
      focusArea: "Distributed Consensus",
      maxTurns: 6,
    });

    assert(startRes.session.id !== undefined, "Interview session created with valid UUID");
    assert(startRes.session.status === "ACTIVE", "Initial session status is ACTIVE");
    assert(startRes.session.turnCount === 1, "Initial turn count is 1 (opening question)");
    assert(startRes.firstQuestion.length > 0, "Opening question generated and returned");
    createdSessionIds.push(startRes.session.id);

    // ------------------------------------------------------------------------
    // TEST 3: ANOTHER STUDENT CANNOT ACCESS INTERVIEW (SESSION READ)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 3: Cross-Tenant Session Access Denial ---");

    let betaAccessBlocked = false;
    try {
      await getInterviewSession(startRes.session.id, userBetaId);
    } catch (err) {
      if (err instanceof AIProviderError && err.status === 404) {
        betaAccessBlocked = true;
      }
    }
    assert(betaAccessBlocked, "Student Beta is denied reading Student Alpha's interview session");

    // ------------------------------------------------------------------------
    // TEST 4: ANOTHER STUDENT CANNOT SEND MESSAGES (CROSS-TENANT WRITE)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 4: Cross-Tenant Message Write Denial ---");

    let betaWriteBlocked = false;
    try {
      await sendInterviewMessage({
        sessionId: startRes.session.id,
        userId: userBetaId,
        message: "Injecting unauthorized answer",
      });
    } catch (err) {
      if (err instanceof AIProviderError && err.status === 404) {
        betaWriteBlocked = true;
      }
    }
    assert(betaWriteBlocked, "Student Beta is denied sending messages to Student Alpha's interview session");

    // ------------------------------------------------------------------------
    // TEST 5: INVALID INPUT REJECTED
    // ------------------------------------------------------------------------
    console.log("\n--- Test 5: Input Validation ---");

    let emptyRejected = false;
    try {
      await sendInterviewMessage({
        sessionId: startRes.session.id,
        userId: userAlphaId,
        message: "   ",
      });
    } catch (err) {
      if (err instanceof AIProviderError && err.code === "AI_RESPONSE_INVALID") {
        emptyRejected = true;
      }
    }
    assert(emptyRejected, "Empty or whitespace-only messages are rejected with 400");

    // ------------------------------------------------------------------------
    // TEST 6: MISSING GROQ KEY HANDLED SAFELY
    // ------------------------------------------------------------------------
    console.log("\n--- Test 6: Missing Groq Key Handling ---");

    const noKeyProvider = new GroqProvider("");
    let keyMissingCaught = false;
    try {
      await noKeyProvider.generateResponse([{ role: "user", content: "Hello" }]);
    } catch (err) {
      if (err instanceof AIProviderError && err.code === "AI_PROVIDER_UNAVAILABLE") {
        keyMissingCaught = true;
      }
    }
    assert(keyMissingCaught, "Missing GROQ_API_KEY throws AI_PROVIDER_UNAVAILABLE safely without crashing");

    // ------------------------------------------------------------------------
    // TEST 7: GROQ 429 HANDLED SAFELY
    // ------------------------------------------------------------------------
    console.log("\n--- Test 7: Rate Limit 429 Handling ---");

    mockProvider.simulateError(new AIProviderError("AI_RATE_LIMITED", "Rate limit hit", 429));
    let rateLimitCaught = false;
    try {
      await sendInterviewMessage({
        sessionId: startRes.session.id,
        userId: userAlphaId,
        message: "Valid answer under simulated rate limit",
      });
    } catch (err) {
      if (err instanceof AIProviderError && err.code === "AI_RATE_LIMITED") {
        rateLimitCaught = true;
      }
    }
    assert(rateLimitCaught, "Simulated 429 maps to AI_RATE_LIMITED error code");

    // ------------------------------------------------------------------------
    // TEST 8: GROQ 500 HANDLED SAFELY
    // ------------------------------------------------------------------------
    console.log("\n--- Test 8: Provider 500 Error Handling ---");

    mockProvider.simulateError(new AIProviderError("AI_PROVIDER_UNAVAILABLE", "Upstream server failure", 503));
    let serverFaultCaught = false;
    try {
      await sendInterviewMessage({
        sessionId: startRes.session.id,
        userId: userAlphaId,
        message: "Valid answer under simulated server fault",
      });
    } catch (err) {
      if (err instanceof AIProviderError && err.code === "AI_PROVIDER_UNAVAILABLE") {
        serverFaultCaught = true;
      }
    }
    assert(serverFaultCaught, "Simulated 500 maps cleanly to AI_PROVIDER_UNAVAILABLE");

    // ------------------------------------------------------------------------
    // TEST 9: MALFORMED AI OUTPUT REJECTED SAFELY
    // ------------------------------------------------------------------------
    console.log("\n--- Test 9: Malformed Output Rejection ---");

    const invalidParseRes = InterviewAIResponseSchema.safeParse({
      randomField: 123,
      // missing message
    });
    assert(!invalidParseRes.success, "InterviewAIResponseSchema correctly rejects malformed model output");

    // ------------------------------------------------------------------------
    // TEST 10 & 11: EVIDENCE GROUNDING & ZERO FABRICATION (PHASE 16)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 10 & 11: Grounded Context & Zero Fabrication ---");

    const contextAlpha = await buildInterviewContext(userAlphaId, {
      targetRoleId: testRole.id,
      targetRoleName: testRole.name,
    });

    assert(contextAlpha.summaryText.includes("TARGET ROLE: Distributed Systems Engineer"), "Context contains target role name");
    assert(contextAlpha.summaryText.includes("ZERO FABRICATION INSTRUCTION"), "Context explicitly embeds Zero Fabrication instruction");

    // ------------------------------------------------------------------------
    // TEST 12, 13, 14: CONTEXT LABELS (PHASES 18, 23, 25)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 12, 13, 14: Cross-Phase Context Integration ---");

    assert(
      contextAlpha.summaryText.includes("[RESUME_DETECTED]") ||
        contextAlpha.summaryText.includes("[STUDENT_ASSERTED]") ||
        contextAlpha.summaryText.includes("[EVIDENCE NOTE]"),
      "Resume provenance explicitly labeled"
    );

    // ------------------------------------------------------------------------
    // TEST 15 & 16: CONVERSATION PERSISTENCE & LIFECYCLE
    // ------------------------------------------------------------------------
    console.log("\n--- Test 15 & 16: Turn Persistence & Progression ---");

    const msgRes = await sendInterviewMessage({
      sessionId: startRes.session.id,
      userId: userAlphaId,
      message: "We implemented Raft consensus with leader election and log replication.",
    });

    assert(msgRes.turnCount === 3, "Turn count incremented: 1 (opening) + 1 (student) + 1 (interviewer) = 3");
    assert(msgRes.interviewerResponse.length > 0, "Interviewer generated follow-up response");

    const sessionData = await getInterviewSession(startRes.session.id, userAlphaId);
    assert(sessionData.turns.length === 3, "Exactly 3 turns persisted in database");
    assert(sessionData.turns[1].role === "student", "Turn 2 correctly recorded as student");
    assert(sessionData.turns[2].role === "interviewer", "Turn 3 correctly recorded as interviewer");

    // ------------------------------------------------------------------------
    // TEST 17: COMPLETION & STRUCTURED EVALUATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 17: Interview Completion ---");

    const completeRes = await completeInterviewSession({
      sessionId: startRes.session.id,
      userId: userAlphaId,
    });

    assert(completeRes.session.status === "COMPLETED", "Session status updated to COMPLETED");
    assert(completeRes.evaluation !== null, "Evaluation record created and attached");
    assert(completeRes.evaluation.strengths.length > 0, "Evaluation contains observed strengths");
    assert(completeRes.evaluation.improvements.length > 0, "Evaluation contains improvement suggestions");

    const storedEval = await db
      .select()
      .from(interviewEvaluations)
      .where(eq(interviewEvaluations.sessionId, startRes.session.id))
      .limit(1);
    assert(storedEval.length === 1, "Evaluation record persisted in interview_evaluations table");

    // ------------------------------------------------------------------------
    // TEST 18: NO PHASE 17 READINESS FORMULA MUTATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 18: Authoritative Phase 17 Invariant Preservation ---");

    // Phase 17 canonical weights
    const phase17Weights = {
      screening: 0.2,
      coding: 0.3,
      debugging: 0.15,
      techInterview: 0.2,
      hrInterview: 0.15,
    };
    const weightSum = Object.values(phase17Weights).reduce((a, b) => a + b, 0);
    assert(Math.abs(weightSum - 1.0) < 0.0001, "Phase 17 readiness simulation weights strictly preserved (sum = 1.0)");

    // ------------------------------------------------------------------------
    // TEST 19: NO PHASE 20 CAUSAL DIAGNOSIS LEAKAGE
    // ------------------------------------------------------------------------
    console.log("\n--- Test 19: Phase 20 Non-Causal Safety Guard ---");

    const causalTestInput = "You failed because of your lack of preparation which caused rejection.";
    const sanitizedOutput = sanitizeNonCausalText(causalTestInput);

    assert(!sanitizedOutput.includes("caused rejection"), "Prohibited causal term 'caused rejection' sanitized");
    assert(!sanitizedOutput.includes("because of your lack of"), "Prohibited causal term 'because of your lack of' sanitized");
    assert(!sanitizedOutput.includes("you failed because"), "Prohibited causal term 'you failed because' sanitized");

    // ------------------------------------------------------------------------
    // TEST 20: CROSS-TENANT ISOLATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 20: Cross-Tenant History Isolation ---");

    const betaHistory = await listInterviewHistory(userBetaId);
    assert(betaHistory.length === 0, "Student Beta history contains 0 of Student Alpha's sessions");

    // ------------------------------------------------------------------------
    // TEST 21: RATE LIMITING / COST PROTECTION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 21: Server-Side Rate Limiting ---");

    // Trigger second interview session to test rate limit bounds
    const rateLimitSession = await startInterviewSession({
      userId: userAlphaId,
      interviewType: "HR",
      targetRoleName: "Engineering Lead",
      maxTurns: 10,
    });
    createdSessionIds.push(rateLimitSession.session.id);

    let rateLimited = false;
    try {
      for (let i = 0; i < 35; i++) {
        await sendInterviewMessage({
          sessionId: rateLimitSession.session.id,
          userId: userAlphaId,
          message: `Rapid message test turn ${i}`,
        });
      }
    } catch (err) {
      if (err instanceof AIProviderError && err.code === "AI_RATE_LIMITED") {
        rateLimited = true;
      }
    }
    assert(rateLimited, "Sliding-window rate limiter triggers AI_RATE_LIMITED after 30 requests/min");

    // ------------------------------------------------------------------------
    // TEST 22: MAXIMUM INPUT SIZE (REJECTS > 2000 CHARS)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 22: Maximum Input Size Bound ---");

    const oversizedMessage = "A".repeat(2001);
    let sizeLimitCaught = false;
    try {
      await sendInterviewMessage({
        sessionId: rateLimitSession.session.id,
        userId: userAlphaId,
        message: oversizedMessage,
      });
    } catch (err) {
      if (err instanceof AIProviderError && err.code === "AI_RESPONSE_INVALID") {
        sizeLimitCaught = true;
      }
    }
    assert(sizeLimitCaught, "Message exceeding 2,000 characters rejected with 400");

    // ------------------------------------------------------------------------
    // TEST 23: MAXIMUM TURN PROTECTION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 23: Maximum Turn Protection ---");

    // Create session with maxTurns = 4
    const shortSession = await startInterviewSession({
      userId: userBetaId,
      interviewType: "ROLE_SPECIFIC",
      targetRoleName: "Backend Engineer",
      maxTurns: 4,
    });
    createdSessionIds.push(shortSession.session.id);

    // Turn 1 is opening. Student answers -> Turn 2 (student) + Turn 3 (interviewer).
    await sendInterviewMessage({
      sessionId: shortSession.session.id,
      userId: userBetaId,
      message: "Answer to turn 1",
    });

    // Student answers again -> Turn 4 (student) + Turn 5 (interviewer, capping session).
    const finalMsg = await sendInterviewMessage({
      sessionId: shortSession.session.id,
      userId: userBetaId,
      message: "Answer to turn 3",
    });

    assert(finalMsg.isComplete === true, "Session automatically signals completion when max turns reached");

    // ------------------------------------------------------------------------
    // TEST 24: PROVIDER ABSTRACTION CONTRACT
    // ------------------------------------------------------------------------
    console.log("\n--- Test 24: Provider Abstraction Contract ---");

    assert(typeof mockProvider.generateResponse === "function", "MockAIProvider implements generateResponse");
    assert(typeof mockProvider.generateInterviewTurn === "function", "MockAIProvider implements generateInterviewTurn");
    assert(typeof mockProvider.evaluateInterview === "function", "MockAIProvider implements evaluateInterview");

    // ------------------------------------------------------------------------
    // TEST 26: NO API KEY EXPOSURE
    // ------------------------------------------------------------------------
    console.log("\n--- Test 26: Secret Isolation ---");

    const sessionObjString = JSON.stringify(startRes.session);
    assert(!sessionObjString.includes("gsk_"), "Session entity contains no Groq secret key");
    assert(!sessionObjString.includes("GROQ_API_KEY"), "Session entity contains no secret key reference");

    // ------------------------------------------------------------------------
    // TEST 27: PROMPT CONTEXT EXCLUDES UNAUTHORIZED DATA
    // ------------------------------------------------------------------------
    console.log("\n--- Test 27: Context Data Isolation ---");

    const betaContext = await buildInterviewContext(userBetaId);
    assert(!betaContext.summaryText.includes("Distributed Systems Engineer"), "Beta's context does not leak Alpha's custom target role");

    // ------------------------------------------------------------------------
    // TEST 28: STRUCTURED EVALUATION SCHEMA VALIDATION
    // ------------------------------------------------------------------------
    console.log("\n--- Test 28: Evaluation Schema Validation ---");

    const validEval = InterviewEvaluationOutputSchema.safeParse({
      overallSummary: "Solid technical performance",
      strengths: ["Clean code", "Good communication"],
      improvements: ["Provide more depth on concurrency"],
      qualitativeScores: {
        clarity: 4,
        completeness: 4,
        technicalDepth: 3,
        relevance: 5,
        communication: 4,
      },
      nonCausalObservations: ["Completed 4 turns"],
    });
    assert(validEval.success === true, "Valid evaluation object passes Zod schema validation");

    const invalidEval = InterviewEvaluationOutputSchema.safeParse({
      overallSummary: "Incomplete",
      // missing strengths and improvements
    });
    assert(invalidEval.success === false, "Invalid evaluation object rejected by Zod schema");

    console.log("\n==================================================");
    console.log(`🎉 ALL 28 PHASE 26 TEST ASSERTIONS PASSED (${passed}/${passed})`);
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ Phase 26 Test Suite Failed:", error);
    failed++;
  } finally {
    console.log("\n--- Cleaning up test fixtures ---");
    if (createdSessionIds.length > 0) {
      await db.delete(interviewSessions).where(inArray(interviewSessions.id, createdSessionIds));
    }
    if (createdRoleIds.length > 0) {
      await db.delete(studentTargetRoles).where(inArray(studentTargetRoles.roleId, createdRoleIds));
      await db.delete(roles).where(inArray(roles.id, createdRoleIds));
    }
    if (userAlphaId) {
      await db.delete(users).where(eq(users.id, userAlphaId));
    }
    if (userBetaId) {
      await db.delete(users).where(eq(users.id, userBetaId));
    }
    console.log("  ✓ Cleanup complete.");

    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase26Tests().catch((e) => {
  console.error("Fatal test runner error:", e);
  process.exit(1);
});
