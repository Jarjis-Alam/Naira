/**
 * Phase 19 — Placement Application OS service layer.
 *
 * Owns the application pipeline end to end: creation with Phase 16 target
 * defaults, guarded status transitions with an append-only timeline,
 * Phase 18 resume/JD association, readiness snapshots, application-specific
 * skill gaps, checklists, deadlines, and the upcoming-events calendar.
 *
 * Non-negotiables inherited from the rest of Placement OS:
 *  - No fabricated history: events are written only when something actually
 *    happens, and the timeline replays stored events verbatim.
 *  - No duplicate intelligence: companies/roles come from the Phase 11A/16
 *    catalog, resume facts from Phase 18, readiness from Phases 14/16/17.
 *    The four readiness dimensions are shown independently — never combined
 *    into a fake single percentage.
 *  - Owner isolation on every read and write; company/role names are
 *    snapshotted onto the application so history survives catalog changes.
 */

import { db } from "@/db";
import {
  applicationAssessments,
  applicationEvents,
  applicationInterviews,
  applicationOffers,
  applications,
  companies,
  roles,
} from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, or, isNull, sql } from "drizzle-orm";

import {
  APPLICATION_EVENT_TYPES,
  type ApplicationChecklistItem,
  type ApplicationEventRecord,
  type ApplicationStatus,
  type DeadlineInfo,
  deriveChecklist,
  describeDeadline,
  canTransition,
  isTerminalStatus,
  listTransitions,
  STATUS_LABELS,
  type ApplicationEventType,
  type ChecklistFacts,
  type InterviewResult,
  type InterviewType,
  type AssessmentStatus,
  type ApplicationSource,
} from "@/lib/applications/domain";
import { analyzeJobDescription } from "@/lib/resume/job-description";

import { getStudentPlacementTargets } from "./company-role-intelligence";
import { getPlacementTargetStrategy } from "./placement-target-strategy";
import { calculateReadiness } from "./readiness";
import { getStudentSimulationHistory } from "./placement-simulation";
import {
  getResumeCoverageForGaps,
  getResumeVariant,
  listResumeVariants,
} from "./resume-intelligence";

// ============================================================================
// Contracts
// ============================================================================

export interface ApplicationRef {
  id: string;
  companyName: string;
  roleName: string;
  status: ApplicationStatus;
}

export interface ApplicationSummary {
  id: string;
  userId: string;
  companyId: string | null;
  companyName: string;
  roleId: string | null;
  roleName: string;
  status: ApplicationStatus;
  statusLabel: string;
  source: string | null;
  appliedAt: string | null;
  deadline: string | null;
  assessmentDeadline: string | null;
  interviewDate: string | null;
  offerDeadline: string | null;
  location: string | null;
  employmentType: string | null;
  packageText: string | null;
  hasNotes: boolean;
  hasJobDescription: boolean;
  resume: {
    variantId: string | null;
    label: string | null;
    atsScore: number | null;
    matchScore: number | null;
  };
  updatedAt: string;
  createdAt: string;
}

export interface ApplicationCard extends ApplicationSummary {
  deadlineInfo: DeadlineInfo | null;
  nextEvent: { label: string; date: string; kind: DeadlineInfo["kind"] } | null;
}

export interface ApplicationsPipelineCount {
  status: ApplicationStatus;
  label: string;
  count: number;
}

export interface UpcomingApplicationEvent {
  kind: DeadlineInfo["kind"];
  label: string;
  companyName: string;
  roleName: string;
  applicationId: string;
  date: string;
  daysRemaining: number | null;
}

export interface ApplicationsBoard {
  userId: string;
  totals: {
    activeApplications: number;
    assessments: number;
    interviews: number;
    offers: number;
  };
  pipeline: ApplicationsPipelineCount[];
  cards: ApplicationCard[];
  upcoming: UpcomingApplicationEvent[];
  defaults: {
    configured: boolean;
    companyId: string | null;
    companyName: string | null;
    roleId: string | null;
    roleName: string | null;
  };
  emptyState: {
    show: boolean;
    title: string;
    message: string;
    ctaLabel: string;
    ctaHref: string;
  } | null;
}

export interface ReadinessSnapshot {
  preparation: { score: number | null; label: string; note: string };
  target: { score: number | null; label: string; note: string };
  resumeAts: { score: number | null; label: string; note: string };
  interview: { score: number | null; label: string; note: string };
  headline: string;
}

export type ApplicationGapSource = "preparation" | "simulation" | "resume";

export interface ApplicationGap {
  topic: string;
  domain: string;
  sources: ApplicationGapSource[];
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | null;
  explanation: string;
  resumeCoverage: {
    coveredInResume: boolean | null;
    evidence: string | null;
    note: string;
  } | null;
}

export interface ApplicationDetail {
  application: ApplicationSummary;
  notes: string | null;
  jobDescription: {
    raw: string;
    extraction: {
      requiredSkills: { skill: string; evidence: string }[];
      preferredSkills: { skill: string; evidence: string }[];
      keywords: { term: string; count: number }[];
      responsibilities: string[];
      qualifications: string[];
      roleTerminology: string[];
      warnings: string[];
    } | null;
  } | null;
  readiness: ReadinessSnapshot;
  gaps: ApplicationGap[];
  checklist: ApplicationChecklistItem[];
  timeline: ApplicationEventRecord[];
  interviews: ApplicationInterviewRecord[];
  assessments: ApplicationAssessmentRecord[];
  offers: ApplicationOfferRecord[];
  allowedTransitions: ApplicationStatus[];
  targets: {
    configured: boolean;
    isTargetCompany: boolean;
    isTargetRole: boolean;
  };
}

export interface ApplicationInterviewRecord {
  id: string;
  roundNumber: number;
  roundType: InterviewType;
  scheduledAt: string | null;
  completedAt: string | null;
  result: InterviewResult;
  interviewerNotes: string | null;
  userNotes: string | null;
}

export interface ApplicationAssessmentRecord {
  id: string;
  name: string;
  assessmentType: string | null;
  scheduledAt: string | null;
  deadline: string | null;
  status: AssessmentStatus;
  scoreText: string | null;
  notes: string | null;
}

export interface ApplicationOfferRecord {
  id: string;
  companyName: string;
  roleName: string;
  offerDate: string | null;
  compensationText: string | null;
  location: string | null;
  joiningDate: string | null;
  offerDeadline: string | null;
  notes: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

const ISO = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

function ownershipError(): Error {
  return new Error("Unauthorized: you do not have access to this resource.");
}

const STATUS_RANK: Record<ApplicationStatus, number> = {
  INTERESTED: 0,
  ELIGIBLE: 1,
  APPLIED: 2,
  ASSESSMENT: 3,
  SHORTLISTED: 4,
  INTERVIEW: 5,
  OFFER: 6,
  REJECTED: 2,
  WITHDRAWN: 2,
  CLOSED: 2,
};

function isActive(s: ApplicationStatus): boolean {
  return !isTerminalStatus(s);
}

async function loadApplication(applicationId: string, userId: string) {
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw ownershipError();
  return rows[0];
}

async function recordEvent(params: {
  applicationId: string;
  userId: string;
  eventType: ApplicationEventType;
  previousStatus?: ApplicationStatus | null;
  newStatus?: ApplicationStatus | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}) {
  await db.insert(applicationEvents).values({
    applicationId: params.applicationId,
    userId: params.userId,
    eventType: params.eventType,
    previousStatus: params.previousStatus ?? null,
    newStatus: params.newStatus ?? null,
    title: params.title ?? null,
    metadata: params.metadata ?? null,
    ...(params.occurredAt ? { occurredAt: params.occurredAt } : {}),
  });
}

function toSummary(row: typeof applications.$inferSelect): ApplicationSummary {
  return {
    id: row.id,
    userId: row.userId,
    companyId: row.companyId,
    companyName: row.companyName,
    roleId: row.roleId,
    roleName: row.roleName,
    status: row.status as ApplicationStatus,
    statusLabel: STATUS_LABELS[row.status as ApplicationStatus],
    source: row.source,
    appliedAt: ISO(row.appliedAt),
    deadline: ISO(row.deadline),
    assessmentDeadline: ISO(row.assessmentDeadline),
    interviewDate: ISO(row.interviewDate),
    offerDeadline: ISO(row.offerDeadline),
    location: row.location,
    employmentType: row.employmentType,
    packageText: row.packageText,
    hasNotes: Boolean(row.notes && row.notes.trim().length > 0),
    hasJobDescription: Boolean(row.jobDescription && row.jobDescription.trim().length > 0),
    resume: {
      variantId: row.resumeVariantId,
      label: row.resumeLabel,
      atsScore: row.resumeAtsScore,
      matchScore: row.resumeMatchScore,
    },
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// ============================================================================
// Create / list / board
// ============================================================================

export interface CreateApplicationInput {
  companyId?: string;
  roleId?: string;
  source?: ApplicationSource;
  jobDescription?: string;
  deadline?: Date;
  location?: string;
  employmentType?: string;
  packageText?: string;
  notes?: string;
  resumeVariantId?: string;
  initialStatus?: ApplicationStatus;
}

export async function createApplication(
  userId: string,
  input: CreateApplicationInput
): Promise<ApplicationSummary> {
  if (!userId) throw new Error("Invalid or unauthenticated user ID");

  // Resolve company/role from the catalog — never a second company database.
  // Defaults come from the student's Phase 16 targets when provided.
  const targets = await getStudentPlacementTargets(userId);
  const companyId = input.companyId ?? targets.primaryCompany?.id ?? null;
  const roleId = input.roleId ?? targets.primaryRole?.id ?? null;

  if (!companyId || !roleId) {
    throw new Error(
      "A company and role are required: select them from the catalog or configure your placement targets first."
    );
  }

  const [companyRow] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const [roleRow] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!companyRow || !roleRow) {
    throw new Error("Selected company or role does not exist in the catalog.");
  }

  // One active application per company + role.
  const existing = await db
    .select({ id: applications.id, status: applications.status })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        eq(applications.companyId, companyId),
        eq(applications.roleId, roleId)
      )
    );
  const activeDupe = existing.find((row) => isActive(row.status as ApplicationStatus));
  if (activeDupe) {
    throw new Error(
      `An active application for ${companyRow.name} — ${roleRow.name} already exists. Reopen tracking from the applications board instead.`
    );
  }

  const initialStatus: ApplicationStatus = input.initialStatus ?? "INTERESTED";
  const appliedAt = STATUS_RANK[initialStatus] >= STATUS_RANK.APPLIED ? new Date() : null;

  // Phase 18 resume association, validated for ownership, scores snapshotted.
  let resumeVariantId: string | null = null;
  let resumeLabel: string | null = null;
  let resumeAtsScore: number | null = null;
  let resumeMatchScore: number | null = null;
  if (input.resumeVariantId) {
    const variant = await getResumeVariant(input.resumeVariantId, userId);
    resumeVariantId = variant.id;
    resumeLabel = variant.label;
    resumeAtsScore = variant.atsScore;
    resumeMatchScore = variant.matchScore;
  }

  const [created] = await db
    .insert(applications)
    .values({
      userId,
      companyId,
      companyName: companyRow.name,
      roleId,
      roleName: roleRow.name,
      jobDescription: input.jobDescription?.trim() || null,
      source: input.source ?? null,
      status: initialStatus,
      appliedAt,
      deadline: input.deadline ?? null,
      location: input.location ?? null,
      employmentType: input.employmentType ?? null,
      packageText: input.packageText ?? null,
      notes: input.notes ?? null,
      resumeVariantId,
      resumeLabel,
      resumeAtsScore,
      resumeMatchScore,
    })
    .returning();

  await recordEvent({
    applicationId: created.id,
    userId,
    eventType: "APPLICATION_CREATED",
    newStatus: initialStatus,
    title: `Created for ${companyRow.name} — ${roleRow.name}`,
    metadata: { source: input.source ?? null, initialStatus },
  });

  if (resumeVariantId) {
    await recordEvent({
      applicationId: created.id,
      userId,
      eventType: "RESUME_ATTACHED",
      title: resumeLabel,
      metadata: { variantId: resumeVariantId, atsScore: resumeAtsScore, matchScore: resumeMatchScore },
    });
  }
  if (input.deadline) {
    await recordEvent({
      applicationId: created.id,
      userId,
      eventType: "DEADLINE_ADDED",
      title: "Application Deadline",
      metadata: { date: input.deadline.toISOString() },
    });
  }

  return toSummary(created);
}

export async function listApplications(userId: string): Promise<ApplicationSummary[]> {
  if (!userId) throw new Error("Invalid or unauthenticated user ID");
  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt))
    .limit(200);
  return rows.map(toSummary);
}

function nextEventFor(row: typeof applications.$inferSelect): ApplicationCard["nextEvent"] {
  const candidates: { label: string; date: Date; kind: DeadlineInfo["kind"] }[] = [];
  if (row.deadline) candidates.push({ label: "Application Deadline", date: row.deadline, kind: "application" });
  if (row.assessmentDeadline) candidates.push({ label: "Assessment Deadline", date: row.assessmentDeadline, kind: "assessment" });
  if (row.interviewDate) candidates.push({ label: "Interview", date: row.interviewDate, kind: "interview" });
  if (row.offerDeadline) candidates.push({ label: "Offer Deadline", date: row.offerDeadline, kind: "offer" });
  const future = candidates.filter((c) => c.date.getTime() >= Date.now()).sort((a, b) => a.date.getTime() - b.date.getTime());
  if (future.length === 0) return null;
  const next = future[0];
  return { label: next.label, date: next.date.toISOString(), kind: next.kind };
}

export async function getApplicationsBoard(userId: string): Promise<ApplicationsBoard> {
  if (!userId) throw new Error("Invalid or unauthenticated user ID");

  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt))
    .limit(200);

  const summaries = rows.map(toSummary);
  const cards: ApplicationCard[] = rows.map((row) => {
    const summary = toSummary(row);
    return {
      ...summary,
      deadlineInfo: describeDeadline("application", row.deadline),
      nextEvent: nextEventFor(row),
    };
  });

  const pipeline = (
    [
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
    ] as ApplicationStatus[]
  ).map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: summaries.filter((s) => s.status === status).length,
  }));

  const [assessmentCount, interviewRows, offerCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applicationAssessments)
      .where(eq(applicationAssessments.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applicationInterviews)
      .where(eq(applicationInterviews.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applicationOffers)
      .where(eq(applicationOffers.userId, userId)),
  ]);

  const totals = {
    activeApplications: summaries.filter((s) => isActive(s.status)).length,
    assessments: assessmentCount[0]?.count ?? 0,
    interviews: interviewRows[0]?.count ?? 0,
    offers: offerCount[0]?.count ?? 0,
  };

  const upcoming = await getUpcomingApplicationEvents(userId, 30);

  const targets = await getStudentPlacementTargets(userId);

  return {
    userId,
    totals,
    pipeline,
    cards,
    upcoming,
    defaults: {
      configured: targets.configured,
      companyId: targets.primaryCompany?.id ?? null,
      companyName: targets.primaryCompany?.name ?? null,
      roleId: targets.primaryRole?.id ?? null,
      roleName: targets.primaryRole?.name ?? null,
    },
    emptyState:
      summaries.length === 0
        ? {
            show: true,
            title: "No applications yet",
            message: targets.configured
              ? `Start tracking ${targets.primaryCompany?.name ?? "your target company"} — or any company from the catalog — to see deadlines, interviews and offers in one pipeline.`
              : "Track where you are applying, what stage each application is in, and what to do next. Configure your placement target first for smart defaults.",
            ctaLabel: targets.configured ? "Create your first application" : "Set your target",
            ctaHref: targets.configured ? "/applications" : "/target",
          }
        : null,
  };
}

// ============================================================================
// Status transitions
// ============================================================================

export async function updateApplicationStatus(
  userId: string,
  applicationId: string,
  newStatus: ApplicationStatus,
  note?: string
): Promise<ApplicationSummary> {
  const app = await loadApplication(applicationId, userId);
  const previous = app.status as ApplicationStatus;

  if (previous === newStatus) {
    throw new Error(`Application is already in status ${STATUS_LABELS[previous]}.`);
  }
  if (!canTransition(previous, newStatus)) {
    throw new Error(
      `Cannot move from ${STATUS_LABELS[previous]} to ${STATUS_LABELS[newStatus]}. Allowed: ${listTransitions(previous)
        .map((s) => STATUS_LABELS[s])
        .join(", ")}.`
    );
  }

  const reopening = isTerminalStatus(previous);
  const appliedAt =
    !reopening && STATUS_RANK[newStatus] >= STATUS_RANK.APPLIED && !app.appliedAt ? new Date() : app.appliedAt;

  const [updated] = await db
    .update(applications)
    .set({
      status: newStatus,
      appliedAt,
      reopenedCount: reopening ? app.reopenedCount + 1 : app.reopenedCount,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .returning();

  if (reopening) {
    await recordEvent({
      applicationId,
      userId,
      eventType: "REOPENED",
      previousStatus: previous,
      newStatus,
      title: note ?? `Reopened as ${STATUS_LABELS[newStatus]}`,
    });
  } else if (newStatus === "REJECTED" || newStatus === "WITHDRAWN") {
    await recordEvent({
      applicationId,
      userId,
      eventType: newStatus,
      previousStatus: previous,
      newStatus,
      title: note ?? STATUS_LABELS[newStatus],
    });
  } else if (newStatus === "CLOSED") {
    await recordEvent({
      applicationId,
      userId,
      eventType: "STATUS_CHANGED",
      previousStatus: previous,
      newStatus,
      title: note ?? "Closed",
    });
  } else {
    await recordEvent({
      applicationId,
      userId,
      eventType: "STATUS_CHANGED",
      previousStatus: previous,
      newStatus,
      title: note ?? `${STATUS_LABELS[previous]} → ${STATUS_LABELS[newStatus]}`,
    });
  }

  // Phase 20 — record the outcome as a first-class timeline event when the
  // application reaches a state that carries an outcome (terminal or OFFER).
  // The category is derived from history only; the event exists so outcome
  // surfaces cite persisted data instead of re-deriving silently.
  if (newStatus === "REJECTED" || newStatus === "WITHDRAWN" || newStatus === "OFFER" || newStatus === "CLOSED") {
    await recordEvent({
      applicationId,
      userId,
      eventType: "OUTCOME_RECORDED",
      previousStatus: previous,
      newStatus,
      title: `Outcome recorded: ${STATUS_LABELS[newStatus]}`,
      metadata: { derivedCategoryHint: newStatus },
    });
  }

  return toSummary(updated);
}

// ============================================================================
// Field updates (deadlines, JD, resume, details, notes)
// ============================================================================

export interface UpdateApplicationInput {
  deadline?: Date | null;
  assessmentDeadline?: Date | null;
  interviewDate?: Date | null;
  offerDeadline?: Date | null;
  location?: string | null;
  employmentType?: string | null;
  packageText?: string | null;
  source?: ApplicationSource | null;
  notes?: string;
  resumeVariantId?: string | null;
  jobDescription?: string;
}

const DEADLINE_FIELDS: {
  key: "deadline" | "assessmentDeadline" | "interviewDate" | "offerDeadline";
  label: string;
  event: "DEADLINE_ADDED" | "DEADLINE_CHANGED";
  kind: DeadlineInfo["kind"];
}[] = [
  { key: "deadline", label: "Application Deadline", event: "DEADLINE_CHANGED", kind: "application" },
  { key: "assessmentDeadline", label: "Assessment Deadline", event: "DEADLINE_CHANGED", kind: "assessment" },
  { key: "interviewDate", label: "Interview Date", event: "DEADLINE_CHANGED", kind: "interview" },
  { key: "offerDeadline", label: "Offer Deadline", event: "DEADLINE_CHANGED", kind: "offer" },
];

export async function updateApplication(
  userId: string,
  applicationId: string,
  input: UpdateApplicationInput
): Promise<ApplicationSummary> {
  const app = await loadApplication(applicationId, userId);

  const patch: Partial<typeof applications.$inferInsert> = { updatedAt: new Date() };
  const pendingEvents: Parameters<typeof recordEvent>[0][] = [];

  for (const field of DEADLINE_FIELDS) {
    const incoming = input[field.key];
    if (incoming === undefined) continue;
    const current = app[field.key];
    if (incoming === null && current === null) continue;
    if (
      incoming instanceof Date &&
      current instanceof Date &&
      incoming.getTime() === current.getTime()
    ) {
      continue;
    }
    patch[field.key] = incoming;
    pendingEvents.push({
      applicationId,
      userId,
      eventType: incoming === null ? "DEADLINE_CHANGED" : current === null ? "DEADLINE_ADDED" : field.event,
      title: incoming === null ? `${field.label} removed` : field.label,
      metadata: { kind: field.kind, date: incoming === null ? null : incoming.toISOString() },
    });
  }

  if (input.location !== undefined) patch.location = input.location;
  if (input.employmentType !== undefined) patch.employmentType = input.employmentType;
  if (input.packageText !== undefined) patch.packageText = input.packageText;
  if (input.source !== undefined) patch.source = input.source;

  if (input.notes !== undefined && input.notes !== (app.notes ?? "")) {
    patch.notes = input.notes;
    if (input.notes.trim().length > 0) {
      pendingEvents.push({
        applicationId,
        userId,
        eventType: "NOTE_ADDED",
        title: "Note updated",
      });
    }
  }

  if (input.resumeVariantId !== undefined && input.resumeVariantId !== app.resumeVariantId) {
    if (input.resumeVariantId === null) {
      patch.resumeVariantId = null;
      patch.resumeLabel = null;
      patch.resumeAtsScore = null;
      patch.resumeMatchScore = null;
      pendingEvents.push({
        applicationId,
        userId,
        eventType: "RESUME_ATTACHED",
        title: "Resume detached",
        metadata: { variantId: null },
      });
    } else {
      const variant = await getResumeVariant(input.resumeVariantId, userId);
      patch.resumeVariantId = variant.id;
      patch.resumeLabel = variant.label;
      patch.resumeAtsScore = variant.atsScore;
      patch.resumeMatchScore = variant.matchScore;
      pendingEvents.push({
        applicationId,
        userId,
        eventType: "RESUME_ATTACHED",
        title: variant.label,
        metadata: { variantId: variant.id, atsScore: variant.atsScore, matchScore: variant.matchScore },
      });
    }
  }

  if (input.jobDescription !== undefined) {
    const jd = input.jobDescription.trim();
    if (jd.length > 0 && jd !== (app.jobDescription ?? "")) {
      analyzeJobDescription({ raw: jd }); // parse must succeed before storing
      patch.jobDescription = jd;
      pendingEvents.push({
        applicationId,
        userId,
        eventType: "JD_ATTACHED",
        title: "Job description attached",
        metadata: { characters: jd.length },
      });
    } else if (jd.length === 0 && app.jobDescription) {
      patch.jobDescription = null;
    }
  }

  const [updated] = await db
    .update(applications)
    .set(patch)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .returning();

  for (const event of pendingEvents) {
    await recordEvent(event);
  }

  return toSummary(updated);
}

export async function deleteApplication(
  userId: string,
  applicationId: string
): Promise<{ deleted: boolean }> {
  const app = await loadApplication(applicationId, userId);
  await db.delete(applications).where(eq(applications.id, app.id));
  return { deleted: true };
}

// ============================================================================
// Timeline
// ============================================================================

export async function getApplicationTimeline(
  userId: string,
  applicationId: string
): Promise<ApplicationEventRecord[]> {
  const app = await loadApplication(applicationId, userId);
  const rows = await db
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, app.id))
    .orderBy(asc(applicationEvents.occurredAt), asc(applicationEvents.createdAt));
  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType as ApplicationEventType,
    previousStatus: (row.previousStatus as ApplicationStatus | null) ?? null,
    newStatus: (row.newStatus as ApplicationStatus | null) ?? null,
    title: row.title,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    occurredAt: row.occurredAt.toISOString(),
  }));
}

export async function addApplicationNote(
  userId: string,
  applicationId: string,
  title: string,
  detail?: string
): Promise<ApplicationEventRecord> {
  const app = await loadApplication(applicationId, userId);
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Event title is required.");
  await recordEvent({
    applicationId: app.id,
    userId,
    eventType: "NOTE_ADDED",
    title: trimmed,
    metadata: detail?.trim() ? { detail: detail.trim() } : null,
  });
  const timeline = await getApplicationTimeline(userId, app.id);
  return timeline[timeline.length - 1];
}

// ============================================================================
// Interviews
// ============================================================================

export interface ScheduleInterviewInput {
  roundType: InterviewType;
  scheduledAt: Date;
  userNotes?: string;
}

export async function scheduleInterview(
  userId: string,
  applicationId: string,
  input: ScheduleInterviewInput
): Promise<ApplicationInterviewRecord> {
  const app = await loadApplication(applicationId, userId);

  const existing = await db
    .select({ roundNumber: applicationInterviews.roundNumber })
    .from(applicationInterviews)
    .where(eq(applicationInterviews.applicationId, app.id));
  const roundNumber =
    existing.reduce((max, row) => Math.max(max, row.roundNumber), 0) + 1;

  const [created] = await db
    .insert(applicationInterviews)
    .values({
      applicationId: app.id,
      userId,
      roundNumber,
      roundType: input.roundType,
      scheduledAt: input.scheduledAt,
      userNotes: input.userNotes ?? null,
    })
    .returning();

  await recordEvent({
    applicationId: app.id,
    userId,
    eventType: "INTERVIEW_SCHEDULED",
    title: `Round ${roundNumber} — ${input.roundType}`,
    metadata: { interviewId: created.id, scheduledAt: input.scheduledAt.toISOString() },
  });

  if (
    !app.interviewDate ||
    input.scheduledAt.getTime() < app.interviewDate.getTime()
  ) {
    await db
      .update(applications)
      .set({ interviewDate: input.scheduledAt, updatedAt: new Date() })
      .where(eq(applications.id, app.id));
  }

  return toInterviewRecord(created);
}

function toInterviewRecord(row: typeof applicationInterviews.$inferSelect): ApplicationInterviewRecord {
  return {
    id: row.id,
    roundNumber: row.roundNumber,
    roundType: row.roundType as InterviewType,
    scheduledAt: ISO(row.scheduledAt),
    completedAt: ISO(row.completedAt),
    result: row.result as InterviewResult,
    interviewerNotes: row.interviewerNotes,
    userNotes: row.userNotes,
  };
}

export interface CompleteInterviewInput {
  result: InterviewResult;
  completedAt?: Date;
  interviewerNotes?: string;
  userNotes?: string;
}

export async function completeInterview(
  userId: string,
  applicationId: string,
  interviewId: string,
  input: CompleteInterviewInput
): Promise<ApplicationInterviewRecord> {
  const app = await loadApplication(applicationId, userId);
  const rows = await db
    .select()
    .from(applicationInterviews)
    .where(
      and(
        eq(applicationInterviews.id, interviewId),
        eq(applicationInterviews.applicationId, app.id),
        eq(applicationInterviews.userId, userId)
      )
    )
    .limit(1);
  if (rows.length === 0) throw ownershipError();
  const interview = rows[0];

  const [updated] = await db
    .update(applicationInterviews)
    .set({
      result: input.result,
      completedAt: input.completedAt ?? new Date(),
      interviewerNotes: input.interviewerNotes ?? interview.interviewerNotes,
      userNotes: input.userNotes ?? interview.userNotes,
      updatedAt: new Date(),
    })
    .where(eq(applicationInterviews.id, interviewId))
    .returning();

  await recordEvent({
    applicationId: app.id,
    userId,
    eventType: "INTERVIEW_COMPLETED",
    title: `Round ${interview.roundNumber} — ${interview.roundType}: ${input.result.replace("_", " ")}`,
    metadata: { interviewId, result: input.result },
  });

  return toInterviewRecord(updated);
}

// ============================================================================
// Assessments
// ============================================================================

export interface RecordAssessmentInput {
  name: string;
  assessmentType?: string;
  scheduledAt?: Date;
  deadline?: Date;
  notes?: string;
}

export async function recordAssessment(
  userId: string,
  applicationId: string,
  input: RecordAssessmentInput
): Promise<ApplicationAssessmentRecord> {
  const app = await loadApplication(applicationId, userId);
  const name = input.name.trim();
  if (!name) throw new Error("Assessment name is required.");

  const [created] = await db
    .insert(applicationAssessments)
    .values({
      applicationId: app.id,
      userId,
      name,
      assessmentType: input.assessmentType ?? null,
      scheduledAt: input.scheduledAt ?? null,
      deadline: input.deadline ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  await recordEvent({
    applicationId: app.id,
    userId,
    eventType: "ASSESSMENT_SCHEDULED",
    title: name,
    metadata: {
      assessmentId: created.id,
      deadline: input.deadline ? input.deadline.toISOString() : null,
    },
  });

  if (input.deadline && (!app.assessmentDeadline || input.deadline.getTime() < app.assessmentDeadline.getTime())) {
    await db
      .update(applications)
      .set({ assessmentDeadline: input.deadline, updatedAt: new Date() })
      .where(eq(applications.id, app.id));
  }

  return toAssessmentRecord(created);
}

function toAssessmentRecord(row: typeof applicationAssessments.$inferSelect): ApplicationAssessmentRecord {
  return {
    id: row.id,
    name: row.name,
    assessmentType: row.assessmentType,
    scheduledAt: ISO(row.scheduledAt),
    deadline: ISO(row.deadline),
    status: row.status as AssessmentStatus,
    scoreText: row.scoreText,
    notes: row.notes,
  };
}

export interface UpdateAssessmentInput {
  status?: AssessmentStatus;
  scoreText?: string | null;
  notes?: string;
  deadline?: Date | null;
}

export async function updateAssessment(
  userId: string,
  applicationId: string,
  assessmentId: string,
  input: UpdateAssessmentInput
): Promise<ApplicationAssessmentRecord> {
  const app = await loadApplication(applicationId, userId);
  const rows = await db
    .select()
    .from(applicationAssessments)
    .where(
      and(
        eq(applicationAssessments.id, assessmentId),
        eq(applicationAssessments.applicationId, app.id),
        eq(applicationAssessments.userId, userId)
      )
    )
    .limit(1);
  if (rows.length === 0) throw ownershipError();

  const [updated] = await db
    .update(applicationAssessments)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.scoreText !== undefined ? { scoreText: input.scoreText } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
      updatedAt: new Date(),
    })
    .where(eq(applicationAssessments.id, assessmentId))
    .returning();

  return toAssessmentRecord(updated);
}

// ============================================================================
// Offers — all compensation data is user-provided, never inferred
// ============================================================================

export interface RecordOfferInput {
  offerDate?: Date;
  compensationText?: string;
  location?: string;
  joiningDate?: Date;
  offerDeadline?: Date;
  notes?: string;
}

export async function recordOffer(
  userId: string,
  applicationId: string,
  input: RecordOfferInput
): Promise<ApplicationOfferRecord> {
  const app = await loadApplication(applicationId, userId);
  const status = app.status as ApplicationStatus;

  const [created] = await db
    .insert(applicationOffers)
    .values({
      applicationId: app.id,
      userId,
      companyName: app.companyName,
      roleName: app.roleName,
      offerDate: input.offerDate ?? new Date(),
      compensationText: input.compensationText ?? null,
      location: input.location ?? app.location,
      joiningDate: input.joiningDate ?? null,
      offerDeadline: input.offerDeadline ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  if (status !== "OFFER") {
    if (!canTransition(status, "OFFER")) {
      throw new Error(
        `An offer cannot be recorded from status ${STATUS_LABELS[status]}. Move the application to a pre-offer stage first.`
      );
    }
    await db
      .update(applications)
      .set({
        status: "OFFER",
        offerDeadline: input.offerDeadline ?? app.offerDeadline,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, app.id));
  } else if (input.offerDeadline) {
    await db
      .update(applications)
      .set({ offerDeadline: input.offerDeadline, updatedAt: new Date() })
      .where(eq(applications.id, app.id));
  }

  await recordEvent({
    applicationId: app.id,
    userId,
    eventType: "OFFER_RECEIVED",
    title: `Offer — ${app.companyName} ${app.roleName}`,
    metadata: {
      offerId: created.id,
      offerDate: (input.offerDate ?? new Date()).toISOString(),
      compensationProvided: Boolean(input.compensationText),
    },
  });

  return toOfferRecord(created);
}

function toOfferRecord(row: typeof applicationOffers.$inferSelect): ApplicationOfferRecord {
  return {
    id: row.id,
    companyName: row.companyName,
    roleName: row.roleName,
    offerDate: ISO(row.offerDate),
    compensationText: row.compensationText,
    location: row.location,
    joiningDate: ISO(row.joiningDate),
    offerDeadline: ISO(row.offerDeadline),
    notes: row.notes,
  };
}

// ============================================================================
// Upcoming events calendar
// ============================================================================

export async function getUpcomingApplicationEvents(
  userId: string,
  withinDays = 14
): Promise<UpcomingApplicationEvent[]> {
  if (!userId) throw new Error("Invalid or unauthenticated user ID");
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const apps = await db
    .select({
      id: applications.id,
      companyName: applications.companyName,
      roleName: applications.roleName,
      deadline: applications.deadline,
      assessmentDeadline: applications.assessmentDeadline,
      interviewDate: applications.interviewDate,
      offerDeadline: applications.offerDeadline,
      status: applications.status,
    })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        inArray(applications.status, [
          "INTERESTED",
          "ELIGIBLE",
          "APPLIED",
          "ASSESSMENT",
          "SHORTLISTED",
          "INTERVIEW",
          "OFFER",
        ] as const satisfies readonly ApplicationStatus[])
      )
    );

  const events: UpcomingApplicationEvent[] = [];
  const push = (
    app: (typeof apps)[number],
    date: Date | null,
    kind: DeadlineInfo["kind"]
  ) => {
    if (!date || date.getTime() < now.getTime() - 24 * 60 * 60 * 1000 || date.getTime() > horizon.getTime()) return;
    const days = Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    events.push({
      kind,
      label:
        kind === "application"
          ? "Application Deadline"
          : kind === "assessment"
            ? "Assessment Deadline"
            : kind === "interview"
              ? "Interview"
              : "Offer Deadline",
      companyName: app.companyName,
      roleName: app.roleName,
      applicationId: app.id,
      date: date.toISOString(),
      daysRemaining: days > 0 ? days : null,
    });
  };

  for (const app of apps) {
    push(app, app.deadline, "application");
    push(app, app.assessmentDeadline, "assessment");
    push(app, app.interviewDate, "interview");
    push(app, app.offerDeadline, "offer");
  }

  const interviews = await db
    .select({
      scheduledAt: applicationInterviews.scheduledAt,
      roundType: applicationInterviews.roundType,
      roundNumber: applicationInterviews.roundNumber,
      applicationId: applicationInterviews.applicationId,
    })
    .from(applicationInterviews)
    .where(
      and(
        eq(applicationInterviews.userId, userId),
        gte(applicationInterviews.scheduledAt, now),
        lte(applicationInterviews.scheduledAt, horizon),
        isNull(applicationInterviews.completedAt)
      )
    );
  for (const iv of interviews) {
    const app = apps.find((a) => a.id === iv.applicationId);
    if (!app || !iv.scheduledAt) continue;
    events.push({
      kind: "interview",
      label: `Interview — Round ${iv.roundNumber} (${iv.roundType})`,
      companyName: app.companyName,
      roleName: app.roleName,
      applicationId: app.id,
      date: iv.scheduledAt.toISOString(),
      daysRemaining: Math.ceil((iv.scheduledAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    });
  }

  const assessments = await db
    .select({
      deadline: applicationAssessments.deadline,
      name: applicationAssessments.name,
      applicationId: applicationAssessments.applicationId,
    })
    .from(applicationAssessments)
    .where(
      and(
        eq(applicationAssessments.userId, userId),
        eq(applicationAssessments.status, "scheduled"),
        gte(applicationAssessments.deadline, now),
        lte(applicationAssessments.deadline, horizon)
      )
    );
  for (const a of assessments) {
    const app = apps.find((x) => x.id === a.applicationId);
    if (!app || !a.deadline) continue;
    events.push({
      kind: "assessment",
      label: `Assessment — ${a.name}`,
      companyName: app.companyName,
      roleName: app.roleName,
      applicationId: app.id,
      date: a.deadline.toISOString(),
      daysRemaining: Math.ceil((a.deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Readiness snapshot — four independent dimensions, never one fake number
// ============================================================================

async function buildReadinessSnapshot(
  userId: string,
  app: typeof applications.$inferSelect
): Promise<ReadinessSnapshot> {
  const [readiness, strategy, sims] = await Promise.all([
    calculateReadiness(userId),
    getPlacementTargetStrategy(userId),
    getStudentSimulationHistory(userId),
  ]);

  const preparationScore = readiness.readinessScore;
  const targetScore = strategy.readiness.targetScore;
  const resumeAts = app.resumeAtsScore;

  const completedSims = sims.filter(
    (s) => s.status === "completed" && s.summaryReport !== null
  );
  const latestSim = completedSims[0] ?? null;
  const interviewScore = latestSim
    ? (latestSim.summaryReport?.categoryReadiness.interview ?? latestSim.overallReadinessScore)
    : null;

  return {
    preparation: {
      score: preparationScore,
      label: "Preparation Readiness",
      note: readiness.hasCompletedBaseline
        ? "From Phase 14 performance intelligence across your tests"
        : "Complete a baseline assessment to unlock this measure",
    },
    target: {
      score: targetScore,
      label: "Target Readiness",
      note:
        strategy.hasTarget && targetScore !== null
          ? "From Phase 16 target strategy against your measured domains"
          : "Configure a placement target to unlock this measure",
    },
    resumeAts: {
      score: resumeAts,
      label: "Resume ATS",
      note:
        resumeAts !== null
          ? "ATS compatibility of the resume attached to this application (Phase 18)"
          : "Attach and analyse a resume variant to unlock this measure",
    },
    interview: {
      score: interviewScore,
      label: "Interview Readiness",
      note: latestSim
        ? "Interview category from your latest completed placement simulation (Phase 17)"
        : "Complete a placement simulation to unlock this measure",
    },
    headline: `${app.companyName} — ${app.roleName}`,
  };
}

// ============================================================================
// Application-specific skill gaps — typed by source, explained
// ============================================================================

async function buildApplicationGaps(
  userId: string,
  app: typeof applications.$inferSelect
): Promise<ApplicationGap[]> {
  const merged = new Map<
    string,
    { topic: string; domain: string; sources: Set<ApplicationGapSource>; priority: "CRITICAL" | "HIGH" | "MEDIUM" | null }
  >();

  const add = (
    topic: string,
    domain: string,
    source: ApplicationGapSource,
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | null
  ) => {
    const key = `${domain}::${topic.toLowerCase()}`;
    const entry = merged.get(key);
    if (entry) {
      entry.sources.add(source);
      if (priority === "CRITICAL") entry.priority = "CRITICAL";
      else if (priority === "HIGH" && entry.priority !== "CRITICAL") entry.priority = "HIGH";
    } else {
      merged.set(key, { topic, domain, sources: new Set([source]), priority });
    }
  };

  // Phase 16 target strategy gaps (measured performance vs target requirements).
  const strategy = await getPlacementTargetStrategy(userId);
  for (const gap of strategy.gaps) {
    add(gap.topic, gap.domain, "preparation", gap.priority);
  }

  // Phase 17 simulation feedback (needsImprovement topics).
  const sims = await getStudentSimulationHistory(userId);
  const latestSim = sims.find((s) => s.summaryReport !== null) ?? null;
  for (const weak of latestSim?.summaryReport?.targetGapAnalysis.needsImprovement ?? []) {
    add(weak.topic, weak.domain, "simulation", weak.priority);
  }

  // Phase 18: JD skills missing from the resume are resume gaps — and only
  // resume gaps. A skill absent from the resume is NOT evidence the student
  // lacks it; preparation/simulation sources carry that claim.
  let jdResumeGaps: { skill: string; evidence: string }[] = [];
  if (app.jobDescription && app.resumeVariantId) {
    try {
      const variant = await getResumeVariant(app.resumeVariantId, userId);
      const detected = new Set(variant.structured.skills.detected.map((s) => s.toLowerCase()));
      const extraction = analyzeJobDescription({ raw: app.jobDescription });
      jdResumeGaps = extraction.requiredSkills
        .filter((s) => !detected.has(s.term.toLowerCase()))
        .map((s) => ({ skill: s.term, evidence: s.evidence }));
    } catch {
      // Resume or JD became unavailable — skip resume-gap derivation honestly.
      jdResumeGaps = [];
    }
  }
  for (const gap of jdResumeGaps) {
    add(gap.skill, "—", "resume", null);
  }

  if (merged.size === 0) return [];

  // Resume coverage from Phase 18 for curriculum topics (domain-known gaps).
  const curriculumGaps = [...merged.values()].filter((g) => g.domain !== "—");
  const coverage = curriculumGaps.length
    ? await getResumeCoverageForGaps(
        userId,
        curriculumGaps.map((g) => ({ topic: g.topic, domain: g.domain }))
      )
    : null;
  const coverageByTopic = new Map(
    (coverage?.coverage ?? []).map((c) => [`${c.domain}::${c.topic.toLowerCase()}`, c])
  );

  const gaps: ApplicationGap[] = [];
  for (const entry of merged.values()) {
    const key = `${entry.domain}::${entry.topic.toLowerCase()}`;
    const cov = coverageByTopic.get(key) ?? null;

    const sourceBits: string[] = [];
    if (entry.sources.has("preparation")) {
      sourceBits.push(
        `measured below the target benchmark in Phase 16 (subject ${entry.domain})`
      );
    }
    if (entry.sources.has("simulation")) {
      sourceBits.push("flagged by your latest placement simulation (Phase 17)");
    }
    if (entry.sources.has("resume")) {
      sourceBits.push("required in the attached job description but not present in your resume (Phase 18)");
    }
    if (cov && cov.coveredInResume === false) {
      sourceBits.push("also not covered in your resume");
    } else if (cov && cov.coveredInResume === true) {
      sourceBits.push("appears in your resume, so interviewers may probe it");
    }

    gaps.push({
      topic: entry.topic,
      domain: entry.domain,
      sources: [...entry.sources],
      priority: entry.priority,
      explanation:
        sourceBits.length > 0
          ? `Why this is listed: ${sourceBits.join("; ")}.`
          : `Why this is listed: identified from your placement data for ${entry.domain}.`,
      resumeCoverage: cov
        ? { coveredInResume: cov.coveredInResume, evidence: cov.evidence, note: cov.note }
        : entry.sources.has("resume")
          ? {
              coveredInResume: false,
              evidence: null,
              note: "Missing from the resume relative to the attached JD. This is a resume gap only — it does not mean you lack the skill.",
            }
          : null,
    });
  }

  const priorityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 } as const;
  return gaps.sort((a, b) => {
    const pa = a.priority ? priorityRank[a.priority] : 3;
    const pb = b.priority ? priorityRank[b.priority] : 3;
    if (pa !== pb) return pa - pb;
    return a.sources.length > b.sources.length ? -1 : a.sources.length < b.sources.length ? 1 : 0;
  });
}

// ============================================================================
// Checklist
// ============================================================================

function buildChecklistFacts(
  app: typeof applications.$inferSelect,
  interviews: ApplicationInterviewRecord[],
  hasSim: boolean
): ChecklistFacts {
  const status = app.status as ApplicationStatus;
  return {
    targetSelected: Boolean(app.companyId && app.roleId),
    resumeAttached: Boolean(app.resumeVariantId),
    resumeAtsScore: app.resumeAtsScore,
    hasJobDescription: Boolean(app.jobDescription && app.jobDescription.trim().length > 0),
    eligibilityReviewed: !isTerminalStatus(status) && STATUS_RANK[status] >= STATUS_RANK.ELIGIBLE,
    appliedAt: app.appliedAt,
    status,
    hasAssessmentRecord: true, // replaced below by caller-aware overload
    hasInterviewRecord: interviews.length > 0,
    interviewPreparationLinked: hasSim,
  };
}

// ============================================================================
// Detail
// ============================================================================

export async function getApplicationDetail(
  userId: string,
  applicationId: string
): Promise<ApplicationDetail> {
  const app = await loadApplication(applicationId, userId);

  const [timeline, interviewRows, assessmentRows, offerRows, readiness, gaps] = await Promise.all([
    getApplicationTimeline(userId, app.id),
    db
      .select()
      .from(applicationInterviews)
      .where(eq(applicationInterviews.applicationId, app.id))
      .orderBy(asc(applicationInterviews.roundNumber)),
    db
      .select()
      .from(applicationAssessments)
      .where(eq(applicationAssessments.applicationId, app.id))
      .orderBy(asc(applicationAssessments.createdAt)),
    db
      .select()
      .from(applicationOffers)
      .where(eq(applicationOffers.applicationId, app.id))
      .orderBy(desc(applicationOffers.createdAt)),
    buildReadinessSnapshot(userId, app),
    buildApplicationGaps(userId, app),
  ]);

  const interviews = interviewRows.map(toInterviewRecord);
  const assessments = assessmentRows.map(toAssessmentRecord);
  const offers = offerRows.map(toOfferRecord);

  const sims = await getStudentSimulationHistory(userId);
  const hasSim = sims.some((s) => s.status === "completed");

  const facts = buildChecklistFacts(app, interviews, hasSim);
  facts.hasAssessmentRecord = assessments.length > 0;
  const checklist = deriveChecklist(facts);

  const targets = await getStudentPlacementTargets(userId);

  let jdExtraction: ApplicationDetail["jobDescription"] extends null ? never : NonNullable<ApplicationDetail["jobDescription"]>["extraction"] | null = null;
  if (app.jobDescription) {
    const extraction = analyzeJobDescription({ raw: app.jobDescription });
    jdExtraction = {
      requiredSkills: extraction.requiredSkills.map((s) => ({ skill: s.term, evidence: s.evidence })),
      preferredSkills: extraction.preferredSkills.map((s) => ({ skill: s.term, evidence: s.evidence })),
      keywords: extraction.keywords.slice(0, 15).map((k) => ({ term: k.term, count: k.count })),
      responsibilities: extraction.responsibilities,
      qualifications: extraction.qualifications,
      roleTerminology: extraction.roleTerminology,
      warnings: extraction.warnings,
    };
  }

  const status = app.status as ApplicationStatus;

  return {
    application: toSummary(app),
    notes: app.notes,
    jobDescription: app.jobDescription
      ? { raw: app.jobDescription, extraction: jdExtraction }
      : null,
    readiness,
    gaps,
    checklist,
    timeline,
    interviews,
    assessments,
    offers,
    allowedTransitions: listTransitions(status),
    targets: {
      configured: targets.configured,
      isTargetCompany: Boolean(app.companyId && targets.primaryCompany?.id === app.companyId),
      isTargetRole: Boolean(app.roleId && targets.primaryRole?.id === app.roleId),
    },
  };
}

// ============================================================================
// Dashboard card — compact pipeline summary for the main dashboard
// ============================================================================

export interface ApplicationDashboardCard {
  show: boolean;
  activeApplications: number;
  interviews: number;
  assessments: number;
  offers: number;
  nextDeadline: {
    companyName: string;
    roleName: string;
    date: string;
    daysRemaining: number | null;
    label: string;
  } | null;
  pipeline: ApplicationsPipelineCount[];
  ctaHref: string;
  ctaLabel: string;
}

export async function getApplicationDashboardCard(
  userId: string
): Promise<ApplicationDashboardCard> {
  const board = await getApplicationsBoard(userId);
  const next = board.upcoming[0] ?? null;

  return {
    show: true,
    activeApplications: board.totals.activeApplications,
    interviews: board.totals.interviews,
    assessments: board.totals.assessments,
    offers: board.totals.offers,
    nextDeadline: next
      ? {
          companyName: next.companyName,
          roleName: next.roleName,
          date: next.date,
          daysRemaining: next.daysRemaining,
          label: next.label,
        }
      : null,
    pipeline: board.pipeline,
    ctaHref: "/applications",
    ctaLabel: "View Applications",
  };
}

// ============================================================================
// Catalog search passthrough (used by the UI; avoids a second catalog API)
// ============================================================================

export { EVENT_LABELS, APPLICATION_EVENT_TYPES, STATUS_LABELS, PIPELINE_ORDER, isActiveStatus } from "@/lib/applications/domain";
