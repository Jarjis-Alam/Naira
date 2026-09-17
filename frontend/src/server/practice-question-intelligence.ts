import { db } from "@/db";
import {
  questions,
  topics,
  subjects,
  tests,
  testQuestions,
  testSections,
  attempts,
  answers,
  studyPlanItems,
} from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { getPlacementIntelligence2 } from "./placement-intelligence-2";
import { getActiveStudyPlan } from "./adaptive-study-planner";
import { getStudentPlacementTargets } from "./company-role-intelligence";

// ============================================================================
// PHASE 25 TYPE DEFINITIONS
// ============================================================================

export type PracticeObjective = "FIX" | "REINFORCE" | "REVIEW" | "REASSESS" | "MIXED";
export type QuestionDifficultyLevel = "easy" | "medium" | "hard" | "unknown";

export interface QuestionHistoryItem {
  questionId: string;
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  lastAttemptedAt: Date | null;
  lastResult: "correct" | "incorrect" | "unattempted";
  historicalAccuracy: number | null; // 0 - 100
  isRepeatedMistake: boolean; // >= 2 incorrect attempts
  isRepeatedCorrect: boolean; // >= 2 correct attempts
  recencyDays: number | null;
}

export interface StudentTopicPerformance {
  topicId: string;
  topicName: string;
  subjectCode: string;
  attemptCount: number;
  correctCount: number;
  accuracy: number | null;
  hasRepeatedMistakes: boolean;
  mistakeStatement: string | null;
}

export interface QuestionCandidate {
  questionId: string;
  questionText: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  difficulty: QuestionDifficultyLevel;
  questionType: "single_choice" | "multiple_choice";
  marks: number;
  expectedTime: number | null;
  targetRelevance: boolean;
  weaknessRelevance: boolean;
  history: QuestionHistoryItem;
  selectionReason: string;
  selectionScore: number;
  sequenceOrder: number;
}

export interface PracticeRecommendation {
  topicId: string;
  topicName: string;
  subjectCode: string;
  subjectName: string;
  objective: PracticeObjective;
  suggestedCount: number;
  estimatedMinutes: number;
  targetRelevance: boolean;
  evidence: {
    recentAccuracy: number | null;
    historicalBaseline: number | null;
    attemptCount: number;
    hasRepeatedMistakes: boolean;
    repeatedMistakeNote: string | null;
  };
  rationale: string;
  questionSequencePreview: {
    order: number;
    difficulty: QuestionDifficultyLevel;
    label: string;
  }[];
  planItemId?: string;
}

export interface SelectionParams {
  userId: string;
  topicId?: string;
  subjectCode?: string;
  objective?: PracticeObjective;
  requestedCount?: number;
  planItemId?: string;
}

export interface SelectionResult {
  objective: PracticeObjective;
  topicId: string | null;
  topicName: string | null;
  subjectCode: string | null;
  requestedCount: number;
  availableCount: number;
  selectedQuestions: QuestionCandidate[];
  evidence: {
    recentAccuracy: number | null;
    historicalBaseline: number | null;
    attemptCount: number;
    hasRepeatedMistakes: boolean;
    repeatedMistakeNote: string | null;
  };
  explanation: {
    headline: string;
    rationale: string;
    targetAlignmentNote: string | null;
  };
  emptyState?: {
    type: "no_questions_for_topic" | "topic_not_found" | "insufficient_pool";
    message: string;
  };
}

// ============================================================================
// 1. QUESTION HISTORY ANALYZER (ZERO FABRICATION)
// ============================================================================

/**
 * Analyzes each student's historical interaction with questions and topics
 * strictly from persisted submitted attempts and answers.
 */
export async function getStudentQuestionHistory(
  userId: string
): Promise<{
  questionMap: Map<string, QuestionHistoryItem>;
  topicMap: Map<string, StudentTopicPerformance>;
}> {
  if (!userId || userId.trim() === "") {
    return { questionMap: new Map(), topicMap: new Map() };
  }

  // Join answers with submitted attempts for this student
  const rows = await db
    .select({
      questionId: answers.questionId,
      isCorrect: answers.isCorrect,
      submittedAt: attempts.submittedAt,
      topicId: questions.topicId,
      topicName: topics.name,
      subjectCode: subjects.code,
    })
    .from(answers)
    .innerJoin(attempts, eq(answers.attemptId, attempts.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "submitted")))
    .orderBy(desc(attempts.submittedAt));

  const questionMap = new Map<string, QuestionHistoryItem>();
  const topicStats = new Map<
    string,
    {
      topicName: string;
      subjectCode: string;
      total: number;
      correct: number;
      incorrect: number;
      questionsWithMultipleMistakes: Set<string>;
    }
  >();

  const nowMs = Date.now();

  for (const r of rows) {
    // 1. Accumulate question history
    let qHist = questionMap.get(r.questionId);
    const isCorr = r.isCorrect === true;
    const isInc = r.isCorrect === false;

    if (!qHist) {
      const lastAttempted = r.submittedAt ? new Date(r.submittedAt) : null;
      const recencyDays = lastAttempted
        ? Math.max(0, Math.floor((nowMs - lastAttempted.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      qHist = {
        questionId: r.questionId,
        attemptCount: 1,
        correctCount: isCorr ? 1 : 0,
        incorrectCount: isInc ? 1 : 0,
        lastAttemptedAt: lastAttempted,
        lastResult: isCorr ? "correct" : isInc ? "incorrect" : "unattempted",
        historicalAccuracy: null,
        isRepeatedMistake: false,
        isRepeatedCorrect: false,
        recencyDays,
      };
      questionMap.set(r.questionId, qHist);
    } else {
      qHist.attemptCount += 1;
      if (isCorr) qHist.correctCount += 1;
      if (isInc) qHist.incorrectCount += 1;
    }

    // 2. Accumulate topic stats
    let tStat = topicStats.get(r.topicId);
    if (!tStat) {
      tStat = {
        topicName: r.topicName,
        subjectCode: r.subjectCode,
        total: 0,
        correct: 0,
        incorrect: 0,
        questionsWithMultipleMistakes: new Set(),
      };
      topicStats.set(r.topicId, tStat);
    }
    tStat.total += 1;
    if (isCorr) tStat.correct += 1;
    if (isInc) tStat.incorrect += 1;
  }

  // Finalize question accuracy and repeated classifications
  for (const qHist of questionMap.values()) {
    qHist.historicalAccuracy =
      qHist.attemptCount > 0
        ? Math.round((qHist.correctCount / qHist.attemptCount) * 100)
        : null;
    qHist.isRepeatedMistake = qHist.incorrectCount >= 2;
    qHist.isRepeatedCorrect = qHist.correctCount >= 2;
  }

  // Finalize topic summary
  const topicMap = new Map<string, StudentTopicPerformance>();
  for (const [topicId, tStat] of topicStats.entries()) {
    const accuracy = tStat.total > 0 ? Math.round((tStat.correct / tStat.total) * 100) : null;
    const hasRepeated = tStat.incorrect >= 2;
    const mistakeStatement = hasRepeated
      ? `${tStat.topicName} has repeated incorrect attempts in previous assessments.`
      : null;

    topicMap.set(topicId, {
      topicId,
      topicName: tStat.topicName,
      subjectCode: tStat.subjectCode,
      attemptCount: tStat.total,
      correctCount: tStat.correct,
      accuracy,
      hasRepeatedMistakes: hasRepeated,
      mistakeStatement,
    });
  }

  return { questionMap, topicMap };
}

// ============================================================================
// 2. MALFORMED QUESTION EXCLUSION & QUALITY GATE
// ============================================================================

export function isValidQuestion(q: {
  id: string;
  question: string | null;
  options: unknown;
  correctAnswer: unknown;
  subjectId: string | null;
  topicId: string | null;
}): { isValid: boolean; reason?: string } {
  if (!q.question || q.question.trim().length === 0) {
    return { isValid: false, reason: "missing_text" };
  }
  if (!Array.isArray(q.options) || q.options.length < 2) {
    return { isValid: false, reason: "insufficient_options" };
  }
  if (
    q.correctAnswer === null ||
    q.correctAnswer === undefined ||
    (typeof q.correctAnswer === "string" && q.correctAnswer.trim() === "")
  ) {
    return { isValid: false, reason: "invalid_correct_answer" };
  }
  if (!q.subjectId || !q.topicId) {
    return { isValid: false, reason: "missing_topic_or_subject" };
  }
  return { isValid: true };
}

// ============================================================================
// 3. TARGET RELEVANCE RESOLVER (PHASE 16 SOLE SOURCE OF TRUTH)
// ============================================================================

export async function getTargetRelevantTopics(
  userId: string
): Promise<{ targetConfigured: boolean; targetRole: string | null; relevantSubjectCodes: Set<string> }> {
  try {
    const targets = await getStudentPlacementTargets(userId);
    if (!targets || !targets.primaryRole) {
      return { targetConfigured: false, targetRole: null, relevantSubjectCodes: new Set() };
    }

    const roleName = targets.primaryRole.name.toLowerCase();
    const relevantSubjectCodes = new Set<string>();

    if (roleName.includes("software") || roleName.includes("sde") || roleName.includes("engineer")) {
      relevantSubjectCodes.add("DSA");
      relevantSubjectCodes.add("DBMS");
      relevantSubjectCodes.add("OS");
      relevantSubjectCodes.add("OOP");
      relevantSubjectCodes.add("CN");
    } else if (roleName.includes("data") || roleName.includes("analyst")) {
      relevantSubjectCodes.add("DBMS");
      relevantSubjectCodes.add("SQL");
      relevantSubjectCodes.add("APT");
    } else {
      relevantSubjectCodes.add("DSA");
      relevantSubjectCodes.add("APT");
    }

    return {
      targetConfigured: true,
      targetRole: targets.primaryRole.name,
      relevantSubjectCodes,
    };
  } catch {
    return { targetConfigured: false, targetRole: null, relevantSubjectCodes: new Set() };
  }
}

// ============================================================================
// 4. CORE DETERMINISTIC QUESTION SELECTION ENGINE
// ============================================================================

/**
 * Selects and sequences questions deterministically based on empirical evidence,
 * practice objective, target relevance, and reuse policies.
 */
export async function selectPersonalizedQuestions(
  params: SelectionParams
): Promise<SelectionResult> {
  const { userId, topicId, subjectCode, planItemId } = params;

  // 1. Ingest Evidence & Intelligence
  const { questionMap, topicMap } = await getStudentQuestionHistory(userId);
  const targetInfo = await getTargetRelevantTopics(userId);

  // Ingest Phase 24 context
  let derivedObjective: PracticeObjective = params.objective || "REINFORCE";
  let suggestedMinutes = 20;

  // Check Phase 24 study plan if planItemId provided
  if (planItemId) {
    try {
      const [itemRow] = await db
        .select()
        .from(studyPlanItems)
        .where(and(eq(studyPlanItems.id, planItemId), eq(studyPlanItems.userId, userId)))
        .limit(1);

      if (itemRow) {
        suggestedMinutes = itemRow.estimatedMinutes;
        switch (itemRow.category) {
          case "FIX":
            derivedObjective = "FIX";
            break;
          case "REINFORCE":
            derivedObjective = "REINFORCE";
            break;
          case "REVIEW":
            derivedObjective = "REVIEW";
            break;
          case "ASSESSMENT":
            derivedObjective = "REASSESS";
            break;
          default:
            derivedObjective = "REINFORCE";
        }
      }
    } catch {
      // Ignore if item lookup fails
    }
  }

  const objective = params.objective || derivedObjective;
  const requestedCount = params.requestedCount || (suggestedMinutes <= 15 ? 5 : suggestedMinutes <= 20 ? 8 : 10);

  // 2. Resolve Topic & Subject
  let resolvedTopic: { id: string; name: string; subjectId: string; subjectCode: string; subjectName: string } | null = null;

  if (topicId) {
    const topicRows = await db
      .select({
        id: topics.id,
        name: topics.name,
        subjectId: topics.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(eq(topics.id, topicId))
      .limit(1);

    if (topicRows.length > 0) {
      resolvedTopic = topicRows[0];
    } else {
      return {
        objective,
        topicId: topicId,
        topicName: null,
        subjectCode: null,
        requestedCount,
        availableCount: 0,
        selectedQuestions: [],
        evidence: {
          recentAccuracy: null,
          historicalBaseline: null,
          attemptCount: 0,
          hasRepeatedMistakes: false,
          repeatedMistakeNote: null,
        },
        explanation: {
          headline: "Topic Not Found",
          rationale: "The specified topic ID does not correspond to any registered topic in the placement curriculum.",
          targetAlignmentNote: null,
        },
        emptyState: {
          type: "topic_not_found",
          message: "The requested topic was not found in the placement syllabus.",
        },
      };
    }
  } else if (subjectCode) {
    // Find first topic for this subject or general subject selection
    const topicRows = await db
      .select({
        id: topics.id,
        name: topics.name,
        subjectId: topics.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(eq(subjects.code, subjectCode))
      .orderBy(asc(topics.displayOrder))
      .limit(1);

    if (topicRows.length > 0) {
      resolvedTopic = topicRows[0];
    }
  }

  // 3. Fetch Questions for Topic (or Subject)
  let rawQuestions: {
    id: string;
    question: string;
    options: unknown;
    correctAnswer: unknown;
    subjectId: string;
    topicId: string;
    difficulty: string | null;
    questionType: "single_choice" | "multiple_choice";
    marks: number;
    expectedTime: number | null;
    subjectCode: string;
    subjectName: string;
    topicName: string;
  }[] = [];

  if (resolvedTopic) {
    rawQuestions = await db
      .select({
        id: questions.id,
        question: questions.question,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        subjectId: questions.subjectId,
        topicId: questions.topicId,
        difficulty: questions.difficulty,
        questionType: questions.questionType,
        marks: questions.marks,
        expectedTime: questions.expectedTime,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        topicName: topics.name,
      })
      .from(questions)
      .innerJoin(topics, eq(questions.topicId, topics.id))
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .where(eq(questions.topicId, resolvedTopic.id));
  } else if (subjectCode) {
    rawQuestions = await db
      .select({
        id: questions.id,
        question: questions.question,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        subjectId: questions.subjectId,
        topicId: questions.topicId,
        difficulty: questions.difficulty,
        questionType: questions.questionType,
        marks: questions.marks,
        expectedTime: questions.expectedTime,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        topicName: topics.name,
      })
      .from(questions)
      .innerJoin(topics, eq(questions.topicId, topics.id))
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .where(eq(subjects.code, subjectCode));
  }

  // 4. Exclude Malformed Questions Safely
  const validPool = rawQuestions.filter((q) => isValidQuestion(q).isValid);

  // If pool is empty, return honest empty state
  if (validPool.length === 0) {
    return {
      objective,
      topicId: resolvedTopic?.id || null,
      topicName: resolvedTopic?.name || null,
      subjectCode: resolvedTopic?.subjectCode || subjectCode || null,
      requestedCount,
      availableCount: 0,
      selectedQuestions: [],
      evidence: {
        recentAccuracy: null,
        historicalBaseline: null,
        attemptCount: 0,
        hasRepeatedMistakes: false,
        repeatedMistakeNote: null,
      },
      explanation: {
        headline: "No Suitable Questions Available",
        rationale: "No verified questions currently exist in the question bank for this topic.",
        targetAlignmentNote: null,
      },
      emptyState: {
        type: "no_questions_for_topic",
        message: "No suitable questions are currently available for this topic in the question bank.",
      },
    };
  }

  // 5. Evaluate Topic-Level Evidence
  const topicHist = resolvedTopic ? topicMap.get(resolvedTopic.id) : null;
  const recentAccuracy = topicHist?.accuracy ?? null;
  const attemptCount = topicHist?.attemptCount ?? 0;
  const hasRepeatedMistakes = topicHist?.hasRepeatedMistakes ?? false;
  const repeatedMistakeNote = topicHist?.mistakeStatement ?? null;

  const matchesTargetSubject = (code: string) => {
    const upper = code.toUpperCase();
    for (const rel of targetInfo.relevantSubjectCodes) {
      if (upper === rel || upper.startsWith(rel)) return true;
    }
    return false;
  };

  // Determine Target Relevance
  const isTargetRelevant = resolvedTopic
    ? matchesTargetSubject(resolvedTopic.subjectCode)
    : subjectCode
    ? matchesTargetSubject(subjectCode)
    : false;

  // 6. Score & Rank Each Candidate Deterministically
  const scoredCandidates: QuestionCandidate[] = validPool.map((q) => {
    const qHist: QuestionHistoryItem = questionMap.get(q.id) || {
      questionId: q.id,
      attemptCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      lastAttemptedAt: null,
      lastResult: "unattempted",
      historicalAccuracy: null,
      isRepeatedMistake: false,
      isRepeatedCorrect: false,
      recencyDays: null,
    };

    // Difficulty normalization (Never invent difficulty!)
    let diff: QuestionDifficultyLevel = "unknown";
    if (q.difficulty === "easy" || q.difficulty === "medium" || q.difficulty === "hard") {
      diff = q.difficulty;
    }

    let selectionScore = 100;
    let reason = "Standard topic coverage";

    // A. Practice Objective & Difficulty Alignment
    switch (objective) {
      case "FIX": {
        // Heavy priority on easy/foundational, deprioritize hard
        if (diff === "easy") selectionScore += 40;
        else if (diff === "medium") selectionScore += 15;
        else if (diff === "hard") selectionScore -= 30;

        // Boost previously missed questions
        if (qHist.isRepeatedMistake) {
          selectionScore += 50;
          reason = "Repeated previous mistake prioritized for targeted remediation";
        } else if (qHist.lastResult === "incorrect") {
          selectionScore += 30;
          reason = "Previously missed question included for foundational correction";
        } else if (qHist.lastResult === "unattempted") {
          selectionScore += 20;
          reason = "Foundational unattempted question to establish basic competency";
        } else if (qHist.lastResult === "correct") {
          // Deprioritize recently correct questions during a FIX session
          selectionScore -= 25;
        }
        break;
      }

      case "REINFORCE": {
        // Developing skill: prefers medium questions and single mistakes
        if (diff === "medium") selectionScore += 35;
        else if (diff === "easy") selectionScore += 20;
        else if (diff === "hard") selectionScore += 10;

        if (qHist.lastResult === "incorrect") {
          selectionScore += 35;
          reason = "Recent incorrect attempt queued for reinforcement";
        } else if (qHist.lastResult === "unattempted") {
          selectionScore += 25;
          reason = "Core topic question to broaden skill depth";
        } else if (qHist.isRepeatedCorrect) {
          // Repeatedly correct moved toward review rather than daily drilling
          selectionScore -= 20;
        }
        break;
      }

      case "REVIEW": {
        // Spaced maintenance: prefers medium/hard and questions answered correctly previously
        if (diff === "medium") selectionScore += 30;
        else if (diff === "hard") selectionScore += 35;
        else if (diff === "easy") selectionScore += 10;

        if (qHist.isRepeatedCorrect) {
          // If attempted today (< 1 day ago), deprioritize; if spaced (>= 3 days), boost!
          if (qHist.recencyDays !== null && qHist.recencyDays >= 3) {
            selectionScore += 45;
            reason = `Spaced review question (${qHist.recencyDays} days since last mastery check)`;
          } else if (qHist.recencyDays === 0) {
            selectionScore -= 35; // Don't repeat what was just answered correctly today
          }
        } else if (qHist.lastResult === "unattempted") {
          selectionScore += 15;
          reason = "Advanced concept probe for topic maintenance";
        }
        break;
      }

      case "REASSESS": {
        // Diagnostic benchmark spread
        if (diff === "medium") selectionScore += 30;
        else if (diff === "easy") selectionScore += 20;
        else if (diff === "hard") selectionScore += 20;

        if (qHist.lastResult === "unattempted") {
          selectionScore += 30;
          reason = "Unattempted question selected for unbiased reassessment";
        } else if (qHist.recencyDays !== null && qHist.recencyDays >= 2) {
          selectionScore += 20;
          reason = "Reassessment probe to verify retention";
        }
        break;
      }

      case "MIXED": {
        selectionScore += 20;
        break;
      }
    }

    // B. Target Relevance Boost
    if (isTargetRelevant) {
      selectionScore += 25;
    }

    // C. Recency Penalty (Deprioritize questions taken today unless needed)
    if (qHist.recencyDays === 0 && qHist.lastResult === "correct") {
      selectionScore -= 30;
    }

    return {
      questionId: q.id,
      questionText: q.question,
      subjectId: q.subjectId,
      subjectCode: q.subjectCode,
      subjectName: q.subjectName,
      topicId: q.topicId,
      topicName: q.topicName,
      difficulty: diff,
      questionType: q.questionType,
      marks: q.marks,
      expectedTime: q.expectedTime,
      targetRelevance: isTargetRelevant,
      weaknessRelevance: hasRepeatedMistakes || (recentAccuracy !== null && recentAccuracy < 60),
      history: qHist,
      selectionReason: reason,
      selectionScore,
      sequenceOrder: 0,
    };
  });

  // 7. Deterministic Ordering & Tie-Breaking
  // Sort primarily by selectionScore descending.
  // Tie-breakers: topicId -> difficultyRank -> lastAttemptedAt -> questionId
  const diffOrder: Record<QuestionDifficultyLevel, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
    unknown: 4,
  };

  scoredCandidates.sort((a, b) => {
    if (b.selectionScore !== a.selectionScore) {
      return b.selectionScore - a.selectionScore;
    }
    const diffDiff = diffOrder[a.difficulty] - diffOrder[b.difficulty];
    if (diffDiff !== 0) return diffDiff;
    // Tie break by questionId bitwise
    return a.questionId.localeCompare(b.questionId);
  });

  // 8. Pool Limiting & Diversity Protection (Zero Fabrication)
  // Take up to requestedCount. If pool has fewer, return available count honestly!
  const finalCount = Math.min(requestedCount, scoredCandidates.length);
  const selectedSlice = scoredCandidates.slice(0, finalCount);

  // 9. Intentional Question Sequencing
  // FIX: Foundational/Easy -> Medium -> Challenge
  // REINFORCE: Easy -> Medium -> Challenge
  // REVIEW: Medium -> Challenge -> Easy
  // REASSESS: Distributed diagnostic spread
  if (objective === "FIX" || objective === "REINFORCE") {
    selectedSlice.sort((a, b) => {
      const diffComp = diffOrder[a.difficulty] - diffOrder[b.difficulty];
      if (diffComp !== 0) return diffComp;
      if (b.selectionScore !== a.selectionScore) {
        return b.selectionScore - a.selectionScore;
      }
      return a.questionId.localeCompare(b.questionId);
    });
  } else if (objective === "REVIEW") {
    // Challenge/Medium first, then foundational
    selectedSlice.sort((a, b) => {
      const rankA = a.difficulty === "hard" ? 1 : a.difficulty === "medium" ? 2 : 3;
      const rankB = b.difficulty === "hard" ? 1 : b.difficulty === "medium" ? 2 : 3;
      if (rankA !== rankB) return rankA - rankB;
      if (b.selectionScore !== a.selectionScore) {
        return b.selectionScore - a.selectionScore;
      }
      return a.questionId.localeCompare(b.questionId);
    });
  }

  // Assign sequence numbers 1-indexed
  selectedSlice.forEach((q, idx) => {
    q.sequenceOrder = idx + 1;
  });

  // 10. Generate Transparent Rationale & Non-Causal Explanation
  let rationale = `Selected based on current preparation schedule for ${resolvedTopic?.name || "practice topic"}.`;
  if (hasRepeatedMistakes) {
    rationale = `Selected because ${resolvedTopic?.name || "this topic"} has repeated incorrect attempts in recent assessments.`;
  } else if (recentAccuracy !== null && recentAccuracy < 50) {
    rationale = `Selected because ${resolvedTopic?.name || "this topic"} recent accuracy is ${recentAccuracy}%, below the placement benchmark.`;
  } else if (recentAccuracy !== null && recentAccuracy >= 75) {
    rationale = `Selected for spaced retention review following demonstrated proficiency (${recentAccuracy}% accuracy).`;
  }

  const targetAlignmentNote = isTargetRelevant && targetInfo.targetRole
    ? `Aligned with core technical requirements for ${targetInfo.targetRole}.`
    : null;

  return {
    objective,
    topicId: resolvedTopic?.id || null,
    topicName: resolvedTopic?.name || null,
    subjectCode: resolvedTopic?.subjectCode || subjectCode || null,
    requestedCount,
    availableCount: validPool.length,
    selectedQuestions: selectedSlice,
    evidence: {
      recentAccuracy,
      historicalBaseline: recentAccuracy,
      attemptCount,
      hasRepeatedMistakes,
      repeatedMistakeNote,
    },
    explanation: {
      headline: `Practice Question Set: ${resolvedTopic?.name || "Targeted"} [${objective}]`,
      rationale,
      targetAlignmentNote,
    },
  };
}

// ============================================================================
// 5. PRACTICE RECOMMENDATIONS AGGREGATOR
// ============================================================================

/**
 * Generates proactive practice recommendations by combining Phase 23 intelligence
 * and Phase 24 study plan items.
 */
export async function getPracticeRecommendations(
  userId: string
): Promise<PracticeRecommendation[]> {
  if (!userId || userId.trim() === "") {
    return [];
  }

  const recommendations: PracticeRecommendation[] = [];
  const seenTopicIds = new Set<string>();

  // 1. Ingest Phase 24 Today's plan if available
  try {
    const planView = await getActiveStudyPlan(userId);
    if (planView.todaySchedule?.items) {
      for (const item of planView.todaySchedule.items) {
        if (item.topicId && !seenTopicIds.has(item.topicId)) {
          seenTopicIds.add(item.topicId);

          const objective: PracticeObjective =
            item.category === "FIX"
              ? "FIX"
              : item.category === "REINFORCE"
              ? "REINFORCE"
              : item.category === "REVIEW"
              ? "REVIEW"
              : "REASSESS";

          recommendations.push({
            topicId: item.topicId,
            topicName: item.topic,
            subjectCode: item.domain,
            subjectName: item.domain,
            objective,
            suggestedCount: item.estimatedMinutes <= 15 ? 5 : 10,
            estimatedMinutes: item.estimatedMinutes,
            targetRelevance: false,
            evidence: {
              recentAccuracy: null,
              historicalBaseline: null,
              attemptCount: 0,
              hasRepeatedMistakes: false,
              repeatedMistakeNote: null,
            },
            rationale: item.reason || `Scheduled preparation for ${item.topic}.`,
            questionSequencePreview: [
              { order: 1, difficulty: "easy", label: "Foundational" },
              { order: 2, difficulty: "medium", label: "Core Concept" },
              { order: 3, difficulty: "medium", label: "Practice Drill" },
            ],
            planItemId: item.id,
          });
        }
      }
    }
  } catch {
    // Continue if planner lookup fails
  }

  // 2. Ingest Student Question History (Repeated Mistakes & Low Accuracy Topics)
  try {
    const { topicMap } = await getStudentQuestionHistory(userId);
    const targetInfo = await getTargetRelevantTopics(userId);

    for (const [topId, tStat] of topicMap.entries()) {
      if (recommendations.length >= 6) break;
      if (!seenTopicIds.has(topId)) {
        seenTopicIds.add(topId);

        const objective: PracticeObjective =
          tStat.hasRepeatedMistakes || (tStat.accuracy !== null && tStat.accuracy < 50)
            ? "FIX"
            : tStat.accuracy !== null && tStat.accuracy < 75
            ? "REINFORCE"
            : "REVIEW";

        recommendations.push({
          topicId: topId,
          topicName: tStat.topicName,
          subjectCode: tStat.subjectCode,
          subjectName: tStat.subjectCode,
          objective,
          suggestedCount: 10,
          estimatedMinutes: 25,
          targetRelevance: targetInfo.relevantSubjectCodes.has(tStat.subjectCode),
          evidence: {
            recentAccuracy: tStat.accuracy,
            historicalBaseline: tStat.accuracy,
            attemptCount: tStat.attemptCount,
            hasRepeatedMistakes: tStat.hasRepeatedMistakes,
            repeatedMistakeNote: tStat.mistakeStatement,
          },
          rationale:
            tStat.mistakeStatement ||
            (tStat.accuracy !== null && tStat.accuracy < 60
              ? `Recent accuracy (${tStat.accuracy}%) indicates developing concept proficiency.`
              : `Maintenance review for validated topic.`),
          questionSequencePreview: [
            { order: 1, difficulty: "easy", label: "Foundational Check" },
            { order: 2, difficulty: "medium", label: "Core Reinforcement" },
            { order: 3, difficulty: "hard", label: "Proficiency Verification" },
          ],
        });
      }
    }
  } catch {
    // Continue if history lookup fails
  }

  // 3. Ingest Phase 23 Intelligence Focus Areas
  try {
    const intel = await getPlacementIntelligence2(userId);
    const targetInfo = await getTargetRelevantTopics(userId);

    for (const prio of intel.priorities) {
      if (recommendations.length >= 6) break;

      // Locate topicId for priority with flexible matching
      const topicRows = await db
        .select({
          id: topics.id,
          name: topics.name,
          subjectCode: subjects.code,
          subjectName: subjects.name,
        })
        .from(topics)
        .innerJoin(subjects, eq(topics.subjectId, subjects.id))
        .where(
          sql`lower(${topics.name}) = lower(${prio.title}) OR lower(${topics.name}) LIKE lower(${prio.title}) || '%' OR lower(${prio.title}) LIKE lower(${topics.name}) || '%'`
        )
        .limit(1);

      if (topicRows.length > 0) {
        const top = topicRows[0];
        if (!seenTopicIds.has(top.id)) {
          seenTopicIds.add(top.id);

          const objective: PracticeObjective =
            prio.level === "CRITICAL" ? "FIX" : prio.level === "HIGH" ? "REINFORCE" : "REVIEW";

          recommendations.push({
            topicId: top.id,
            topicName: top.name,
            subjectCode: top.subjectCode,
            subjectName: top.subjectName,
            objective,
            suggestedCount: 10,
            estimatedMinutes: 25,
            targetRelevance: targetInfo.relevantSubjectCodes.has(top.subjectCode),
            evidence: {
              recentAccuracy: null,
              historicalBaseline: null,
              attemptCount: 0,
              hasRepeatedMistakes: false,
              repeatedMistakeNote: null,
            },
            rationale: prio.why || `Priority focus on ${top.name}.`,
            questionSequencePreview: [
              { order: 1, difficulty: "easy", label: "Diagnostic Check" },
              { order: 2, difficulty: "medium", label: "Core Reinforcement" },
              { order: 3, difficulty: "hard", label: "Proficiency Verification" },
            ],
          });
        }
      }
    }
  } catch {
    // Continue if intelligence lookup fails
  }

  return recommendations;
}

// ============================================================================
// 6. MATERIALIZE PRACTICE SESSION (PHASE 15 INTEGRATION)
// ============================================================================

/**
 * Creates or retrieves a personalized practice test populated with the selected questions,
 * ready for exam engine execution.
 */
export async function materializePracticeSession(params: {
  userId: string;
  topicId?: string;
  subjectCode?: string;
  objective?: PracticeObjective;
  requestedCount?: number;
  planItemId?: string;
}): Promise<{
  testId: string;
  title: string;
  duration: number;
  questionCount: number;
  questions: QuestionCandidate[];
  explanation: SelectionResult["explanation"];
  emptyState?: SelectionResult["emptyState"];
}> {
  const selection = await selectPersonalizedQuestions(params);

  if (selection.emptyState || selection.selectedQuestions.length === 0) {
    return {
      testId: "",
      title: "Practice Unavailable",
      duration: 0,
      questionCount: 0,
      questions: [],
      explanation: selection.explanation,
      emptyState: selection.emptyState || {
        type: "no_questions_for_topic",
        message: "No questions available for this practice session.",
      },
    };
  }

  const topicName = selection.topicName || "Fundamentals";
  const subjectCode = selection.subjectCode || "CS";
  const practiceTitle = `Practice: ${subjectCode} — ${topicName} [${selection.objective}]`;

  // Determine duration: ~2-2.5 min per question (bounded 10 - 30 min)
  const duration = Math.max(10, Math.min(30, Math.round(selection.selectedQuestions.length * 2.5)));
  const totalMarks = selection.selectedQuestions.reduce((sum, q) => sum + (q.marks || 2), 0);

  // 1. Check if an identical published practice test already exists in DB
  const [existingTest] = await db
    .select({
      id: tests.id,
      title: tests.title,
      duration: tests.duration,
    })
    .from(tests)
    .where(eq(tests.title, practiceTitle))
    .limit(1);

  let targetTestId = existingTest?.id;

  if (!targetTestId) {
    // 2. Create the practice test in tests table
    const [createdTest] = await db
      .insert(tests)
      .values({
        title: practiceTitle,
        description: `Personalized ${selection.objective} practice session focusing on ${topicName} (${subjectCode}).`,
        type: subjectCode === "APT" ? "aptitude" : "cs_fundamentals",
        duration,
        difficulty: selection.objective === "FIX" ? "easy" : selection.objective === "REVIEW" ? "hard" : "medium",
        totalMarks,
        isPublished: true,
        status: "published",
      })
      .returning();

    targetTestId = createdTest.id;

    // Create primary section
    const [createdSection] = await db
      .insert(testSections)
      .values({
        testId: createdTest.id,
        title: `${subjectCode} — ${topicName}`,
        sectionOrder: 1,
      })
      .returning();

    // Link selected questions with their deterministic sequence
    for (let i = 0; i < selection.selectedQuestions.length; i++) {
      const q = selection.selectedQuestions[i];
      await db.insert(testQuestions).values({
        testId: createdTest.id,
        questionId: q.questionId,
        sectionId: createdSection.id,
        questionOrder: i + 1,
      });
    }
  }

  // 3. If planItemId was provided, link the execution action to the study plan item
  if (params.planItemId) {
    try {
      await db
        .update(studyPlanItems)
        .set({
          executionActionId: targetTestId,
          metadata: {
            ctaHref: `/tests/${targetTestId}`,
          },
        })
        .where(
          and(
            eq(studyPlanItems.id, params.planItemId),
            eq(studyPlanItems.userId, params.userId)
          )
        );
    } catch {
      // Non-blocking
    }
  }

  return {
    testId: targetTestId,
    title: practiceTitle,
    duration,
    questionCount: selection.selectedQuestions.length,
    questions: selection.selectedQuestions,
    explanation: selection.explanation,
  };
}
