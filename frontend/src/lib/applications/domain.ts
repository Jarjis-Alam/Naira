/**
 * Phase 19 — Placement Application OS domain model.
 *
 * Pure, deterministic application-lifecycle logic: status set, legal
 * transitions, checklist derivation, and deadline display. This module knows
 * nothing about the database; the service layer owns persistence and
 * integration with Phases 14–18.
 *
 * Fabrication rules honoured here:
 *  - A checklist item is only complete when the underlying application state
 *    actually proves it (a row exists, a JD was attached, an ATS score is
 *    stored) — never because a page was opened.
 *  - Deadline math is display-only; nothing invents a date.
 */

// ============================================================================
// Statuses and transitions
// ============================================================================

export const APPLICATION_STATUSES = [
  "INTERESTED",
  "ELIGIBLE",
  "APPLIED",
  "ASSESSMENT",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "CLOSED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  "REJECTED",
  "WITHDRAWN",
  "CLOSED",
]);

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Legal forward/backward transitions between non-terminal statuses, plus
 * explicit exits to terminal statuses. Anything not listed is forbidden —
 * e.g. INTERESTED → OFFER must pass through APPLIED first, and a terminal
 * application can only move again via the explicit reopen transition.
 */
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  INTERESTED: ["ELIGIBLE", "APPLIED", "REJECTED", "WITHDRAWN", "CLOSED"],
  ELIGIBLE: ["APPLIED", "REJECTED", "WITHDRAWN", "CLOSED"],
  APPLIED: ["ASSESSMENT", "SHORTLISTED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "CLOSED"],
  ASSESSMENT: ["SHORTLISTED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "CLOSED"],
  SHORTLISTED: ["INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "CLOSED"],
  INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN", "CLOSED"],
  OFFER: ["REJECTED", "WITHDRAWN", "CLOSED"],
  REJECTED: [],
  WITHDRAWN: [],
  CLOSED: [],
};

/** From a terminal status the only allowed move is reopening (see below). */
export const REOPEN_TARGETS: readonly ApplicationStatus[] = [
  "INTERESTED",
  "ELIGIBLE",
  "APPLIED",
  "ASSESSMENT",
  "SHORTLISTED",
  "INTERVIEW",
];

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return false;
  if (isTerminalStatus(from)) {
    return REOPEN_TARGETS.includes(to);
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function listTransitions(from: ApplicationStatus): ApplicationStatus[] {
  if (isTerminalStatus(from)) return [...REOPEN_TARGETS];
  return [...ALLOWED_TRANSITIONS[from]];
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  INTERESTED: "Interested",
  ELIGIBLE: "Eligible",
  APPLIED: "Applied",
  ASSESSMENT: "Assessment",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  CLOSED: "Closed",
};

/** Pipeline display order for cards and counts. */
export const PIPELINE_ORDER: readonly ApplicationStatus[] = [
  "INTERESTED",
  "ELIGIBLE",
  "APPLIED",
  "ASSESSMENT",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "CLOSED",
];

/** Statuses counted as "active" in the dashboard headline. */
export const ACTIVE_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  "INTERESTED",
  "ELIGIBLE",
  "APPLIED",
  "ASSESSMENT",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFER",
]);

export function isActiveStatus(status: ApplicationStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

// ============================================================================
// Events
// ============================================================================

export const APPLICATION_EVENT_TYPES = [
  "APPLICATION_CREATED",
  "STATUS_CHANGED",
  "DEADLINE_ADDED",
  "DEADLINE_CHANGED",
  "RESUME_ATTACHED",
  "ASSESSMENT_SCHEDULED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFER_RECEIVED",
  "REJECTED",
  "WITHDRAWN",
  "REOPENED",
  "NOTE_ADDED",
  "JD_ATTACHED",
  "OUTCOME_RECORDED",
] as const;

export type ApplicationEventType = (typeof APPLICATION_EVENT_TYPES)[number];

export const EVENT_LABELS: Record<ApplicationEventType, string> = {
  APPLICATION_CREATED: "Application Created",
  STATUS_CHANGED: "Status Changed",
  DEADLINE_ADDED: "Deadline Added",
  DEADLINE_CHANGED: "Deadline Changed",
  RESUME_ATTACHED: "Resume Attached",
  ASSESSMENT_SCHEDULED: "Assessment Scheduled",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  OFFER_RECEIVED: "Offer Received",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  REOPENED: "Reopened",
  NOTE_ADDED: "Note Added",
  JD_ATTACHED: "Job Description Attached",
  OUTCOME_RECORDED: "Outcome Recorded",
};

export interface ApplicationEventRecord {
  id: string;
  eventType: ApplicationEventType;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

// ============================================================================
// Deadlines (display-only math over user-provided dates)
// ============================================================================

export type DeadlineKind = "application" | "assessment" | "interview" | "offer";

export interface DeadlineInfo {
  kind: DeadlineKind;
  label: string;
  date: string; // ISO timestamp
  daysRemaining: number | null; // null when in the past
  isPast: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function describeDeadline(
  kind: DeadlineKind,
  date: Date | string | null
): DeadlineInfo | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / DAY_MS);
  return {
    kind,
    label:
      kind === "application"
        ? "Application Deadline"
        : kind === "assessment"
          ? "Assessment Deadline"
          : kind === "interview"
            ? "Interview Date"
            : "Offer Deadline",
    date: d.toISOString(),
    daysRemaining: diffDays > 0 ? diffDays : null,
    isPast: diffDays <= 0,
  };
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ============================================================================
// Checklist — derived strictly from real application state
// ============================================================================

export type ChecklistState = "complete" | "pending" | "not_applicable";

export interface ApplicationChecklistItem {
  id: string;
  label: string;
  state: ChecklistState;
  detail: string;
}

/** Minimal application facts the checklist derives from (no DB types here). */
export interface ChecklistFacts {
  targetSelected: boolean;
  resumeAttached: boolean;
  resumeAtsScore: number | null;
  hasJobDescription: boolean;
  eligibilityReviewed: boolean;
  appliedAt: Date | string | null;
  status: ApplicationStatus;
  hasAssessmentRecord: boolean;
  hasInterviewRecord: boolean;
  interviewPreparationLinked: boolean;
}

export function deriveChecklist(facts: ChecklistFacts): ApplicationChecklistItem[] {
  const items: ApplicationChecklistItem[] = [
    {
      id: "target",
      label: "Target selected",
      state: facts.targetSelected ? "complete" : "pending",
      detail: facts.targetSelected
        ? "Company and role recorded on the application"
        : "Pick a company and role from the catalog",
    },
    {
      id: "resume",
      label: "Resume attached",
      state: facts.resumeAttached ? "complete" : "pending",
      detail: facts.resumeAttached
        ? "A Phase 18 resume variant is linked"
        : "Attach a resume variant from your Resume workspace",
    },
    {
      id: "ats",
      label: "Resume ATS analyzed",
      state: facts.resumeAtsScore !== null ? "complete" : "pending",
      detail:
        facts.resumeAtsScore !== null
          ? `ATS compatibility stored: ${Math.round(facts.resumeAtsScore)}/100`
          : "Analyse the attached resume to store its ATS score",
    },
    {
      id: "jd",
      label: "JD analyzed",
      state: facts.hasJobDescription ? "complete" : "pending",
      detail: facts.hasJobDescription
        ? "Job description attached and parsed by Phase 18"
        : "Paste the job description to unlock keyword and gap analysis",
    },
    {
      id: "eligibility",
      label: "Eligibility reviewed",
      state: facts.eligibilityReviewed ? "complete" : "pending",
      detail: facts.eligibilityReviewed
        ? "You confirmed the eligibility criteria"
        : "Review the role's eligibility before applying",
    },
    {
      id: "submitted",
      label: "Application submitted",
      state: facts.appliedAt ? "complete" : "pending",
      detail: facts.appliedAt
        ? `Marked applied on ${formatDateLong(
            typeof facts.appliedAt === "string" ? facts.appliedAt : facts.appliedAt.toISOString()
          )}`
        : "Submit through the company portal, then record it here",
    },
    {
      id: "assessment",
      label: "Assessment completed",
      state: facts.hasAssessmentRecord ? "complete" : "pending",
      detail: facts.hasAssessmentRecord
        ? "At least one assessment is recorded for this application"
        : "No assessment recorded yet",
    },
    {
      id: "interview_prep",
      label: "Interview preparation",
      state: facts.interviewPreparationLinked ? "complete" : "pending",
      detail: facts.interviewPreparationLinked
        ? "Linked preparation actions exist for this application's weak areas"
        : "Open Roadmap or Execution OS to prepare for interview rounds",
    },
  ];

  return items;
}

// ============================================================================
// Interview / assessment vocabulary (mirrors DB enums for service typing)
// ============================================================================

export const INTERVIEW_TYPES = [
  "Technical",
  "Coding",
  "HR",
  "Managerial",
  "Behavioral",
  "Group Discussion",
  "Other",
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_RESULTS = ["pending", "cleared", "not_cleared", "awaiting_result"] as const;
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number];

export const ASSESSMENT_STATUSES = ["scheduled", "completed", "missed", "expired"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const APPLICATION_SOURCES = [
  "company_website",
  "referral",
  "job_portal",
  "campus_placement",
  "recruiter",
  "other",
] as const;

export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  company_website: "Company website",
  referral: "Referral",
  job_portal: "Job portal",
  campus_placement: "Campus placement",
  recruiter: "Recruiter",
  other: "Other",
};
