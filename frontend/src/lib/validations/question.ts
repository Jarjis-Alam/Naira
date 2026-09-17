import { z } from "zod";

export const questionTypeEnum = z.enum(["single_choice", "multiple_choice"]);
export const questionDifficultyEnum = z.enum(["easy", "medium", "hard"]);

export const createQuestionSchema = z
  .object({
    question: z
      .string({ message: "Question text is required." })
      .trim()
      .min(5, "Question prompt must be at least 5 characters.")
      .max(3000, "Question prompt cannot exceed 3000 characters."),
    questionType: questionTypeEnum.default("single_choice"),
    subjectId: z
      .string({ message: "Subject is required." })
      .regex(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
        "Invalid subject ID format."
      ),
    topicId: z
      .string({ message: "Topic is required." })
      .regex(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
        "Invalid topic ID format."
      ),
    difficulty: questionDifficultyEnum.default("medium"),
    marks: z
      .number({ message: "Marks are required." })
      .int("Marks must be an integer.")
      .min(1, "Marks must be at least 1.")
      .max(20, "Marks cannot exceed 20."),
    expectedTime: z
      .number({ message: "Expected time is required." })
      .int("Expected time must be an integer.")
      .min(10, "Expected time must be at least 10 seconds.")
      .max(600, "Expected time cannot exceed 600 seconds (10 minutes)."),
    options: z
      .array(z.string().trim().min(1, "Option text cannot be empty."))
      .min(2, "At least two options are required.")
      .max(8, "Cannot exceed 8 options.")
      .refine(
        (opts) => new Set(opts).size === opts.length,
        "All options must be unique."
      ),
    correctAnswer: z.union([
      z.string().trim().min(1, "Correct answer key is required."),
      z.array(z.string().trim().min(1)).min(1, "At least one correct answer is required."),
    ]),
    explanation: z
      .string()
      .trim()
      .max(2000, "Explanation cannot exceed 2000 characters.")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const opts = data.options;
    if (data.questionType === "single_choice") {
      if (typeof data.correctAnswer !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Single-choice question must have a single correct answer string.",
          path: ["correctAnswer"],
        });
      } else if (!opts.includes(data.correctAnswer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Correct answer must exactly match one of the options.",
          path: ["correctAnswer"],
        });
      }
    } else if (data.questionType === "multiple_choice") {
      const answers = Array.isArray(data.correctAnswer)
        ? data.correctAnswer
        : [data.correctAnswer];
      if (answers.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple-choice questions must specify at least one correct answer.",
          path: ["correctAnswer"],
        });
      }
      for (const ans of answers) {
        if (!opts.includes(ans)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Selected answer "${ans}" does not match any provided option.`,
            path: ["correctAnswer"],
          });
        }
      }
    }
  });

export const updateQuestionSchema = createQuestionSchema;

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
