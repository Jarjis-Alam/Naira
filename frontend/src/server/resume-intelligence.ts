/**
 * Phase 18 — ATS Resume Intelligence service layer.
 *
 * Orchestrates resume upload, parsing, ATS analysis, job-description matching,
 * truth-verified suggestions, the ATS-safe builder, variants, and version
 * history — and integrates the result with Phases 14–17.
 *
 * Security model: every exported function takes the authenticated userId and
 * scopes its queries to that user. Cross-tenant access throws rather than
 * returning empty data, so an ownership bug can never look like "no data".
 */

import { db } from "@/db";
import {
  answers,
  attempts,
  companies,
  questions,
  resumeAnalyses,
  resumeFiles,
  resumeSuggestions,
  resumeVariants,
  resumeVersions,
  roles,
  subjects,
} from "@/db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

import { MAX_RESUME_FILE_BYTES, extractResume } from "@/lib/resume/text-extraction";
import { flattenResumeText, parseStructuredResume } from "@/lib/resume/parse-resume";
import { analyzeJobDescription } from "@/lib/resume/job-description";
import { analyzeResumeAtsScore, type MeasuredDomain } from "@/lib/resume/ats-analysis";
import { applySuggestion, generateSuggestions } from "@/lib/resume/suggestions";
import { renderAtsHtml, renderAtsPlainText } from "@/lib/resume/ats-render";
import {
  detectCanonicalSkills,
  type SubjectCode,
} from "@/lib/resume/skill-taxonomy";
import type {
  AtsAnalysisResult,
  ParseStatus,
  ResumeExtraction,
  ResumeFileFormat,
  ResumeFileSignals,
  ResumeSuggestion,
  StoredJobDescription,
  StructuredResume,
  SuggestionTarget,
  SuggestionVerification,
} from "@/lib/resume/types";

import type { StructuredResumeUpdateInput } from "@/lib/validations/resume";

import { calculateReadiness } from "./readiness";
import { getStudentPlacementTargets } from "./company-role-intelligence";
import { getRoleDomainRequirements } from "./placement-target-strategy";

// ============================================================================
// Public contracts
// ============================================================================

export interface ResumeFileSummary {
  id: string;
  fileName: string;
  fileFormat: ResumeFileFormat;
  byteSize: number;
  pageCount: number | null;
  parseStatus: ParseStatus;
  parseWarnings: string[];
  wordCount: number;
  createdAt: string;
}

export interface ResumeVariantSummary {
  id: string;
  label: string;
  targetCompanyId: string | null;
  targetCompanyName: string | null;
  targetRoleId: string | null;
  targetRoleName: string | null;
  isPrimary: boolean;
  status: "active" | "archived";
  sourceFileId: string | null;
  atsScore: number | null;
  matchScore: number | null;
  hasJobDescription: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSuggestionRecord {
  id: string;
  key: string;
  category: ResumeSuggestion["category"];
  target: SuggestionTarget;
  originalText: string;
  suggestedText: string | null;
  reason: { what: string; why: string; evidence: string };
  severity: ResumeSuggestion["severity"];
  actionable: boolean;
  source: ResumeSuggestion["source"];
  verification: SuggestionVerification;
  status: "pending" | "accepted" | "rejected";
  decidedAt: string | null;
  createdAt: string;
}

export interface ResumeVersionSummary {
  id: string;
  versionNumber: number;
  label: string;
  atsScore: number | null;
  matchScore: number | null;
  createdAt: string;
  changeSummary: Record<string, unknown> | null;
}

export interface ResumeVariantDetail {
  id: string;
  label: string;
  targetCompanyId: string | null;
  targetCompanyName: string | null;
  targetRoleId: string | null;
  targetRoleName: string | null;
  isPrimary: boolean;
  status: "active" | "archived";
  /** Latest stored ATS compatibility score (mirrors analysis.atsScore). */
  atsScore: number | null;
  /** Latest stored target match score (mirrors analysis.roleMatch.score). */
  matchScore: number | null;
  structured: StructuredResume;
  /** Verbatim text extracted from the uploaded document (provenance record). */
  originalRawText: string | null;
  jobDescription: StoredJobDescription | null;
  analysis: AtsAnalysisResult | null;
  suggestions: ResumeSuggestionRecord[];
  versions: ResumeVersionSummary[];
  sourceFile: ResumeFileSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeHealth {
  hasResume: boolean;
  variantId: string | null;
  label: string | null;
  targetLabel: string | null;
  atsScore: number | null;
  matchScore: number | null;
  level: string | null;
  signals: { id: string; status: "ok" | "warn" | "info"; label: string; detail: string }[];
  topRecommendations: { id: string; title: string; why: string; severity: string }[];
  ctaHref: string;
  ctaLabel: string;
}

export interface ResumeAction {
  id: string;
  type: "RESUME" | "ALIGN";
  title: string;
  skill: string;
  domain: SubjectCode | null;
  reason: string;
  evidence: string;
  ctaLabel: string;
  ctaHref: string | null;
  /** true when the action is only produced from independently measured weakness. */
  requiresMeasuredWeakness: boolean;
}

export interface ResumeGapCoverage {
  topic: string;
  domain: string;
  coveredInResume: boolean | null;
  evidence: string | null;
  note: string;
}

export interface ResumeWorkspace {
  userId: string;
  hasResume: boolean;
  files: ResumeFileSummary[];
  variants: ResumeVariantSummary[];
  primaryVariant: ResumeVariantDetail | null;
  targets: {
    configured: boolean;
    roleId: string | null;
    roleName: string | null;
    companyId: string | null;
    companyName: string | null;
  };
  health: ResumeHealth;
  supportedFormats: { format: string; supported: boolean; note: string }[];
  maxUploadBytes: number;
  emptyState: {
    show: boolean;
    title: string;
    message: string;
    ctaLabel: string;
    ctaHref: string;
  } | null;
}

// ============================================================================
// Helpers
// ============================================================================

function ownershipError(): Error {
  return new Error("Unauthorized: you do not have access to this resource.");
}

function emptyStructuredResume(now = new Date().toISOString()): StructuredResume {
  return {
    schemaVersion: 1,
    generatedAt: now,
    header: { name: null, email: null, phone: null, location: null, links: [], rawLines: [] },
    summary: null,
    skills: { groups: [], detected: [], rawLines: [] },
    sections: [],
    links: [],
    studentAssertedFacts: [],
    unclassified: [],
    stats: { lineCount: 0, wordCount: 0, bulletCount: 0, entryCount: 0, sectionKeys: [] },
  };
}

function asStructuredResume(value: unknown): StructuredResume {
  if (!value || typeof value !== "object") return emptyStructuredResume();
  const candidate = value as Partial<StructuredResume>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.sections)) return emptyStructuredResume();
  return {
    ...emptyStructuredResume(),
    ...candidate,
    header: { ...emptyStructuredResume().header, ...(candidate.header ?? {}) },
    skills: { ...emptyStructuredResume().skills, ...(candidate.skills ?? {}) },
    studentAssertedFacts: Array.isArray(candidate.studentAssertedFacts) ? candidate.studentAssertedFacts : [],
    unclassified: Array.isArray(candidate.unclassified) ? candidate.unclassified : [],
  };
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toFileSummary(row: {
  id: string;
  fileName: string;
  fileFormat: ResumeFileFormat;
  byteSize: number;
  pageCount: number | null;
  parseStatus: ParseStatus;
  parseWarnings: unknown;
  fileSignals: unknown;
  createdAt: Date | string;
}): ResumeFileSummary {
  const signals = (row.fileSignals ?? null) as ResumeFileSignals | null;
  return {
    id: row.id,
    fileName: row.fileName,
    fileFormat: row.fileFormat,
    byteSize: row.byteSize,
    pageCount: row.pageCount,
    parseStatus: row.parseStatus,
    parseWarnings: Array.isArray(row.parseWarnings) ? (row.parseWarnings as string[]) : [],
    wordCount: signals?.wordCount ?? 0,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toVariantSummary(row: typeof resumeVariants.$inferSelect): ResumeVariantSummary {
  return {
    id: row.id,
    label: row.label,
    targetCompanyId: row.targetCompanyId,
    targetCompanyName: row.targetCompanyName,
    targetRoleId: row.targetRoleId,
    targetRoleName: row.targetRoleName,
    isPrimary: row.isPrimary,
    status: row.status,
    sourceFileId: row.sourceFileId,
    atsScore: row.atsScore,
    matchScore: row.matchScore,
    hasJobDescription: Boolean(row.jobDescription),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

async function loadOwnedVariant(variantId: string, userId: string) {
  if (!variantId || !userId) throw ownershipError();
  const rows = await db
    .select()
    .from(resumeVariants)
    .where(and(eq(resumeVariants.id, variantId), eq(resumeVariants.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw ownershipError();
  return rows[0];
}

async function loadOwnedFile(fileId: string, userId: string) {
  const rows = await db
    .select()
    .from(resumeFiles)
    .where(and(eq(resumeFiles.id, fileId), eq(resumeFiles.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw ownershipError();
  return rows[0];
}

/** Real measured question volume per subject for the authenticated student. */
async function getMeasuredDomains(userId: string): Promise<MeasuredDomain[]> {
  const [readiness, counts] = await Promise.all([
    calculateReadiness(userId).catch(() => null),
    db
      .select({ code: subjects.code, attempted: sql<number>`count(*)::int` })
      .from(answers)
      .innerJoin(questions, eq(questions.id, answers.questionId))
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .where(
        and(
          eq(attempts.userId, userId),
          eq(attempts.status, "submitted"),
          sql`${answers.selectedAnswer} is not null`
        )
      )
      .groupBy(subjects.code)
      .catch(() => [] as { code: string; attempted: number }[]),
  ]);

  if (!readiness) return [];

  const attemptedByCode = new Map(counts.map((row) => [row.code, Number(row.attempted)]));

  // Only domains with real answered questions are reported, so an unassessed
  // subject can never be mistaken for a measured weakness.
  return readiness.subjectScores
    .filter((subject) => (attemptedByCode.get(subject.code) ?? 0) > 0)
    .map((subject) => ({
      code: subject.code as SubjectCode,
      accuracy: subject.score,
      questionsAttempted: attemptedByCode.get(subject.code) ?? 0,
    }));
}

async function resolveRoleDomains(params: {
  roleId: string | null;
  userId: string;
}): Promise<{ domain: SubjectCode; need: "HIGH" | "MEDIUM" | "STANDARD" }[]> {
  try {
    let roleRow: { slug: string; name: string } | null = null;
    let industry: string | null = null;

    if (params.roleId) {
      const rows = await db
        .select({ slug: roles.slug, name: roles.name })
        .from(roles)
        .where(eq(roles.id, params.roleId))
        .limit(1);
      roleRow = rows[0] ?? null;
    } else {
      const targets = await getStudentPlacementTargets(params.userId);
      if (targets.primaryRole) roleRow = { slug: targets.primaryRole.slug, name: targets.primaryRole.name };
      if (targets.primaryCompany) industry = targets.primaryCompany.industry;
    }

    if (!roleRow) return [];
    return getRoleDomainRequirements({ roleSlug: roleRow.slug, industry }).map((requirement) => ({
      domain: requirement.domain as SubjectCode,
      need: requirement.targetNeed,
    }));
  } catch {
    return [];
  }
}

function extractionInfoFor(file: typeof resumeFiles.$inferSelect | null): {
  ok: boolean;
  format: ResumeFileFormat | null;
  warnings: string[];
  signals: ResumeFileSignals | null;
  errorCode: string | null;
} {
  if (!file) {
    // Builder-created variant with no uploaded source document.
    return { ok: true, format: null, warnings: [], signals: null, errorCode: null };
  }
  const warnings = Array.isArray(file.parseWarnings) ? (file.parseWarnings as string[]) : [];
  return {
    ok: file.parseStatus !== "failed",
    format: file.fileFormat,
    warnings,
    signals: (file.fileSignals ?? null) as ResumeFileSignals | null,
    errorCode: file.parseStatus === "failed" ? "extraction_failed" : null,
  };
}

function toSuggestionRecord(row: typeof resumeSuggestions.$inferSelect): ResumeSuggestionRecord {
  return {
    id: row.id,
    key: row.category + ":" + row.id,
    category: row.category as ResumeSuggestion["category"],
    target: row.target as SuggestionTarget,
    originalText: row.originalText ?? "",
    suggestedText: row.suggestedText,
    reason: { what: row.reasonWhat, why: row.reasonWhy, evidence: row.reasonEvidence },
    severity: row.severity as ResumeSuggestion["severity"],
    actionable: row.actionable,
    source: row.source,
    verification: (row.verification ?? {
      truthPreserving: true,
      placeholderRequired: false,
      checks: [],
      violations: [],
    }) as SuggestionVerification,
    status: row.status,
    decidedAt: iso(row.decidedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

// ============================================================================
// 1. Upload
// ============================================================================

export interface UploadResumeResult {
  ok: boolean;
  fileId: string | null;
  fileName: string;
  fileFormat: ResumeFileFormat | null;
  byteSize: number;
  pageCount: number | null;
  parseStatus: ParseStatus;
  wordCount: number;
  warnings: string[];
  error: { code: string; message: string } | null;
  /** True when an identical file was already stored for this user. */
  reusedExisting: boolean;
  /**
   * True when the stored record existed with a failed/pending parse and the
   * current parser was run against it again. Lets the UI say "Retrying
   * analysis…" instead of treating a stale server-side failure as permanent.
   */
  retried: boolean;
}

export async function uploadResumeFile(params: {
  userId: string;
  bytes: Buffer;
  fileName: string;
  mimeType: string | null;
}): Promise<UploadResumeResult> {
  if (!params.userId) throw ownershipError();

  // Two concurrent uploads of the same bytes must never run two parse jobs or
  // create two rows: identical requests within this process share one promise.
  const contentHash = createHash("sha256").update(params.bytes).digest("hex");
  const inFlightKey = `${params.userId}:${contentHash}`;
  const inFlight = inFlightUploads.get(inFlightKey);
  if (inFlight) return inFlight;

  const promise = uploadResumeFileInternal(params, contentHash).finally(() => {
    inFlightUploads.delete(inFlightKey);
  });
  inFlightUploads.set(inFlightKey, promise);
  return promise;
}

const inFlightUploads = new Map<string, Promise<UploadResumeResult>>();

async function uploadResumeFileInternal(
  params: {
    userId: string;
    bytes: Buffer;
    fileName: string;
    mimeType: string | null;
  },
  contentHash: string
): Promise<UploadResumeResult> {
  const fileName = (params.fileName || "resume").slice(0, 255);
  const mimeType = (params.mimeType || "application/octet-stream").slice(0, 120);


  // Size and emptiness are rejected before any bytes are persisted, so an
  // oversized or empty upload never becomes a stored record.
  if (params.bytes.length === 0) {
    return {
      ok: false,
      fileId: null,
      fileName,
      fileFormat: null,
      byteSize: 0,
      pageCount: null,
      parseStatus: "failed",
      wordCount: 0,
      warnings: [],
      error: { code: "empty", message: "The uploaded file is empty." },
      reusedExisting: false,
      retried: false,
    };
  }

  if (params.bytes.length > MAX_RESUME_FILE_BYTES) {
    return {
      ok: false,
      fileId: null,
      fileName,
      fileFormat: null,
      byteSize: params.bytes.length,
      pageCount: null,
      parseStatus: "failed",
      wordCount: 0,
      warnings: [],
      error: {
        code: "too_large",
        message: `This file is ${(params.bytes.length / (1024 * 1024)).toFixed(1)} MB. The maximum supported resume size is ${MAX_RESUME_FILE_BYTES / (1024 * 1024)} MB.`,
      },
      reusedExisting: false,
      retried: false,
    };
  }

  const extraction: ResumeExtraction = await extractResume({
    bytes: params.bytes,
    fileName,
    mimeType,
  });

  // Idempotent: re-uploading an identical document reuses the stored record.
  // The lookup is scoped to the owner — the same document under another
  // account is a different row and must never be reused across users.
  const existing = await db
    .select()
    .from(resumeFiles)
    .where(and(eq(resumeFiles.userId, params.userId), eq(resumeFiles.contentHash, contentHash)))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];

    // A stored failure is a snapshot of the parser that ran at the time, not a
    // verdict on the document. An earlier failure produced by a server-side
    // bug (the pdfjs worker resolution defect, for example) must not brand the
    // file unparseable forever — so a failed or stalled record is re-parsed
    // with the CURRENT parser and updated in place, preserving the row's
    // identity and content-hash idempotency.
    if (row.parseStatus === "failed" || row.parseStatus === "pending") {
      return retryStoredResumeFile({
        row,
        params,
        extraction,
        previousStatus: row.parseStatus,
      });
    }

    // parsed / partial reuse: the stored extraction is the result.
    return {
      ok: true,
      fileId: row.id,
      fileName: row.fileName,
      fileFormat: row.fileFormat,
      byteSize: row.byteSize,
      pageCount: row.pageCount,
      parseStatus: row.parseStatus,
      wordCount: ((row.fileSignals ?? null) as ResumeFileSignals | null)?.wordCount ?? 0,
      warnings: Array.isArray(row.parseWarnings) ? (row.parseWarnings as string[]) : [],
      error: null,
      reusedExisting: true,
      retried: false,
    };
  }

  const parseStatus: ParseStatus = extraction.ok
    ? extraction.warnings.length > 0
      ? "partial"
      : "parsed"
    : "failed";

  // A supported document that cannot be fully parsed is still recorded so the
  // student can see what happened and download their own file. An unsupported
  // type is never stored, because nothing useful could ever be done with it.
  if (extraction.format === null) {
    return {
      ok: false,
      fileId: null,
      fileName,
      fileFormat: null,
      byteSize: params.bytes.length,
      pageCount: null,
      parseStatus: "failed",
      wordCount: 0,
      warnings: extraction.warnings,
      error: extraction.error ?? {
        code: "unsupported_type",
        message: "This file type is not supported. Upload a text-based PDF or a DOCX file.",
      },
      reusedExisting: false,
      retried: false,
    };
  }

  const inserted = await db
    .insert(resumeFiles)
    .values({
      userId: params.userId,
      fileName,
      mimeType,
      fileFormat: extraction.format ?? "txt",
      byteSize: params.bytes.length,
      contentHash,
      data: params.bytes,
      rawText: extraction.rawText.slice(0, 400_000),
      pageCount: extraction.signals?.pageCount ?? null,
      parseStatus,
      parseWarnings: extraction.warnings,
      fileSignals: extraction.signals,
    })
    .onConflictDoNothing({
      target: [resumeFiles.userId, resumeFiles.contentHash],
    })
    .returning({ id: resumeFiles.id });

  // The unique (user, content hash) index can only conflict when a second
  // process inserted the same document between this request's lookup and
  // insert. Defer to that row — including its retry semantics — instead of
  // creating a duplicate.
  if (inserted.length === 0) {
    const raced = await db
      .select()
      .from(resumeFiles)
      .where(and(eq(resumeFiles.userId, params.userId), eq(resumeFiles.contentHash, contentHash)))
      .limit(1);
    const row = raced[0];
    if (row) {
      if (row.parseStatus === "failed" || row.parseStatus === "pending") {
        return retryStoredResumeFile({ row, params, extraction, previousStatus: row.parseStatus });
      }
      return {
        ok: true,
        fileId: row.id,
        fileName: row.fileName,
        fileFormat: row.fileFormat,
        byteSize: row.byteSize,
        pageCount: row.pageCount,
        parseStatus: row.parseStatus,
        wordCount: ((row.fileSignals ?? null) as ResumeFileSignals | null)?.wordCount ?? 0,
        warnings: Array.isArray(row.parseWarnings) ? (row.parseWarnings as string[]) : [],
        error: null,
        reusedExisting: true,
        retried: false,
      };
    }
  }

  return {
    ok: extraction.ok,
    fileId: inserted[0]?.id ?? null,
    fileName,
    fileFormat: extraction.format,
    byteSize: params.bytes.length,
    pageCount: extraction.signals?.pageCount ?? null,
    parseStatus,
    wordCount: extraction.signals?.wordCount ?? 0,
    warnings: extraction.warnings,
    error: extraction.error ? { code: extraction.error.code, message: extraction.error.message } : null,
    reusedExisting: false,
    retried: false,
  };
}

/**
 * Re-parse a stored record whose earlier parse failed (or never finished).
 *
 * A `failed` row is a record of what the parser AT THAT TIME could do — when
 * that failure was caused by a server-side defect (e.g. the pdfjs worker
 * resolution bug), the stored error says nothing about the document, so the
 * CURRENT parser is run against the stored bytes and the row is updated in
 * place. The record's identity, ownership and content hash are preserved; no
 * duplicate raw file is ever created.
 *
 * The passed-in `extraction` is the fresh run over the same bytes already
 * performed by this request — it IS the current parser's verdict. If it also
 * fails, the row keeps a failed status, now carrying the current, correctly
 * classified error (corrupt document vs unavailable engine).
 */
async function retryStoredResumeFile(params: {
  row: typeof resumeFiles.$inferSelect;
  params: {
    userId: string;
    bytes: Buffer;
    fileName: string;
    mimeType: string | null;
  };
  extraction: ResumeExtraction;
  previousStatus: ParseStatus;
}): Promise<UploadResumeResult> {
  const { row, extraction, previousStatus } = params;

  const parseStatus: ParseStatus = extraction.ok
    ? extraction.warnings.length > 0
      ? "partial"
      : "parsed"
    : "failed";

  const updated = await db
    .update(resumeFiles)
    .set({
      parseStatus,
      rawText: extraction.ok ? extraction.rawText.slice(0, 400_000) : "",
      pageCount: extraction.signals?.pageCount ?? null,
      parseWarnings: extraction.warnings,
      fileSignals: extraction.signals,
      fileFormat: extraction.format ?? row.fileFormat,
      updatedAt: new Date(),
    })
    .where(and(eq(resumeFiles.id, row.id), eq(resumeFiles.userId, row.userId)))
    .returning({ id: resumeFiles.id });

  // The row vanished between the lookup and the update (user deleted their
  // data concurrently). Report the fresh extraction on its own merits.
  if (updated.length === 0) {
    return {
      ok: extraction.ok,
      fileId: null,
      fileName: row.fileName,
      fileFormat: extraction.format,
      byteSize: row.byteSize,
      pageCount: extraction.signals?.pageCount ?? null,
      parseStatus,
      wordCount: extraction.signals?.wordCount ?? 0,
      warnings: extraction.warnings,
      error: extraction.error ? { code: extraction.error.code, message: extraction.error.message } : null,
      reusedExisting: false,
      retried: previousStatus === "failed",
    };
  }

  return {
    ok: extraction.ok,
    fileId: row.id,
    fileName: row.fileName,
    fileFormat: extraction.format ?? row.fileFormat,
    byteSize: row.byteSize,
    pageCount: extraction.signals?.pageCount ?? null,
    parseStatus,
    wordCount: extraction.signals?.wordCount ?? 0,
    warnings: extraction.warnings,
    error: extraction.error ? { code: extraction.error.code, message: extraction.error.message } : null,
    reusedExisting: true,
    retried: true,
  };
}

// ============================================================================
// 2. Analysis
// ============================================================================

async function persistAnalysis(params: {
  userId: string;
  variant: typeof resumeVariants.$inferSelect;
  file: typeof resumeFiles.$inferSelect | null;
}): Promise<{
  analysis: AtsAnalysisResult;
  suggestions: ResumeSuggestion[];
  structured: StructuredResume;
}> {
  const structured = asStructuredResume(params.variant.structuredData);
  const jobDescription = (params.variant.jobDescription ?? null) as StoredJobDescription | null;

  const [roleDomains, measuredDomains] = await Promise.all([
    resolveRoleDomains({ roleId: params.variant.targetRoleId, userId: params.userId }),
    getMeasuredDomains(params.userId),
  ]);

  const studentAssertedSkills = structured.studentAssertedFacts
    .filter((fact) => fact.kind === "skill")
    .map((fact) => fact.value);

  const analysis = analyzeResumeAtsScore({
    resume: structured,
    extraction: extractionInfoFor(params.file),
    jobDescription: jobDescription?.extraction ?? null,
    target: {
      companyName: params.variant.targetCompanyName,
      roleName: params.variant.targetRoleName,
    },
    roleDomains,
    measuredDomains,
    studentAssertedSkills,
  });

  const suggestions = generateSuggestions({
    resume: structured,
    jobDescription: jobDescription?.extraction ?? null,
    target: {
      companyName: params.variant.targetCompanyName,
      roleName: params.variant.targetRoleName,
    },
    studentAssertedSkills,
  });

  await db.insert(resumeAnalyses).values({
    variantId: params.variant.id,
    userId: params.userId,
    atsScore: analysis.atsScore,
    matchScore: analysis.roleMatch?.score ?? null,
    breakdown: analysis.breakdown,
    explanation: analysis.explanation,
    findings: analysis.findings,
    keywordAnalysis: analysis.keywordAnalysis,
    skillMatch: analysis.skillMatch,
    roleMatch: analysis.roleMatch,
    contentQuality: analysis.contentQuality,
    parsingChecks: analysis.parsingChecks,
  });

  // Pending suggestions are regenerated; decided ones remain as history.
  await db
    .delete(resumeSuggestions)
    .where(
      and(
        eq(resumeSuggestions.variantId, params.variant.id),
        eq(resumeSuggestions.userId, params.userId),
        eq(resumeSuggestions.status, "pending")
      )
    );

  // A suggestion the student has already decided must never be re-issued, so
  // the freshly generated pending list is filtered against prior decisions.
  const decided = await db
    .select({
      category: resumeSuggestions.category,
      originalText: resumeSuggestions.originalText,
      suggestedText: resumeSuggestions.suggestedText,
    })
    .from(resumeSuggestions)
    .where(
      and(
        eq(resumeSuggestions.variantId, params.variant.id),
        eq(resumeSuggestions.userId, params.userId),
        ne(resumeSuggestions.status, "pending")
      )
    );

  const decidedKeys = new Set(
    decided.map((row) => `${row.category}|${row.originalText ?? ""}|${row.suggestedText ?? ""}`)
  );

  const freshSuggestions = suggestions.filter(
    (suggestion) =>
      !decidedKeys.has(`${suggestion.category}|${suggestion.originalText}|${suggestion.suggestedText ?? ""}`)
  );

  if (freshSuggestions.length > 0) {
    await db.insert(resumeSuggestions).values(
      freshSuggestions.map((suggestion) => ({
        variantId: params.variant.id,
        userId: params.userId,
        category: suggestion.category,
        target: suggestion.target,
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        reasonWhat: suggestion.reason.what,
        reasonWhy: suggestion.reason.why,
        reasonEvidence: suggestion.reason.evidence,
        severity: suggestion.severity,
        actionable: suggestion.actionable,
        verification: suggestion.verification,
        source: suggestion.source,
        status: "pending" as const,
      }))
    );
  }

  await db
    .update(resumeVariants)
    .set({
      atsScore: analysis.atsScore,
      atsBreakdown: analysis.breakdown,
      matchScore: analysis.roleMatch?.score ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(resumeVariants.id, params.variant.id), eq(resumeVariants.userId, params.userId)));

  return { analysis, suggestions, structured };
}

export async function analyzeResumeVariant(variantId: string, userId: string): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(variantId, userId);
  const file = variant.sourceFileId ? await loadOwnedFile(variant.sourceFileId, userId) : null;
  await persistAnalysis({ userId, variant, file });
  return getResumeVariant(variantId, userId);
}

async function latestAnalysis(variantId: string, userId: string) {
  const rows = await db
    .select()
    .from(resumeAnalyses)
    .where(and(eq(resumeAnalyses.variantId, variantId), eq(resumeAnalyses.userId, userId)))
    .orderBy(desc(resumeAnalyses.analyzedAt))
    .limit(1);
  return rows[0] ?? null;
}

function analysisFromRow(row: typeof resumeAnalyses.$inferSelect | null): AtsAnalysisResult | null {
  if (!row) return null;
  const breakdown = row.breakdown as AtsAnalysisResult["breakdown"];
  const dimensions = Object.keys(breakdown ?? {}) as (keyof typeof breakdown)[];
  return {
    atsScore: row.atsScore,
    breakdown,
    evaluatedDimensions: dimensions.filter((dimension) => breakdown[dimension] !== null),
    unevaluatedDimensions: dimensions.filter((dimension) => breakdown[dimension] === null),
    explanation: (row.explanation ?? []) as string[],
    findings: (row.findings ?? []) as AtsAnalysisResult["findings"],
    parsingChecks: (row.parsingChecks ?? []) as AtsAnalysisResult["parsingChecks"],
    keywordAnalysis: (row.keywordAnalysis ?? {
      rows: [],
      matched: 0,
      missing: 0,
      overused: [],
      roleTerms: [],
      note: "",
    }) as AtsAnalysisResult["keywordAnalysis"],
    skillMatch: (row.skillMatch ?? {
      rows: [],
      matched: [],
      notEvidenced: [],
      resumeOnly: [],
      resumeGaps: [],
      preparationGaps: [],
      note: "",
    }) as AtsAnalysisResult["skillMatch"],
    roleMatch: (row.roleMatch ?? null) as AtsAnalysisResult["roleMatch"],
    contentQuality: (row.contentQuality ?? null) as AtsAnalysisResult["contentQuality"],
    sectionCoverage: [],
    limitations: [
      "This is an ATS compatibility assessment, not a prediction of any company's decision.",
      '"Not evidenced in your resume" means the term was not detected in your document — it is never a statement that you lack the skill.',
    ],
  };
}

// ============================================================================
// 3. Variants
// ============================================================================

async function nextVariantLabel(params: {
  userId: string;
  roleName: string | null;
  companyName: string | null;
}): Promise<string> {
  const base = [params.roleName, params.companyName].filter(Boolean).join(" — ") || "General Resume";
  const existing = await db
    .select({ label: resumeVariants.label })
    .from(resumeVariants)
    .where(eq(resumeVariants.userId, params.userId));
  const labels = new Set(existing.map((row) => row.label));
  if (!labels.has(base)) return base;
  let counter = 2;
  while (labels.has(`${base} (${counter})`)) counter++;
  return `${base} (${counter})`;
}

export async function createResumeVariant(params: {
  userId: string;
  sourceFileId?: string | null;
  label?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  makePrimary?: boolean;
  jobDescriptionRaw?: string | null;
  jobDescriptionSource?: "paste" | "upload";
  jobDescriptionRoleTitle?: string | null;
  jobDescriptionCompanyName?: string | null;
}): Promise<ResumeVariantDetail> {
  if (!params.userId) throw ownershipError();

  let file: typeof resumeFiles.$inferSelect | null = null;
  if (params.sourceFileId) {
    file = await loadOwnedFile(params.sourceFileId, params.userId);
    if (file.parseStatus === "failed" || !file.rawText.trim()) {
      throw new Error(
        "This uploaded document could not be parsed, so a resume variant cannot be created from it. Upload a text-based PDF or DOCX."
      );
    }
  }

  // Target defaults come from Phase 16 (the single source of company/role truth).
  const targets = await getStudentPlacementTargets(params.userId).catch(() => null);
  let companyId = params.companyId ?? null;
  let companyName = params.companyName ?? null;
  let roleId = params.roleId ?? null;
  let roleName = params.roleName ?? null;

  if (!companyId && !companyName && targets?.primaryCompany) {
    companyId = targets.primaryCompany.id;
    companyName = targets.primaryCompany.name;
  }
  if (!roleId && !roleName && targets?.primaryRole) {
    roleId = targets.primaryRole.id;
    roleName = targets.primaryRole.name;
  }

  if (companyId) {
    const rows = await db
      .select({ id: companies.id, name: companies.name, industry: companies.industry })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (rows.length > 0) companyName = rows[0].name;
  }
  if (roleId) {
    const rows = await db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.id, roleId)).limit(1);
    if (rows.length > 0) roleName = rows[0].name;
  }

  const existingCount = await db
    .select({ id: resumeVariants.id })
    .from(resumeVariants)
    .where(eq(resumeVariants.userId, params.userId));

  const shouldBePrimary = params.makePrimary ?? existingCount.length === 0;
  const label = (params.label ?? "").trim() || (await nextVariantLabel({ userId: params.userId, roleName, companyName }));

  const structured = file ? parseStructuredResume(file.rawText).resume : emptyStructuredResume();

  let jobDescription: StoredJobDescription | null = null;
  if (params.jobDescriptionRaw && params.jobDescriptionRaw.trim().length >= 20) {
    jobDescription = {
      raw: params.jobDescriptionRaw.trim(),
      source: params.jobDescriptionSource ?? "paste",
      providedRoleTitle: params.jobDescriptionRoleTitle ?? roleName,
      providedCompanyName: params.jobDescriptionCompanyName ?? companyName,
      addedAt: new Date().toISOString(),
      extraction: analyzeJobDescription({
        raw: params.jobDescriptionRaw,
        source: params.jobDescriptionSource ?? "paste",
        providedRoleTitle: params.jobDescriptionRoleTitle ?? roleName,
        providedCompanyName: params.jobDescriptionCompanyName ?? companyName,
      }),
    };
  }

  const inserted = await db.transaction(async (tx) => {
    if (shouldBePrimary) {
      await tx
        .update(resumeVariants)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(resumeVariants.userId, params.userId));
    }
    return tx
      .insert(resumeVariants)
      .values({
        userId: params.userId,
        label,
        targetCompanyId: companyId,
        targetCompanyName: companyName,
        targetRoleId: roleId,
        targetRoleName: roleName,
        sourceFileId: file?.id ?? null,
        structuredData: structured,
        jobDescription,
        isPrimary: shouldBePrimary,
        status: "active",
      })
      .returning();
  });

  const variant = inserted[0];
  await persistAnalysis({ userId: params.userId, variant, file });
  return getResumeVariant(variant.id, params.userId);
}

export async function listResumeVariants(userId: string): Promise<ResumeVariantSummary[]> {
  const rows = await db
    .select()
    .from(resumeVariants)
    .where(eq(resumeVariants.userId, userId))
    .orderBy(desc(resumeVariants.isPrimary), desc(resumeVariants.updatedAt));
  return rows.map(toVariantSummary);
}

export async function getResumeVariant(variantId: string, userId: string): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(variantId, userId);
  const [file, analysisRow, suggestionRows, versionRows] = await Promise.all([
    variant.sourceFileId ? loadOwnedFile(variant.sourceFileId, userId) : Promise.resolve(null),
    latestAnalysis(variant.id, userId),
    db
      .select()
      .from(resumeSuggestions)
      .where(and(eq(resumeSuggestions.variantId, variant.id), eq(resumeSuggestions.userId, userId)))
      .orderBy(desc(resumeSuggestions.createdAt)),
    db
      .select()
      .from(resumeVersions)
      .where(and(eq(resumeVersions.variantId, variant.id), eq(resumeVersions.userId, userId)))
      .orderBy(desc(resumeVersions.versionNumber)),
  ]);

  return {
    id: variant.id,
    label: variant.label,
    targetCompanyId: variant.targetCompanyId,
    targetCompanyName: variant.targetCompanyName,
    targetRoleId: variant.targetRoleId,
    targetRoleName: variant.targetRoleName,
    isPrimary: variant.isPrimary,
    status: variant.status,
    atsScore: analysisRow?.atsScore ?? variant.atsScore,
    matchScore: analysisRow?.matchScore ?? variant.matchScore,
    structured: asStructuredResume(variant.structuredData),
    originalRawText: file ? file.rawText : null,
    jobDescription: (variant.jobDescription ?? null) as StoredJobDescription | null,
    analysis: analysisFromRow(analysisRow),
    suggestions: suggestionRows.map(toSuggestionRecord),
    versions: versionRows.map((row) => ({
      id: row.id,
      versionNumber: row.versionNumber,
      label: row.label,
      atsScore: row.atsScore,
      matchScore: row.matchScore,
      createdAt: iso(row.createdAt) ?? new Date().toISOString(),
      changeSummary: (row.changeSummary ?? null) as Record<string, unknown> | null,
    })),
    sourceFile: file ? toFileSummary(file) : null,
    createdAt: iso(variant.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(variant.updatedAt) ?? new Date().toISOString(),
  };
}

export async function updateResumeVariant(params: {
  variantId: string;
  userId: string;
  patch: {
    label?: string;
    companyId?: string | null;
    companyName?: string | null;
    roleId?: string | null;
    roleName?: string | null;
    status?: "active" | "archived";
    isPrimary?: boolean;
  };
}): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(params.variantId, params.userId);
  const patch = params.patch;
  const update: Partial<typeof resumeVariants.$inferInsert> = { updatedAt: new Date() };

  if (patch.label !== undefined) update.label = patch.label;

  if (patch.companyId !== undefined) {
    if (patch.companyId === null) {
      update.targetCompanyId = null;
      update.targetCompanyName = patch.companyName ?? null;
    } else {
      const rows = await db.select().from(companies).where(eq(companies.id, patch.companyId)).limit(1);
      if (rows.length === 0) throw new Error("The selected company does not exist in the Placement OS catalog.");
      update.targetCompanyId = rows[0].id;
      update.targetCompanyName = rows[0].name;
    }
  } else if (patch.companyName !== undefined) {
    update.targetCompanyName = patch.companyName;
  }

  if (patch.roleId !== undefined) {
    if (patch.roleId === null) {
      update.targetRoleId = null;
      update.targetRoleName = patch.roleName ?? null;
    } else {
      const rows = await db.select().from(roles).where(eq(roles.id, patch.roleId)).limit(1);
      if (rows.length === 0) throw new Error("The selected role does not exist in the Placement OS catalog.");
      update.targetRoleId = rows[0].id;
      update.targetRoleName = rows[0].name;
    }
  } else if (patch.roleName !== undefined) {
    update.targetRoleName = patch.roleName;
  }

  if (patch.status !== undefined) update.status = patch.status;

  await db.transaction(async (tx) => {
    if (patch.isPrimary === true) {
      await tx
        .update(resumeVariants)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(resumeVariants.userId, params.userId), ne(resumeVariants.id, variant.id)));
      update.isPrimary = true;
    } else if (patch.isPrimary === false) {
      // Never leave the account without a primary variant.
      const others = await tx
        .select({ id: resumeVariants.id })
        .from(resumeVariants)
        .where(and(eq(resumeVariants.userId, params.userId), ne(resumeVariants.id, variant.id)))
        .limit(1);
      if (others.length === 0) throw new Error("At least one resume variant must remain primary.");
      update.isPrimary = false;
    }
    await tx
      .update(resumeVariants)
      .set(update)
      .where(and(eq(resumeVariants.id, variant.id), eq(resumeVariants.userId, params.userId)));
  });

  // Target changes alter role matching, so the analysis is refreshed.
  const refreshed = await loadOwnedVariant(params.variantId, params.userId);
  const file = refreshed.sourceFileId ? await loadOwnedFile(refreshed.sourceFileId, params.userId) : null;
  await persistAnalysis({ userId: params.userId, variant: refreshed, file });

  return getResumeVariant(params.variantId, params.userId);
}

export async function deleteResumeVariant(variantId: string, userId: string): Promise<{ deleted: boolean }> {
  const variant = await loadOwnedVariant(variantId, userId);
  await db.delete(resumeVariants).where(and(eq(resumeVariants.id, variant.id), eq(resumeVariants.userId, userId)));

  if (variant.isPrimary) {
    const remaining = await db
      .select({ id: resumeVariants.id })
      .from(resumeVariants)
      .where(eq(resumeVariants.userId, userId))
      .orderBy(desc(resumeVariants.updatedAt))
      .limit(1);
    if (remaining.length > 0) {
      await db
        .update(resumeVariants)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(and(eq(resumeVariants.id, remaining[0].id), eq(resumeVariants.userId, userId)));
    }
  }

  return { deleted: true };
}

// ============================================================================
// 4. Job description
// ============================================================================

export async function setResumeJobDescription(params: {
  variantId: string;
  userId: string;
  raw: string;
  source?: "paste" | "upload";
  providedRoleTitle?: string | null;
  providedCompanyName?: string | null;
}): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(params.variantId, params.userId);
  const raw = params.raw.trim();
  if (raw.length < 20) {
    throw new Error("Paste at least a few lines of the job description so it can be analysed.");
  }

  const jobDescription: StoredJobDescription = {
    raw,
    source: params.source ?? "paste",
    providedRoleTitle: params.providedRoleTitle ?? variant.targetRoleName,
    providedCompanyName: params.providedCompanyName ?? variant.targetCompanyName,
    addedAt: new Date().toISOString(),
    extraction: analyzeJobDescription({
      raw,
      source: params.source ?? "paste",
      providedRoleTitle: params.providedRoleTitle ?? variant.targetRoleName,
      providedCompanyName: params.providedCompanyName ?? variant.targetCompanyName,
    }),
  };

  await db
    .update(resumeVariants)
    .set({ jobDescription, updatedAt: new Date() })
    .where(and(eq(resumeVariants.id, variant.id), eq(resumeVariants.userId, params.userId)));

  const refreshed = await loadOwnedVariant(params.variantId, params.userId);
  const file = refreshed.sourceFileId ? await loadOwnedFile(refreshed.sourceFileId, params.userId) : null;
  await persistAnalysis({ userId: params.userId, variant: refreshed, file });

  return getResumeVariant(params.variantId, params.userId);
}

export async function clearResumeJobDescription(variantId: string, userId: string): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(variantId, userId);
  await db
    .update(resumeVariants)
    .set({ jobDescription: null, updatedAt: new Date() })
    .where(and(eq(resumeVariants.id, variant.id), eq(resumeVariants.userId, userId)));
  const refreshed = await loadOwnedVariant(variantId, userId);
  const file = refreshed.sourceFileId ? await loadOwnedFile(refreshed.sourceFileId, userId) : null;
  await persistAnalysis({ userId, variant: refreshed, file });
  return getResumeVariant(variantId, userId);
}

// ============================================================================
// 5. Builder edits
// ============================================================================

export async function updateStructuredResume(params: {
  variantId: string;
  userId: string;
  structured: StructuredResumeUpdateInput;
}): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(params.variantId, params.userId);
  const current = asStructuredResume(variant.structuredData);

  const next: StructuredResume = {
    ...current,
    header: params.structured.header
      ? { ...current.header, ...params.structured.header, rawLines: current.header.rawLines }
      : current.header,
    summary: params.structured.summary !== undefined ? params.structured.summary : current.summary,
    sections: params.structured.sections
      ? params.structured.sections.map((section, index) => ({
          key: section.key,
          originalHeading: section.originalHeading ?? null,
          order: section.order ?? index,
          entries: (section.entries ?? []).map((entry) => ({
            id: entry.id,
            heading: entry.heading,
            title: entry.title ?? null,
            organization: entry.organization ?? null,
            dates: entry.dates,
            bullets: entry.bullets,
            rawLines: entry.rawLines ?? [],
            confidence: entry.confidence ?? "medium",
          })),
          items: section.items ?? [],
          rawLines: section.rawLines ?? [],
          recognized: section.recognized ?? true,
        }))
      : current.sections,
    skills: params.structured.skills
      ? {
          groups: params.structured.skills.groups,
          detected: detectCanonicalSkills(
            params.structured.skills.groups.flatMap((group) => [group.label ?? "", ...group.skills]).join("\n")
          ),
          rawLines: current.skills.rawLines,
        }
      : current.skills,
    links: params.structured.links ?? current.links,
    studentAssertedFacts: params.structured.studentAssertedFacts ?? current.studentAssertedFacts,
  };

  await db
    .update(resumeVariants)
    .set({ structuredData: next, updatedAt: new Date() })
    .where(and(eq(resumeVariants.id, variant.id), eq(resumeVariants.userId, params.userId)));

  const refreshed = await loadOwnedVariant(params.variantId, params.userId);
  const file = refreshed.sourceFileId ? await loadOwnedFile(refreshed.sourceFileId, params.userId) : null;
  await persistAnalysis({ userId: params.userId, variant: refreshed, file });

  return getResumeVariant(params.variantId, params.userId);
}

export async function setStudentAssertedSkill(params: {
  variantId: string;
  userId: string;
  skill: string;
  asserted: boolean;
  note?: string | null;
}): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(params.variantId, params.userId);
  const current = asStructuredResume(variant.structuredData);
  const value = params.skill.trim();
  if (!value) throw new Error("A skill name is required.");

  const withoutSkill = current.studentAssertedFacts.filter(
    (fact) => !(fact.kind === "skill" && fact.value.toLowerCase() === value.toLowerCase())
  );

  const studentAssertedFacts = params.asserted
    ? [
        ...withoutSkill,
        {
          id: `asserted-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          kind: "skill" as const,
          value,
          note: params.note ?? null,
          assertedAt: new Date().toISOString(),
        },
      ]
    : withoutSkill;

  await db
    .update(resumeVariants)
    .set({
      structuredData: { ...current, studentAssertedFacts },
      updatedAt: new Date(),
    })
    .where(and(eq(resumeVariants.id, variant.id), eq(resumeVariants.userId, params.userId)));

  const refreshed = await loadOwnedVariant(params.variantId, params.userId);
  const file = refreshed.sourceFileId ? await loadOwnedFile(refreshed.sourceFileId, params.userId) : null;
  await persistAnalysis({ userId: params.userId, variant: refreshed, file });

  return getResumeVariant(params.variantId, params.userId);
}

// ============================================================================
// 6. Suggestions: accept / reject
// ============================================================================

export async function decideSuggestion(params: {
  variantId: string;
  userId: string;
  suggestionId: string;
  decision: "accepted" | "rejected";
}): Promise<ResumeVariantDetail> {
  const variant = await loadOwnedVariant(params.variantId, params.userId);
  const rows = await db
    .select()
    .from(resumeSuggestions)
    .where(
      and(
        eq(resumeSuggestions.id, params.suggestionId),
        eq(resumeSuggestions.variantId, variant.id),
        eq(resumeSuggestions.userId, params.userId)
      )
    )
    .limit(1);

  if (rows.length === 0) throw ownershipError();
  const suggestion = rows[0];

  // The decision is recorded before the analysis is regenerated, so the
  // decided row survives the pending-suggestion refresh below.
  await db
    .update(resumeSuggestions)
    .set({ status: params.decision, decidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(resumeSuggestions.id, suggestion.id), eq(resumeSuggestions.userId, params.userId)));

  if (params.decision === "accepted") {
    const engineSuggestion: ResumeSuggestion = {
      id: suggestion.id,
      category: suggestion.category as ResumeSuggestion["category"],
      target: suggestion.target as SuggestionTarget,
      originalText: suggestion.originalText ?? "",
      suggestedText: suggestion.suggestedText,
      reason: { what: suggestion.reasonWhat, why: suggestion.reasonWhy, evidence: suggestion.reasonEvidence },
      severity: suggestion.severity as ResumeSuggestion["severity"],
      actionable: suggestion.actionable,
      source: suggestion.source,
      verification: (suggestion.verification ?? null) as SuggestionVerification,
    };

    const current = asStructuredResume(variant.structuredData);
    const applied = applySuggestion(current, engineSuggestion);

    if (!applied.applied) {
      throw new Error(
        applied.reason ??
          "This suggestion could not be applied automatically. Make the change yourself in the resume builder."
      );
    }

    await db
      .update(resumeVariants)
      .set({ structuredData: applied.resume, updatedAt: new Date() })
      .where(and(eq(resumeVariants.id, variant.id), eq(resumeVariants.userId, params.userId)));

    const refreshed = await loadOwnedVariant(params.variantId, params.userId);
    const file = refreshed.sourceFileId ? await loadOwnedFile(refreshed.sourceFileId, params.userId) : null;
    await persistAnalysis({ userId: params.userId, variant: refreshed, file });

    // Accepting a change is a meaningful version: snapshot it with its scores.
    await saveResumeVersion({
      variantId: params.variantId,
      userId: params.userId,
      label: `Accepted suggestion: ${suggestion.category.replace(/_/g, " ")}`,
      changeSummary: {
        type: "suggestion_accepted",
        category: suggestion.category,
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        truthVerified: Boolean((suggestion.verification as SuggestionVerification | null)?.truthPreserving),
      },
    });
  }

  return getResumeVariant(params.variantId, params.userId);
}

// ============================================================================
// 7. Versions
// ============================================================================

export async function saveResumeVersion(params: {
  variantId: string;
  userId: string;
  label?: string | null;
  changeSummary?: Record<string, unknown> | null;
}): Promise<ResumeVersionSummary> {
  const variant = await loadOwnedVariant(params.variantId, params.userId);
  const structured = asStructuredResume(variant.structuredData);

  const latest = await db
    .select({ versionNumber: resumeVersions.versionNumber })
    .from(resumeVersions)
    .where(and(eq(resumeVersions.variantId, variant.id), eq(resumeVersions.userId, params.userId)))
    .orderBy(desc(resumeVersions.versionNumber))
    .limit(1);

  const versionNumber = (latest[0]?.versionNumber ?? 0) + 1;
  const label =
    (params.label ?? "").trim() ||
    [variant.targetRoleName, variant.targetCompanyName].filter(Boolean).join(" — ") ||
    "Resume version";

  const inserted = await db
    .insert(resumeVersions)
    .values({
      variantId: variant.id,
      userId: params.userId,
      versionNumber,
      label: `${label} v${versionNumber}`,
      structuredData: structured,
      atsScore: variant.atsScore,
      matchScore: variant.matchScore,
      changeSummary: params.changeSummary ?? { type: "manual_snapshot" },
    })
    .returning();

  const row = inserted[0];
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    label: row.label,
    atsScore: row.atsScore,
    matchScore: row.matchScore,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    changeSummary: (row.changeSummary ?? null) as Record<string, unknown> | null,
  };
}

export async function listResumeVersions(variantId: string, userId: string): Promise<ResumeVersionSummary[]> {
  await loadOwnedVariant(variantId, userId);
  const rows = await db
    .select()
    .from(resumeVersions)
    .where(and(eq(resumeVersions.variantId, variantId), eq(resumeVersions.userId, userId)))
    .orderBy(desc(resumeVersions.versionNumber));
  return rows.map((row) => ({
    id: row.id,
    versionNumber: row.versionNumber,
    label: row.label,
    atsScore: row.atsScore,
    matchScore: row.matchScore,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    changeSummary: (row.changeSummary ?? null) as Record<string, unknown> | null,
  }));
}

export interface ResumeVersionComparison {
  from: ResumeVersionSummary;
  to: ResumeVersionSummary;
  deltas: { atsScore: number | null; matchScore: number | null };
  addedSkills: string[];
  removedSkills: string[];
  changedBullets: { before: string; after: string }[];
  addedBullets: string[];
  removedBullets: string[];
  sectionsChanged: string[];
  summary: string;
}

function collectSkills(structured: StructuredResume): string[] {
  return Array.from(new Set([...structured.skills.detected, ...structured.skills.groups.flatMap((group) => group.skills)]));
}

function collectBullets(structured: StructuredResume): string[] {
  return structured.sections.flatMap((section) => section.entries.flatMap((entry) => entry.bullets));
}

export async function compareResumeVersions(params: {
  variantId: string;
  userId: string;
  fromVersionId: string;
  toVersionId: string;
}): Promise<ResumeVersionComparison> {
  await loadOwnedVariant(params.variantId, params.userId);
  const rows = await db
    .select()
    .from(resumeVersions)
    .where(
      and(
        eq(resumeVersions.variantId, params.variantId),
        eq(resumeVersions.userId, params.userId),
        inArray(resumeVersions.id, [params.fromVersionId, params.toVersionId])
      )
    );

  if (rows.length < 2) throw ownershipError();

  const fromRow = rows.find((row) => row.id === params.fromVersionId)!;
  const toRow = rows.find((row) => row.id === params.toVersionId)!;
  const fromStructured = asStructuredResume(fromRow.structuredData);
  const toStructured = asStructuredResume(toRow.structuredData);

  const fromSkills = new Set(collectSkills(fromStructured));
  const toSkills = new Set(collectSkills(toStructured));
  const fromBullets = collectBullets(fromStructured);
  const toBullets = collectBullets(toStructured);

  const addedSkills = Array.from(toSkills).filter((skill) => !fromSkills.has(skill));
  const removedSkills = Array.from(fromSkills).filter((skill) => !toSkills.has(skill));
  const addedBullets = toBullets.filter((bullet) => !fromBullets.includes(bullet));
  const removedBullets = fromBullets.filter((bullet) => !toBullets.includes(bullet));

  const changedBullets: { before: string; after: string }[] = [];
  const pool = [...toBullets];
  for (const before of removedBullets) {
    const candidateIndex = pool.findIndex((after) => {
      const beforeTokens = new Set(before.toLowerCase().split(/\s+/));
      const afterTokens = after.toLowerCase().split(/\s+/);
      const overlap = afterTokens.filter((token) => beforeTokens.has(token)).length;
      return overlap / Math.max(1, beforeTokens.size) > 0.5;
    });
    if (candidateIndex >= 0) {
      changedBullets.push({ before, after: pool[candidateIndex] });
      pool.splice(candidateIndex, 1);
    }
  }

  const sectionSet = (structured: StructuredResume) =>
    new Set(structured.sections.map((section) => `${section.key}:${section.entries.length}:${section.items.length}`));
  const beforeSections = sectionSet(fromStructured);
  const sectionsChanged = Array.from(sectionSet(toStructured)).filter((key) => !beforeSections.has(key));

  const atsDelta =
    toRow.atsScore !== null && fromRow.atsScore !== null ? Math.round(toRow.atsScore - fromRow.atsScore) : null;
  const matchDelta =
    toRow.matchScore !== null && fromRow.matchScore !== null ? Math.round(toRow.matchScore - fromRow.matchScore) : null;

  const summaryParts: string[] = [];
  if (atsDelta !== null) summaryParts.push(`ATS compatibility changed by ${atsDelta >= 0 ? "+" : ""}${atsDelta}.`);
  if (matchDelta !== null) summaryParts.push(`Target match changed by ${matchDelta >= 0 ? "+" : ""}${matchDelta}.`);
  if (addedSkills.length > 0) summaryParts.push(`Skills added: ${addedSkills.join(", ")}.`);
  if (removedSkills.length > 0) summaryParts.push(`Skills removed: ${removedSkills.join(", ")}.`);
  if (changedBullets.length > 0) summaryParts.push(`${changedBullets.length} bullet(s) were rewritten.`);
  if (summaryParts.length === 0) summaryParts.push("No meaningful content changes were detected between these versions.");

  return {
    from: {
      id: fromRow.id,
      versionNumber: fromRow.versionNumber,
      label: fromRow.label,
      atsScore: fromRow.atsScore,
      matchScore: fromRow.matchScore,
      createdAt: iso(fromRow.createdAt) ?? new Date().toISOString(),
      changeSummary: (fromRow.changeSummary ?? null) as Record<string, unknown> | null,
    },
    to: {
      id: toRow.id,
      versionNumber: toRow.versionNumber,
      label: toRow.label,
      atsScore: toRow.atsScore,
      matchScore: toRow.matchScore,
      createdAt: iso(toRow.createdAt) ?? new Date().toISOString(),
      changeSummary: (toRow.changeSummary ?? null) as Record<string, unknown> | null,
    },
    deltas: { atsScore: atsDelta, matchScore: matchDelta },
    addedSkills,
    removedSkills,
    changedBullets,
    addedBullets: addedBullets.filter((bullet) => !changedBullets.some((change) => change.after === bullet)),
    removedBullets: removedBullets.filter((bullet) => !changedBullets.some((change) => change.before === bullet)),
    sectionsChanged,
    summary: summaryParts.join(" "),
  };
}

// ============================================================================
// 8. Export + private file access
// ============================================================================

export async function renderAtsResume(params: {
  variantId: string;
  userId: string;
  format: "txt" | "html";
}): Promise<{ content: string; contentType: string; fileName: string }> {
  const variant = await loadOwnedVariant(params.variantId, params.userId);
  const structured = asStructuredResume(variant.structuredData);
  const targetLine = [variant.targetCompanyName, variant.targetRoleName].filter(Boolean).length
    ? `Target: ${[variant.targetCompanyName, variant.targetRoleName].filter(Boolean).join(" — ")}`
    : null;

  const baseName = (variant.label || "resume").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

  if (params.format === "html") {
    return {
      content: renderAtsHtml(structured, { targetLine }),
      contentType: "text/html; charset=utf-8",
      fileName: `${baseName || "resume"}-ats.html`,
    };
  }
  return {
    content: renderAtsPlainText(structured, { targetLine }),
    contentType: "text/plain; charset=utf-8",
    fileName: `${baseName || "resume"}-ats.txt`,
  };
}

export async function getResumeFile(params: {
  fileId: string;
  userId: string;
}): Promise<{ bytes: Buffer; fileName: string; mimeType: string; byteSize: number }> {
  const row = await loadOwnedFile(params.fileId, params.userId);
  return {
    bytes: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data),
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
  };
}

// ============================================================================
// 9. Workspace + health
// ============================================================================

const SUPPORTED_FORMATS = [
  { format: "PDF (text-based)", supported: true, note: "Extracted with a PDF text parser. Scanned or image-only PDFs cannot be read." },
  { format: "DOCX", supported: true, note: "Extracted with a Word document parser, including structural signals such as tables." },
  { format: "TXT", supported: true, note: "Read verbatim." },
  { format: "DOC, RTF, ODT, images", supported: false, note: "Not supported. Re-save as PDF or DOCX." },
];

export async function getResumeWorkspace(userId: string): Promise<ResumeWorkspace> {
  if (!userId) throw ownershipError();

  const [fileRows, variantRows, targets] = await Promise.all([
    db
      .select({
        id: resumeFiles.id,
        fileName: resumeFiles.fileName,
        fileFormat: resumeFiles.fileFormat,
        byteSize: resumeFiles.byteSize,
        pageCount: resumeFiles.pageCount,
        parseStatus: resumeFiles.parseStatus,
        parseWarnings: resumeFiles.parseWarnings,
        fileSignals: resumeFiles.fileSignals,
        createdAt: resumeFiles.createdAt,
      })
      .from(resumeFiles)
      .where(eq(resumeFiles.userId, userId))
      .orderBy(desc(resumeFiles.createdAt))
      .limit(10),
    listResumeVariants(userId),
    getStudentPlacementTargets(userId).catch(() => null),
  ]);

  const primarySummary = variantRows.find((variant) => variant.isPrimary) ?? variantRows[0] ?? null;
  const primaryVariant = primarySummary ? await getResumeVariant(primarySummary.id, userId) : null;
  const health = await getResumeHealth(userId);

  return {
    userId,
    hasResume: variantRows.length > 0,
    files: fileRows.map(toFileSummary),
    variants: variantRows,
    primaryVariant,
    targets: {
      configured: Boolean(targets?.configured),
      roleId: targets?.primaryRole?.id ?? null,
      roleName: targets?.primaryRole?.name ?? null,
      companyId: targets?.primaryCompany?.id ?? null,
      companyName: targets?.primaryCompany?.name ?? null,
    },
    health,
    supportedFormats: SUPPORTED_FORMATS,
    maxUploadBytes: 5 * 1024 * 1024,
    emptyState:
      variantRows.length === 0
        ? {
            show: true,
            title: "ADD YOUR RESUME",
            message:
              "Upload a text-based PDF or DOCX to see how your resume reads to an ATS, how well it matches your target role, and exactly what to improve — without inventing anything.",
            ctaLabel: "Upload Resume",
            ctaHref: "#resume-upload",
          }
        : null,
  };
}

export async function getResumeHealth(userId: string): Promise<ResumeHealth> {
  const variantRows = await db
    .select()
    .from(resumeVariants)
    .where(eq(resumeVariants.userId, userId))
    .orderBy(desc(resumeVariants.isPrimary), desc(resumeVariants.updatedAt))
    .limit(1);

  if (variantRows.length === 0) {
    return {
      hasResume: false,
      variantId: null,
      label: null,
      targetLabel: null,
      atsScore: null,
      matchScore: null,
      level: null,
      signals: [
        {
          id: "no-resume",
          status: "info",
          label: "No resume analysed yet",
          detail: "Upload your resume to measure ATS compatibility and target match.",
        },
      ],
      topRecommendations: [],
      ctaHref: "/resume",
      ctaLabel: "Add Resume",
    };
  }

  const variant = variantRows[0];
  const analysis = latestAnalysis(variant.id, userId);

  const [analysisRow, suggestionRows] = await Promise.all([
    analysis,
    db
      .select({
        id: resumeSuggestions.id,
        category: resumeSuggestions.category,
        reasonWhat: resumeSuggestions.reasonWhat,
        reasonWhy: resumeSuggestions.reasonWhy,
        severity: resumeSuggestions.severity,
      })
      .from(resumeSuggestions)
      .where(and(eq(resumeSuggestions.variantId, variant.id), eq(resumeSuggestions.status, "pending")))
      .limit(12),
  ]);

  const breakdown = (analysisRow?.breakdown ?? variant.atsBreakdown ?? null) as Record<string, number | null> | null;
  const findings = ((analysisRow?.findings ?? []) as AtsAnalysisResult["findings"]).filter(Boolean);

  const signals: ResumeHealth["signals"] = [];
  if (breakdown) {
    if ((breakdown.parsing ?? 0) >= 85) {
      signals.push({ id: "parsing", status: "ok", label: "ATS readable", detail: `Parsing ${breakdown.parsing}/100.` });
    } else {
      signals.push({
        id: "parsing",
        status: "warn",
        label: "Parsing needs work",
        detail: `Parsing ${breakdown.parsing ?? 0}/100 — check the parsing findings.`,
      });
    }
    if ((breakdown.formatting ?? 100) >= 85) {
      signals.push({ id: "formatting", status: "ok", label: "Clean structure", detail: `Formatting ${breakdown.formatting}/100.` });
    }
    if (typeof breakdown.skills === "number") {
      signals.push({
        id: "skills",
        status: breakdown.skills >= 60 ? "ok" : "warn",
        label: breakdown.skills >= 60 ? "Strong skills match" : "Skills match needs work",
        detail: `Skills ${breakdown.skills}/100 against the target.`,
      });
    }
  }

  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const topRecommendations: ResumeHealth["topRecommendations"] = findings
    .slice()
    .sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3))
    .slice(0, 3)
    .map((finding) => ({
      id: finding.id,
      title: finding.title,
      why: finding.detail,
      severity: finding.severity,
    }));

  if (topRecommendations.length === 0 && suggestionRows.length > 0) {
    for (const suggestion of suggestionRows.slice(0, 3)) {
      topRecommendations.push({
        id: suggestion.id,
        title: suggestion.reasonWhat,
        why: suggestion.reasonWhy,
        severity: suggestion.severity,
      });
    }
  }

  const atsScore = variant.atsScore;
  let level: string | null = null;
  if (atsScore !== null) {
    if (atsScore >= 85) level = "ATS FRIENDLY";
    else if (atsScore >= 70) level = "GOOD";
    else if (atsScore >= 50) level = "NEEDS WORK";
    else level = "HIGH RISK";
  }

  return {
    hasResume: true,
    variantId: variant.id,
    label: variant.label,
    targetLabel: [variant.targetCompanyName, variant.targetRoleName].filter(Boolean).join(" — ") || null,
    atsScore,
    matchScore: variant.matchScore,
    level,
    signals,
    topRecommendations,
    ctaHref: "/resume",
    ctaLabel: "Improve Resume",
  };
}

// ============================================================================
// 10. Phase 15 integration — resumee actions
// ============================================================================

/**
 * Actions resume intelligence contributes to the preparation loop.
 *
 * A "RESUME" action never becomes a preparation task: it only points out that
 * something is not evidenced and asks the student to add it if it is real.
 * An "ALIGN" action is only produced when Placement OS independently measured
 * weakness in a domain the resume already claims.
 */
export async function getResumeActions(userId: string): Promise<ResumeAction[]> {
  if (!userId) return [];

  const variantRows = await db
    .select()
    .from(resumeVariants)
    .where(and(eq(resumeVariants.userId, userId), eq(resumeVariants.status, "active")))
    .orderBy(desc(resumeVariants.isPrimary), desc(resumeVariants.updatedAt))
    .limit(1);

  if (variantRows.length === 0) return [];
  const variant = variantRows[0];

  const analysisRow = await latestAnalysis(variant.id, userId);
  if (!analysisRow) return [];

  const skillMatch = (analysisRow.skillMatch ?? null) as AtsAnalysisResult["skillMatch"] | null;
  if (!skillMatch) return [];

  const actions: ResumeAction[] = [];

  // Missing evidence for a requirement -> prompt, never a fabrication task.
  const notEvidencedRequired = (skillMatch.resumeGaps ?? []).filter((row) => row.requirement === "required").slice(0, 4);
  for (const row of notEvidencedRequired) {
    actions.push({
      id: `resume-action-${variant.id}-${row.canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      type: "RESUME",
      title: `Resume Action — add evidence for ${row.canonical}`,
      skill: row.canonical,
      domain: row.domain,
      reason: `${row.canonical} appears in your target requirements but is not evidenced anywhere in your resume. If you have real experience with it, add it to a specific project or experience line.`,
      evidence: "Not detected in the current resume text.",
      ctaLabel: "Open Resume Builder",
      ctaHref: "/resume/builder",
      requiresMeasuredWeakness: false,
    });
  }

  // Resume claims the skill, but measured preparation is independently weak.
  for (const row of (skillMatch.preparationGaps ?? []).slice(0, 3)) {
    if (row.measuredDomainAccuracy === null || row.measuredQuestionsAttempted <= 0) continue;
    actions.push({
      id: `resume-align-${variant.id}-${row.canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      type: "ALIGN",
      title: `Alignment — strengthen ${row.canonical} before interviews`,
      skill: row.canonical,
      domain: row.domain,
      reason: `Your resume evidences ${row.canonical}, but your measured ${row.domain ?? "related"} performance is ${row.measuredDomainAccuracy}% across ${row.measuredQuestionsAttempted} answered questions. A resume claim you cannot defend is a risk in interviews.`,
      evidence: `${row.measuredQuestionsAttempted} answered question(s) in ${row.domain ?? "the mapped domain"} at ${row.measuredDomainAccuracy}% accuracy.`,
      ctaLabel: row.domain ? "Start Targeted Practice" : "Open Roadmap",
      ctaHref: row.domain ? `/practice?subjectCode=${row.domain}` : "/roadmap",
      requiresMeasuredWeakness: true,
    });
  }

  return actions;
}

// ============================================================================
// 11. Phase 17 integration — resume coverage of simulation gaps
// ============================================================================

/**
 * For each gap the simulation identified, report whether the resume evidences
 * anything in that area. Returns `coveredInResume: null` when no resume exists,
 * so the UI can say "no resume on file" instead of implying a gap.
 */
export async function getResumeCoverageForGaps(
  userId: string,
  gaps: { topic: string; domain: string }[]
): Promise<ResumeCoverageReport> {
  const variantRows = await db
    .select()
    .from(resumeVariants)
    .where(eq(resumeVariants.userId, userId))
    .orderBy(desc(resumeVariants.isPrimary), desc(resumeVariants.updatedAt))
    .limit(1);

  if (variantRows.length === 0) {
    return {
      hasResume: false,
      variantId: null,
      coverage: gaps.map((gap) => ({
        topic: gap.topic,
        domain: gap.domain,
        coveredInResume: null,
        evidence: null,
        note: "No resume is on file, so resume coverage could not be evaluated.",
      })),
    };
  }

  const variant = variantRows[0];
  const structured = asStructuredResume(variant.structuredData);
  const resumeText = flattenResumeText(structured);
  const lowerText = resumeText.toLowerCase();

  const coverage: ResumeGapCoverage[] = gaps.map((gap) => {
    const topicWords = gap.topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !["fundamentals", "basics", "core", "advanced"].includes(word));

    const matchedWord = topicWords.find((word) => lowerText.includes(word));
    const domainMatched = lowerText.includes(gap.domain.toLowerCase());
    const covered = Boolean(matchedWord || domainMatched);

    return {
      topic: gap.topic,
      domain: gap.domain,
      coveredInResume: covered,
      evidence: matchedWord ? `Your resume contains "${matchedWord}".` : domainMatched ? `Your resume references ${gap.domain}.` : null,
      note: covered
        ? "This area is represented in your resume text. Depth of experience is not measured here."
        : "Not detected in your resume. That is not a statement about your knowledge — add it only if you have real evidence.",
    };
  });

  return { hasResume: true, variantId: variant.id, coverage };
}

export interface ResumeCoverageReport {
  hasResume: boolean;
  variantId: string | null;
  coverage: ResumeGapCoverage[];
}

// ============================================================================
// 12. Maintenance helpers
// ============================================================================

/** Delete every resume artifact for a user (used by tests and account cleanup). */
export async function deleteAllResumeData(userId: string): Promise<void> {
  await db.delete(resumeFiles).where(eq(resumeFiles.userId, userId));
  await db.delete(resumeSuggestions).where(eq(resumeSuggestions.userId, userId));
  await db.delete(resumeAnalyses).where(eq(resumeAnalyses.userId, userId));
  await db.delete(resumeVersions).where(eq(resumeVersions.userId, userId));
  await db.delete(resumeVariants).where(eq(resumeVariants.userId, userId));
}

/** Count of resume artifacts for a user, used for verification. */
export async function countResumeArtifacts(userId: string) {
  const [files, variants] = await Promise.all([
    db.select({ id: resumeFiles.id }).from(resumeFiles).where(eq(resumeFiles.userId, userId)),
    db.select({ id: resumeVariants.id }).from(resumeVariants).where(eq(resumeVariants.userId, userId)),
  ]);
  return { files: files.length, variants: variants.length };
}
