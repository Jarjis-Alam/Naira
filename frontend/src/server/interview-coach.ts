/**
 * NAIRA Phase 26 — AI Interview Coach Engine
 * 
 * Orchestrates deterministic context building across completed phases (16, 17, 18, 20, 23, 24, 25),
 * manages interview sessions and turns with strict student ownership isolation,
 * integrates with the AI Provider abstraction (Groq / Mock), and enforces
 * Phase 20 non-causal safety.
 */

import { db } from "@/db";
import {
  interviewSessions,
  interviewTurns,
  interviewEvaluations,
  type InterviewSession,
  type InterviewTurn,
  type InterviewEvaluation,
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  getAIProvider,
  AIMessage,
  AIProviderError,
  INTERVIEWER_SYSTEM_PROMPT,
  buildInterviewerTurnPrompt,
} from "./ai";

// Cross-phase intelligence integrations
import { getPlacementTargetStrategy } from "./placement-target-strategy";
import { getResumeWorkspace } from "./resume-intelligence";
import { getPlacementIntelligence2 } from "./placement-intelligence-2";
import { getStudentQuestionHistory } from "./practice-question-intelligence";
import { getStudentSimulationHistory } from "./placement-simulation";

export type InterviewType = "TECHNICAL" | "HR" | "MIXED" | "ROLE_SPECIFIC";
export type InterviewSessionStatus = "CREATED" | "ACTIVE" | "COMPLETED" | "ABANDONED";

export interface StartInterviewParams {
  userId: string;
  interviewType: InterviewType;
  targetRoleId?: string;
  targetRoleName?: string;
  companyName?: string;
  focusArea?: string;
  maxTurns?: number;
}

export interface SendInterviewMessageParams {
  sessionId: string;
  userId: string;
  message: string;
}

export interface CompleteInterviewParams {
  sessionId: string;
  userId: string;
}

export interface GroundedContext {
  targetRole: string;
  targetCompany?: string;
  requirements: string[];
  resumeSkills: {
    asserted: string[];
    detected: string[];
  };
  performanceDimensions: {
    strengths: string[];
    weaknesses: string[];
  };
  practiceDeficits: string[];
  simulationScores?: {
    technical?: number;
    hr?: number;
  };
  summaryText: string;
}

// In-memory sliding-window rate limiter (30 requests/minute per user)
const userMessageTimestamps = new Map<string, number[]>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  const timestamps = userMessageTimestamps.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    throw new AIProviderError(
      "AI_RATE_LIMITED",
      "Rate limit exceeded. You can send at most 30 messages per minute.",
      429
    );
  }

  validTimestamps.push(now);
  userMessageTimestamps.set(userId, validTimestamps);
}

/**
 * Phase 20 Non-Causal Safety Guard:
 * Scans text against prohibited causal patterns and sanitizes them.
 */
const BANNED_CAUSAL_PATTERNS = [
  /\bcaused rejection\b/gi,
  /\bcaused by\b/gi,
  /\bbecause of your lack of\b/gi,
  /\byou failed because\b/gi,
  /\byou don't understand\b/gi,
  /\bdue to lack of\b/gi,
  /\bresulted in your rejection\b/gi,
];

export function sanitizeNonCausalText(input: string): string {
  let sanitized = input;
  for (const pattern of BANNED_CAUSAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, "associated with observed area for development in");
  }
  return sanitized;
}

/**
 * Deterministically constructs student background context across NAIRA phases.
 * Enforces zero fabrication: labels data provenance clearly.
 */
export async function buildInterviewContext(
  userId: string,
  overrides?: { targetRoleId?: string; targetRoleName?: string; companyName?: string }
): Promise<GroundedContext> {
  // 1. Phase 16: Target Strategy
  let targetRoleName = overrides?.targetRoleName || "Software Engineer";
  let targetCompany = overrides?.companyName;
  const requirements: string[] = [];

  try {
    const targetStrategy = await getPlacementTargetStrategy(userId);
    if (targetStrategy?.target?.primaryRole) {
      targetRoleName = targetStrategy.target.primaryRole.name;
    }
    if (!targetCompany && targetStrategy?.target?.primaryCompany) {
      targetCompany = targetStrategy.target.primaryCompany.name;
    }
    if (targetStrategy?.requirements?.domains) {
      requirements.push(...targetStrategy.requirements.domains.map((d) => d.domainName));
    }
  } catch {
    // Graceful fallback to default role
  }

  // 2. Phase 18: Resume Skills (Asserted vs Detected)
  const resumeSkills = {
    asserted: [] as string[],
    detected: [] as string[],
  };

  try {
    const resumeWorkspace = await getResumeWorkspace(userId);
    if (resumeWorkspace.primaryVariant?.structured) {
      const s = resumeWorkspace.primaryVariant.structured;
      resumeSkills.detected = s.skills?.detected || [];
      resumeSkills.asserted = s.skills?.groups?.flatMap((g) => g.skills) || [];
    }
  } catch {
    // Fallback if no resume exists yet
  }

  // 3. Phase 23: Multidimensional Intelligence (Strengths & Weaknesses)
  const performanceDimensions = {
    strengths: [] as string[],
    weaknesses: [] as string[],
  };

  try {
    const intel2 = await getPlacementIntelligence2(userId);
    performanceDimensions.strengths = intel2.strengths.map((s) => s.title);
    performanceDimensions.weaknesses = intel2.weaknesses.map((w) => w.title);
  } catch {
    // Fallback if no assessment taken
  }

  // 4. Phase 25: Practice Deficits (Repeated Mistakes)
  const practiceDeficits: string[] = [];
  try {
    const questionHistory = await getStudentQuestionHistory(userId);
    for (const [, topic] of questionHistory.topicMap.entries()) {
      if (topic.hasRepeatedMistakes) {
        practiceDeficits.push(topic.topicName);
      }
    }
  } catch {
    // Fallback
  }

  // 5. Phase 17: Simulation Scores
  const simulationScores: { technical?: number; hr?: number } = {};
  try {
    const simHistory = await getStudentSimulationHistory(userId);
    if (Array.isArray(simHistory) && simHistory.length > 0) {
      const completedSim = simHistory.find(
        (s) => s.status === "completed" && s.interviewScore !== null
      );
      if (completedSim && completedSim.interviewScore !== null) {
        simulationScores.technical = completedSim.interviewScore;
      }
    }
  } catch {
    // Fallback
  }

  // Build compact text summary for LLM context grounding
  const lines: string[] = [
    `TARGET ROLE: ${targetRoleName} ${targetCompany ? `(Targeting: ${targetCompany})` : ""}`,
  ];

  if (requirements.length > 0) {
    lines.push(`ROLE REQUIREMENTS: ${requirements.slice(0, 6).join(", ")}`);
  }

  if (resumeSkills.detected.length > 0) {
    lines.push(`[RESUME_DETECTED] SKILLS: ${resumeSkills.detected.slice(0, 8).join(", ")}`);
  } else if (resumeSkills.asserted.length > 0) {
    lines.push(`[STUDENT_ASSERTED] SKILLS: ${resumeSkills.asserted.slice(0, 8).join(", ")}`);
  } else {
    lines.push(`[EVIDENCE NOTE]: No verified resume skills recorded yet. Focus questions on foundational concepts.`);
  }

  if (performanceDimensions.weaknesses.length > 0) {
    lines.push(`[SYSTEM_OBSERVED] FOCUS TOPICS: ${performanceDimensions.weaknesses.slice(0, 4).join(", ")}`);
  }

  if (practiceDeficits.length > 0) {
    lines.push(`[SYSTEM_OBSERVED] TOPICS WITH REPEATED PRACTICE GAPS: ${practiceDeficits.slice(0, 3).join(", ")}`);
  }

  lines.push(
    `ZERO FABRICATION INSTRUCTION: The above items represent the ONLY verified background data for this student. Do not invent project names, past employers, years of work experience, or achievements.`
  );

  const summaryText = lines.join("\n");

  return {
    targetRole: targetRoleName,
    targetCompany,
    requirements,
    resumeSkills,
    performanceDimensions,
    practiceDeficits,
    simulationScores,
    summaryText,
  };
}

/**
 * Starts a new AI Interview Coach Session.
 */
export async function startInterviewSession(params: StartInterviewParams): Promise<{
  session: InterviewSession;
  firstQuestion: string;
}> {
  if (!params.userId) {
    throw new AIProviderError("AI_CONFIGURATION_ERROR", "User ID is required.", 400);
  }

  // Build deterministic grounded context
  const context = await buildInterviewContext(params.userId, {
    targetRoleId: params.targetRoleId,
    targetRoleName: params.targetRoleName,
    companyName: params.companyName,
  });

  const provider = getAIProvider();
  const maxTurns = Math.min(Math.max(params.maxTurns || 10, 4), 15);

  // Generate the opening interviewer turn
  const openingPromptMessages: AIMessage[] = [
    { role: "system", content: INTERVIEWER_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Please start the interview.
STUDENT CONTEXT:
${context.summaryText}

INTERVIEW CONFIGURATION:
${buildInterviewerTurnPrompt(params.interviewType, context.targetRole, params.focusArea)}

Provide the opening greeting and your first single question.`,
    },
  ];

  const openingTurn = await provider.generateInterviewTurn(openingPromptMessages);
  const sanitizedFirstQuestion = sanitizeNonCausalText(openingTurn.message);

  // Create session in database
  const [session] = await db
    .insert(interviewSessions)
    .values({
      userId: params.userId,
      targetRoleId: params.targetRoleId,
      targetRoleName: context.targetRole,
      companyName: context.targetCompany,
      interviewType: params.interviewType,
      status: "ACTIVE",
      currentRound: 1,
      turnCount: 1,
      maxTurns,
      focusArea: params.focusArea,
      deterministicContext: context,
      provider: provider.name,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      startedAt: new Date(),
    })
    .returning();

  // Create initial interviewer turn
  await db.insert(interviewTurns).values({
    sessionId: session.id,
    userId: params.userId,
    turnNumber: 1,
    role: "interviewer",
    content: sanitizedFirstQuestion,
    qualitativeFeedback: openingTurn.feedback ? sanitizeNonCausalText(openingTurn.feedback) : null,
    detectedTopics: openingTurn.detectedTopics || [],
  });

  return {
    session,
    firstQuestion: sanitizedFirstQuestion,
  };
}

/**
 * Sends a student response to an active interview and receives the interviewer's next turn.
 */
export async function sendInterviewMessage(params: SendInterviewMessageParams): Promise<{
  interviewerResponse: string;
  turnCount: number;
  feedback?: string;
  isComplete: boolean;
}> {
  if (!params.message || params.message.trim().length === 0) {
    throw new AIProviderError("AI_RESPONSE_INVALID", "Message cannot be empty.", 400);
  }

  if (params.message.length > 2000) {
    throw new AIProviderError(
      "AI_RESPONSE_INVALID",
      "Message exceeds maximum allowed length of 2,000 characters.",
      400
    );
  }

  checkRateLimit(params.userId);

  // Fetch session with strict ownership check
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, params.sessionId), eq(interviewSessions.userId, params.userId)))
    .limit(1);

  if (!session) {
    throw new AIProviderError("AI_CONFIGURATION_ERROR", "Interview session not found or access denied.", 404);
  }

  if (session.status !== "ACTIVE") {
    throw new AIProviderError(
      "AI_CONFIGURATION_ERROR",
      `Interview session is already ${session.status.toLowerCase()}.`,
      400
    );
  }

  if (session.turnCount >= session.maxTurns) {
    return {
      interviewerResponse: "We have reached the planned number of questions for this session. Please click 'Complete Interview' to receive your detailed qualitative evaluation.",
      turnCount: session.turnCount,
      isComplete: true,
    };
  }

  // Fetch recent conversation history (sliding window of last 6 turns to avoid context blowout)
  const existingTurns = await db
    .select()
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, session.id))
    .orderBy(asc(interviewTurns.turnNumber));

  const recentTurns = existingTurns.slice(-6);

  // Construct prompt messages
  const contextSummary =
    typeof session.deterministicContext === "object" && session.deterministicContext !== null
      ? (session.deterministicContext as { summaryText?: string }).summaryText || ""
      : "";

  const messages: AIMessage[] = [
    { role: "system", content: INTERVIEWER_SYSTEM_PROMPT },
    {
      role: "system",
      content: `STUDENT CONTEXT:\n${contextSummary}\n\nINTERVIEW CONFIGURATION:\n${buildInterviewerTurnPrompt(
        session.interviewType,
        session.targetRoleName,
        session.focusArea || undefined
      )}`,
    },
  ];

  for (const turn of recentTurns) {
    messages.push({
      role: turn.role === "interviewer" ? "assistant" : "user",
      content: turn.content,
    });
  }

  // Add the student's new incoming message
  messages.push({
    role: "user",
    content: params.message.trim(),
  });

  // Call AI Provider
  const provider = getAIProvider();
  const aiResponse = await provider.generateInterviewTurn(messages);

  const sanitizedMessage = sanitizeNonCausalText(aiResponse.message);
  const sanitizedFeedback = aiResponse.feedback ? sanitizeNonCausalText(aiResponse.feedback) : undefined;

  const studentTurnNumber = session.turnCount + 1;
  const interviewerTurnNumber = studentTurnNumber + 1;
  const isComplete = interviewerTurnNumber >= session.maxTurns;

  // Atomically persist both turns and update session
  await db.transaction(async (tx) => {
    // 1. Student turn
    await tx.insert(interviewTurns).values({
      sessionId: session.id,
      userId: params.userId,
      turnNumber: studentTurnNumber,
      role: "student",
      content: params.message.trim(),
    });

    // 2. Interviewer turn
    await tx.insert(interviewTurns).values({
      sessionId: session.id,
      userId: params.userId,
      turnNumber: interviewerTurnNumber,
      role: "interviewer",
      content: sanitizedMessage,
      qualitativeFeedback: sanitizedFeedback || null,
      detectedTopics: aiResponse.detectedTopics || [],
    });

    // 3. Update session
    await tx
      .update(interviewSessions)
      .set({
        turnCount: interviewerTurnNumber,
        updatedAt: new Date(),
      })
      .where(eq(interviewSessions.id, session.id));
  });

  return {
    interviewerResponse: sanitizedMessage,
    turnCount: interviewerTurnNumber,
    feedback: sanitizedFeedback,
    isComplete,
  };
}

/**
 * Retrieves an interview session, all its conversation turns, and evaluation if completed.
 */
export async function getInterviewSession(
  sessionId: string,
  userId: string
): Promise<{
  session: InterviewSession;
  turns: InterviewTurn[];
  evaluation: InterviewEvaluation | null;
}> {
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, userId)))
    .limit(1);

  if (!session) {
    throw new AIProviderError("AI_CONFIGURATION_ERROR", "Interview session not found or access denied.", 404);
  }

  const turns = await db
    .select()
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, sessionId))
    .orderBy(asc(interviewTurns.turnNumber));

  const [evaluation] = await db
    .select()
    .from(interviewEvaluations)
    .where(eq(interviewEvaluations.sessionId, sessionId))
    .limit(1);

  return {
    session,
    turns,
    evaluation: evaluation || null,
  };
}

/**
 * Completes an interview session and triggers comprehensive structured evaluation.
 */
export async function completeInterviewSession(params: CompleteInterviewParams): Promise<{
  session: InterviewSession;
  evaluation: InterviewEvaluation;
}> {
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, params.sessionId), eq(interviewSessions.userId, params.userId)))
    .limit(1);

  if (!session) {
    throw new AIProviderError("AI_CONFIGURATION_ERROR", "Interview session not found or access denied.", 404);
  }

  // Load all conversation turns
  const turns = await db
    .select()
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, session.id))
    .orderBy(asc(interviewTurns.turnNumber));

  const contextSummary =
    typeof session.deterministicContext === "object" && session.deterministicContext !== null
      ? (session.deterministicContext as { summaryText?: string }).summaryText || ""
      : "";

  const transcript = turns.map((t) => ({
    role: t.role,
    content: t.content,
  }));

  // Generate evaluation via AI Provider
  const provider = getAIProvider();
  const rawEval = await provider.evaluateInterview(contextSummary, transcript);

  // Sanitize all output through non-causal safety guard
  const sanitizedSummary = sanitizeNonCausalText(rawEval.overallSummary);
  const sanitizedStrengths = rawEval.strengths.map((s) => sanitizeNonCausalText(s));
  const sanitizedImprovements = rawEval.improvements.map((i) => sanitizeNonCausalText(i));
  const sanitizedObservations = rawEval.nonCausalObservations?.map((o) => sanitizeNonCausalText(o)) || [];

  // Upsert or insert evaluation
  const [evaluation] = await db
    .insert(interviewEvaluations)
    .values({
      sessionId: session.id,
      userId: params.userId,
      overallSummary: sanitizedSummary,
      strengths: sanitizedStrengths,
      improvements: sanitizedImprovements,
      qualitativeScores: rawEval.qualitativeScores,
      nonCausalObservations: sanitizedObservations,
      provenance: "AI_EVALUATION",
    })
    .returning();

  // Mark session COMPLETED
  const [updatedSession] = await db
    .update(interviewSessions)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, session.id))
    .returning();

  return {
    session: updatedSession,
    evaluation,
  };
}

/**
 * Lists the authenticated student's past interview sessions.
 */
export async function listInterviewHistory(userId: string): Promise<InterviewSession[]> {
  return db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, userId))
    .orderBy(desc(interviewSessions.createdAt));
}
