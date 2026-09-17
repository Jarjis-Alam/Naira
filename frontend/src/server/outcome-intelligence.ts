/**
 * Phase 20 — Placement Outcome Intelligence service layer.
 *
 * Owns: outcome analysis per application, cross-application analytics,
 * student reflections (student-reported, never verified facts), interview
 * feedback, OUTCOME_RECORDED timeline events, the unified placement journey,
 * and the compact dashboard card. Reuses Phase 14/15/16/17/18/19 as the only
 * sources of truth; adds no scoring, no task engine, no causal claims.
 *
 * Provenance contract: every number shown on the outcome surfaces is copied
 * from the owning phase's own stored data (Phase 14 priorities, Phase 17
 * simulations, Phase 18 resume variants, Phase 19 application records) and
 * labeled with its source.
 */

import { db } from "@/db";
import {
  applicationEvents,
  applicationInterviews,
  applicationOffers,
  applicationReflections,
  applications,
  placementSimulations,
  studentTargetCompanies,
} from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getResumeVariant } from "@/server/resume-intelligence";
import { getStudentPlacementTargets } from "@/server/company-role-intelligence";
import { getPlacementIntelligence } from "@/server/placement-intelligence";
import type { ApplicationStatus } from "@/lib/applications/domain";
import {
  buildFocusCandidates,
  buildStageDistribution,
  CAUSALITY_DISCLAIMER,
  deriveOutcome,
  detectPatterns,
  renderNonCausalObservation,
  type DerivedOutcome,
  type GapEvidenceInput,
  type OutcomeAnalytics,
  type OutcomeAnalysis,
  type OutcomeEvidence,
  type OutcomeObservation,
} from "@/lib/applications/outcome-intelligence";

// ============================================================================
// Types
// ============================================================================

export interface ApplicationOutcomeSummary {
  applicationId: string;
  companyName: string;
  roleName: string;
  status: ApplicationStatus;
  outcome: DerivedOutcome;
  updatedAt: string;
}

export interface OutcomeFeedbackRecord {
  interviewId: string;
  roundNumber: number;
  roundType: string;
  difficulty: string | null;
  topicsDiscussed: string[] | null;
  studentConfidence: string | null;
  questionsRemembered: string[] | null;
  result: string;
}

export interface ApplicationOutcomeDetail {
  summary: ApplicationOutcomeSummary;
  analysis: OutcomeAnalysis;
  reflection: {
    whatWentWell: string | null;
    whatWasDifficult: string | null;
    whatWasAsked: string | null;
    whatWouldImprove: string | null;
    updatedAt: string | null;
  } | null;
  interviewFeedback: OutcomeFeedbackRecord[];
}

function ownershipError(): Error {
  return new Error("Unauthorized: you do not have access to this resource.");
}

async function loadApplication(applicationId: string, userId: string) {
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw ownershipError();
  return rows[0];
}

// ============================================================================
// Reflections (student-reported — never verified facts)
// ============================================================================

export interface ReflectionInput {
  whatWentWell?: string;
  whatWasDifficult?: string;
  whatWasAsked?: string;
  whatWouldImprove?: string;
}

export async function saveReflection(
  userId: string,
  applicationId: string,
  input: ReflectionInput
) {
  const app = await loadApplication(applicationId, userId);
  const clean = (v?: string) => {
    const t = v?.trim();
    return t && t.length > 0 ? t : null;
  };
  const values = {
    whatWentWell: clean(input.whatWentWell),
    whatWasDifficult: clean(input.whatWasDifficult),
    whatWasAsked: clean(input.whatWasAsked),
    whatWouldImprove: clean(input.whatWouldImprove),
  };
  if (!Object.values(values).some((v) => v !== null)) {
    throw new Error("At least one reflection field is required.");
  }

  const [saved] = await db
    .insert(applicationReflections)
    .values({ applicationId: app.id, userId, ...values })
    .onConflictDoUpdate({
      target: applicationReflections.applicationId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  await db.insert(applicationEvents).values({
    applicationId: app.id,
    userId,
    eventType: "NOTE_ADDED",
    title: "Student reflection recorded",
    metadata: { kind: "reflection", source: "student_note" },
  });

  return {
    whatWentWell: saved.whatWentWell,
    whatWasDifficult: saved.whatWasDifficult,
    whatWasAsked: saved.whatWasAsked,
    whatWouldImprove: saved.whatWouldImprove,
    updatedAt: saved.updatedAt.toISOString(),
  };
}

async function loadReflection(applicationId: string, userId: string) {
  const rows = await db
    .select()
    .from(applicationReflections)
    .where(
      and(
        eq(applicationReflections.applicationId, applicationId),
        eq(applicationReflections.userId, userId)
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    whatWentWell: r.whatWentWell,
    whatWasDifficult: r.whatWasDifficult,
    whatWasAsked: r.whatWasAsked,
    whatWouldImprove: r.whatWouldImprove,
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ============================================================================
// Interview feedback (student-reported — student_note evidence)
// ============================================================================

export interface InterviewFeedbackInput {
  interviewId: string;
  difficulty?: string | null;
  topicsDiscussed?: string[] | null;
  studentConfidence?: string | null;
  questionsRemembered?: string[] | null;
}

export async function saveInterviewFeedback(
  userId: string,
  applicationId: string,
  input: InterviewFeedbackInput
) {
  const app = await loadApplication(applicationId, userId);
  const rows = await db
    .select()
    .from(applicationInterviews)
    .where(
      and(
        eq(applicationInterviews.id, input.interviewId),
        eq(applicationInterviews.applicationId, app.id),
        eq(applicationInterviews.userId, userId)
      )
    )
    .limit(1);
  if (rows.length === 0) throw ownershipError();

  const cleanList = (list?: string[] | null) => {
    if (!list) return null;
    const cleaned = list.map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 20);
    return cleaned.length > 0 ? cleaned : null;
  };

  const [updated] = await db
    .update(applicationInterviews)
    .set({
      difficulty: input.difficulty?.trim() || null,
      topicsDiscussed: cleanList(input.topicsDiscussed),
      studentConfidence: input.studentConfidence?.trim() || null,
      questionsRemembered: cleanList(input.questionsRemembered),
      updatedAt: new Date(),
    })
    .where(eq(applicationInterviews.id, input.interviewId))
    .returning();

  await db.insert(applicationEvents).values({
    applicationId: app.id,
    userId,
    eventType: "NOTE_ADDED",
    title: `Interview feedback recorded (Round ${updated.roundNumber})`,
    metadata: { kind: "interview_feedback", source: "student_note", interviewId: updated.id },
  });

  return toFeedbackRecord(updated);
}

function toFeedbackRecord(row: typeof applicationInterviews.$inferSelect): OutcomeFeedbackRecord {
  return {
    interviewId: row.id,
    roundNumber: row.roundNumber,
    roundType: row.roundType,
    difficulty: row.difficulty,
    topicsDiscussed: row.topicsDiscussed ?? null,
    studentConfidence: row.studentConfidence,
    questionsRemembered: row.questionsRemembered ?? null,
    result: row.result,
  };
}

export async function getInterviewFeedback(
  userId: string,
  applicationId: string
): Promise<OutcomeFeedbackRecord[]> {
  const app = await loadApplication(applicationId, userId);
  const rows = await db
    .select()
    .from(applicationInterviews)
    .where(eq(applicationInterviews.applicationId, app.id))
    .orderBy(applicationInterviews.roundNumber);
  return rows.map(toFeedbackRecord);
}

// ============================================================================
// Offer decision (only when the student explicitly recorded it)
// ============================================================================

function deriveOfferDecision(
  status: ApplicationStatus,
  reflection: Awaited<ReturnType<typeof loadReflection>>
): "accepted" | "declined" | null {
  if (status !== "OFFER" || !reflection) return null;
  const text = `${reflection.whatWentWell ?? ""} ${reflection.whatWouldImprove ?? ""}`.toLowerCase();
  if (/\b(accepted|accepting|signed)\b/.test(text)) return "accepted";
  if (/\b(declined|declining|turned down|reject(?:ed|ing) the offer)\b/.test(text)) return "declined";
  return null;
}

// ============================================================================
// Evidence assembly (provenance preserved from each owning phase)
// ============================================================================

interface EvidenceBundle {
  evidence: OutcomeEvidence[];
  gaps: GapEvidenceInput[];
  observations: OutcomeObservation[];
  readiness: OutcomeAnalysis["readiness"];
  resumeSignals: { aligned: boolean | null; note: string };
}

const SOURCE_BASIS: Record<string, string> = {
  preparation_performance: "Phase 14 per-topic accuracy",
  simulation_result: "Phase 17 simulation scores",
  student_note: "Student reflection (student-reported)",
  interview_result: "Recorded interview result",
  assessment_score: "Recorded assessment score",
  resume_match: "Phase 18 resume analysis",
  target_requirement: "Phase 16 target requirements",
  application_status: "Application timeline",
};

async function assembleEvidence(
  userId: string,
  app: typeof applications.$inferSelect,
  outcome: DerivedOutcome
): Promise<EvidenceBundle> {
  const evidence: OutcomeEvidence[] = [];
  const observations: OutcomeObservation[] = [];

  // --- The outcome's own basis (Phase 19 timeline).
  evidence.push({
    type: "application_status",
    confidence: "observed",
    label: "Recorded outcome",
    value: outcome.label,
    detail: "Derived from the application's own timeline events",
  });

  // --- Phase 14 preparation performance: reuse its own priority list.
  let prepPriorities: Awaited<ReturnType<typeof getPlacementIntelligence>>["priorities"] = [];
  try {
    const intelligence = await getPlacementIntelligence(userId);
    prepPriorities = intelligence.priorities.filter(
      (p) => p.category === "FIX" || p.category === "REINFORCE"
    );
  } catch {
    // No baseline / no data — no fabricated evidence.
  }

  for (const p of prepPriorities.slice(0, 6)) {
    evidence.push({
      type: "preparation_performance",
      confidence: "observed",
      label: `${p.domain} · ${p.topic}`,
      value: `${p.accuracy}%`,
      detail: `Phase 14 measured accuracy over ${p.totalAttempts} attempts (${p.impact})`,
    });
  }

  // --- Phase 17 simulation results (most recent).
  const sims = await db
    .select()
    .from(placementSimulations)
    .where(eq(placementSimulations.userId, userId))
    .orderBy(desc(placementSimulations.createdAt))
    .limit(3);
  const latestSim = sims[0] ?? null;
  if (latestSim?.overallReadinessScore !== null && latestSim?.overallReadinessScore !== undefined) {
    evidence.push({
      type: "simulation_result",
      confidence: "observed",
      label: `Simulation · ${latestSim.companyName} — ${latestSim.roleName}`,
      value: `${latestSim.overallReadinessScore}%`,
      detail: "Phase 17 simulation overall readiness",
    });
  }
  if (
    latestSim?.interviewScore !== null &&
    latestSim?.interviewScore !== undefined &&
    latestSim.interviewScore < 75
  ) {
    evidence.push({
      type: "simulation_result",
      confidence: "observed",
      label: "Simulation · Interview round",
      value: `${latestSim.interviewScore}%`,
      detail: "Phase 17 interview round score, below the 75 benchmark",
    });
  }

  // --- Phase 18 resume snapshots (variant when present, snapshot otherwise).
  let atsScore: number | null = app.resumeAtsScore;
  if (app.resumeVariantId) {
    try {
      const variant = await getResumeVariant(app.resumeVariantId, userId);
      if (variant.atsScore !== null) atsScore = variant.atsScore;
      if (variant.atsScore !== null) {
        evidence.push({
          type: "resume_match",
          confidence: "observed",
          label: `Resume ATS · ${variant.label}`,
          value: `${variant.atsScore}`,
          detail: "Phase 18 ATS analysis of the attached resume",
        });
      }
      if (variant.matchScore !== null) {
        evidence.push({
          type: "resume_match",
          confidence: "observed",
          label: `Target match · ${variant.label}`,
          value: `${variant.matchScore}`,
          detail: "Phase 18 target-match analysis of the attached resume",
        });
      }
    } catch {
      if (app.resumeAtsScore !== null) {
        evidence.push({
          type: "resume_match",
          confidence: "observed",
          label: "Resume ATS (snapshot)",
          value: `${app.resumeAtsScore}`,
          detail: "Score snapshotted on the application when the resume was attached",
        });
      }
    }
  }

  const resumeSignals = {
    aligned: atsScore === null ? null : atsScore >= 75,
    note:
      atsScore === null
        ? "No ATS analysis is associated with this application."
        : atsScore >= 75
          ? `Resume ATS ${atsScore} — resume was not identified as a verified weakness for this application.`
          : `Resume ATS ${atsScore} — below the 75 benchmark the ATS engine itself uses. This is a descriptive signal, not an explanation of the outcome.`,
  };

  // --- Phase 19 interview results + student-reported feedback.
  const interviews = await db
    .select()
    .from(applicationInterviews)
    .where(eq(applicationInterviews.applicationId, app.id))
    .orderBy(applicationInterviews.roundNumber);

  for (const iv of interviews) {
    if (iv.result !== "pending") {
      evidence.push({
        type: "interview_result",
        confidence: "observed",
        label: `Interview Round ${iv.roundNumber} · ${iv.roundType}`,
        value: iv.result,
        detail: "Recorded interview result on this application",
      });
    }
    if (iv.topicsDiscussed && iv.topicsDiscussed.length > 0) {
      evidence.push({
        type: "student_note",
        confidence: "student_reported",
        label: `Round ${iv.roundNumber} topics reported`,
        value: iv.topicsDiscussed.join(", "),
        detail: "Student reported — not a system measurement",
      });
    }
  }

  // --- Student reflection (always student_note).
  const reflection = await loadReflection(app.id, userId);
  if (reflection?.whatWasDifficult) {
    evidence.push({
      type: "student_note",
      confidence: "student_reported",
      label: "What was difficult (student reported)",
      value: reflection.whatWasDifficult.slice(0, 140),
      detail: "Student reported — never treated as a verified fact",
    });
  }

  // --- Gap assembly: ONLY already-evidenced gaps.
  const gaps: GapEvidenceInput[] = [];

  for (const p of prepPriorities.slice(0, 6)) {
    gaps.push({
      topic: p.topic,
      domain: p.domain,
      topicId: p.topicId,
      sources: ["preparation_performance"],
      occurrences: 1,
    });
  }

  if (latestSim?.interviewScore !== null && latestSim?.interviewScore !== undefined && latestSim.interviewScore < 75) {
    const match = gaps.find(
      (g) => g.topic.toLowerCase().includes("interview") || g.domain === "INTERVIEW"
    );
    if (match) {
      if (!match.sources.includes("simulation_result")) match.sources.push("simulation_result");
    } else {
      gaps.push({
        topic: "Technical Interview",
        domain: "INTERVIEW",
        topicId: null,
        sources: ["simulation_result"],
        occurrences: 1,
      });
    }
  }

  const notCleared = interviews.filter((iv) => iv.result === "not_cleared");
  if (notCleared.length > 0) {
    const match = gaps.find(
      (g) => g.topic.toLowerCase().includes("interview") || g.domain === "INTERVIEW"
    );
    if (match) {
      if (!match.sources.includes("interview_result")) match.sources.push("interview_result");
    } else {
      gaps.push({
        topic: "Technical Interview",
        domain: "INTERVIEW",
        topicId: null,
        sources: ["interview_result"],
        occurrences: 1,
      });
    }
  }

  // Student-reported difficulty joins an existing gap only when the topic name
  // literally appears in the student's own words.
  if (reflection?.whatWasDifficult) {
    const lower = reflection.whatWasDifficult.toLowerCase();
    for (const gap of gaps) {
      if (lower.includes(gap.topic.toLowerCase()) && !gap.sources.includes("student_note")) {
        gap.sources.push("student_note");
      }
    }
  }

  // --- Observations in the mandatory non-causal form.
  for (const gap of gaps.slice(0, 5)) {
    observations.push({
      observation: renderNonCausalObservation(gap.topic, outcome.label, gap.sources[0]),
      source: gap.sources[0],
      confidence: gap.sources.includes("student_note") && gap.sources.length === 1 ? "student_reported" : "observed",
      basis: gap.sources.map((s) => SOURCE_BASIS[s] ?? s).join("; "),
    });
  }

  const readiness = {
    preparation: prepPriorities.length > 0 ? Math.round(prepPriorities[0].accuracy) : null,
    target: null as number | null,
    resumeAts: atsScore,
    interview: latestSim?.interviewScore ?? null,
  };

  return { evidence, gaps, observations, readiness, resumeSignals };
}

// ============================================================================
// Per-application outcome analysis
// ============================================================================

export async function getOutcomeAnalysis(
  userId: string,
  applicationId: string
): Promise<ApplicationOutcomeDetail> {
  const app = await loadApplication(applicationId, userId);

  const events = await db
    .select({
      eventType: applicationEvents.eventType,
      newStatus: applicationEvents.newStatus,
      occurredAt: applicationEvents.occurredAt,
    })
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, app.id))
    .orderBy(applicationEvents.occurredAt);

  const offerRows = await db
    .select({ id: applicationOffers.id })
    .from(applicationOffers)
    .where(eq(applicationOffers.applicationId, app.id))
    .limit(1);

  const reflection = await loadReflection(app.id, userId);
  const outcome = deriveOutcome(
    {
      status: app.status as ApplicationStatus,
      events: events.map((e) => ({
        eventType: e.eventType,
        newStatus: e.newStatus,
        occurredAt: e.occurredAt.toISOString(),
      })),
      hasOfferRecord: offerRows.length > 0,
    },
    deriveOfferDecision(app.status as ApplicationStatus, reflection)
  );

  const bundle = await assembleEvidence(userId, app, outcome);

  const analysis: OutcomeAnalysis = {
    applicationId: app.id,
    companyName: app.companyName,
    roleName: app.roleName,
    outcome,
    readiness: bundle.readiness,
    evidence: bundle.evidence,
    observations: bundle.observations,
    observedGaps: bundle.gaps.map((g) => ({ topic: g.topic, domain: g.domain, sources: g.sources })),
    resumeSignals: bundle.resumeSignals,
    nextFocus: buildFocusCandidates(bundle.gaps),
    causalityDisclaimer: CAUSALITY_DISCLAIMER,
  };

  return {
    summary: {
      applicationId: app.id,
      companyName: app.companyName,
      roleName: app.roleName,
      status: app.status as ApplicationStatus,
      outcome,
      updatedAt: app.updatedAt.toISOString(),
    },
    analysis,
    reflection,
    interviewFeedback: await getInterviewFeedback(userId, app.id),
  };
}

// ============================================================================
// Cross-application analytics
// ============================================================================

export async function getOutcomeAnalytics(userId: string): Promise<OutcomeAnalytics> {
  const apps = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt));

  const outcomeApps = apps.filter((a) =>
    ["REJECTED", "WITHDRAWN", "OFFER", "CLOSED"].includes(a.status)
  );

  const perApplication: { applicationId: string; outcome: DerivedOutcome; gaps: GapEvidenceInput[] }[] = [];
  const recentOutcomes: OutcomeAnalytics["recentOutcomes"] = [];

  for (const app of outcomeApps.slice(0, 20)) {
    const detail = await getOutcomeAnalysis(userId, app.id);
    perApplication.push({
      applicationId: app.id,
      outcome: detail.summary.outcome,
      gaps: detail.analysis.observedGaps.map((g) => ({
        topic: g.topic,
        domain: g.domain,
        topicId: null,
        sources: g.sources,
        occurrences: 1,
      })),
    });
    recentOutcomes.push({
      applicationId: app.id,
      companyName: app.companyName,
      roleName: app.roleName,
      category: detail.summary.outcome.category,
      label: detail.summary.outcome.label,
      stage: detail.summary.outcome.stage,
      occurredAt: app.updatedAt.toISOString(),
    });
  }

  const patterns = detectPatterns(
    perApplication.map((p) => ({ applicationId: p.applicationId, gaps: p.gaps }))
  );

  // Aggregate gap occurrences across outcome applications for focus candidates.
  const gapAgg = new Map<string, GapEvidenceInput>();
  for (const p of perApplication) {
    for (const g of p.gaps) {
      const key = `${g.domain}::${g.topic}`;
      const existing = gapAgg.get(key);
      if (existing) {
        existing.occurrences += 1;
        for (const s of g.sources) if (!existing.sources.includes(s)) existing.sources.push(s);
      } else {
        gapAgg.set(key, { ...g, occurrences: 1 });
      }
    }
  }

  return {
    totals: {
      applications: apps.length,
      interviews: recentOutcomes.filter((o) => o.stage === "interview").length,
      offers: recentOutcomes.filter((o) => o.category.startsWith("OFFER")).length,
      rejections: recentOutcomes.filter((o) => o.category.startsWith("REJECTED")).length,
      withdrawals: recentOutcomes.filter((o) => o.category === "WITHDRAWN").length,
    },
    stageDistribution: buildStageDistribution(perApplication.map((p) => p.outcome)),
    patterns,
    recentOutcomes: recentOutcomes.slice(0, 10),
    focusCandidates: buildFocusCandidates([...gapAgg.values()]),
  };
}

// ============================================================================
// Unified placement journey (every entry from persisted data)
// ============================================================================

export interface JourneyEntry {
  date: string;
  phase: string;
  title: string;
  detail: string | null;
  href: string | null;
}

export async function getPlacementJourney(userId: string): Promise<JourneyEntry[]> {
  const entries: JourneyEntry[] = [];

  // Phase 16 — earliest target company row gives the persisted target date.
  const [firstTarget] = await db
    .select({ createdAt: studentTargetCompanies.createdAt })
    .from(studentTargetCompanies)
    .where(eq(studentTargetCompanies.userId, userId))
    .orderBy(asc(studentTargetCompanies.createdAt))
    .limit(1);
  if (firstTarget) {
    try {
      const targets = await getStudentPlacementTargets(userId);
      if (targets.configured && targets.primaryCompany && targets.primaryRole) {
        entries.push({
          date: firstTarget.createdAt.toISOString(),
          phase: "Target",
          title: `Targeted ${targets.primaryCompany.name} — ${targets.primaryRole.name}`,
          detail: "Phase 16 target strategy",
          href: "/target",
        });
      }
    } catch {
      // Not configured — no fabricated entry.
    }
  }

  // Phase 19 — applications and their event timelines.
  const apps = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt))
    .limit(20);

  for (const app of apps) {
    const events = await db
      .select({
        eventType: applicationEvents.eventType,
        title: applicationEvents.title,
        occurredAt: applicationEvents.occurredAt,
        newStatus: applicationEvents.newStatus,
      })
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, app.id))
      .orderBy(applicationEvents.occurredAt);

    for (const event of events) {
      entries.push({
        date: event.occurredAt.toISOString(),
        phase: "Application",
        title: `${app.companyName}: ${event.title ?? event.eventType.replaceAll("_", " ").toLowerCase()}`,
        detail: event.newStatus ? `Status: ${event.newStatus}` : null,
        href: `/applications/${app.id}`,
      });
    }
  }

  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ============================================================================
// Compact dashboard card
// ============================================================================

export interface OutcomeDashboardCard {
  show: boolean;
  applications: number;
  interviews: number;
  offers: number;
  recentOutcome: {
    applicationId: string;
    companyName: string;
    label: string;
  } | null;
  observedFocus: string[];
  ctaHref: string;
  ctaLabel: string;
  disclaimer: string;
}

export async function getOutcomeDashboardCard(userId: string): Promise<OutcomeDashboardCard> {
  const analytics = await getOutcomeAnalytics(userId);
  const recent = analytics.recentOutcomes[0] ?? null;

  return {
    show: analytics.totals.applications > 0,
    applications: analytics.totals.applications,
    interviews: analytics.totals.interviews,
    offers: analytics.totals.offers,
    recentOutcome: recent
      ? { applicationId: recent.applicationId, companyName: recent.companyName, label: recent.label }
      : null,
    observedFocus: analytics.focusCandidates.slice(0, 2).map((f) => f.topic),
    ctaHref: "/outcomes",
    ctaLabel: "View Outcomes",
    disclaimer: CAUSALITY_DISCLAIMER,
  };
}

// ============================================================================
// Profile: descriptive outcome history (no success score)
// ============================================================================

export interface OutcomeHistorySummary {
  applications: number;
  interviews: number;
  offers: number;
  rejections: number;
}

export async function getOutcomeHistorySummary(userId: string): Promise<OutcomeHistorySummary> {
  const apps = await db
    .select({ status: applications.status, interviewDate: applications.interviewDate })
    .from(applications)
    .where(eq(applications.userId, userId));

  const statusOf = (s: ApplicationStatus) => apps.filter((a) => a.status === s).length;
  return {
    applications: apps.length,
    interviews:
      statusOf("INTERVIEW") +
      statusOf("OFFER") +
      apps.filter((a) => a.status === "REJECTED" && a.interviewDate !== null).length,
    offers: statusOf("OFFER"),
    rejections: statusOf("REJECTED"),
  };
}

// ============================================================================
// Phase 15 integration — evidence-backed outcome context (advisory only)
// ============================================================================

export interface OutcomePlanContext {
  headline: string;
  focusCandidates: { topic: string; reason: string; actionType: string }[];
  note: string;
}

/**
 * Reads the evidence-backed focus candidates from the student's most recent
 * outcome application. Phase 15 remains the only preparation engine: this
 * returns context Phase 15 may display — never something it re-ranks by.
 */
export async function getOutcomePlanContext(userId: string): Promise<OutcomePlanContext | null> {
  const [latestOutcomeApp] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.userId, userId), inArray(applications.status, ["REJECTED", "WITHDRAWN", "OFFER", "CLOSED"])))
    .orderBy(desc(applications.updatedAt))
    .limit(1);
  if (!latestOutcomeApp) return null;

  const detail = await getOutcomeAnalysis(userId, latestOutcomeApp.id);
  if (detail.analysis.nextFocus.length === 0) return null;

  return {
    headline: `Recent outcome: ${latestOutcomeApp.companyName} — ${detail.summary.outcome.label}`,
    focusCandidates: detail.analysis.nextFocus.slice(0, 3).map((f) => ({
      topic: f.topic,
      reason: f.reason,
      actionType: f.actionType,
    })),
    note: "Outcome-derived context is advisory. Phase 15 actions are ranked by measured performance, never by application outcomes.",
  };
}

// Re-export the renderer so the UI never hand-builds gap sentences.
export { renderNonCausalObservation, isCausalClaim, CAUSALITY_DISCLAIMER } from "@/lib/applications/outcome-intelligence";
