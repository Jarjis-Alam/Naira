/**
 * NAIRA Phase 26 — Mock AI Provider
 * 
 * Provides fully deterministic responses and error simulation capabilities
 * for automated unit and integration tests, ensuring zero dependence on live Groq API keys.
 */

import {
  AIProvider,
  AIMessage,
  AIProviderError,
  InterviewAIResponse,
  InterviewEvaluationOutput,
} from "./provider";

export class MockAIProvider implements AIProvider {
  public readonly name = "mock";
  private nextError: AIProviderError | null = null;
  private customResponse: InterviewAIResponse | null = null;
  private customEvaluation: InterviewEvaluationOutput | null = null;

  /**
   * Arm the mock provider to throw an error on the next call.
   */
  public simulateError(error: AIProviderError) {
    this.nextError = error;
  }

  /**
   * Supply a specific interview turn response for the next call.
   */
  public setCustomResponse(response: InterviewAIResponse | null) {
    this.customResponse = response;
  }

  /**
   * Supply a specific evaluation output for the next call.
   */
  public setCustomEvaluation(evaluation: InterviewEvaluationOutput | null) {
    this.customEvaluation = evaluation;
  }

  async generateResponse(
    messages: AIMessage[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: { jsonMode?: boolean }
  ): Promise<string> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }

    const lastMsg = messages[messages.length - 1]?.content || "";
    return JSON.stringify({
      message: `I acknowledge your response regarding "${lastMsg.slice(0, 30)}...". How would you approach scaling this architecture?`,
      nextQuestion: "How would you approach scaling this architecture?",
      feedback: "Clear high-level overview with good foundational principles.",
      detectedTopics: ["System Design", "Scalability"],
      followUpRequired: false,
    });
  }

  async generateInterviewTurn(messages: AIMessage[]): Promise<InterviewAIResponse> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }

    if (this.customResponse) {
      const res = this.customResponse;
      this.customResponse = null;
      return res;
    }

    // Default conversational response
    const lastUserMsg = messages
      .filter((m) => m.role === "user")
      .pop()?.content;

    if (!lastUserMsg) {
      // First turn / opening question
      return {
        message: "Hello! Welcome to your technical interview session. To start, could you walk me through a complex data structure or algorithm problem you recently solved, and how you analyzed its time complexity?",
        nextQuestion: "Could you walk me through a complex data structure or algorithm problem you recently solved, and how you analyzed its time complexity?",
        feedback: undefined,
        detectedTopics: ["DSA", "Complexity Analysis"],
        followUpRequired: false,
      };
    }

    return {
      message: "Thank you for that explanation. You mentioned hash collisions and load factors. How does a HashMap resolve collisions using open addressing versus separate chaining, and what are the trade-offs in cache locality?",
      nextQuestion: "How does a HashMap resolve collisions using open addressing versus separate chaining, and what are the trade-offs in cache locality?",
      feedback: "The candidate accurately defined time complexity and basic data structure operations.",
      detectedTopics: ["DSA", "Hash Tables", "System Performance"],
      followUpRequired: true,
      evaluation: {
        clarity: 4,
        completeness: 4,
        technicalDepth: 4,
        relevance: 5,
        communication: 4,
      },
    };
  }

  async evaluateInterview(
    _contextSummary: string,
    transcript: { role: string; content: string }[]
  ): Promise<InterviewEvaluationOutput> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }

    if (this.customEvaluation) {
      const res = this.customEvaluation;
      this.customEvaluation = null;
      return res;
    }

    return {
      overallSummary: `Candidate completed ${transcript.length} turns showing strong foundational knowledge and structured communication.`,
      strengths: [
        "Articulated technical concepts with clear terminology",
        "Structured answers logically before diving into implementation details",
        "Addressed algorithmic complexity proactively",
      ],
      improvements: [
        "Provide more concrete real-world examples when discussing architecture trade-offs",
        "Deepen exploration of edge cases under high concurrency",
      ],
      qualitativeScores: {
        clarity: 4,
        completeness: 4,
        technicalDepth: 3,
        relevance: 4,
        communication: 4,
      },
      nonCausalObservations: [
        `Candidate participated in ${transcript.length} discussion turns.`,
        "Responses adhered to structured technical reasoning across questions.",
      ],
    };
  }
}
