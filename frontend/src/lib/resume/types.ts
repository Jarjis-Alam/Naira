/**
 * Phase 18 — ATS Resume Intelligence: shared data contracts.
 *
 * These types describe the *observable* resume domain. Nothing in this module
 * asserts a fact about a student; every value is either extracted from the
 * student's own document, extracted from a job description they supplied, or
 * explicitly marked as student-asserted.
 */

import type { SubjectCode } from "./skill-taxonomy";

export type { SubjectCode };

export type ResumeSectionKey =
  | "summary"
  | "education"
  | "experience"
  | "internships"
  | "projects"
  | "skills"
  | "certifications"
  | "achievements"
  | "publications"
  | "leadership"
  | "extracurriculars"
  | "links"
  | "other";

export const RESUME_SECTION_KEYS: ResumeSectionKey[] = [
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
];

export const RESUME_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: "Summary",
  education: "Education",
  experience: "Experience",
  internships: "Internships",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  achievements: "Achievements",
  publications: "Publications",
  leadership: "Leadership",
  extracurriculars: "Extracurriculars",
  links: "Links",
  other: "Additional Information",
};

export type ResumeFileFormat = "pdf" | "docx" | "txt";
export type ParseStatus = "pending" | "parsed" | "partial" | "failed";

/** Provenance of any fact surfaced by resume intelligence. */
export type EvidenceSource =
  | "resume_detected"
  | "student_asserted"
  | "job_description_detected"
  | "ats_formatting";

export type Severity = "info" | "warning" | "critical";

export type AtsDimension =
  | "parsing"
  | "keywords"
  | "skills"
  | "experience"
  | "formatting"
  | "roleMatch";

export const ATS_DIMENSION_LABELS: Record<AtsDimension, string> = {
  parsing: "Parsing",
  keywords: "Keywords",
  skills: "Skills",
  experience: "Experience",
  formatting: "Formatting",
  roleMatch: "Role Match",
};

// ============================================================================
// Structured resume model
// ============================================================================

export interface ResumeDateRange {
  /** Verbatim date text from the resume, e.g. "Jun 2024 – Present". */
  raw: string | null;
  /** Loosely normalized start, e.g. "2024-06" or "2024". Never inferred from context. */
  start: string | null;
  end: string | null;
  isCurrent: boolean;
}

export interface ResumeEntry {
  id: string;
  /** Verbatim heading line that introduced the entry. */
  heading: string;
  title: string | null;
  organization: string | null;
  dates: ResumeDateRange;
  bullets: string[];
  /** Every original line of the entry, verbatim and in order. */
  rawLines: string[];
  confidence: "high" | "medium" | "low";
}

export interface ResumeSection {
  key: ResumeSectionKey;
  /** Verbatim heading line, or null when the section was inferred. */
  originalHeading: string | null;
  order: number;
  entries: ResumeEntry[];
  /** Simple list lines (skills, certifications, achievements). */
  items: string[];
  rawLines: string[];
  /** false when the heading was not part of the standard ATS lexicon. */
  recognized: boolean;
}

export interface ResumeSkillGroup {
  label: string | null;
  skills: string[];
  rawLine: string;
}

export interface ResumeHeader {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
  rawLines: string[];
}

export interface StudentAssertedFact {
  id: string;
  kind: "skill" | "experience" | "achievement" | "certification" | "project";
  value: string;
  note: string | null;
  assertedAt: string;
}

export interface StructuredResume {
  schemaVersion: 1;
  generatedAt: string;
  header: ResumeHeader;
  summary: string | null;
  skills: {
    groups: ResumeSkillGroup[];
    /** Canonical skill names detected anywhere in the resume text. */
    detected: string[];
    rawLines: string[];
  };
  sections: ResumeSection[];
  links: string[];
  /** Facts the student explicitly confirmed. Never auto-populated by analysis. */
  studentAssertedFacts: StudentAssertedFact[];
  /** Original lines that could not be attributed to any section. */
  unclassified: string[];
  stats: {
    lineCount: number;
    wordCount: number;
    bulletCount: number;
    entryCount: number;
    sectionKeys: ResumeSectionKey[];
  };
}

// ============================================================================
// File signals (observable structure, used by the ATS engine)
// ============================================================================

export interface ResumeFileSignals {
  format: ResumeFileFormat;
  pageCount: number | null;
  hasTextLayer: boolean;
  wordCount: number;
  /** Lines containing 3+ consecutive spaces between content (possible columns/tables). */
  multiColumnLineCount: number;
  /** Lines repeated across pages (possible header/footer content). */
  repeatedLineCount: number;
  /** Ratio of decorative/non-alphanumeric characters in the extracted text. */
  symbolDensity: number;
  pdf?: {
    imageCount: number;
    fontFamilies: string[];
    hasAnnotations: boolean;
    hasFormFields: boolean;
    hasEncryptedFlag: boolean;
  };
  docx?: {
    tableCount: number;
    imageCount: number;
    hasTextBoxes: boolean;
    hasHeadersFooters: boolean;
    hasColumns: boolean;
    hasSymbols: boolean;
  };
}

export type ExtractionErrorCode =
  | "unsupported_type"
  | "unsupported_format"
  | "too_large"
  | "corrupt"
  | "empty"
  | "no_text_layer"
  | "encrypted"
  /**
   * The PDF engine itself could not start on the server (worker/runtime
   * resolution). Distinct from `corrupt` so a server-side failure is never
   * reported to the student as a damaged file.
   */
  | "engine_unavailable";

export interface ResumeExtraction {
  ok: boolean;
  format: ResumeFileFormat | null;
  rawText: string;
  warnings: string[];
  error: { code: ExtractionErrorCode; message: string } | null;
  signals: ResumeFileSignals | null;
}

// ============================================================================
// Job description model
// ============================================================================

export interface JobDescriptionSkill {
  /** Term exactly as written in the job description. */
  term: string;
  canonical: string;
  mapped: boolean;
  domain: SubjectCode | null;
  requirement: "required" | "preferred";
  /** Verbatim line that evidenced this skill. */
  evidence: string;
}

export interface JobDescriptionExtraction {
  raw: string;
  source: "paste" | "upload";
  extractedAt: string;
  roleTitle: string | null;
  company: string | null;
  requiredSkills: JobDescriptionSkill[];
  preferredSkills: JobDescriptionSkill[];
  responsibilities: string[];
  qualifications: string[];
  tools: string[];
  keywords: { term: string; count: number }[];
  roleTerminology: string[];
  sections: { label: string; lineCount: number }[];
  warnings: string[];
}

// ============================================================================
// ATS analysis model
// ============================================================================

export type AtsScoreBreakdown = Record<AtsDimension, number | null>;

export interface AtsFinding {
  id: string;
  category: "parsing" | "formatting" | "keywords" | "skills" | "content";
  severity: Severity;
  title: string;
  detail: string;
  evidence: string | null;
}

export interface AtsParsingCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "info" | "fail" | "unknown";
  detail: string;
}

export interface KeywordMatchRow {
  keyword: string;
  status: "matched" | "missing" | "overused";
  occurrences: number;
  requirement: "required" | "preferred";
  note: string | null;
}

export interface SkillMatchRow {
  skill: string;
  canonical: string;
  domain: SubjectCode | null;
  requirement: "required" | "preferred" | "not_in_jd";
  /** true only when the skill is evidenced in the resume text. */
  evidencedInResume: boolean;
  /** Verbatim resume line evidencing the skill, when present. */
  resumeEvidence: string | null;
  provenance: EvidenceSource;
  /**
   * Placement OS measured performance for the mapped domain, when the student
   * has been assessed in it. Not a claim about the skill itself.
   */
  measuredDomainAccuracy: number | null;
  measuredQuestionsAttempted: number;
  gapType: "none" | "resume_gap" | "preparation_gap" | "both" | "not_assessed";
  recommendation: string | null;
}

export interface RoleMatchSummary {
  score: number;
  /**
   * What the match was computed against. "target_role" means the score only
   * reflects whether the resume evidences anything in the curriculum domains
   * that the student's target role requires — it is not a skills requirement
   * list, because no job description was supplied.
   */
  basis: "job_description" | "target_role";
  basisLabel: string;
  matched: string[];
  /** Skills present in the target/JD but not evidenced in the resume. */
  notEvidenced: string[];
  resumeOnly: string[];
  note: string;
}

export interface ContentQuality {
  clarity: number;
  relevance: number;
  conciseness: number;
  technicalSpecificity: number;
  evidenceOfImpact: number;
  consistency: number;
  grammar: number;
  redundancy: number;
  organization: number;
  notes: string[];
}

export interface AtsAnalysisResult {
  atsScore: number;
  breakdown: AtsScoreBreakdown;
  evaluatedDimensions: AtsDimension[];
  unevaluatedDimensions: AtsDimension[];
  explanation: string[];
  findings: AtsFinding[];
  parsingChecks: AtsParsingCheck[];
  keywordAnalysis: {
    rows: KeywordMatchRow[];
    matched: number;
    missing: number;
    overused: KeywordMatchRow[];
    roleTerms: string[];
    note: string;
  };
  skillMatch: {
    rows: SkillMatchRow[];
    matched: string[];
    notEvidenced: string[];
    resumeOnly: string[];
    resumeGaps: SkillMatchRow[];
    preparationGaps: SkillMatchRow[];
    note: string;
  };
  roleMatch: RoleMatchSummary | null;
  contentQuality: ContentQuality;
  sectionCoverage: {
    key: ResumeSectionKey;
    present: boolean;
    itemCount: number;
  }[];
  limitations: string[];
}

// ============================================================================
// Suggestion model
// ============================================================================

export type SuggestionCategory =
  | "summary"
  | "experience_bullet"
  | "project_bullet"
  | "experience_entry"
  | "project_entry"
  | "skills_section"
  | "keyword_evidence"
  | "content_quality"
  | "formatting"
  | "education"
  | "general";

export interface SuggestionTarget {
  sectionKey: ResumeSectionKey | "header";
  entryId: string | null;
  field: "summary" | "bullet" | "entry_heading" | "section_heading" | "skills" | "item";
  index: number | null;
}

export interface ScopeCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface ScopeViolation {
  rule: string;
  detail: string;
}

export interface SuggestionVerification {
  truthPreserving: boolean;
  placeholderRequired: boolean;
  checks: ScopeCheck[];
  violations: ScopeViolation[];
}

export interface ResumeSuggestion {
  /** Deterministic id, stable across re-analysis for the same input. */
  id: string;
  category: SuggestionCategory;
  target: SuggestionTarget;
  originalText: string;
  suggestedText: string | null;
  reason: { what: string; why: string; evidence: string };
  severity: Severity;
  /** true when accepting the suggestion applies a change to structured data. */
  actionable: boolean;
  source: EvidenceSource;
  verification: SuggestionVerification;
}

// ============================================================================
// Job description storage on a variant
// ============================================================================

export interface StoredJobDescription {
  raw: string;
  source: "paste" | "upload";
  /** Verbatim role title typed by the student, when provided. */
  providedRoleTitle: string | null;
  providedCompanyName: string | null;
  addedAt: string;
  extraction: JobDescriptionExtraction;
}
