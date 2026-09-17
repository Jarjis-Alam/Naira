/**
 * NAIRA Phase 26 — AI Provider Module Index & Factory
 */

import { AIProvider } from "./provider";
import { GroqProvider } from "./groq-provider";
import { MockAIProvider } from "./mock-provider";

export * from "./provider";
export * from "./prompts";
export * from "./groq-provider";
export * from "./mock-provider";

let activeTestProvider: AIProvider | null = null;

/**
 * Injects a test provider for automated test suites.
 */
export function setAIProviderForTesting(provider: AIProvider | null): void {
  activeTestProvider = provider;
}

/**
 * Returns the active AI provider instance:
 * 1. Test provider if set
 * 2. GroqProvider if GROQ_API_KEY is configured
 * 3. MockAIProvider fallback if no key is present
 */
export function getAIProvider(): AIProvider {
  if (activeTestProvider) {
    return activeTestProvider;
  }

  if (process.env.GROQ_API_KEY) {
    return new GroqProvider();
  }

  // Graceful fallback for test or offline environments
  return new MockAIProvider();
}
