import { z } from "zod";

/**
 * Phase 20 — outcome API validation.
 *
 * Reflections and interview feedback are student-reported free text. Nothing
 * here infers or scores; the strictest rule is the one that protects
 * provenance: student input stays student_note evidence, never facts.
 */

const optionalTrimmed = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length <= max, { message: `Must be at most ${max} characters` });

export const reflectionSchema = z
  .object({
    whatWentWell: optionalTrimmed(4000).optional(),
    whatWasDifficult: optionalTrimmed(4000).optional(),
    whatWasAsked: optionalTrimmed(4000).optional(),
    whatWouldImprove: optionalTrimmed(4000).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined && v !== ""), {
    message: "At least one reflection field is required",
  });

export const interviewFeedbackSchema = z.object({
  interviewId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, {
    message: "Invalid interviewId",
  }),
  difficulty: optionalTrimmed(120).nullable().optional(),
  topicsDiscussed: z.array(z.string().min(1).max(120)).max(20).nullable().optional(),
  studentConfidence: optionalTrimmed(120).nullable().optional(),
  questionsRemembered: z.array(z.string().min(1).max(500)).max(20).nullable().optional(),
});
