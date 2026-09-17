import { db } from "@/db";
import {
  attempts,
  answers,
  questions,
  subjects,
  topics,
  tests,
} from "@/db/schema";
import { eq, and, inArray, desc, gte } from "drizzle-orm";
import { calculateReadiness } from "./readiness";
import { getStudentPlacementTargets } from "./company-role-intelligence";
import { getRoleDomainRequirements } from "./placement-target-strategy";
import { getStudentSimulationHistory } from "./placement-simulation";
import { getResumeHealth } from "./resume-intelligence";
import { getApplicationsBoard } from "./application-intelligence";

// ============================================================================
// 1. DATA CONTRACTS & INTELLIGENCE 2.0 TYPES
// ============================================================================

export type IntelligenceDimensionId =
  | "dsa"
  | "programming"
  | "debugging"
  | "cs_fundamentals"
  | "dbms"
  | "os"
  | "cn"
  | "aptitude"
  | "communication"
  | "technical_interview"
  | "hr_interview"
  | "resume_ats"
  | "target_alignment"
  | "execution_consistency";

export type DimensionCategory =
  | "problem_solving"
  | "core_cs"
  | "interview"
  | "placement_assets"
  | "execution";

export type EvidenceState =
  | "INSUFFICIENT_EVIDENCE"
  | "EMERGING"
  | "DEVELOPING"
  | "STABLE"
  | "STRONG_EVIDENCE"
  | "INCONSISTENT";

export type TrendDirection =
  | "improving"
  | "declining"
  | "stable"
  | "inconsistent"
  | "insufficient_evidence";

export type EvidenceSourceType =
  | "assessment"
  | "practice"
  | "simulation"
  | "resume"
  | "execution"
  | "outcome"
  | "reflection";

export interface EvidenceItem {
  source: EvidenceSourceType;
  metric: string;
  count: number;
  value?: number;
  label: string;
  date?: string;
}

export interface IntelligenceDimension {
  id: IntelligenceDimensionId;
  name: string;
  category: DimensionCategory;
  status: EvidenceState;
  score: number | null; // null strictly when INSUFFICIENT_EVIDENCE
  observationCount: number;
  recentScore: number | null;
  historicalScore: number | null;
  trend: TrendDirection;
  evidence: EvidenceItem[];
  summary: string;
  hasCorroboratingSources: boolean;
}

export interface PerformanceTrend {
  dimensionId: IntelligenceDimensionId;
  dimensionName: string;
  direction: TrendDirection;
  recentMetric: string;
  historicalMetric: string;
  recentScore: number;
  historicalScore: number;
  delta: number;
  observation: string;
  sampleSize: {
    recent: number;
    historical: number;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface EvidenceStrength {
  id: string;
  dimensionId: IntelligenceDimensionId;
  title: string;
  evidenceStatement: string;
  stability: EvidenceState;
  score: number;
  observations: number;
  corroborated: boolean;
}

export interface EvidenceWeakness {
  id: string;
  dimensionId: IntelligenceDimensionId;
  title: string;
  deficitScore: number;
  evidenceStatement: string;
  observationCount: number;
  targetRelevance: boolean;
  targetRoleName?: string;
  sources: EvidenceSourceType[];
  corroborationLevel: "SINGLE_SOURCE" | "MULTI_SOURCE";
}

export type TargetRequirementSupport =
  | "SUPPORTED_BY_EVIDENCE"
  | "PARTIALLY_SUPPORTED"
  | "INSUFFICIENT_EVIDENCE";

export interface TargetRequirementItem {
  name: string;
  domain: string;
  importance: "HIGH" | "MEDIUM" | "STANDARD";
  supportStatus: TargetRequirementSupport;
  evidenceText: string;
  score: number | null;
}

export interface TargetIntelligenceAlignment {
  targetConfigured: boolean;
  companyName: string | null;
  roleName: string | null;
  requirements: TargetRequirementItem[];
  overallSupportStatus:
    | "ALIGNED_WITH_EVIDENCE"
    | "DEVELOPING_ALIGNMENT"
    | "INSUFFICIENT_EVIDENCE";
  alignmentSummary: string;
}

export interface CrossSourceCorroboration {
  id: string;
  domainOrTopic: string;
  title: string;
  sources: Array<{ source: EvidenceSourceType; detail: string }>;
  nature: "REPEATED_STRENGTH" | "REPEATED_FOCUS" | "MIXED_SIGNALS";
  observation: string;
}

export type IntelligencePriorityLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "MONITOR";

export interface IntelligencePriority {
  id: string;
  priorityNumber: string;
  level: IntelligencePriorityLevel;
  title: string;
  dimensionId: IntelligenceDimensionId;
  observation: string;
  why: string;
  evidence: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  recommendedAction: {
    type: "FIX" | "REINFORCE" | "REVIEW" | "MONITOR";
    title: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
  };
}

export interface ActionableInsight {
  id: string;
  category:
    | "PERFORMANCE_TREND"
    | "TARGET_ALIGNMENT"
    | "CORROBORATED_FOCUS"
    | "STABILITY_SIGNAL";
  headline: string;
  observation: string;
  evidenceDetail: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  actionDirective: string;
  actionType: "FIX" | "REINFORCE" | "REVIEW";
  ctaLabel: string;
  ctaHref: string;
}

export interface PlacementIntelligenceSnapshot2 {
  generatedAt: string;
  userId: string;
  evidenceSummary: {
    totalAssessments: number;
    totalPracticeAttempts: number;
    totalQuestionsAnswered: number;
    hasBaseline: boolean;
    hasSimulation: boolean;
    hasResume: boolean;
    hasApplications: boolean;
    hasOutcomes: boolean;
    dataSufficiency: "zero_data" | "limited_data" | "sufficient_data";
  };
  dimensions: IntelligenceDimension[];
  trends: PerformanceTrend[];
  strengths: EvidenceStrength[];
  weaknesses: EvidenceWeakness[];
  targetAlignment: TargetIntelligenceAlignment;
  crossSourceCorroborations: CrossSourceCorroboration[];
  priorities: IntelligencePriority[];
  actionableInsights: ActionableInsight[];
}

// ============================================================================
// 2. HELPER FUNCTIONS FOR STATISTICAL CALCULATION
// ============================================================================

function computeVariance(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squareDiffs = numbers.map((n) => Math.pow(n - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

function deriveStabilityState(
  observations: number,
  accuracy: number,
  variance: number
): EvidenceState {
  if (observations < 3) return "INSUFFICIENT_EVIDENCE";
  if (observations < 5) return "EMERGING";
  if (variance > 400) return "INCONSISTENT"; // std dev > 20
  if (accuracy >= 80 && variance <= 144) return "STRONG_EVIDENCE"; // std dev <= 12
  if (accuracy >= 70 && variance <= 225) return "STABLE"; // std dev <= 15
  return "DEVELOPING";
}

function deriveTrend(
  recentAccuracy: number | null,
  recentCount: number,
  histAccuracy: number | null,
  histCount: number
): TrendDirection {
  if (
    recentAccuracy === null ||
    histAccuracy === null ||
    recentCount < 2 ||
    histCount < 2
  ) {
    return "insufficient_evidence";
  }
  const delta = recentAccuracy - histAccuracy;
  if (delta >= 5) return "improving";
  if (delta <= -5) return "declining";
  return "stable";
}

// ============================================================================
// 3. MAIN PLACEMENT INTELLIGENCE 2.0 ENGINE
// ============================================================================

export async function getPlacementIntelligence2(
  userId: string
): Promise<PlacementIntelligenceSnapshot2> {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Invalid or unauthenticated user ID");
  }

  const generatedAt = new Date().toISOString();

  // 1. Parallel fetch of all available persistent state across Nexora modules
  const [
    readiness,
    targets,
    simulations,
    resumeHealth,
    appBoard,
  ] = await Promise.all([
    calculateReadiness(userId).catch(() => ({
      hasCompletedBaseline: false,
      readinessScore: null,
      level: null,
      breakdown: null,
      subjectScores: [],
    })),
    getStudentPlacementTargets(userId).catch(() => ({
      configured: false,
      primaryCompany: null,
      primaryRole: null,
    })),
    getStudentSimulationHistory(userId).catch(() => []),
    getResumeHealth(userId).catch(() => null),
    getApplicationsBoard(userId).catch(() => null),
  ]);

  const targetRequirements: {
    domain: string;
    domainName: string;
    targetNeed: "HIGH" | "MEDIUM" | "STANDARD";
    rationale: string;
  }[] = targets.configured && targets.primaryRole
    ? getRoleDomainRequirements({
        roleSlug: targets.primaryRole.slug,
      })
    : [];

  // 2. Fetch all submitted answers with detailed question subject & topic tags
  const submittedAnswers = await db
    .select({
      answerId: answers.id,
      isCorrect: answers.isCorrect,
      selectedAnswer: answers.selectedAnswer,
      questionId: questions.id,
      subjectId: questions.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      topicId: questions.topicId,
      topicName: topics.name,
      attemptId: attempts.id,
      attemptScore: attempts.score,
      testType: tests.type,
      submittedAt: attempts.submittedAt,
    })
    .from(answers)
    .innerJoin(attempts, eq(answers.attemptId, attempts.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "submitted")))
    .orderBy(desc(attempts.submittedAt));

  // Count distinct attempts
  const attemptRows = await db
    .select({
      id: attempts.id,
      score: attempts.score,
      accuracy: attempts.accuracy,
      type: tests.type,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "submitted")))
    .orderBy(desc(attempts.submittedAt));

  const totalAssessments = attemptRows.length;
  const practiceAttempts = attemptRows.filter(
    (a) => a.type !== "baseline"
  ).length;
  const totalQuestionsAnswered = submittedAnswers.length;

  const dataSufficiency: "zero_data" | "limited_data" | "sufficient_data" =
    totalQuestionsAnswered >= 30 && totalAssessments >= 3
      ? "sufficient_data"
      : totalQuestionsAnswered > 0
      ? "limited_data"
      : "zero_data";

  // 3. Segment into Recent vs Historical
  // Recent: answers submitted within the last 7 days, or top 35% slice if timestamps identical
  type AnswerRow = (typeof submittedAnswers)[number];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hasDistinctTimeWindows =
    submittedAnswers.some((a) => a.submittedAt && a.submittedAt >= sevenDaysAgo) &&
    submittedAnswers.some((a) => a.submittedAt && a.submittedAt < sevenDaysAgo);

  let recentAnswers: AnswerRow[];
  let historicalAnswers: AnswerRow[];

  if (hasDistinctTimeWindows) {
    recentAnswers = submittedAnswers.filter(
      (a) => a.submittedAt && a.submittedAt >= sevenDaysAgo
    );
    historicalAnswers = submittedAnswers.filter(
      (a) => !a.submittedAt || a.submittedAt < sevenDaysAgo
    );
  } else {
    const recentCutoffIndex = Math.max(
      5,
      Math.floor(submittedAnswers.length * 0.35)
    );
    recentAnswers = submittedAnswers.slice(0, recentCutoffIndex);
    historicalAnswers = submittedAnswers.slice(recentCutoffIndex);
  }

  // Helper to group answers by subject code
  const groupAnswersBySubject = (ansList: AnswerRow[]) => {
    const map = new Map<string, AnswerRow[]>();
    for (const ans of ansList) {
      const code = ans.subjectCode;
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(ans);
    }
    return map;
  };

  const allBySubject = groupAnswersBySubject(submittedAnswers);
  const recentBySubject = groupAnswersBySubject(recentAnswers);
  const histBySubject = groupAnswersBySubject(historicalAnswers);

  // Group simulation rounds if available
  const completedSims = simulations.filter((s) => s.status === "completed");
  const latestSim = completedSims[0] || null;

  // 4. Compute 14 Multi-Dimensional Performance Models
  const dimensions: IntelligenceDimension[] = [];

  // Helper to build a subject-backed dimension
  const buildSubjectDimension = (
    id: IntelligenceDimensionId,
    name: string,
    category: DimensionCategory,
    subjectCodes: string[],
    additionalEvidence?: EvidenceItem[]
  ): IntelligenceDimension => {
    const matchedAnswers: AnswerRow[] = [];
    const matchedRecent: AnswerRow[] = [];
    const matchedHist: AnswerRow[] = [];

    for (const code of subjectCodes) {
      if (allBySubject.has(code)) matchedAnswers.push(...allBySubject.get(code)!);
      if (recentBySubject.has(code)) matchedRecent.push(...recentBySubject.get(code)!);
      if (histBySubject.has(code)) matchedHist.push(...histBySubject.get(code)!);
    }

    const obsCount = matchedAnswers.length;
    const evidenceList: EvidenceItem[] = [];

    if (obsCount > 0) {
      const correct = matchedAnswers.filter((a) => a.isCorrect === true).length;
      const acc = Math.round((correct / obsCount) * 100);
      evidenceList.push({
        source: "assessment",
        metric: "accuracy",
        count: obsCount,
        value: acc,
        label: `${acc}% accuracy across ${obsCount} questions (${correct}/${obsCount} correct)`,
      });
    }

    if (additionalEvidence) {
      evidenceList.push(...additionalEvidence);
    }

    if (obsCount === 0 && evidenceList.length === 0) {
      return {
        id,
        name,
        category,
        status: "INSUFFICIENT_EVIDENCE",
        score: null,
        observationCount: 0,
        recentScore: null,
        historicalScore: null,
        trend: "insufficient_evidence",
        evidence: [],
        summary: "No empirical observations recorded for this dimension.",
        hasCorroboratingSources: false,
      };
    }

    const correctCount = matchedAnswers.filter((a) => a.isCorrect === true).length;
    const overallScore = obsCount > 0 ? Math.round((correctCount / obsCount) * 100) : null;

    const recentCorrect = matchedRecent.filter((a) => a.isCorrect === true).length;
    const recentScore =
      matchedRecent.length > 0
        ? Math.round((recentCorrect / matchedRecent.length) * 100)
        : null;

    const histCorrect = matchedHist.filter((a) => a.isCorrect === true).length;
    const historicalScore =
      matchedHist.length > 0
        ? Math.round((histCorrect / matchedHist.length) * 100)
        : null;

    const trend = deriveTrend(
      recentScore,
      matchedRecent.length,
      historicalScore,
      matchedHist.length
    );

    // Compute variance across attempts
    const attemptScoreMap = new Map<string, { c: number; t: number }>();
    for (const a of matchedAnswers) {
      const cur = attemptScoreMap.get(a.attemptId) || { c: 0, t: 0 };
      cur.t += 1;
      if (a.isCorrect) cur.c += 1;
      attemptScoreMap.set(a.attemptId, cur);
    }
    const perAttemptScores = Array.from(attemptScoreMap.values()).map(
      (v: { c: number; t: number }) => Math.round((v.c / v.t) * 100)
    );

    const variance = computeVariance(perAttemptScores);
    const status = deriveStabilityState(obsCount, overallScore ?? 0, variance);

    const hasCorroboratingSources =
      new Set(evidenceList.map((e) => e.source)).size >= 2;

    const summary =
      obsCount === 0
        ? "Only non-assessment signals detected."
        : `${status.replace("_", " ")}: ${overallScore}% accuracy across ${obsCount} questions with ${trend} trend.`;

    return {
      id,
      name,
      category,
      status,
      score: overallScore,
      observationCount: obsCount + (additionalEvidence?.length ?? 0),
      recentScore,
      historicalScore,
      trend,
      evidence: evidenceList,
      summary,
      hasCorroboratingSources,
    };
  };

  // 1. DSA / Problem Solving
  const dsaSimEvidence: EvidenceItem[] = [];
  if (latestSim) {
    const r2 = latestSim.rounds.find((r) => r.roundType === "coding");
    if (r2 && r2.score !== null) {
      dsaSimEvidence.push({
        source: "simulation",
        metric: "score",
        count: 1,
        value: r2.score,
        label: `Coding round evaluation: ${r2.score}/100`,
      });
    }
  }
  dimensions.push(
    buildSubjectDimension(
      "dsa",
      "DSA & Problem Solving",
      "problem_solving",
      ["DSA"],
      dsaSimEvidence
    )
  );

  // 2. Programming
  dimensions.push(
    buildSubjectDimension(
      "programming",
      "Programming Proficiency",
      "problem_solving",
      ["OOP", "DSA"]
    )
  );

  // 3. Debugging
  const debugEvidence: EvidenceItem[] = [];
  if (latestSim) {
    const r3 = latestSim.rounds.find((r) => r.roundType === "debugging");
    if (r3 && r3.score !== null) {
      debugEvidence.push({
        source: "simulation",
        metric: "score",
        count: 1,
        value: r3.score,
        label: `Multi-round simulation debugging score: ${r3.score}/100`,
      });
    }
  }
  dimensions.push({
    id: "debugging",
    name: "Code Debugging & Verification",
    category: "problem_solving",
    status: debugEvidence.length > 0 ? "STABLE" : "INSUFFICIENT_EVIDENCE",
    score: debugEvidence[0]?.value ?? null,
    observationCount: debugEvidence.length,
    recentScore: debugEvidence[0]?.value ?? null,
    historicalScore: null,
    trend: debugEvidence.length > 1 ? "stable" : "insufficient_evidence",
    evidence: debugEvidence,
    summary:
      debugEvidence.length > 0
        ? `Debugging verified via realistic multi-round simulation (${debugEvidence[0]?.value}%).`
        : "No direct debugging assessments or simulation completed.",
    hasCorroboratingSources: false,
  });

  // 4. CS Fundamentals
  dimensions.push(
    buildSubjectDimension(
      "cs_fundamentals",
      "Core CS Fundamentals",
      "core_cs",
      ["OS", "DBMS", "CN", "OOP"]
    )
  );

  // 5. DBMS
  dimensions.push(
    buildSubjectDimension(
      "dbms",
      "Database Management Systems",
      "core_cs",
      ["DBMS", "SQL"]
    )
  );

  // 6. Operating Systems
  dimensions.push(
    buildSubjectDimension(
      "os",
      "Operating Systems & Architecture",
      "core_cs",
      ["OS"]
    )
  );

  // 7. Computer Networks
  dimensions.push(
    buildSubjectDimension(
      "cn",
      "Computer Networks & Protocols",
      "core_cs",
      ["CN"]
    )
  );

  // 8. Aptitude
  const aptSimEvidence: EvidenceItem[] = [];
  if (latestSim) {
    const r1 = latestSim.rounds.find((r) => r.roundType === "screening");
    if (r1 && r1.score !== null) {
      aptSimEvidence.push({
        source: "simulation",
        metric: "score",
        count: 1,
        value: r1.score,
        label: `Screening aptitude round: ${r1.score}/100`,
      });
    }
  }
  dimensions.push(
    buildSubjectDimension(
      "aptitude",
      "Aptitude & Logical Reasoning",
      "problem_solving",
      ["APT"],
      aptSimEvidence
    )
  );

  // 9. Technical Interview
  const techInterviewEvidence: EvidenceItem[] = [];
  if (latestSim) {
    const r4 = latestSim.rounds.find((r) => r.roundType === "tech_interview");
    if (r4 && r4.score !== null) {
      techInterviewEvidence.push({
        source: "simulation",
        metric: "score",
        count: 1,
        value: r4.score,
        label: `Architecture & tech interview score: ${r4.score}/100`,
      });
    }
  }
  dimensions.push({
    id: "technical_interview",
    name: "Technical Architecture & Interview",
    category: "interview",
    status: techInterviewEvidence.length > 0 ? "STABLE" : "INSUFFICIENT_EVIDENCE",
    score: techInterviewEvidence[0]?.value ?? null,
    observationCount: techInterviewEvidence.length,
    recentScore: techInterviewEvidence[0]?.value ?? null,
    historicalScore: null,
    trend: "insufficient_evidence",
    evidence: techInterviewEvidence,
    summary:
      techInterviewEvidence.length > 0
        ? `Interview evaluated via multi-round simulation (${techInterviewEvidence[0]?.value}%).`
        : "Complete a placement simulation to evaluate technical interview depth.",
    hasCorroboratingSources: false,
  });

  // 10. HR Interview & Behavioral
  const hrEvidence: EvidenceItem[] = [];
  if (latestSim) {
    const r5 = latestSim.rounds.find((r) => r.roundType === "hr_interview");
    if (r5 && r5.score !== null) {
      hrEvidence.push({
        source: "simulation",
        metric: "score",
        count: 1,
        value: r5.score,
        label: `Behavioral STAR response score: ${r5.score}/100`,
      });
    }
  }
  dimensions.push({
    id: "hr_interview",
    name: "HR & Behavioral Communication",
    category: "interview",
    status: hrEvidence.length > 0 ? "STABLE" : "INSUFFICIENT_EVIDENCE",
    score: hrEvidence[0]?.value ?? null,
    observationCount: hrEvidence.length,
    recentScore: hrEvidence[0]?.value ?? null,
    historicalScore: null,
    trend: "insufficient_evidence",
    evidence: hrEvidence,
    summary:
      hrEvidence.length > 0
        ? `Behavioral alignment evaluated via simulation (${hrEvidence[0]?.value}%).`
        : "Complete a placement simulation to evaluate behavioral readiness.",
    hasCorroboratingSources: false,
  });

  // 11. Communication
  dimensions.push({
    id: "communication",
    name: "Professional Communication",
    category: "interview",
    status: hrEvidence.length > 0 ? "EMERGING" : "INSUFFICIENT_EVIDENCE",
    score: hrEvidence[0]?.value ?? null,
    observationCount: hrEvidence.length,
    recentScore: hrEvidence[0]?.value ?? null,
    historicalScore: null,
    trend: "insufficient_evidence",
    evidence: hrEvidence,
    summary:
      hrEvidence.length > 0
        ? `Measured through behavioral simulation (${hrEvidence[0]?.value}%).`
        : "No direct communication recordings or behavioral evaluations on record.",
    hasCorroboratingSources: false,
  });

  // 12. Resume / ATS
  const resumeEvidence: EvidenceItem[] = [];
  if (resumeHealth && resumeHealth.hasResume && resumeHealth.atsScore !== null) {
    resumeEvidence.push({
      source: "resume",
      metric: "atsScore",
      count: 1,
      value: resumeHealth.atsScore,
      label: `Deterministic ATS score: ${resumeHealth.atsScore}/100`,
    });
  }
  dimensions.push({
    id: "resume_ats",
    name: "Resume ATS Compatibility",
    category: "placement_assets",
    status: resumeEvidence.length > 0 ? "STABLE" : "INSUFFICIENT_EVIDENCE",
    score: resumeEvidence[0]?.value ?? null,
    observationCount: resumeEvidence.length,
    recentScore: resumeEvidence[0]?.value ?? null,
    historicalScore: null,
    trend: "insufficient_evidence",
    evidence: resumeEvidence,
    summary:
      resumeEvidence.length > 0
        ? `ATS machine-readability score calibrated at ${resumeEvidence[0]?.value}%.`
        : "Upload a resume to measure ATS parsing compatibility.",
    hasCorroboratingSources: false,
  });

  // 13. Target Alignment
  const targetEvidence: EvidenceItem[] = [];
  const targetScore = targets.configured && targetRequirements.length > 0
    ? Math.round(
        targetRequirements.reduce((sum: number, d) => {
          const subjScore = readiness.subjectScores.find((s) => s.code === d.domain)?.score ?? 0;
          return sum + subjScore;
        }, 0) / targetRequirements.length
      )
    : null;

  if (targets.configured && targetScore !== null) {
    targetEvidence.push({
      source: "assessment",
      metric: "targetScore",
      count: targetRequirements.length,
      value: targetScore,
      label: `Target Alignment Index: ${targetScore}% for ${targets.primaryRole?.name ?? "Target Role"}`,
    });
  }
  dimensions.push({
    id: "target_alignment",
    name: "Placement Target Alignment",
    category: "placement_assets",
    status: targets.configured && targetScore !== null ? "DEVELOPING" : "INSUFFICIENT_EVIDENCE",
    score: targetScore,
    observationCount: targetEvidence.length,
    recentScore: targetScore,
    historicalScore: null,
    trend: "insufficient_evidence",
    evidence: targetEvidence,
    summary: targets.configured
      ? `Calibrated for target role: ${targets.primaryRole?.name ?? "Target Role"} (${targetScore ?? 0}% alignment).`
      : "Configure a target company and role in Profile to measure alignment.",
    hasCorroboratingSources: false,
  });

  // 14. Execution Consistency
  const execEvidence: EvidenceItem[] = [];
  const last7DaysAttempts = attemptRows.filter((a) => {
    const d = a.submittedAt ? new Date(a.submittedAt) : null;
    return d && Date.now() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
  });
  const execConsistencyScore = totalAssessments > 0
    ? Math.min(100, Math.round((last7DaysAttempts.length / Math.max(1, Math.min(totalAssessments, 5))) * 100))
    : null;

  if (execConsistencyScore !== null) {
    execEvidence.push({
      source: "execution",
      metric: "actions",
      count: last7DaysAttempts.length,
      value: execConsistencyScore,
      label: `${last7DaysAttempts.length} assessments completed in past 7 days (${totalAssessments} total recorded)`,
    });
  }
  dimensions.push({
    id: "execution_consistency",
    name: "Execution Consistency & Discipline",
    category: "execution",
    status:
      totalAssessments >= 3
        ? "STABLE"
        : totalAssessments > 0
        ? "EMERGING"
        : "INSUFFICIENT_EVIDENCE",
    score: execConsistencyScore,
    observationCount: totalAssessments,
    recentScore: execConsistencyScore,
    historicalScore: null,
    trend: "insufficient_evidence",
    evidence: execEvidence,
    summary:
      totalAssessments > 0
        ? `Execution activity active: ${last7DaysAttempts.length} recent assessments recorded.`
        : "Complete baseline to activate the daily execution tracking.",
    hasCorroboratingSources: false,
  });

  // 5. Derive Deterministic Performance Trends across Dimensions
  const trends: PerformanceTrend[] = [];
  for (const dim of dimensions) {
    if (
      dim.recentScore !== null &&
      dim.historicalScore !== null &&
      dim.trend !== "insufficient_evidence"
    ) {
      const delta = dim.recentScore - dim.historicalScore;
      const observation =
        delta >= 5
          ? `Recent performance in ${dim.name} (${dim.recentScore}%) is higher than the historical baseline (${dim.historicalScore}%).`
          : delta <= -5
          ? `Recent performance in ${dim.name} (${dim.recentScore}%) is lower than the historical baseline (${dim.historicalScore}%).`
          : `Performance in ${dim.name} is stable between recent (${dim.recentScore}%) and historical (${dim.historicalScore}%) measurements.`;

      trends.push({
        dimensionId: dim.id,
        dimensionName: dim.name,
        direction: dim.trend,
        recentMetric: `${dim.recentScore}%`,
        historicalMetric: `${dim.historicalScore}%`,
        recentScore: dim.recentScore,
        historicalScore: dim.historicalScore,
        delta,
        observation,
        sampleSize: {
          recent: 5,
          historical: dim.observationCount - 5,
        },
        confidence: dim.observationCount >= 15 ? "HIGH" : "MEDIUM",
      });
    }
  }

  // 6. Evidence-Backed Strengths
  const strengths: EvidenceStrength[] = [];
  for (const dim of dimensions) {
    if (
      dim.score !== null &&
      dim.score >= 75 &&
      dim.observationCount >= 3 &&
      (dim.status === "STRONG_EVIDENCE" ||
        dim.status === "STABLE" ||
        dim.status === "DEVELOPING")
    ) {
      strengths.push({
        id: `strength-${dim.id}`,
        dimensionId: dim.id,
        title: `Consistent proficiency in ${dim.name}`,
        evidenceStatement: `${dim.score}% measured accuracy across ${dim.observationCount} empirical observations.`,
        stability: dim.status,
        score: dim.score,
        observations: dim.observationCount,
        corroborated: dim.hasCorroboratingSources,
      });
    }
  }

  // 7. Evidence-Backed Focus Areas / Weaknesses 2.0
  const weaknesses: EvidenceWeakness[] = [];
  for (const dim of dimensions) {
    if (
      dim.score !== null &&
      dim.score < 70 &&
      dim.observationCount >= 2 &&
      dim.status !== "INSUFFICIENT_EVIDENCE"
    ) {
      const isTargetRelevant =
        targets.configured &&
        targetRequirements.some(
          (r: { domain: string }) =>
            r.domain.toUpperCase() === dim.id.toUpperCase() ||
            (dim.id === "dsa" && r.domain === "DSA") ||
            (dim.id === "dbms" && (r.domain === "DBMS" || r.domain === "SQL")) ||
            (dim.id === "os" && r.domain === "OS") ||
            (dim.id === "cn" && r.domain === "CN")
        );

      weaknesses.push({
        id: `weakness-${dim.id}`,
        dimensionId: dim.id,
        title: `Measured deficit in ${dim.name}`,
        deficitScore: dim.score,
        evidenceStatement: `${dim.score}% measured accuracy across ${dim.observationCount} observations (${100 - dim.score}% deficit).`,
        observationCount: dim.observationCount,
        targetRelevance: Boolean(isTargetRelevant),
        targetRoleName: targets.primaryRole?.name ?? undefined,
        sources: Array.from(new Set(dim.evidence.map((e) => e.source))),
        corroborationLevel: dim.hasCorroboratingSources
          ? "MULTI_SOURCE"
          : "SINGLE_SOURCE",
      });
    }
  }

  // Sort weaknesses: target-relevant first, multi-source first, lowest score (greatest deficit) first
  weaknesses.sort((a, b) => {
    if (a.targetRelevance && !b.targetRelevance) return -1;
    if (!a.targetRelevance && b.targetRelevance) return 1;
    if (a.corroborationLevel === "MULTI_SOURCE" && b.corroborationLevel !== "MULTI_SOURCE") return -1;
    if (a.corroborationLevel !== "MULTI_SOURCE" && b.corroborationLevel === "MULTI_SOURCE") return 1;
    return a.deficitScore - b.deficitScore;
  });

  // 8. Target-Aware Alignment via Phase 16
  const targetAlignmentRequirements: TargetRequirementItem[] = [];
  if (targets.configured) {
    for (const req of targetRequirements) {
      // Find matching dimension
      const dim = dimensions.find(
        (d) =>
          d.id.toUpperCase() === req.domain.toUpperCase() ||
          (req.domain === "DSA" && d.id === "dsa") ||
          ((req.domain === "DBMS" || req.domain === "SQL") && d.id === "dbms") ||
          (req.domain === "OS" && d.id === "os") ||
          (req.domain === "CN" && d.id === "cn") ||
          (req.domain === "APT" && d.id === "aptitude")
      );

      let supportStatus: TargetRequirementSupport = "INSUFFICIENT_EVIDENCE";
      let evidenceText = "No assessment evidence recorded for this requirement.";

      if (dim && dim.score !== null) {
        if (dim.score >= 70 && dim.observationCount >= 3) {
          supportStatus = "SUPPORTED_BY_EVIDENCE";
          evidenceText = `Strong evidence: ${dim.score}% accuracy across ${dim.observationCount} questions.`;
        } else {
          supportStatus = "PARTIALLY_SUPPORTED";
          evidenceText = `Partial evidence: ${dim.score}% accuracy recorded (${dim.observationCount} questions). Below benchmark.`;
        }
      }

      targetAlignmentRequirements.push({
        name: req.domainName,
        domain: req.domain,
        importance: req.targetNeed,
        supportStatus,
        evidenceText,
        score: dim?.score ?? null,
      });
    }
  }

  const supportedCount = targetAlignmentRequirements.filter(
    (r) => r.supportStatus === "SUPPORTED_BY_EVIDENCE"
  ).length;
  const partialCount = targetAlignmentRequirements.filter(
    (r) => r.supportStatus === "PARTIALLY_SUPPORTED"
  ).length;

  const targetAlignment: TargetIntelligenceAlignment = {
    targetConfigured: targets.configured,
    companyName: targets.primaryCompany?.name ?? null,
    roleName: targets.primaryRole?.name ?? null,
    requirements: targetAlignmentRequirements,
    overallSupportStatus:
      targetAlignmentRequirements.length === 0
        ? "INSUFFICIENT_EVIDENCE"
        : supportedCount >= targetAlignmentRequirements.length * 0.6
        ? "ALIGNED_WITH_EVIDENCE"
        : partialCount + supportedCount > 0
        ? "DEVELOPING_ALIGNMENT"
        : "INSUFFICIENT_EVIDENCE",
    alignmentSummary: targets.configured
      ? `${supportedCount} of ${targetAlignmentRequirements.length} requirements supported by evidence for ${targets.primaryRole?.name ?? "target role"}.`
      : "Target requirements will calibrate automatically when a target role is selected.",
  };

  // 9. Cross-Source Corroboration Detection (Non-Causal)
  const crossSourceCorroborations: CrossSourceCorroboration[] = [];

  // Check DBMS / SQL across practice and outcome reflection
  const dbmsDim = dimensions.find((d) => d.id === "dbms");
  const simTechRound = latestSim?.rounds.find((r) => r.roundType === "tech_interview");
  if (
    dbmsDim &&
    dbmsDim.score !== null &&
    dbmsDim.score < 70 &&
    simTechRound &&
    simTechRound.score !== null &&
    simTechRound.score < 70
  ) {
    crossSourceCorroborations.push({
      id: "corroboration-dbms",
      domainOrTopic: "DBMS",
      title: "DBMS deficit corroborated across assessment and simulation",
      sources: [
        {
          source: "assessment",
          detail: `Assessment accuracy: ${dbmsDim.score}% across ${dbmsDim.observationCount} questions`,
        },
        {
          source: "simulation",
          detail: `Technical architecture interview score: ${simTechRound.score}/100`,
        },
      ],
      nature: "REPEATED_FOCUS",
      observation:
        "DBMS appears as a repeated evidence area across both objective assessment and simulated technical interview data.",
    });
  }

  // Check DSA across assessment and coding simulation
  const dsaDim = dimensions.find((d) => d.id === "dsa");
  const simCodingRound = latestSim?.rounds.find((r) => r.roundType === "coding");
  if (
    dsaDim &&
    dsaDim.score !== null &&
    dsaDim.score >= 75 &&
    simCodingRound &&
    simCodingRound.score !== null &&
    simCodingRound.score >= 75
  ) {
    crossSourceCorroborations.push({
      id: "corroboration-dsa",
      domainOrTopic: "DSA",
      title: "DSA proficiency corroborated across assessment and coding rounds",
      sources: [
        {
          source: "assessment",
          detail: `DSA assessment accuracy: ${dsaDim.score}%`,
        },
        {
          source: "simulation",
          detail: `Simulation coding round score: ${simCodingRound.score}/100`,
        },
      ],
      nature: "REPEATED_STRENGTH",
      observation:
        "DSA problem solving appears as a consistent strength across multiple independent evaluation modes.",
    });
  }

  // 10. Prioritized Next Actions & Actionable Insights
  const priorities: IntelligencePriority[] = [];
  const actionableInsights: ActionableInsight[] = [];

  // Build priorities from weaknesses, trends, and target requirements
  let pIndex = 1;

  for (const w of weaknesses.slice(0, 4)) {
    const isCorroborated = w.corroborationLevel === "MULTI_SOURCE";
    const level: IntelligencePriorityLevel =
      w.deficitScore < 50 || (isCorroborated && w.targetRelevance)
        ? "CRITICAL"
        : w.targetRelevance
        ? "HIGH"
        : "MEDIUM";

    const pItem: IntelligencePriority = {
      id: `p-${w.id}`,
      priorityNumber: String(pIndex++).padStart(2, "0"),
      level,
      title: w.title,
      dimensionId: w.dimensionId,
      observation: `Measured accuracy is ${w.deficitScore}% with ${w.observationCount} total observations.`,
      why: w.targetRelevance
        ? `Required competency for target role (${w.targetRoleName}). Deficit directly impacts competitive readiness.`
        : "Conceptual deficit detected during assessment evaluation.",
      evidence: [
        w.evidenceStatement,
        isCorroborated ? "Corroborated across multiple independent sources" : "Observed in assessment attempt records",
      ],
      confidence: w.observationCount >= 10 ? "HIGH" : "MEDIUM",
      recommendedAction: {
        type: w.deficitScore < 50 ? "FIX" : "REINFORCE",
        title: `Targeted Practice: ${w.dimensionId.toUpperCase()}`,
        description: `Complete targeted problem sets in ${w.dimensionId.toUpperCase()} to eliminate conceptual gaps.`,
        ctaLabel: "Start Practice",
        ctaHref: `/practice?subjectCode=${w.dimensionId.toUpperCase()}`,
      },
    };

    priorities.push(pItem);

    actionableInsights.push({
      id: `insight-${w.id}`,
      category: isCorroborated ? "CORROBORATED_FOCUS" : "TARGET_ALIGNMENT",
      headline: w.title,
      observation: pItem.observation,
      evidenceDetail: pItem.evidence,
      confidence: pItem.confidence,
      actionDirective: pItem.recommendedAction.description,
      actionType: pItem.recommendedAction.type === "FIX" ? "FIX" : "REINFORCE",
      ctaLabel: pItem.recommendedAction.ctaLabel,
      ctaHref: pItem.recommendedAction.ctaHref,
    });
  }

  // If uncalibrated / zero data
  if (priorities.length === 0 && !readiness.hasCompletedBaseline) {
    priorities.push({
      id: "p-baseline",
      priorityNumber: "01",
      level: "CRITICAL",
      title: "Establish Placement Baseline",
      dimensionId: "cs_fundamentals",
      observation: "No baseline assessment completed yet.",
      why: "Initial benchmark is required to calibrate multi-dimensional placement intelligence.",
      evidence: ["0 assessments completed", "Readiness score uncalibrated"],
      confidence: "HIGH",
      recommendedAction: {
        type: "FIX",
        title: "Complete Baseline Assessment",
        description: "Take the comprehensive 7-domain placement baseline assessment.",
        ctaLabel: "Start Baseline Assessment",
        ctaHref: "/assessment",
      },
    });

    actionableInsights.push({
      id: "insight-baseline",
      category: "STABILITY_SIGNAL",
      headline: "Establish Your Baseline Calibration",
      observation: "Placement intelligence operates strictly on real empirical evidence.",
      evidenceDetail: ["Awaiting first completed assessment"],
      confidence: "HIGH",
      actionDirective: "Complete the baseline assessment to unlock personalized guidance.",
      actionType: "FIX",
      ctaLabel: "Start Baseline",
      ctaHref: "/assessment",
    });
  }

  // Sort priorities deterministically by urgency level (CRITICAL -> HIGH -> MEDIUM -> LOW -> MONITOR)
  const levelRank: Record<IntelligencePriorityLevel, number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
    MONITOR: 5,
  };
  priorities.sort((a, b) => levelRank[a.level] - levelRank[b.level]);
  priorities.forEach((p, idx) => {
    p.priorityNumber = String(idx + 1).padStart(2, "0");
  });

  return {
    generatedAt,
    userId,
    evidenceSummary: {
      totalAssessments,
      totalPracticeAttempts: practiceAttempts,
      totalQuestionsAnswered,
      hasBaseline: readiness.hasCompletedBaseline,
      hasSimulation: completedSims.length > 0,
      hasResume: Boolean(resumeHealth?.hasResume),
      hasApplications: Boolean(appBoard && appBoard.cards.length > 0),
      hasOutcomes: Boolean(
        appBoard &&
          appBoard.cards.some((c) =>
            ["OFFER", "REJECTED", "WITHDRAWN"].includes(c.status)
          )
      ),
      dataSufficiency,
    },
    dimensions,
    trends,
    strengths,
    weaknesses,
    targetAlignment,
    crossSourceCorroborations,
    priorities: priorities.slice(0, 5),
    actionableInsights: actionableInsights.slice(0, 5),
  };
}
