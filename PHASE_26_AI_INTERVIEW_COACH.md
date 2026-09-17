# NAIRA — Phase 26: AI Interview Coach Architecture & Operations

## Overview

Phase 26 introduces an AI-powered conversational interview layer to **NAIRA (Nexora / Placement OS)**, integrating the **Groq Cloud API** (`llama-3.3-70b-versatile` by default) via a decoupled provider abstraction.

The AI Interview Coach serves as an interaction and practice layer for university students preparing for campus placements. The deterministic NAIRA engine remains the sole authoritative source of truth for student readiness scores, eligibility, study plans, and diagnostic outcomes.

> **CRITICAL RESILIENCE INVARIANT**:
> **NAIRA remains 100% functional if the AI provider is unavailable.**
> If `GROQ_API_KEY` is missing, invalid, rate-limited, or encountering outages, all other NAIRA placement engines (Phases 14–25) continue operating seamlessly. The interview UI displays a graceful, user-friendly informational state without crashing or leaking infrastructure details.

---

## 1. Architectural Boundaries

```
DETERMINISTIC NAIRA ENGINE (Phases 14, 16, 17, 18, 20, 23, 24, 25)
                     ↓
         INTERVIEW CONTEXT ENGINE (Deterministic Grounding)
                     ↓
          AI PROVIDER ABSTRACTION (`AIProvider` Contract)
                     ↓
                   GROQ PROVIDER (`GroqProvider`)
                     ↓
       AI INTERVIEW COACH SESSION (`/interview`)
                     ↓
                   STUDENT
```

### Absolute Boundary Invariants:
1. **No Score Mutation**: The AI Interview Coach never alters the Phase 17 Readiness Simulation Score (Screening 20%, Coding 30%, Debugging 15%, Tech Interview 20%, HR 15%).
2. **Zero Fabrication**: The LLM context contains only verified, authenticated student data. If a skill, project, or company is absent from the student's record, the AI is explicitly instructed never to fabricate it.
3. **Phase 20 Non-Causal Safety**: Feedback and evaluations describe observable response characteristics and prohibit causal diagnosis (`caused rejection`, `because of your lack of`, `you failed because`, `you don't understand`).
4. **Interviewer Persona as Simulation**: The AI acts as a practice interview coach; it never claims to be an employee of an actual company, nor does it issue hiring or rejection predictions.

---

## 2. AI Provider Abstraction

The system decouples conversational business logic from Groq via the `AIProvider` contract in `src/server/ai/provider.ts`:

```typescript
export interface AIProvider {
  readonly name: string;
  generateResponse(messages: AIMessage[], options?: { jsonMode?: boolean }): Promise<string>;
  generateInterviewTurn(messages: AIMessage[]): Promise<InterviewAIResponse>;
  evaluateInterview(
    contextSummary: string,
    transcript: { role: string; content: string }[]
  ): Promise<InterviewEvaluationOutput>;
}
```

- **`GroqProvider`** (`src/server/ai/groq-provider.ts`): Implements `AIProvider` using the official `groq-sdk`. Operates strictly server-side with controlled JSON mode and error translation.
- **`MockAIProvider`** (`src/server/ai/mock-provider.ts`): In-memory deterministic implementation used in automated test suites and offline environments, ensuring CI has zero reliance on external network calls or secrets.
- **Provider Factory** (`src/server/ai/index.ts`): `getAIProvider()` yields the configured provider with automatic fallback.

---

## 3. Environment Variables & Configuration

Configure in `.env.local`:

```env
# Phase 26 — NAIRA AI Interview Coach (Groq API)
# API key for Groq Cloud (Server-side only, never committed or exposed to client)
GROQ_API_KEY=gsk_...

# Model selection (default: llama-3.3-70b-versatile, or llama-3.1-8b-instant)
GROQ_MODEL=llama-3.3-70b-versatile
```

### Security & Privacy Rules:
- `GROQ_API_KEY` is strictly accessed via server functions and API route handlers.
- The key is never returned in client JSON responses, never rendered into HTML, and never logged.
- Student conversation data is isolated per user; Student A can never access Student B's interview sessions.

---

## 4. Database Schema & Migration

### Migration: `0019_phase_26_ai_interview_coach.sql`
Registered in `src/db/migrations/meta/_journal.json` (Index 19).

### Tables & Enums:
1. **`ai_interview_type`** enum: `TECHNICAL`, `HR`, `MIXED`, `ROLE_SPECIFIC`
2. **`ai_interview_session_status`** enum: `CREATED`, `ACTIVE`, `COMPLETED`, `ABANDONED`
3. **`interview_sessions`**:
   - `id`: UUID Primary Key
   - `user_id`: UUID (Foreign Key to `users.id`, CASCADE)
   - `target_role_id`: UUID (Foreign Key to `roles.id`, SET NULL)
   - `target_role_name`: VARCHAR(255)
   - `company_name`: VARCHAR(255)
   - `interview_type`: `ai_interview_type`
   - `status`: `ai_interview_session_status` (Default: `ACTIVE`)
   - `turn_count`: INTEGER
   - `max_turns`: INTEGER (Default: 10, Capped at 15)
   - `focus_area`: VARCHAR(255)
   - `deterministic_context`: JSONB
   - `provider`: VARCHAR(64)
   - `model`: VARCHAR(128)
   - `started_at`, `completed_at`, `created_at`, `updated_at`
4. **`interview_turns`**:
   - `id`: UUID Primary Key
   - `session_id`: UUID (Foreign Key to `interview_sessions.id`, CASCADE)
   - `user_id`: UUID (Foreign Key to `users.id`, CASCADE)
   - `turn_number`: INTEGER
   - `role`: VARCHAR(32) (`interviewer` | `student`)
   - `content`: TEXT
   - `qualitative_feedback`: TEXT
   - `detected_topics`: JSONB
5. **`interview_evaluations`**:
   - `id`: UUID Primary Key
   - `session_id`: UUID Unique (Foreign Key to `interview_sessions.id`, CASCADE)
   - `user_id`: UUID (Foreign Key to `users.id`, CASCADE)
   - `overall_summary`: TEXT
   - `strengths`: JSONB (`string[]`)
   - `improvements`: JSONB (`string[]`)
   - `qualitative_scores`: JSONB (`clarity`, `completeness`, `technicalDepth`, `relevance`, `communication`)
   - `non_causal_observations`: JSONB (`string[]`)
   - `provenance`: VARCHAR(64) (`AI_EVALUATION`)

---

## 5. API Endpoints

All endpoints require authentication via NextAuth (`session.user.id`).

| Endpoint | Method | Purpose | Input / Payload |
|---|---|---|---|
| `/api/student/interview/start` | POST | Initialize interview & generate opening question | `{ interviewType, targetRoleId?, targetRoleName?, companyName?, focusArea?, maxTurns? }` |
| `/api/student/interview/[id]/message` | POST | Send student answer & receive next question | `{ message: string }` (Max 2,000 chars) |
| `/api/student/interview/[id]` | GET | Retrieve session, conversation turns, and evaluation | URL param `id` |
| `/api/student/interview/[id]/complete` | POST | Complete session & generate structured evaluation | URL param `id` |
| `/api/student/interview/history` | GET | List authenticated student's past sessions | — |

---

## 6. Rate Limiting & Cost Protection

- **Sliding-Window Rate Limiter**: 30 requests per minute per authenticated user (`AI_RATE_LIMITED`).
- **Input Character Bound**: Maximum 2,000 characters per message.
- **Turn Capping**: Configured per session (default 10 turns, maximum 15 turns). When reached, the session automatically transitions to completion.
- **Context Window Truncation**: Chat history is windowed to the last 6 turns to avoid context overflow and excessive token usage.

---

## 7. Failure & Error Handling

Errors are mapped to standardized `AIProviderError` codes:

| Code | HTTP Status | Trigger Condition | Handled Behavior |
|---|---|---|---|
| `AI_PROVIDER_UNAVAILABLE` | 503 | Missing `GROQ_API_KEY`, Groq outage (500/503), or network timeout | Informational banner in UI; system remains operational |
| `AI_RATE_LIMITED` | 429 | Exceeded 30 req/min or upstream Groq rate limit | Displays wait prompt to user without crashing session |
| `AI_CONFIGURATION_ERROR` | 401 / 403 / 404 | Bad API credentials or unauthorized cross-tenant access | Access denied (404/403) or credential alert |
| `AI_RESPONSE_INVALID` | 400 / 502 | Malformed JSON response or Zod schema validation failure | Error returned gracefully without persisting corrupt turns |

---

## 8. Deployment & Rollback

- **Deploy Pre-check**: `npm run verify:schema` runs automatically on `prebuild` to verify database table and enum parity.
- **Database Migration**: Run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/db/migrations/0019_phase_26_ai_interview_coach.sql`.
- **Rollback Consideration**: If Phase 26 needs to be rolled back, the navigation item can be hidden from `src/components/layout/sidebar.tsx`. Database tables are strictly additive and will not affect previous phases.
