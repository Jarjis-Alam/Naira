import { z } from "zod";

/**
 * Phase 18 — request validation contracts.
 *
 * Every resume endpoint validates its payload here, server-side, before any
 * database work. Strings are length-bounded so no unbounded blob can be stored,
 * and the structured resume payload is validated field by field rather than
 * trusted as opaque JSON.
 */

const uuid = z.string().uuid();
const optionalName = z.string().trim().max(255).nullable().optional();

export const RESUME_SECTION_KEY_VALUES = [
  "summary",
  "education",
  "experience",
  "internships",
  "projects",
  "skills",
  "certifications",
  "achievements",
  "publications",
  "leadership",
  "extracurriculars",
  "links",
  "other",
] as const;

export const jobDescriptionInputSchema = z.object({
  raw: z.string().trim().min(20, "Paste at least a few lines of the job description.").max(20000),
  source: z.enum(["paste", "upload"]).optional(),
  providedRoleTitle: z.string().trim().max(120).nullable().optional(),
  providedCompanyName: z.string().trim().max(120).nullable().optional(),
});

export const resumeVariantCreateSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  sourceFileId: uuid.optional(),
  companyId: uuid.nullable().optional(),
  companyName: optionalName,
  roleId: uuid.nullable().optional(),
  roleName: optionalName,
  makePrimary: z.boolean().optional(),
  jobDescription: jobDescriptionInputSchema.nullable().optional(),
});

export const resumeVariantUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    companyId: uuid.nullable().optional(),
    companyName: optionalName,
    roleId: uuid.nullable().optional(),
    roleName: optionalName,
    status: z.enum(["active", "archived"]).optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes were supplied.");

const resumeDatesSchema = z.object({
  raw: z.string().max(120).nullable(),
  start: z.string().max(20).nullable(),
  end: z.string().max(20).nullable(),
  isCurrent: z.boolean(),
});

const resumeEntrySchema = z.object({
  id: z.string().min(1).max(64),
  heading: z.string().max(400),
  title: z.string().max(300).nullable(),
  organization: z.string().max(300).nullable(),
  dates: resumeDatesSchema,
  bullets: z.array(z.string().max(1200)).max(40),
  rawLines: z.array(z.string().max(1200)).max(80).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

const resumeSectionSchema = z.object({
  key: z.enum(RESUME_SECTION_KEY_VALUES),
  originalHeading: z.string().max(120).nullable(),
  order: z.number().int().min(0).max(200).optional(),
  entries: z.array(resumeEntrySchema).max(40).optional(),
  items: z.array(z.string().max(800)).max(120).optional(),
  rawLines: z.array(z.string().max(2000)).max(400).optional(),
  recognized: z.boolean().optional(),
});

const resumeHeaderSchema = z.object({
  name: z.string().max(200).nullable(),
  email: z.string().max(200).nullable(),
  phone: z.string().max(80).nullable(),
  location: z.string().max(200).nullable(),
  links: z.array(z.string().max(400)).max(20),
  rawLines: z.array(z.string().max(400)).max(40).optional(),
});

/**
 * Server-side validation for builder edits. Only the editable fields are
 * accepted; anything else in the payload is stripped rather than stored.
 */
export const structuredResumeUpdateSchema = z.object({
  header: resumeHeaderSchema.optional(),
  summary: z.string().max(2500).nullable().optional(),
  sections: z.array(resumeSectionSchema).max(30).optional(),
  skills: z
    .object({
      groups: z
        .array(
          z.object({
            label: z.string().max(80).nullable(),
            skills: z.array(z.string().max(120)).max(120),
            rawLine: z.string().max(2000),
          })
        )
        .max(30),
      detected: z.array(z.string().max(120)).max(300).optional(),
      rawLines: z.array(z.string().max(2000)).max(200).optional(),
    })
    .optional(),
  links: z.array(z.string().max(400)).max(30).optional(),
  studentAssertedFacts: z
    .array(
      z.object({
        id: z.string().max(80),
        kind: z.enum(["skill", "experience", "achievement", "certification", "project"]),
        value: z.string().max(200),
        note: z.string().max(500).nullable(),
        assertedAt: z.string().max(40),
      })
    )
    .max(200)
    .optional(),
});

export const suggestionDecisionSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
});

export const resumeVersionCreateSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
});

export const resumeExportQuerySchema = z.object({
  format: z.enum(["txt", "html"]).default("txt"),
});

export const studentAssertedSkillSchema = z.object({
  skill: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).nullable().optional(),
  asserted: z.boolean(),
});

export type ResumeVariantCreateInput = z.infer<typeof resumeVariantCreateSchema>;
export type ResumeVariantUpdateInput = z.infer<typeof resumeVariantUpdateSchema>;
export type JobDescriptionInput = z.infer<typeof jobDescriptionInputSchema>;
export type StructuredResumeUpdateInput = z.infer<typeof structuredResumeUpdateSchema>;
