/**
 * Phase 20 — Placement Outcome Intelligence (pure domain engine).
 *
 * Derives outcomes from Phase 19 application history, attaches evidence with
 * explicit provenance, detects only evidence-backed repeated patterns, and
 * produces next-focus candidates that reuse the existing Phase 15 execution
 * vocabulary. It knows nothing about the database.
 *
 * CORE PRINCIPLE: an outcome is feedback, not a diagnosis.
 *  - Every observation carries its evidence source; nothing is presented
 *    without provenance.
 *  - Causal language is structurally impossible: the renderer emits
 *    "X was an observed gap at the time of this application", never
 *    "X caused the outcome".
 *  - Stage inference is forbidden: if history does not prove the stage,
 *    the outcome is REJECTED with stage "Stage not recorded".
 *  - Student reflections are student_note evidence and are always rendered
 *    as "Student reported", never "System detected".
 */

import type { ApplicationStatus } from "./domain";

// ============================================================================
// Evidence provenance model
// ============================================================================

export const OUTCOME_EVIDENCE_TYPES = [
  "assessment_score",
  "interview_result",
  "simulation_result",
  "preparation_performance",
  "resume_match",
  "target_requirement",
  "student_note",
  "application_status",
] as const;

export type OutcomeEvidenceType = (typeof OUTCOME_EVIDENCE_TYPES)[number];

export const OUTCOME_EVIDENCE_LABELS: Record<OutcomeEvidenceType, string> = {
  assessment_score: "Assessment score",
  interview_result: "Interview result",
  simulation_result: "Simulation result",
  preparation_performance: "Preparation performance",
  resume_match: "Resume match",
  target_requirement: "Target requirement",
  student_note: "Student note",
  application_status: "Application status",
};

/** "observed" = measured by the system; "student_reported" = self-reported. */
export type EvidenceConfidence = "observed" | "student_reported";

export interface OutcomeEvidence {
  type: OutcomeEvidenceType;
  /** "System detected" vs "Student reported" — never blended. */
  confidence: EvidenceConfidence;
  label: string;
  /** Display value (e.g. "74%", "not_cleared", "86"). */
  value: string;
  /** Where exactly this came from, for the UI to show. */
  detail: string;
}

// ============================================================================
// Outcome categories
// ============================================================================

export const OUTCOME_CATEGORIES = [
  "NO_OUTCOME",
  "WITHDRAWN",
  "REJECTED_APPLICATION",
  "REJECTED_ASSESSMENT",
  "REJECTED_INTERVIEW",
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
] as const;

export type OutcomeCategory = (typeof OUTCOME_CATEGORIES)[number];

export const OUTCOME_LABELS: Record<OutcomeCategory, string> = {
  NO_OUTCOME: "No outcome yet",
  WITHDRAWN: "Withdrawn",
  REJECTED_APPLICATION: "Rejected — Stage not recorded",
  REJECTED_ASSESSMENT: "Rejected after assessment",
  REJECTED_INTERVIEW: "Rejected after interview",
  OFFER_RECEIVED: "Offer received",
  OFFER_ACCEPTED: "Offer accepted",
  OFFER_DECLINED: "Offer declined",
};

export type OutcomeStage = "none" | "application" | "assessment" | "interview" | "offer";

export interface DerivedOutcome {
  category: OutcomeCategory;
  label: string;
  /** The furthest stage history actually proves. "unknown" when not provable. */
  stage: OutcomeStage | "unknown";
  /** True only when a rejection's stage could not be proven from history. */
  stageUnknown: boolean;
  isTerminal: boolean;
  /** Timeline citations the classification rests on. */
  basis: string[];
}

// ============================================================================
// Observations and focus candidates
// ============================================================================

export interface OutcomeObservation {
  observation: string;
  source: OutcomeEvidenceType;
  confidence: EvidenceConfidence;
  /** Deterministic explanation of why this observation exists at all. */
  basis: string;
}

export interface OutcomeFocusCandidate {
  /** Phase 15 vocabulary: FIX / REINFORCE / REVIEW. */
  actionType: "FIX" | "REINFORCE" | "REVIEW";
  topic: string;
  domain: string;
  topicId: string | null;
  reason: string;
  sources: OutcomeEvidenceType[];
  occurrences: number;
}

export interface OutcomeAnalysis {
  applicationId: string;
  companyName: string;
  roleName: string;
  outcome: DerivedOutcome;
  /** Snapshot of the four independent dimensions (Phases 15–18). */
  readiness: {
    preparation: number | null;
    target: number | null;
    resumeAts: number | null;
    interview: number | null;
  };
  evidence: OutcomeEvidence[];
  observations: OutcomeObservation[];
  /** Gaps that already existed — never framed as caused by the outcome. */
  observedGaps: { topic: string; domain: string; sources: OutcomeEvidenceType[] }[];
  resumeSignals: { aligned: boolean | null; note: string };
  nextFocus: OutcomeFocusCandidate[];
  /** Immutable guard text shown in the UI. */
  causalityDisclaimer: string;
}

// ============================================================================
// Pattern detection (evidence-backed only)
// ============================================================================

export interface OutcomePattern {
  description: string;
  /** Denominator: outcome applications the pattern was checked across. */
  sampleSize: number;
  /** Numerator: applications where the gap was actually observed. */
  occurrences: number;
  topic: string;
  domain: string;
  sources: OutcomeEvidenceType[];
}

export interface OutcomeAnalytics {
  totals: {
    applications: number;
    interviews: number;
    offers: number;
    rejections: number;
    withdrawals: number;
  };
  stageDistribution: { stage: OutcomeStage | "unknown"; label: string; count: number }[];
  patterns: OutcomePattern[];
  recentOutcomes: {
    applicationId: string;
    companyName: string;
    roleName: string;
    category: OutcomeCategory;
    label: string;
    stage: OutcomeStage | "unknown";
    occurredAt: string | null;
  }[];
  focusCandidates: OutcomeFocusCandidate[];
}

// ============================================================================
// Outcome derivation from Phase 19 history
// ============================================================================

export interface OutcomeHistoryInput {
  status: ApplicationStatus;
  events: {
    eventType: string;
    newStatus: string | null;
    occurredAt: string;
  }[];
  hasOfferRecord: boolean;
}

const day = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

/**
 * Classify the outcome strictly from recorded history.
 *
 * Stage proof rules:
 *  - "Rejected after interview" requires timeline proof the application
 *    reached INTERVIEW (or SHORTLISTED) before the terminal event.
 *  - "Rejected after assessment" requires proof of ASSESSMENT.
 *  - If nothing proves the stage, the category is REJECTED_APPLICATION with
 *    stage "unknown" — the stage is NEVER inferred.
 *  - OFFER_ACCEPTED / OFFER_DECLINED exist only when a student reflection or
 *    offer note explicitly records the decision; otherwise OFFER_RECEIVED.
 */
export function deriveOutcome(input: OutcomeHistoryInput, offerDecision?: "accepted" | "declined" | null): DerivedOutcome {
  const { status, events, hasOfferRecord } = input;
  const basis: string[] = [];

  const chronological = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  // Furthest forward stage the timeline proves.
  let provenStage: OutcomeStage = "none";
  for (const event of chronological) {
    const reached = event.newStatus;
    if (!reached) continue;
    if (reached === "APPLIED" && provenStage === "none") {
      provenStage = "application";
      basis.push(`Status changed to Applied (${day(event.occurredAt)})`);
    } else if (reached === "ASSESSMENT") {
      if (provenStage === "none" || provenStage === "application") {
        provenStage = "assessment";
        basis.push(`Reached assessment stage (${day(event.occurredAt)})`);
      }
    } else if (reached === "SHORTLISTED" || reached === "INTERVIEW") {
      provenStage = "interview";
      basis.push(`Reached interview stage (${day(event.occurredAt)})`);
    } else if (reached === "OFFER") {
      provenStage = "offer";
      basis.push(`Offer stage recorded (${day(event.occurredAt)})`);
    }
  }

  const interviewCompleted = chronological.some((e) => e.eventType === "INTERVIEW_COMPLETED");
  if (interviewCompleted && provenStage !== "offer") {
    provenStage = "interview";
    basis.push("Interview completed and recorded");
  }
  if (hasOfferRecord) {
    provenStage = "offer";
    basis.push("Offer record exists");
  }

  if (status === "WITHDRAWN") {
    basis.push("Application withdrawn by student");
    return {
      category: "WITHDRAWN",
      label: OUTCOME_LABELS.WITHDRAWN,
      stage: provenStage,
      stageUnknown: false,
      isTerminal: true,
      basis,
    };
  }

  if (status === "REJECTED") {
    if (provenStage === "interview" || provenStage === "offer") {
      basis.push("Rejection recorded after interview-stage progress");
      return {
        category: "REJECTED_INTERVIEW",
        label: OUTCOME_LABELS.REJECTED_INTERVIEW,
        stage: "interview",
        stageUnknown: false,
        isTerminal: true,
        basis,
      };
    }
    if (provenStage === "assessment") {
      basis.push("Rejection recorded after assessment-stage progress");
      return {
        category: "REJECTED_ASSESSMENT",
        label: OUTCOME_LABELS.REJECTED_ASSESSMENT,
        stage: "assessment",
        stageUnknown: false,
        isTerminal: true,
        basis,
      };
    }
    basis.push("Rejection recorded; timeline does not prove the stage");
    return {
      category: "REJECTED_APPLICATION",
      label: OUTCOME_LABELS.REJECTED_APPLICATION,
      stage: "unknown",
      stageUnknown: true,
      isTerminal: true,
      basis,
    };
  }

  if (status === "OFFER") {
    basis.push("Offer recorded");
    if (offerDecision === "accepted") {
      return {
        category: "OFFER_ACCEPTED",
        label: OUTCOME_LABELS.OFFER_ACCEPTED,
        stage: "offer",
        stageUnknown: false,
        isTerminal: true,
        basis,
      };
    }
    if (offerDecision === "declined") {
      return {
        category: "OFFER_DECLINED",
        label: OUTCOME_LABELS.OFFER_DECLINED,
        stage: "offer",
        stageUnknown: false,
        isTerminal: true,
        basis,
      };
    }
    return {
      category: "OFFER_RECEIVED",
      label: OUTCOME_LABELS.OFFER_RECEIVED,
      stage: "offer",
      stageUnknown: false,
      isTerminal: false,
      basis,
    };
  }

  if (status === "CLOSED") {
    basis.push("Application closed");
    return {
      category: "NO_OUTCOME",
      label: OUTCOME_LABELS.NO_OUTCOME,
      stage: provenStage,
      stageUnknown: false,
      isTerminal: true,
      basis,
    };
  }

  return {
    category: "NO_OUTCOME",
    label: OUTCOME_LABELS.NO_OUTCOME,
    stage: provenStage,
    stageUnknown: false,
    isTerminal: false,
    basis,
  };
}

// ============================================================================
// Causality guard — the structural heart of Phase 20
// ============================================================================

/**
 * Phrases that would constitute a causal claim linking an outcome to a gap.
 * The observation renderer refuses to emit any sentence matching these, which
 * makes "DSA caused the rejection" structurally unrepresentable rather than a
 * style preference.
 */
const CAUSAL_LINK_PATTERNS: RegExp[] = [
  /\bcaused\b/i,
  /\bbecause of\b/i,
  /\bdue to\b/i,
  /\bresulted in\b/i,
  /\blead(?:s|ing)? to\b/i,
  /\brejected because\b/i,
  /\bfailed because\b/i,
  /\breason (?:for|of) (?:the )?rejection\b/i,
  /\blost (?:the |my |your )?(?:offer|job) because\b/i,
  /\bexplains (?:the |why\b)/i,
];

export function isCausalClaim(text: string): boolean {
  return CAUSAL_LINK_PATTERNS.some((p) => p.test(text));
}

/** The one disclaimer the UI always shows alongside outcome analysis. */
export const CAUSALITY_DISCLAIMER =
  "Observed ≠ causal: these are evidence-backed observations about preparation state, not explanations of why the outcome happened.";

/**
 * Renders an observation about a gap in the mandatory non-causal form.
 * Given "Graph Algorithms" and a rejection label it produces:
 *   "Graph Algorithms was an already-evidenced gap at the time of … — this
 *    does not establish causality."
 * Throws if the generated text would itself read as causal.
 */
export function renderNonCausalObservation(
  topic: string,
  outcomeLabel: string,
  source: OutcomeEvidenceType
): string {
  const sourcePhrase =
    source === "student_note"
      ? "was reported as difficult by the student around the time of"
      : source === "interview_result"
        ? "was an observed interview-topic difficulty during"
        : source === "simulation_result"
          ? "was below the student's target benchmark in simulation before"
          : "was an already-evidenced gap at the time of";
  const text = `${topic} ${sourcePhrase} ${outcomeLabel.toLowerCase()} — this does not establish causality.`;
  if (isCausalClaim(text)) {
    throw new Error(`Internal guard violation: generated causal language: ${text}`);
  }
  return text;
}

// ============================================================================
// Gap evidence + focus candidates
// ============================================================================

export interface GapEvidenceInput {
  topic: string;
  domain: string;
  topicId: string | null;
  sources: OutcomeEvidenceType[];
  /** How many applications observed this gap (1 for a single analysis). */
  occurrences: number;
}

/**
 * Builds next-focus candidates from ALREADY-EVIDENCED gaps only.
 * Priority: evidence breadth (distinct sources), then occurrences.
 * The actionType reuses the Phase 15 FIX/REINFORCE/REVIEW vocabulary; the
 * actual daily-plan integration stays in Phase 15, which remains the only
 * preparation engine.
 */
export function buildFocusCandidates(gaps: GapEvidenceInput[]): OutcomeFocusCandidate[] {
  return gaps
    .filter((g) => g.sources.length > 0 && g.topic.trim().length > 0)
    .sort((a, b) => b.sources.length - a.sources.length || b.occurrences - a.occurrences)
    .slice(0, 5)
    .map((g) => ({
      // A gap known ONLY from self-report is a REVIEW candidate; anything
      // with system-observed evidence is a FIX candidate.
      actionType: g.sources.every((s) => s === "student_note") ? "REVIEW" : "FIX",
      topic: g.topic,
      domain: g.domain,
      topicId: g.topicId,
      reason: renderNonCausalObservation(g.topic, "the application outcome", g.sources[0]),
      sources: g.sources,
      occurrences: g.occurrences,
    }));
}

/**
 * Pattern detection across applications. A pattern exists only when the same
 * evidence-backed gap appears in more than one application with a recorded
 * outcome. sampleSize is the number of outcome applications checked;
 * occurrences the ones where the gap was actually observed. No pattern is
 * reported when evidence is thin (fewer than two applications, or a gap seen
 * in only one application).
 */
export function detectPatterns(
  perApplicationGaps: { applicationId: string; gaps: GapEvidenceInput[] }[]
): OutcomePattern[] {
  const sampleSize = perApplicationGaps.length;
  if (sampleSize < 2) return [];

  const byTopic = new Map<
    string,
    { topic: string; domain: string; sources: Set<OutcomeEvidenceType>; occurrences: number }
  >();
  for (const app of perApplicationGaps) {
    for (const gap of app.gaps) {
      const key = `${gap.domain}::${gap.topic}`;
      const entry = byTopic.get(key) ?? {
        topic: gap.topic,
        domain: gap.domain,
        sources: new Set<OutcomeEvidenceType>(),
        occurrences: 0,
      };
      for (const s of gap.sources) entry.sources.add(s);
      entry.occurrences += 1;
      byTopic.set(key, entry);
    }
  }

  const patterns: OutcomePattern[] = [];
  for (const entry of byTopic.values()) {
    if (entry.occurrences <= 1) continue;
    patterns.push({
      description: `${entry.topic} was an observed gap in ${entry.occurrences} of ${sampleSize} applications with recorded outcomes — a descriptive pattern, not a diagnosis.`,
      sampleSize,
      occurrences: entry.occurrences,
      topic: entry.topic,
      domain: entry.domain,
      sources: [...entry.sources],
    });
  }
  return patterns.sort((a, b) => b.occurrences - a.occurrences || a.topic.localeCompare(b.topic));
}

// ============================================================================
// Descriptive analytics (no probabilities, no predictions, no "best company")
// ============================================================================

export function buildStageDistribution(outcomes: DerivedOutcome[]): {
  stage: OutcomeStage | "unknown";
  label: string;
  count: number;
}[] {
  const labels: Record<string, string> = {
    none: "No stage recorded",
    application: "Applied",
    assessment: "Assessment",
    interview: "Interview",
    offer: "Offer",
    unknown: "Stage not recorded",
  };
  const counts = new Map<string, number>();
  for (const o of outcomes) {
    counts.set(o.stage, (counts.get(o.stage) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([stage, count]) => ({
      stage: stage as OutcomeStage | "unknown",
      label: labels[stage] ?? stage,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
