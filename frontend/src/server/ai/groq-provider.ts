/**
 * NAIRA Phase 26 — Groq AI Provider Implementation
 * 
 * Interacts with the Groq Cloud API via the official groq-sdk.
 * Enforces server-side secret isolation, controlled JSON parsing,
 * and robust mapping to standardized AIProviderError codes.
 */

import Groq from "groq-sdk";
import {
  AIProvider,
  AIMessage,
  AIProviderError,
  InterviewAIResponse,
  InterviewAIResponseSchema,
  InterviewEvaluationOutput,
  InterviewEvaluationOutputSchema,
} from "./provider";
import { EVALUATION_SYSTEM_PROMPT, buildEvaluationPrompt } from "./prompts";

export class GroqProvider implements AIProvider {
  public readonly name = "groq";
  private readonly defaultModel: string;
  private readonly apiKey?: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    this.defaultModel =
      defaultModel || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  }

  private getClient(): Groq {
    if (!this.apiKey) {
      throw new AIProviderError(
        "AI_PROVIDER_UNAVAILABLE",
        "Groq AI provider is unavailable because GROQ_API_KEY is not configured.",
        503
      );
    }

    return new Groq({ apiKey: this.apiKey });
  }

  /**
   * Translates unknown errors from the Groq SDK into standardized AIProviderError instances.
   */
  private handleError(error: unknown): never {
    if (error instanceof AIProviderError) {
      throw error;
    }

    const err = error as { status?: number; message?: string; error?: { message?: string } };
    const status = err?.status || 500;
    const msg = err?.error?.message || err?.message || "Unknown error occurred with AI provider";

    if (status === 401 || status === 403) {
      throw new AIProviderError(
        "AI_CONFIGURATION_ERROR",
        "AI provider authentication failed. Check API credentials.",
        status
      );
    }

    if (status === 429) {
      throw new AIProviderError(
        "AI_RATE_LIMITED",
        "AI interview rate limit reached. Please wait a moment before sending another message.",
        429
      );
    }

    if (status >= 500) {
      throw new AIProviderError(
        "AI_PROVIDER_UNAVAILABLE",
        "AI interview provider service is temporarily unavailable. Please try again later.",
        503
      );
    }

    throw new AIProviderError("AI_PROVIDER_UNAVAILABLE", msg, status);
  }

  async generateResponse(
    messages: AIMessage[],
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    const client = this.getClient();

    try {
      const response = await client.chat.completions.create({
        model: this.defaultModel,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 1024,
        response_format: options?.jsonMode ? { type: "json_object" } : undefined,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIProviderError(
          "AI_RESPONSE_INVALID",
          "AI provider returned an empty response.",
          502
        );
      }

      return content;
    } catch (error) {
      this.handleError(error);
    }
  }

  async generateInterviewTurn(messages: AIMessage[]): Promise<InterviewAIResponse> {
    const raw = await this.generateResponse(messages, { jsonMode: true });

    try {
      const parsedJson = JSON.parse(raw);
      const validated = InterviewAIResponseSchema.safeParse(parsedJson);

      if (!validated.success) {
        // Fallback: If model returned a message property but slight schema mismatch
        if (typeof parsedJson === "object" && parsedJson !== null && typeof parsedJson.message === "string") {
          return {
            message: parsedJson.message,
            nextQuestion: parsedJson.nextQuestion || parsedJson.message,
            feedback: parsedJson.feedback || undefined,
            detectedTopics: Array.isArray(parsedJson.detectedTopics) ? parsedJson.detectedTopics : [],
            followUpRequired: Boolean(parsedJson.followUpRequired),
          };
        }

        throw new AIProviderError(
          "AI_RESPONSE_INVALID",
          `Model output did not match interview schema: ${validated.error.message}`,
          502
        );
      }

      return validated.data;
    } catch (parseError) {
      if (parseError instanceof AIProviderError) throw parseError;
      throw new AIProviderError(
        "AI_RESPONSE_INVALID",
        "Failed to parse structured JSON from AI provider response.",
        502
      );
    }
  }

  async evaluateInterview(
    contextSummary: string,
    transcript: { role: string; content: string }[]
  ): Promise<InterviewEvaluationOutput> {
    const transcriptText = transcript
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join("\n\n");

    const messages: AIMessage[] = [
      { role: "system", content: EVALUATION_SYSTEM_PROMPT },
      { role: "user", content: buildEvaluationPrompt(contextSummary, transcriptText) },
    ];

    const raw = await this.generateResponse(messages, { jsonMode: true });

    try {
      const parsedJson = JSON.parse(raw);
      const validated = InterviewEvaluationOutputSchema.safeParse(parsedJson);

      if (!validated.success) {
        throw new AIProviderError(
          "AI_RESPONSE_INVALID",
          `Model evaluation output did not match schema: ${validated.error.message}`,
          502
        );
      }

      return validated.data;
    } catch (parseError) {
      if (parseError instanceof AIProviderError) throw parseError;
      throw new AIProviderError(
        "AI_RESPONSE_INVALID",
        "Failed to parse structured evaluation JSON from AI provider.",
        502
      );
    }
  }
}
