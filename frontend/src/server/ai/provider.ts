/**
 * NAIRA Phase 26 — AI Provider Abstraction
 * 
 * Defines the core interfaces, schemas, and standardized error codes
 * for LLM providers (Groq, mock, or future providers).
 */

import { z } from "zod";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AIErrorCode =
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_RATE_LIMITED"
  | "AI_CONFIGURATION_ERROR"
  | "AI_RESPONSE_INVALID";

export class AIProviderError extends Error {
  public readonly code: AIErrorCode;
  public readonly status: number;
  public readonly isOperational: boolean;

  constructor(code: AIErrorCode, message: string, status = 500) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.status = status;
    this.isOperational = true;
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }
}

/**
 * Structured schema for each live turn in an interview
 */
export const InterviewAIResponseSchema = z.object({
  message: z.string().min(1, "Message content is required"),
  nextQuestion: z.string().optional(),
  feedback: z.string().optional(),
  detectedTopics: z.array(z.string()).optional().default([]),
  followUpRequired: z.boolean().optional(),
  evaluation: z
    .object({
      clarity: z.number().min(1).max(5).optional(),
      completeness: z.number().min(1).max(5).optional(),
      technicalDepth: z.number().min(1).max(5).optional(),
      relevance: z.number().min(1).max(5).optional(),
      communication: z.number().min(1).max(5).optional(),
    })
    .optional(),
});

export type InterviewAIResponse = z.infer<typeof InterviewAIResponseSchema>;

/**
 * Structured schema for the comprehensive end-of-interview evaluation
 */
export const InterviewEvaluationOutputSchema = z.object({
  overallSummary: z.string().min(1, "Overall summary is required"),
  strengths: z.array(z.string()).min(1, "At least one strength must be identified"),
  improvements: z.array(z.string()).min(1, "At least one improvement area must be identified"),
  qualitativeScores: z.object({
    clarity: z.number().min(1).max(5),
    completeness: z.number().min(1).max(5),
    technicalDepth: z.number().min(1).max(5),
    relevance: z.number().min(1).max(5),
    communication: z.number().min(1).max(5),
  }),
  nonCausalObservations: z.array(z.string()).optional().default([]),
});

export type InterviewEvaluationOutput = z.infer<typeof InterviewEvaluationOutputSchema>;

/**
 * Abstract AI Provider interface
 */
export interface AIProvider {
  readonly name: string;
  generateResponse(messages: AIMessage[], options?: { jsonMode?: boolean }): Promise<string>;
  generateInterviewTurn(messages: AIMessage[]): Promise<InterviewAIResponse>;
  evaluateInterview(
    contextSummary: string,
    transcript: { role: string; content: string }[]
  ): Promise<InterviewEvaluationOutput>;
}
