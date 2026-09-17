import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  numeric,
  pgEnum,
  check,
  customType,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// === Enums ===
export const difficultyEnum = pgEnum("difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const questionTypeEnum = pgEnum("question_type", [
  "single_choice",
  "multiple_choice",
]);

export const testTypeEnum = pgEnum("test_type", [
  "aptitude",
  "cs_fundamentals",
  "mixed",
  "baseline",
]);

export const testStatusEnum = pgEnum("test_status", [
  "draft",
  "published",
  "closed",
  "archived",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "submitted",
  "expired",
]);

// === Users ===
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// === Profiles ===
export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  college: varchar("college", { length: 255 }),
  branch: varchar("branch", { length: 255 }),
  graduationYear: integer("graduation_year"),
  preferredLanguage: varchar("preferred_language", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// === Subjects ===
export const subjects = pgTable("subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  category: varchar("category", { length: 50 }).notNull(), // 'aptitude' or 'cs'
  displayOrder: integer("display_order").notNull().default(0),
});

// === Topics ===
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (table) => [index("topics_subject_id_idx").on(table.subjectId)]
);

// === Questions ===
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    question: text("question").notNull(),
    questionType: questionTypeEnum("question_type").notNull(),
    options: jsonb("options").notNull(), // string[]
    correctAnswer: jsonb("correct_answer").notNull(), // string or string[]
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    difficulty: difficultyEnum("difficulty").notNull(),
    marks: integer("marks").notNull().default(2),
    explanation: text("explanation"),
    expectedTime: integer("expected_time"), // seconds
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("questions_subject_id_idx").on(table.subjectId),
    index("questions_topic_id_idx").on(table.topicId),
    index("questions_difficulty_idx").on(table.difficulty),
  ]
);

// === Tests ===
export const tests = pgTable(
  "tests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    instructions: text("instructions"), // nullable plain-text pre-start instructions; NULL/empty = none
    type: testTypeEnum("type").notNull(),
    duration: integer("duration").notNull(), // minutes
    difficulty: difficultyEnum("difficulty"),
    totalMarks: integer("total_marks").notNull(),
    negativeMarkingEnabled: boolean("negative_marking_enabled").notNull().default(false),
    negativeMarkRate: numeric("negative_mark_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
    randomizeQuestions: boolean("randomize_questions").notNull().default(false),
    randomizeOptions: boolean("randomize_options").notNull().default(false),
    attemptLimit: integer("attempt_limit"), // NULL = unlimited; >= 1 = max submitted attempts per user/test
    status: testStatusEnum("status").notNull().default("draft"),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
    scheduleTimezone: varchar("schedule_timezone", { length: 100 }),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "tests_schedule_range_check",
      sql`${table.scheduledEndAt} IS NULL OR ${table.scheduledStartAt} IS NULL OR ${table.scheduledEndAt} > ${table.scheduledStartAt}`
    ),
    index("tests_status_idx").on(table.status),
    index("tests_type_status_idx").on(table.type, table.status),
    index("tests_schedule_window_idx").on(table.scheduledStartAt, table.scheduledEndAt),
  ]
);

// === Test Sections ===
export const testSections = pgTable(
  "test_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    sectionOrder: integer("section_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("test_sections_test_id_idx").on(table.testId),
    uniqueIndex("test_sections_test_order_idx").on(table.testId, table.sectionOrder),
  ]
);

// === Test Questions (join table) ===
export const testQuestions = pgTable(
  "test_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => testSections.id, { onDelete: "cascade" }),
    questionOrder: integer("question_order").notNull(),
  },
  (table) => [
    uniqueIndex("test_questions_unique_idx").on(table.testId, table.questionId),
    index("test_questions_test_id_idx").on(table.testId),
    index("test_questions_section_id_idx").on(table.sectionId),
  ]
);

// === Question Pools ===
export const questionPools = pgTable(
  "question_pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => testSections.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    selectionCount: integer("selection_count").notNull(),
    poolOrder: integer("pool_order").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("question_pools_selection_count_check", sql`${table.selectionCount} >= 1`),
    index("question_pools_test_id_idx").on(table.testId),
    index("question_pools_section_id_idx").on(table.sectionId),
    uniqueIndex("question_pools_section_pool_order_idx").on(table.sectionId, table.poolOrder),
  ]
);

// === Question Pool Questions (membership join table) ===
export const questionPoolQuestions = pgTable(
  "question_pool_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => questionPools.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    questionOrder: integer("question_order").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("question_pool_questions_unique_idx").on(table.poolId, table.questionId),
    index("question_pool_questions_pool_id_idx").on(table.poolId),
    index("question_pool_questions_question_id_idx").on(table.questionId),
  ]
);

// === Attempts ===
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    negativeMarkingEnabled: boolean("negative_marking_enabled"),
    negativeMarkRate: numeric("negative_mark_rate", { precision: 5, scale: 2 }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    score: real("score"),
    accuracy: real("accuracy"),
    timeTaken: integer("time_taken"), // seconds
    currentQuestion: integer("current_question").notNull().default(0),
    remainingTime: integer("remaining_time"), // seconds (synced periodically)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attempts_user_id_idx").on(table.userId),
    index("attempts_test_id_idx").on(table.testId),
    index("attempts_status_idx").on(table.status),
    index("attempts_submitted_at_idx").on(table.submittedAt),
    index("attempts_test_status_submitted_idx").on(table.testId, table.status, table.submittedAt),
  ]
);

// === Attempt Questions (resolved question order per attempt) ===
export const attemptQuestions = pgTable(
  "attempt_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => testSections.id, { onDelete: "cascade" }),
    questionOrder: integer("question_order").notNull(),
    optionOrder: jsonb("option_order"),
    questionTextSnapshot: text("question_text_snapshot"),
    questionTypeSnapshot: questionTypeEnum("question_type_snapshot"),
    marksSnapshot: integer("marks_snapshot"),
    optionsSnapshot: jsonb("options_snapshot"),
    correctAnswerSnapshot: jsonb("correct_answer_snapshot"),
    poolId: uuid("pool_id").references(() => questionPools.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("attempt_questions_unique_idx").on(table.attemptId, table.questionId),
    uniqueIndex("attempt_questions_order_idx").on(table.attemptId, table.questionOrder),
    index("attempt_questions_attempt_id_idx").on(table.attemptId),
    index("attempt_questions_section_id_idx").on(table.sectionId),
    index("attempt_questions_pool_id_idx").on(table.poolId),
    index("attempt_questions_question_id_idx").on(table.questionId),
  ]
);

// === Answers ===
export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    selectedAnswer: jsonb("selected_answer"), // string or string[] or null
    isCorrect: boolean("is_correct"),
    timeSpent: integer("time_spent").default(0), // seconds
    markedForReview: boolean("marked_for_review").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("answers_attempt_question_idx").on(
      table.attemptId,
      table.questionId
    ),
    index("answers_attempt_id_idx").on(table.attemptId),
    index("answers_question_id_idx").on(table.questionId),
    index("answers_question_is_correct_idx").on(table.questionId, table.isCorrect),
  ]
);

// === Skill Scores (per attempt, per subject/topic) ===
export const skillScores = pgTable(
  "skill_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    topicId: uuid("topic_id").references(() => topics.id),
    score: real("score").notNull(),
    total: real("total").notNull(),
    accuracy: real("accuracy").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("skill_scores_attempt_id_idx").on(table.attemptId),
    index("skill_scores_subject_id_idx").on(table.subjectId),
  ]
);

// === Companies (Phase 11A) ===
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 100 }).notNull(),
    description: text("description"),
    website: varchar("website", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("companies_normalized_name_idx").on(table.normalizedName),
    uniqueIndex("companies_slug_idx").on(table.slug),
    index("companies_industry_idx").on(table.industry),
    index("companies_is_active_idx").on(table.isActive),
  ]
);

// === Roles (Phase 11A) ===
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("roles_normalized_name_idx").on(table.normalizedName),
    uniqueIndex("roles_slug_idx").on(table.slug),
    index("roles_category_idx").on(table.category),
    index("roles_is_active_idx").on(table.isActive),
  ]
);

// === Student Target Roles (Phase 11A) ===
export const studentTargetRoles = pgTable(
  "student_target_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("student_target_roles_user_role_idx").on(table.userId, table.roleId),
    uniqueIndex("student_target_roles_single_primary_idx")
      .on(table.userId)
      .where(sql`${table.isPrimary} = true`),
    index("student_target_roles_role_id_idx").on(table.roleId),
  ]
);

// === Student Target Companies (Phase 11A) ===
export const studentTargetCompanies = pgTable(
  "student_target_companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    priority: integer("priority").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("student_target_companies_user_company_idx").on(
      table.userId,
      table.companyId
    ),
    index("student_target_companies_user_id_idx").on(table.userId),
    index("student_target_companies_company_id_idx").on(table.companyId),
  ]
);

// === Placement Simulations (Phase 17) ===
export const simulationStatusEnum = pgEnum("simulation_status", [
  "not_started",
  "in_progress",
  "round_completed",
  "paused",
  "completed",
  "abandoned",
]);

export const simulationRoundStatusEnum = pgEnum("simulation_round_status", [
  "locked",
  "unlocked",
  "in_progress",
  "completed",
  "skipped",
]);

export const simulationRoundTypeEnum = pgEnum("simulation_round_type", [
  "screening",
  "coding",
  "debugging",
  "tech_interview",
  "hr_interview",
]);

export const placementSimulations = pgTable(
  "placement_simulations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    roleName: varchar("role_name", { length: 255 }).notNull(),
    status: simulationStatusEnum("status").notNull().default("in_progress"),
    isGeneralizedRole: boolean("is_generalized_role").notNull().default(false),
    currentRoundOrder: integer("current_round_order").notNull().default(1),
    totalRounds: integer("total_rounds").notNull().default(5),
    overallReadinessScore: real("overall_readiness_score"),
    aptitudeScore: real("aptitude_score"),
    technicalScore: real("technical_score"),
    codingScore: real("coding_score"),
    debuggingScore: real("debugging_score"),
    interviewScore: real("interview_score"),
    hrScore: real("hr_score"),
    readinessLevel: varchar("readiness_level", { length: 50 }),
    eligibilityCheck: jsonb("eligibility_check"), // { isEligible, criteria, note }
    summaryReport: jsonb("summary_report"), // { strengths, needsImprovement, recommendations }
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("placement_simulations_user_id_idx").on(table.userId),
    index("placement_simulations_status_idx").on(table.status),
  ]
);

export const placementSimulationRounds = pgTable(
  "placement_simulation_rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    simulationId: uuid("simulation_id")
      .notNull()
      .references(() => placementSimulations.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    roundType: simulationRoundTypeEnum("round_type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: simulationRoundStatusEnum("status").notNull().default("locked"),
    score: real("score"),
    maxScore: real("max_score"),
    accuracy: real("accuracy"),
    durationMinutes: integer("duration_minutes").default(30),
    timeTakenSeconds: integer("time_taken_seconds").default(0),
    testId: uuid("test_id").references(() => tests.id, { onDelete: "set null" }),
    attemptId: uuid("attempt_id").references(() => attempts.id, { onDelete: "set null" }),
    roundData: jsonb("round_data"), // Stores questions, submissions, test cases, chat transcript, feedback
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("placement_simulation_rounds_sim_round_idx").on(
      table.simulationId,
      table.roundNumber
    ),
    index("placement_simulation_rounds_simulation_id_idx").on(table.simulationId),
  ]
);

// ============================================================================
// ATS Resume Intelligence (Phase 18)
// ============================================================================

/**
 * Raw byte storage for uploaded resumes. Files are stored privately in Postgres
 * and are only ever served through an ownership-checked server route, never a
 * public URL.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const resumeParseStatusEnum = pgEnum("resume_parse_status", [
  "pending",
  "parsed",
  "partial",
  "failed",
]);

export const resumeVariantStatusEnum = pgEnum("resume_variant_status", [
  "active",
  "archived",
]);

export const resumeSuggestionStatusEnum = pgEnum("resume_suggestion_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const resumeFileFormatEnum = pgEnum("resume_file_format", [
  "pdf",
  "docx",
  "txt",
]);

/** Provenance of every fact that surfaces in resume intelligence. */
export const resumeEvidenceSourceEnum = pgEnum("resume_evidence_source", [
  "resume_detected",
  "student_asserted",
  "job_description_detected",
  "ats_formatting",
]);

// === Resume Files (raw private uploads) ===
export const resumeFiles = pgTable(
  "resume_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    fileFormat: resumeFileFormatEnum("file_format").notNull(),
    byteSize: integer("byte_size").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    data: bytea("data").notNull(),
    rawText: text("raw_text").notNull().default(""),
    pageCount: integer("page_count"),
    parseStatus: resumeParseStatusEnum("parse_status").notNull().default("pending"),
    parseWarnings: jsonb("parse_warnings"), // string[]
    fileSignals: jsonb("file_signals"), // observable structural signals used by the ATS engine
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("resume_files_user_id_idx").on(table.userId),
    // Unique per user + content hash: one stored copy of each distinct document
    // per student. The upload path updates this row on retry instead of ever
    // inserting a duplicate, so a failed parse never forks the identity.
    uniqueIndex("resume_files_user_hash_key").on(table.userId, table.contentHash),
  ]
);

// === Resume Variants (targeted versions) ===
export const resumeVariants = pgTable(
  "resume_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    targetCompanyId: uuid("target_company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    targetCompanyName: varchar("target_company_name", { length: 255 }),
    targetRoleId: uuid("target_role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    targetRoleName: varchar("target_role_name", { length: 255 }),
    sourceFileId: uuid("source_file_id").references(() => resumeFiles.id, {
      onDelete: "set null",
    }),
    structuredData: jsonb("structured_data")
      .notNull()
      .default(sql`'{}'::jsonb`),
    jobDescription: jsonb("job_description"),
    atsScore: real("ats_score"),
    atsBreakdown: jsonb("ats_breakdown"),
    matchScore: real("match_score"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: resumeVariantStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("resume_variants_user_id_idx").on(table.userId),
    index("resume_variants_status_idx").on(table.status),
    uniqueIndex("resume_variants_single_primary_idx")
      .on(table.userId)
      .where(sql`${table.isPrimary} = true`),
  ]
);

// === Resume Analyses (append-only analysis runs) ===
export const resumeAnalyses = pgTable(
  "resume_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => resumeVariants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    atsScore: real("ats_score").notNull(),
    matchScore: real("match_score"),
    breakdown: jsonb("breakdown").notNull(),
    explanation: jsonb("explanation"),
    findings: jsonb("findings"),
    keywordAnalysis: jsonb("keyword_analysis"),
    skillMatch: jsonb("skill_match"),
    roleMatch: jsonb("role_match"),
    contentQuality: jsonb("content_quality"),
    parsingChecks: jsonb("parsing_checks"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("resume_analyses_variant_idx").on(table.variantId, table.analyzedAt),
    index("resume_analyses_user_id_idx").on(table.userId),
  ]
);

// === Resume Suggestions (before/after, truth-verified) ===
export const resumeSuggestions = pgTable(
  "resume_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => resumeVariants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 60 }).notNull(),
    target: jsonb("target").notNull(),
    originalText: text("original_text"),
    suggestedText: text("suggested_text"),
    reasonWhat: text("reason_what").notNull(),
    reasonWhy: text("reason_why").notNull(),
    reasonEvidence: text("reason_evidence").notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("info"),
    actionable: boolean("actionable").notNull().default(false),
    verification: jsonb("verification"),
    source: resumeEvidenceSourceEnum("source").notNull().default("resume_detected"),
    status: resumeSuggestionStatusEnum("status").notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("resume_suggestions_variant_status_idx").on(table.variantId, table.status),
    index("resume_suggestions_user_id_idx").on(table.userId),
  ]
);

// === Resume Versions (meaningful snapshots) ===
export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => resumeVariants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    structuredData: jsonb("structured_data").notNull(),
    atsScore: real("ats_score"),
    matchScore: real("match_score"),
    changeSummary: jsonb("change_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("resume_versions_variant_number_idx").on(
      table.variantId,
      table.versionNumber
    ),
    index("resume_versions_user_id_idx").on(table.userId),
  ]
);

// === Application Status (Phase 19) ===
export const applicationStatusEnum = pgEnum("application_status", [
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

export const applicationEventTypeEnum = pgEnum("application_event_type", [
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
]);

export const applicationInterviewTypeEnum = pgEnum("application_interview_type", [
  "Technical",
  "Coding",
  "HR",
  "Managerial",
  "Behavioral",
  "Group Discussion",
  "Other",
]);

export const applicationInterviewResultEnum = pgEnum("application_interview_result", [
  "pending",
  "cleared",
  "not_cleared",
  "awaiting_result",
]);

export const applicationAssessmentStatusEnum = pgEnum("application_assessment_status", [
  "scheduled",
  "completed",
  "missed",
  "expired",
]);

// === Applications (Phase 19 — Placement Application OS) ===
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    roleName: varchar("role_name", { length: 255 }).notNull(),
    jobDescription: text("job_description"),
    source: varchar("source", { length: 120 }),
    status: applicationStatusEnum("status").notNull().default("INTERESTED"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true }),
    assessmentDeadline: timestamp("assessment_deadline", { withTimezone: true }),
    interviewDate: timestamp("interview_date", { withTimezone: true }),
    offerDeadline: timestamp("offer_deadline", { withTimezone: true }),
    location: varchar("location", { length: 255 }),
    employmentType: varchar("employment_type", { length: 60 }),
    packageText: varchar("package_text", { length: 120 }),
    notes: text("notes"),
    resumeVariantId: uuid("resume_variant_id").references(() => resumeVariants.id, {
      onDelete: "set null",
    }),
    resumeLabel: varchar("resume_label", { length: 255 }),
    resumeAtsScore: real("resume_ats_score"),
    resumeMatchScore: real("resume_match_score"),
    reopenedCount: integer("reopened_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("applications_user_status_idx").on(table.userId, table.status),
    index("applications_user_deadline_idx").on(table.userId, table.deadline),
    index("applications_user_updated_idx").on(table.userId, table.updatedAt),
    index("applications_company_idx").on(table.companyId),
    index("applications_role_idx").on(table.roleId),
  ]
);

// === Application Events (append-only timeline) ===
export const applicationEvents = pgTable(
  "application_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: applicationEventTypeEnum("event_type").notNull(),
    previousStatus: applicationStatusEnum("previous_status"),
    newStatus: applicationStatusEnum("new_status"),
    title: varchar("title", { length: 255 }),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("application_events_application_time_idx").on(
      table.applicationId,
      table.occurredAt
    ),
    index("application_events_user_idx").on(table.userId),
  ]
);

// === Application Interviews ===
export const applicationInterviews = pgTable(
  "application_interviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    roundType: applicationInterviewTypeEnum("round_type").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    result: applicationInterviewResultEnum("result").notNull().default("pending"),
    interviewerNotes: text("interviewer_notes"),
    userNotes: text("user_notes"),
    // Phase 20 — optional student-reported interview feedback (student_note evidence).
    difficulty: text("difficulty"),
    topicsDiscussed: jsonb("topics_discussed").$type<string[]>(),
    studentConfidence: text("student_confidence"),
    questionsRemembered: jsonb("questions_remembered").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("application_interviews_application_idx").on(
      table.applicationId,
      table.roundNumber
    ),
    index("application_interviews_user_idx").on(table.userId),
    index("application_interviews_scheduled_idx").on(table.userId, table.scheduledAt),
  ]
);

// === Application Assessments ===
export const applicationAssessments = pgTable(
  "application_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    assessmentType: varchar("assessment_type", { length: 120 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true }),
    status: applicationAssessmentStatusEnum("status").notNull().default("scheduled"),
    scoreText: varchar("score_text", { length: 120 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("application_assessments_application_idx").on(table.applicationId),
    index("application_assessments_user_idx").on(table.userId),
    index("application_assessments_deadline_idx").on(table.userId, table.deadline),
  ]
);

// === Application Offers (user-provided financial data only) ===
export const applicationOffers = pgTable(
  "application_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    roleName: varchar("role_name", { length: 255 }).notNull(),
    offerDate: timestamp("offer_date", { withTimezone: true }),
    compensationText: varchar("compensation_text", { length: 255 }),
    location: varchar("location", { length: 255 }),
    joiningDate: timestamp("joining_date", { withTimezone: true }),
    offerDeadline: timestamp("offer_deadline", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("application_offers_application_idx").on(table.applicationId),
    index("application_offers_user_idx").on(table.userId),
  ]
);

// === Application Reflections (Phase 20 — Outcome Intelligence) ===
/**
 * Post-outcome student reflection. Every field is optional, free-text,
 * student-provided, and NEVER treated as a verified fact: the outcome engine
 * maps these to `student_note` evidence with confidence "student_reported".
 */
export const applicationReflections = pgTable(
  "application_reflections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    whatWentWell: text("what_went_well"),
    whatWasDifficult: text("what_was_difficult"),
    whatWasAsked: text("what_was_asked"),
    whatWouldImprove: text("what_would_improve"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One reflection per application per student.
    uniqueIndex("application_reflections_application_unique").on(table.applicationId),
    index("application_reflections_user_idx").on(table.userId),
  ]
);

// === Phase 24 — Adaptive Study Planner ===

export const studyPlanStatusEnum = pgEnum("study_plan_status", [
  "ACTIVE",
  "ARCHIVED",
  "RECALIBRATED",
]);

export const studyPlanItemCategoryEnum = pgEnum("study_plan_item_category", [
  "FIX",
  "REINFORCE",
  "REVIEW",
  "ASSESSMENT",
  "PRACTICE",
]);

export const studyPlanItemStatusEnum = pgEnum("study_plan_item_status", [
  "PENDING",
  "IN_PROGRESS",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "MISSED",
  "RESCHEDULED",
]);

export const studyPlanPriorityEnum = pgEnum("study_plan_priority", [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "MONITOR",
  "INSUFFICIENT_EVIDENCE",
]);

export const adaptiveStudyPlans = pgTable(
  "adaptive_study_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planVersion: integer("plan_version").notNull().default(1),
    status: studyPlanStatusEnum("status").notNull().default("ACTIVE"),
    planningHorizon: varchar("planning_horizon", { length: 32 }).notNull().default("7_days"),
    availableMinutesPerDay: integer("available_minutes_per_day"),
    constraints: jsonb("constraints"),
    summary: text("summary"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    recalibratedAt: timestamp("recalibrated_at", { withTimezone: true }),
    recalibrationReason: text("recalibration_reason"),
  },
  (table) => [
    index("adaptive_study_plans_user_idx").on(table.userId),
    index("adaptive_study_plans_user_status_idx").on(table.userId, table.status),
    index("adaptive_study_plans_generated_idx").on(table.generatedAt),
  ]
);

export const studyPlanItems = pgTable(
  "study_plan_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => adaptiveStudyPlans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 64 }).notNull(),
    topic: varchar("topic", { length: 128 }).notNull(),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    category: studyPlanItemCategoryEnum("category").notNull(),
    priority: studyPlanPriorityEnum("priority").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(),
    sequence: integer("sequence").notNull(),
    reason: text("reason").notNull(),
    evidence: text("evidence").notNull(),
    executionActionId: varchar("execution_action_id", { length: 128 }),
    status: studyPlanItemStatusEnum("status").notNull().default("PENDING"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("study_plan_items_plan_idx").on(table.planId),
    index("study_plan_items_user_date_idx").on(table.userId, table.scheduledDate),
    index("study_plan_items_status_idx").on(table.status),
  ]
);

