import { z } from "zod";

/**
 * Phase 19 — Application API validation.
 *
 * Mirrors the domain vocabulary exactly: only legal enum members, only real
 * transitions. Dates arrive as ISO strings; nothing is inferred.
 */

export const applicationStatusSchema = z.enum([
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
]);

export const applicationSourceSchema = z.enum([
  "company_website",
  "referral",
  "job_portal",
  "campus_placement",
  "recruiter",
  "other",
]);

export const interviewTypeSchema = z.enum([
  "Technical",
  "Coding",
  "HR",
  "Managerial",
  "Behavioral",
  "Group Discussion",
  "Other",
]);

export const interviewResultSchema = z.enum(["pending", "cleared", "not_cleared", "awaiting_result"]);

export const assessmentStatusSchema = z.enum(["scheduled", "completed", "missed", "expired"]);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length <= max, { message: `Must be at most ${max} characters` });

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: "Invalid date" })
  .transform((v) => new Date(v));

/**
 * Catalog ids are deterministic UUID-shaped strings (e.g. seeded canonical
 * rows like 00000000-…-000000000703). Zod v4's `.uuid()` rejects those, which
 * made every application for a canonical company fail validation at the API
 * boundary while the service layer worked — so we accept the catalog's actual
 * id format instead of imposing a stricter RFC-variant rule than the data.
 */
const catalogId = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, {
    message: "Invalid id",
  });

export const applicationCreateSchema = z.object({
  companyId: catalogId.optional(),
  roleId: catalogId.optional(),
  source: applicationSourceSchema.optional(),
  jobDescription: z.string().max(40000).optional(),
  deadline: isoDate.optional(),
  location: optionalTrimmed(255).optional(),
  employmentType: optionalTrimmed(60).optional(),
  packageText: optionalTrimmed(120).optional(),
  notes: z.string().max(10000).optional(),
  resumeVariantId: catalogId.optional(),
  initialStatus: applicationStatusSchema.optional(),
});

export const applicationUpdateSchema = z
  .object({
    deadline: isoDate.nullable().optional(),
    assessmentDeadline: isoDate.nullable().optional(),
    interviewDate: isoDate.nullable().optional(),
    offerDeadline: isoDate.nullable().optional(),
    location: optionalTrimmed(255).nullable().optional(),
    employmentType: optionalTrimmed(60).nullable().optional(),
    packageText: optionalTrimmed(120).nullable().optional(),
    source: applicationSourceSchema.nullable().optional(),
    notes: z.string().max(10000).optional(),
    resumeVariantId: catalogId.nullable().optional(),
    jobDescription: z.string().max(40000).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "No changes provided" }
  );

export const applicationStatusUpdateSchema = z.object({
  status: applicationStatusSchema,
  note: z.string().max(500).optional(),
});

export const applicationNoteSchema = z.object({
  title: z.string().min(1).max(255),
  detail: z.string().max(2000).optional(),
});

export const interviewScheduleSchema = z.object({
  roundType: interviewTypeSchema,
  scheduledAt: isoDate,
  userNotes: z.string().max(2000).optional(),
});

export const interviewCompleteSchema = z.object({
  result: interviewResultSchema,
  completedAt: isoDate.optional(),
  interviewerNotes: z.string().max(5000).optional(),
  userNotes: z.string().max(2000).optional(),
});

export const assessmentCreateSchema = z.object({
  name: z.string().min(1).max(255),
  assessmentType: optionalTrimmed(120).optional(),
  scheduledAt: isoDate.optional(),
  deadline: isoDate.optional(),
  notes: z.string().max(5000).optional(),
});

export const assessmentUpdateSchema = z
  .object({
    status: assessmentStatusSchema.optional(),
    scoreText: optionalTrimmed(120).nullable().optional(),
    notes: z.string().max(5000).optional(),
    deadline: isoDate.nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "No changes provided",
  });

export const offerCreateSchema = z.object({
  offerDate: isoDate.optional(),
  compensationText: optionalTrimmed(255).optional(),
  location: optionalTrimmed(255).optional(),
  joiningDate: isoDate.optional(),
  offerDeadline: isoDate.optional(),
  notes: z.string().max(5000).optional(),
});
