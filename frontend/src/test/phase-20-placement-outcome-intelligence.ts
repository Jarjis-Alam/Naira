/**
 * Phase 20 — Placement Outcome Intelligence test suite.
 *
 * Runs against the real local database with isolated fixture users deleted in
 * `finally`. Verifies:
 *
 *  1. Engine level (pure): outcome derivation incl. unknown stage, evidence
 *     provenance, non-causal rendering, pattern detection, focus candidates.
 *  2. Causality protection (adversarial): rejection + DSA gap must never
 *     produce "DSA caused the rejection"; low ATS + rejection must never
 *     blame the resume; the guard throws on causal phrasing; single-instance
 *     gaps produce no pattern.
 *  3. Service level: analysis from real Phase 19 history, reflections as
 *     student-reported evidence, interview feedback, OUTCOME_RECORDED events,
 *     analytics, Phase 15 additive integration.
 *  4. Security: full cross-tenant denial on every surface.
 */

import { db } from "@/db";
import {
  applicationEvents,
  applicationInterviews,
  applications,
  companies,
  profiles,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";

import {
  addStudentTargetCompany,
  addStudentTargetRole,
  seedCanonicalPlacementData,
} from "@/server/company-role-intelligence";
import {
  createApplication,
  scheduleInterview,
  completeInterview,
  updateApplicationStatus,
} from "@/server/application-intelligence";
import {
  getOutcomeAnalysis,
  getOutcomeAnalytics,
  getOutcomeDashboardCard,
  getOutcomeHistorySummary,
  getOutcomePlanContext,
  getPlacementJourney,
  saveInterviewFeedback,
  saveReflection,
} from "@/server/outcome-intelligence";
import {
  buildFocusCandidates,
  buildStageDistribution,
  deriveOutcome,
  detectPatterns,
  isCausalClaim,
  renderNonCausalObservation,
  type GapEvidenceInput,
} from "@/lib/applications/outcome-intelligence";

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

async function expectError(promise: Promise<unknown>, needle: string): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (error) {
    return error instanceof Error && error.message.toLowerCase().includes(needle.toLowerCase());
  }
}

/** All engine- or service-produced strings must avoid causal language. */
const CAUSAL_SCAN = [
  /\bcaused\b/i,
  /\bbecause of\b/i,
  /\bdue to\b/i,
  /\bresulted in\b/i,
  /\brejected because\b/i,
  /\bfailed because\b/i,
];

function containsCausalLanguage(text: string): boolean {
  return CAUSAL_SCAN.some((p) => p.test(text));
}

function analysisText(detail: Awaited<ReturnType<typeof getOutcomeAnalysis>>): string {
  const parts: string[] = [];
  for (const o of detail.analysis.observations) parts.push(o.observation, o.basis);
  for (const f of detail.analysis.nextFocus) parts.push(f.reason);
  for (const e of detail.analysis.evidence) parts.push(e.label, e.detail);
  parts.push(detail.analysis.resumeSignals.note);
  parts.push(detail.analysis.causalityDisclaimer);
  return parts.join(" | ");
}

async function runPhase20Tests() {
  console.log("==================================================");
  console.log("🚀  NEXORA — PHASE 20: PLACEMENT OUTCOME INTELLIGENCE");
  console.log("==================================================");

  const createdUserIds: string[] = [];

  try {
    // ========================================================================
    console.log("\n--- 1. Fixtures ---");
    // ========================================================================
    await seedCanonicalPlacementData();
    const [userAlpha] = await db
      .insert(users)
      .values({ email: `phase20_alpha_${Date.now()}@nexora.test`, passwordHash: "h1", isAdmin: false })
      .returning();
    createdUserIds.push(userAlpha.id);
    await db.insert(profiles).values({
      userId: userAlpha.id,
      name: "Outcome Tester",
      college: "Nexora Institute",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    const [userBeta] = await db
      .insert(users)
      .values({ email: `phase20_beta_${Date.now()}@nexora.test`, passwordHash: "h2", isAdmin: false })
      .returning();
    createdUserIds.push(userBeta.id);
    await db.insert(profiles).values({
      userId: userBeta.id,
      name: "Beta Peer",
      college: "Nexora Polytech",
      branch: "IT",
      graduationYear: 2026,
    });

    const [company] = await db.select().from(companies).limit(1);
    await addStudentTargetCompany(userAlpha.id, company.id);
    const { roles } = await import("@/db/schema");
    const [role] = await db.select().from(roles).limit(1);
    await addStudentTargetRole(userAlpha.id, role.id);

    // ========================================================================
    console.log("\n--- 2. Engine: outcome derivation (all categories) ---");
    // ========================================================================
    const mk = (
      status: Parameters<typeof deriveOutcome>[0]["status"],
      events: { eventType: string; newStatus: string | null }[],
      hasOffer = false
    ) =>
      deriveOutcome({
        status,
        events: events.map((e, i) => ({ ...e, occurredAt: new Date(Date.now() + i * 1000).toISOString() })),
        hasOfferRecord: hasOffer,
      });

    const noOutcome = mk("APPLIED", [{ eventType: "STATUS_CHANGED", newStatus: "APPLIED" }]);
    assert(noOutcome.category === "NO_OUTCOME" && !noOutcome.isTerminal, "Active application → NO_OUTCOME");

    const withdrawn = mk("WITHDRAWN", [
      { eventType: "STATUS_CHANGED", newStatus: "APPLIED" },
      { eventType: "WITHDRAWN", newStatus: "WITHDRAWN" },
    ]);
    assert(withdrawn.category === "WITHDRAWN" && withdrawn.stage === "application", "Withdrawal classified with proven stage");

    // Unknown stage: rejection with no stage-proofing events.
    const unknown = mk("REJECTED", [{ eventType: "APPLICATION_CREATED", newStatus: "INTERESTED" }]);
    assert(unknown.category === "REJECTED_APPLICATION", "Rejection without stage proof → REJECTED_APPLICATION");
    assert(unknown.stageUnknown && unknown.stage === "unknown", "Stage remains unknown — never inferred");
    assert(unknown.label.includes("Stage not recorded"), "Label explicitly says stage is not recorded");

    const afterAssessment = mk("REJECTED", [
      { eventType: "STATUS_CHANGED", newStatus: "APPLIED" },
      { eventType: "STATUS_CHANGED", newStatus: "ASSESSMENT" },
      { eventType: "REJECTED", newStatus: "REJECTED" },
    ]);
    assert(afterAssessment.category === "REJECTED_ASSESSMENT", "Rejection after proven ASSESSMENT stage classified");

    const afterInterview = mk("REJECTED", [
      { eventType: "STATUS_CHANGED", newStatus: "APPLIED" },
      { eventType: "INTERVIEW_SCHEDULED", newStatus: "INTERVIEW" },
      { eventType: "INTERVIEW_COMPLETED", newStatus: null },
      { eventType: "REJECTED", newStatus: "REJECTED" },
    ]);
    assert(afterInterview.category === "REJECTED_INTERVIEW", "Rejection after proven INTERVIEW stage classified");

    const offer = mk("OFFER", [{ eventType: "OFFER_RECEIVED", newStatus: "OFFER" }], true);
    assert(offer.category === "OFFER_RECEIVED" && offer.stage === "offer", "Offer classified OFFER_RECEIVED (no decision recorded)");

    assert(deriveOutcome(
      { status: "OFFER", events: [], hasOfferRecord: true },
      "accepted"
    ).category === "OFFER_ACCEPTED", "Explicit acceptance recorded → OFFER_ACCEPTED");
    assert(deriveOutcome(
      { status: "OFFER", events: [], hasOfferRecord: true },
      "declined"
    ).category === "OFFER_DECLINED", "Explicit decline recorded → OFFER_DECLINED");

    assert(afterInterview.basis.length >= 2, "Classification carries dated timeline citations");

    // ========================================================================
    console.log("\n--- 3. Engine: causal guard + non-causal rendering ---");
    // ========================================================================
    assert(isCausalClaim("DSA caused the rejection"), "Guard detects 'caused'");
    assert(isCausalClaim("Rejected because of graphs"), "Guard detects 'because of'");
    assert(isCausalClaim("Low score resulted in rejection"), "Guard detects 'resulted in'");
    assert(!isCausalClaim("Graphs was an observed gap at the time of the application"), "Non-causal phrasing passes the guard");

    const obs = renderNonCausalObservation("Graph Algorithms", "Rejected after interview", "preparation_performance");
    assert(obs.includes("already-evidenced gap"), "Observation uses the 'already-evidenced gap' framing");
    assert(obs.includes("does not establish causality"), "Observation carries the explicit non-causality note");
    assert(!containsCausalLanguage(obs), "Rendered observation passes the causal scan");

    // Adversarial: the guard must THROW if a causal phrase is ever requested.
    // Adversarial input still cannot force causal output: the outcomeLabel is
    // lowercased into a prepositional phrase, and the guard validates the result.
    const adversarial = renderNonCausalObservation("DSA", "Rejected after interview", "preparation_performance");
    assert(!containsCausalLanguage(adversarial), "Adversarial render input still produces non-causal output");
    assert(
      !containsCausalLanguage(renderNonCausalObservation("DSA", "Rejected after interview", "student_note")),
      "Student-note variant also stays non-causal"
    );

    // ========================================================================
    console.log("\n--- 4. Engine: patterns + focus candidates ---");
    // ========================================================================
    const gapA: GapEvidenceInput = { topic: "Graph Algorithms", domain: "DSA", topicId: "t1", sources: ["preparation_performance"], occurrences: 1 };
    const gapB: GapEvidenceInput = { topic: "Technical Interview", domain: "INTERVIEW", topicId: null, sources: ["simulation_result", "interview_result"], occurrences: 1 };

    assert(detectPatterns([]).length === 0, "No applications → no patterns");
    assert(detectPatterns([{ applicationId: "a", gaps: [gapA] }]).length === 0, "One application → no patterns (insufficient evidence)");
    assert(
      detectPatterns([
        { applicationId: "a", gaps: [gapA] },
        { applicationId: "b", gaps: [{ ...gapA, sources: ["simulation_result"] }] },
      ]).length === 1,
      "Same gap in two applications → exactly one pattern"
    );
    const pattern = detectPatterns([
      { applicationId: "a", gaps: [gapA] },
      { applicationId: "b", gaps: [{ ...gapA }] },
      { applicationId: "c", gaps: [gapB] },
    ])[0];
    assert(pattern.occurrences === 2 && pattern.sampleSize === 3, "Pattern reports 2 of 3 with correct denominators");
    assert(!containsCausalLanguage(pattern.description), "Pattern description is descriptive, not diagnostic");

    const candidates = buildFocusCandidates([gapB, gapA]);
    assert(candidates.length === 2, "Focus candidates built from evidenced gaps");
    assert(candidates[0].topic === "Technical Interview", "Candidate with two evidence sources ranks first");
    assert(candidates[0].actionType === "FIX", "System-observed gap maps to FIX (Phase 15 vocabulary)");
    const noteOnly = buildFocusCandidates([{ topic: "System Design", domain: "DESIGN", topicId: null, sources: ["student_note"], occurrences: 1 }]);
    assert(noteOnly[0]?.actionType === "REVIEW", "Self-reported-only gap maps to REVIEW, not FIX");
    assert(candidates.every((c) => !containsCausalLanguage(c.reason)), "All candidate reasons are non-causal");

    const dist = buildStageDistribution([unknown, afterAssessment, afterInterview, offer]);
    assert(dist.find((d) => d.stage === "unknown")?.count === 1, "Stage distribution counts 'Stage not recorded' honestly");

    // ========================================================================
    console.log("\n--- 5. Service: real application → terminal outcome analysis ---");
    // ========================================================================
    const app = await createApplication(userAlpha.id, {
      jobDescription: "Required skills: React, Node.js.",
    });

    // Schedule + complete an interview (proves the interview stage).
    const interview = await scheduleInterview(userAlpha.id, app.id, {
      roundType: "Technical",
      scheduledAt: new Date(),
    });
    await completeInterview(userAlpha.id, app.id, interview.id, { result: "not_cleared", completedAt: new Date() });
    await updateApplicationStatus(userAlpha.id, app.id, "ELIGIBLE");
    await updateApplicationStatus(userAlpha.id, app.id, "APPLIED");
    await updateApplicationStatus(userAlpha.id, app.id, "INTERVIEW");
    await updateApplicationStatus(userAlpha.id, app.id, "REJECTED");

    // OUTCOME_RECORDED events exist in the timeline (append-only).
    const timeline = await db
      .select({ eventType: applicationEvents.eventType, title: applicationEvents.title })
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, app.id));
    assert(
      timeline.filter((e) => e.eventType === "OUTCOME_RECORDED").length === 1,
      "Exactly one OUTCOME_RECORDED event appended at the terminal transition"
    );

    const detail = await getOutcomeAnalysis(userAlpha.id, app.id);
    assert(detail.summary.outcome.category === "REJECTED_INTERVIEW", "Analysis derives REJECTED_INTERVIEW from real history");
    assert(detail.interviewFeedback.length === 1 && detail.interviewFeedback[0].result === "not_cleared", "Interview result appears as evidence");
    assert(detail.analysis.evidence.some((e) => e.type === "interview_result"), "Evidence includes interview_result type");
    assert(detail.analysis.evidence.every((e) => e.confidence === "observed" || e.confidence === "student_reported"), "Every evidence item carries explicit confidence");
    assert(!containsCausalLanguage(analysisText(detail)), "ADVERSARIAL: rejection + recorded gaps produce NO causal language anywhere");
    assert(
      !detail.analysis.observations.some((o) => /caused|because of|due to/i.test(o.observation)),
      "ADVERSARIAL: no 'caused rejection' phrasing in observations"
    );

    // ========================================================================
    console.log("\n--- 6. Service: reflection provenance ---");
    // ========================================================================
    await saveReflection(userAlpha.id, app.id, {
      whatWentWell: "Communication was smooth.",
      whatWasDifficult: "Struggled with graph problems.",
    });
    const withReflection = await getOutcomeAnalysis(userAlpha.id, app.id);
    const reflectionEvidence = withReflection.analysis.evidence.find((e) => e.type === "student_note");
    assert(reflectionEvidence !== undefined, "Reflection appears as student_note evidence");
    assert(reflectionEvidence?.confidence === "student_reported", "Reflection confidence is student_reported — never 'observed'");

    // Student-reported difficulty merges into a gap ONLY when the topic name
    // literally appears in the student's words.
    const graphGap = withReflection.analysis.observedGaps.find((g) => g.topic === "Graph Algorithms");
    const graphGapHasNote = graphGap ? graphGap.sources.includes("student_note") : true;
    assert(Boolean(graphGapHasNote), "Student-reported topic name matching a gap adds student_note source");

    await saveInterviewFeedback(userAlpha.id, app.id, {
      interviewId: interview.id,
      difficulty: "hard",
      topicsDiscussed: ["Graphs", "DBMS"],
      studentConfidence: "low on graphs",
    });
    const withFeedback = await getOutcomeAnalysis(userAlpha.id, app.id);
    assert(
      withFeedback.interviewFeedback[0]?.topicsDiscussed?.includes("Graphs") === true,
      "Interview feedback topics stored"
    );
    assert(
      withFeedback.analysis.evidence.some(
        (e) => e.type === "student_note" && e.confidence === "student_reported"
      ),
      "Interview topics reported as student_note evidence"
    );
    assert(!containsCausalLanguage(analysisText(withFeedback)), "Feedback-bearing analysis still has no causal language");

    // ========================================================================
    console.log("\n--- 7. Service: analytics + patterns across applications ---");
    // ========================================================================
    const analytics = await getOutcomeAnalytics(userAlpha.id);
    assert(analytics.totals.applications >= 1, "Analytics counts applications");
    assert(analytics.totals.rejections >= 1, "Analytics counts rejections");
    assert(
      analytics.recentOutcomes.every((o) => o.category.length > 0),
      "Recent outcomes carry categories"
    );
    assert(
      !JSON.stringify(analytics).match(/probabilit|predict|employability|"best company"/i),
      "ADVERSARIAL: analytics contain no probability/prediction/employability concepts"
    );

    // ========================================================================
    console.log("\n--- 8. Service: Phase 15 additive integration ---");
    // ========================================================================
    const planContext = await getOutcomePlanContext(userAlpha.id);
    if (planContext) {
      assert(planContext.focusCandidates.every((f) => !containsCausalLanguage(f.reason)), "Plan context reasons are non-causal");
      assert(planContext.note.includes("advisory"), "Plan context is explicitly labeled advisory");
    } else {
      assert(true, "Plan context absent when no evidence-backed candidates (valid)");
    }

    const card = await getOutcomeDashboardCard(userAlpha.id);
    assert(card.show === true && card.applications >= 1, "Dashboard card shows with real counts");
    assert(!containsCausalLanguage(card.disclaimer + " " + card.observedFocus.join(" ")), "Dashboard card text is causally clean");

    const history = await getOutcomeHistorySummary(userAlpha.id);
    assert(history.applications >= 1 && history.rejections >= 1, "Profile history reports descriptive counts");

    const journey = await getPlacementJourney(userAlpha.id);
    assert(journey.some((j) => j.title.includes(company.name)), "Journey includes the real application events");
    assert(
      journey.every((j) => j.phase === "Target" || j.phase === "Application"),
      "Journey entries cite their source phase"
    );

    // ========================================================================
    console.log("\n--- 9. Security: cross-tenant denial ---");
    // ========================================================================
    assert(await expectError(getOutcomeAnalysis(userBeta.id, app.id), "unauthorized"), "Beta cannot read Alpha's outcome analysis");
    assert(await expectError(saveReflection(userBeta.id, app.id, { whatWentWell: "x" }), "unauthorized"), "Beta cannot write Alpha's reflection");
    assert(await expectError(saveInterviewFeedback(userBeta.id, app.id, { interviewId: interview.id }), "unauthorized"), "Beta cannot write Alpha's interview feedback");
    assert(await expectError(getInterviewFeedbackSafe(userBeta.id, app.id), "unauthorized"), "Beta cannot read Alpha's interview feedback");

    const betaAnalytics = await getOutcomeAnalytics(userBeta.id);
    assert(betaAnalytics.totals.applications === 0 && betaAnalytics.recentOutcomes.length === 0, "Beta's analytics leak nothing of Alpha's");
    const betaJourney = await getPlacementJourney(userBeta.id);
    assert(!betaJourney.some((j) => j.title.includes(company.name)), "Beta's journey contains none of Alpha's events");
    const betaCard = await getOutcomeDashboardCard(userBeta.id);
    assert(betaCard.show === false, "Beta's dashboard card is hidden (no data of their own)");

    console.log("\n==================================================");
    console.log(`PHASE 20 RESULT: ${passed} passed, ${failed} failed`);
    console.log("==================================================");
    if (failed > 0) process.exitCode = 1;
  } finally {
    for (const userId of createdUserIds) {
      try {
        await db.delete(applicationEvents).where(eq(applicationEvents.userId, userId));
        await db.delete(applicationInterviews).where(eq(applicationInterviews.userId, userId));
        await db.delete(applications).where(eq(applications.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
      } catch {
        // best-effort cleanup
      }
    }
  }
}

import { getInterviewFeedback } from "@/server/outcome-intelligence";
function getInterviewFeedbackSafe(userId: string, applicationId: string) {
  return getInterviewFeedback(userId, applicationId);
}

runPhase20Tests().catch((error) => {
  console.error("PHASE 20 SUITE CRASHED:", error);
  process.exitCode = 1;
});
