/**
 * Phase 18 — ATS compatibility analysis.
 *
 * Deterministic, fully explainable scoring over *observable* signals:
 *  - the extracted text layer and its structure
 *  - the structural signals recorded during extraction (images, tables,
 *    columns, text boxes, fonts, repeated header/footer lines, symbols)
 *  - the student's supplied job description
 *  - Placement OS measured domain performance (Phase 14/16 intelligence)
 *
 * Language rules enforced throughout:
 *  - The output is an ATS *compatibility* assessment. It never claims a
 *    specific ATS will accept the resume, and never states a probability.
 *  - A skill is "not evidenced in the resume" — never "the student lacks it".
 *  - Dimensions that cannot be evaluated without a job description are reported
 *    as `null` and excluded from the weighted total rather than guessed.
 */

import {
  SUBJECT_CODE_LABELS,
  extractSkills,
  type SubjectCode,
} from "./skill-taxonomy";
import { getAllBullets, flattenResumeText } from "./parse-resume";
import type {
  AtsAnalysisResult,
  AtsDimension,
  AtsFinding,
  AtsParsingCheck,
  AtsScoreBreakdown,
  ContentQuality,
  EvidenceSource,
  JobDescriptionExtraction,
  KeywordMatchRow,
  ResumeFileFormat,
  ResumeFileSignals,
  ResumeSectionKey,
  RoleMatchSummary,
  SkillMatchRow,
  StructuredResume,
} from "./types";
import { ATS_DIMENSION_LABELS, RESUME_SECTION_LABELS } from "./types";

// ============================================================================
// Inputs
// ============================================================================

export interface MeasuredDomain {
  code: SubjectCode;
  accuracy: number | null;
  questionsAttempted: number;
}

export interface RoleDomainRequirement {
  domain: SubjectCode;
  need: "HIGH" | "MEDIUM" | "STANDARD";
}

export interface AtsAnalysisInput {
  resume: StructuredResume;
  extraction: {
    ok: boolean;
    format: ResumeFileFormat | null;
    warnings: string[];
    signals: ResumeFileSignals | null;
    errorCode?: string | null;
  };
  jobDescription?: JobDescriptionExtraction | null;
  target?: { companyName: string | null; roleName: string | null } | null;
  roleDomains?: RoleDomainRequirement[];
  measuredDomains?: MeasuredDomain[];
  /** Canonical skills the student explicitly confirmed. */
  studentAssertedSkills?: string[];
  now?: string;
}

// ============================================================================
// Lexicons and helpers
// ============================================================================

const ACTION_VERBS = [
  "achieved", "adapted", "administered", "analyzed", "architected", "assembled", "automated", "benchmarked", "boosted",
  "built", "centralized", "collaborated", "completed", "composed", "conducted", "configured", "consolidated",
  "contributed", "converted", "coordinated", "created", "customized", "debugged", "delivered", "demonstrated",
  "deployed", "designed", "detected", "developed", "devised", "diagnosed", "directed", "documented", "drove",
  "earned", "eliminated", "engineered", "enhanced", "established", "evaluated", "executed", "expanded", "explored",
  "facilitated", "fine-tuned", "fixed", "forecasted", "formulated", "founded", "generated", "handled", "identified",
  "implemented", "improved", "increased", "initiated", "inspected", "installed", "integrated", "introduced",
  "investigated", "launched", "led", "leveraged", "maintained", "managed", "mapped", "measured", "mentored",
  "migrated", "modeled", "modernized", "monitored", "mounted", "orchestrated", "optimized", "organized", "owned",
  "performed", "piloted", "presented", "prioritized", "produced", "programmed", "provided", "published",
  "refactored", "reduced", "reengineered", "refined", "released", "removed", "reorganized", "reported",
  "researched", "resolved", "restructured", "revamped", "reviewed", "scaled", "scripted", "secured", "shipped",
  "simplified", "solved", "spearheaded", "standardized", "streamlined", "strengthened", "supported", "tested",
  "tracked", "trained", "transformed", "translated", "troubleshot", "tuned", "unified", "upgraded", "validated",
  "verified", "wrote",
];

const ACTION_VERB_SET = new Set(ACTION_VERBS);

const WEAK_OPENERS = [
  "responsible for", "was responsible for", "duties included", "worked on", "involved in", "was involved in",
  "helped with", "assisted in", "tasked with", "part of", "handled",
];

const STANDARD_SECTIONS: ResumeSectionKey[] = [
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "certifications",
  "achievements",
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
}

function containsTerm(haystack: string, term: string): boolean {
  const normalizedTerm = normalizeForMatch(term);
  if (!normalizedTerm) return false;
  const normalizedHaystack = normalizeForMatch(haystack);
  if (normalizedHaystack.includes(normalizedTerm)) return true;
  // Handle simple plural/suffix drift for single words (e.g. "api" vs "apis").
  if (!normalizedTerm.includes(" ")) {
    return new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es|ing|ed)?\\b`).test(
      normalizedHaystack
    );
  }
  return false;
}

function countOccurrences(haystack: string, term: string): number {
  const normalizedTerm = normalizeForMatch(term);
  if (!normalizedTerm) return 0;
  const normalizedHaystack = normalizeForMatch(haystack);
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = normalizedHaystack.match(new RegExp(`\\b${escaped}(?:s|es|ing|ed)?\\b`, "g"));
  return matches ? matches.length : 0;
}

function distinct(values: string[]): string[] {
  return Array.from(new Set(values));
}

function dateFormatShape(raw: string): string {
  return raw
    .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*/gi, "MON")
    .replace(/\d/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

function bulletMarker(line: string): string {
  const match = line.match(/^\s*([-–—•▪◦●○*·‣∙►]|\d{1,2}[.)]|[a-zA-Z][.)])\s+/);
  return match ? match[1] : "";
}

// ============================================================================
// Scoring components
// ============================================================================

interface ScoreAndReasons {
  score: number;
  reasons: string[];
}

function scoreParsing(input: AtsAnalysisInput, resume: StructuredResume): ScoreAndReasons {
  const reasons: string[] = [];
  if (!input.extraction.ok) {
    return { score: 0, reasons: ["No text layer could be extracted from the uploaded file."] };
  }

  let score = 100;

  const hasEmail = Boolean(resume.header.email);
  const hasPhone = Boolean(resume.header.phone);
  const hasName = Boolean(resume.header.name);
  if (!hasEmail) {
    score -= 25;
    reasons.push("No email address was detected in the header block (−25).");
  }
  if (!hasPhone) {
    score -= 15;
    reasons.push("No phone number was detected in the header block (−15).");
  }
  if (!hasName) {
    score -= 10;
    reasons.push("No candidate name was detected at the top of the document (−10).");
  }

  const recognized = resume.sections.filter((section) => section.recognized);
  const unrecognized = resume.sections.filter((section) => !section.recognized);
  if (recognized.length === 0) {
    score -= 30;
    reasons.push("No standard section headings were detected (−30).");
  }
  if (unrecognized.length > 0) {
    const penalty = Math.min(12, unrecognized.length * 4);
    score -= penalty;
    reasons.push(`${unrecognized.length} non-standard heading(s) were preserved but are not ATS-standard (−${penalty}).`);
  }

  const entriesWithDates = resume.sections.reduce(
    (total, section) => total + section.entries.filter((entry) => entry.dates.raw).length,
    0
  );
  if (resume.stats.entryCount > 0 && entriesWithDates === 0) {
    score -= 10;
    reasons.push("No employment/education/project date ranges were detected (−10).");
  }

  if (resume.stats.bulletCount === 0) {
    score -= 15;
    reasons.push("No bullet-point lines were detected (−15).");
  }

  if (resume.unclassified.length > 0) {
    const penalty = Math.min(6, resume.unclassified.length * 2);
    score -= penalty;
    reasons.push(`${resume.unclassified.length} line(s) could not be attributed to a section (−${penalty}).`);
  }

  const warningPenalty = Math.min(9, input.extraction.warnings.length * 3);
  if (warningPenalty > 0) {
    score -= warningPenalty;
    reasons.push(`${input.extraction.warnings.length} extraction warning(s) were reported (−${warningPenalty}).`);
  }

  if (resume.stats.wordCount < 80) {
    score = Math.min(score, 55);
    reasons.push("The document contains very little text, which limits reliable parsing.");
  }

  return { score: clamp(score), reasons };
}

function scoreFormatting(input: AtsAnalysisInput, resume: StructuredResume): ScoreAndReasons & { checks: AtsParsingCheck[] } {
  const reasons: string[] = [];
  const checks: AtsParsingCheck[] = [];
  const signals = input.extraction.signals;
  let score = 100;

  const add = (id: string, label: string, status: AtsParsingCheck["status"], detail: string, penalty = 0) => {
    checks.push({ id, label, status, detail });
    if (penalty > 0) score -= penalty;
  };

  add(
    "text_layer",
    "Extractable text layer",
    input.extraction.ok ? "pass" : "fail",
    input.extraction.ok
      ? "Text was extracted from the document without needing OCR."
      : "Text could not be extracted; ATS parsers rely on the text layer.",
    input.extraction.ok ? 0 : 100
  );

  const pdf = signals?.pdf;
  if (pdf) {
    add(
      "images",
      "Embedded images or graphics",
      pdf.imageCount === 0 ? "pass" : "warn",
      pdf.imageCount === 0
        ? "No embedded images were detected."
        : `${pdf.imageCount} embedded image object(s) were detected. Text inside images is invisible to ATS parsers.`,
      pdf.imageCount > 0 ? 12 : 0
    );
    const nonStandardFonts = pdf.fontFamilies.filter((font) => !isStandardFontName(font));
    add(
      "fonts",
      "Standard font families",
      nonStandardFonts.length === 0 ? "pass" : "warn",
      nonStandardFonts.length === 0
        ? `Fonts detected: ${pdf.fontFamilies.slice(0, 4).join(", ") || "not reported"}.`
        : `Uncommon font(s) detected: ${nonStandardFonts.slice(0, 4).join(", ")}. Custom fonts can map characters unpredictably.`,
      nonStandardFonts.length > 0 ? 8 : 0
    );
    add(
      "form_fields",
      "Form fields and annotations",
      pdf.hasFormFields || pdf.hasAnnotations ? "warn" : "pass",
      pdf.hasFormFields
        ? "Interactive form fields were detected; some parsers skip this content."
        : pdf.hasAnnotations
          ? "Annotations were detected in addition to the text layer."
          : "No interactive form fields were detected.",
      pdf.hasFormFields ? 10 : pdf.hasAnnotations ? 4 : 0
    );
  }

  const docx = signals?.docx;
  if (docx) {
    add(
      "tables",
      "Tables",
      docx.tableCount === 0 ? "pass" : "warn",
      docx.tableCount === 0
        ? "No tables were detected."
        : `${docx.tableCount} table(s) were detected. Many parsers read table cells out of order.`,
      docx.tableCount > 0 ? 12 : 0
    );
    add(
      "text_boxes",
      "Text boxes",
      docx.hasTextBoxes ? "warn" : "pass",
      docx.hasTextBoxes
        ? "Text boxes were detected; content inside them is frequently skipped by parsers."
        : "No text boxes were detected.",
      docx.hasTextBoxes ? 10 : 0
    );
    add(
      "columns",
      "Multi-column layout",
      docx.hasColumns ? "warn" : "pass",
      docx.hasColumns
        ? "A multi-column section layout was detected, which can interleave text when parsed."
        : "A single-column layout was detected.",
      docx.hasColumns ? 10 : 0
    );
    add(
      "headers_footers",
      "Headers and footers",
      docx.hasHeadersFooters ? "warn" : "pass",
      docx.hasHeadersFooters
        ? "Header/footer content was detected. Keep contact details in the body so they are never dropped."
        : "No header or footer content was detected.",
      docx.hasHeadersFooters ? 6 : 0
    );
    if (docx.imageCount > 0) {
      add("docx_images", "Embedded images", "warn", `${docx.imageCount} embedded image(s) were detected.`, 6);
    }
    if (docx.hasSymbols) {
      add("docx_symbols", "Symbol characters", "warn", "Symbol-font characters were detected in the document.", 4);
    }
  }

  if (!signals || signals.multiColumnLineCount > 4) {
    const count = signals?.multiColumnLineCount ?? 0;
    add(
      "multi_column_text",
      "Column-style text runs",
      count === 0 ? "pass" : count > 4 ? "warn" : "info",
      count === 0
        ? "No tab-aligned or column-style lines were detected."
        : `${count} line(s) contain wide gaps between text runs (a common sign of a table or column layout).`,
      count > 4 ? 8 : count > 0 ? 4 : 0
    );
  }

  if (signals && signals.repeatedLineCount > 0) {
    add(
      "repeated_lines",
      "Repeated content across pages",
      "warn",
      "The same line appears at the same position on multiple pages (a likely header or footer), which parsers may read as body text or skip.",
      6
    );
  }

  if (signals && signals.symbolDensity > 0.004) {
    add(
      "symbols",
      "Decorative symbols",
      "warn",
      `Decorative glyphs make up ${(signals.symbolDensity * 100).toFixed(2)}% of the text. Icon fonts and symbol characters often extract as empty boxes.`,
      8
    );
  }

  // Date format consistency
  const dateShapes = distinct(
    resume.sections.flatMap((section) =>
      section.entries.map((entry) => entry.dates.raw).filter((raw): raw is string => Boolean(raw)).map(dateFormatShape)
    )
  );
  if (dateShapes.length > 2) {
    add(
      "date_formats",
      "Consistent date formats",
      "warn",
      `${dateShapes.length} different date formats were detected across your entries. A single consistent format parses more reliably.`,
      5
    );
  } else if (dateShapes.length > 0) {
    add("date_formats", "Consistent date formats", "pass", "Date formats are consistent across entries.");
  } else {
    add("date_formats", "Consistent date formats", "unknown", "No date ranges were detected to compare.");
  }

  // Bullet marker consistency
  const markers = distinct(
    resume.sections.flatMap((section) =>
      section.rawLines.filter((line) => line.trim()).map(bulletMarker).filter((marker) => Boolean(marker))
    )
  );
  if (markers.length > 2) {
    add(
      "bullet_markers",
      "Consistent bullet markers",
      "warn",
      `${markers.length} different bullet markers were used. A single marker style extracts more predictably.`,
      4
    );
  } else if (markers.length > 0) {
    add("bullet_markers", "Consistent bullet markers", "pass", "A consistent bullet marker is used.");
  }

  if (signals?.pageCount && signals.pageCount > 2) {
    add(
      "length",
      "Resume length",
      "info",
      `The document is ${signals.pageCount} pages. Most entry-level roles are scanned in one to two pages.`,
      6
    );
  }

  return { score: clamp(score), reasons, checks };
}

function isStandardFontName(fontFamily: string): boolean {
  const base = fontFamily
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/[,\-]?(Bold|Italic|Oblique|Regular|Light|Medium|Black|Thin|SemiBold|Semibold|Roman|MT|PS)$/gi, "")
    .toLowerCase();
  return /^(arial|helvetica|timesnewroman|times|timesnewromanps|courier|couriern|calibri|cambria|georgia|verdana|tahoma|garamond|bookman|palatino|trebuchet|symbol|zapfdingbats|nimbus|liberation|dejavu|carlito|caladea|notosans|opensans|lato|roboto|segoe|consolas|menlo|monaco|andale|futura|gill|arialmt|timesnewromanpsmt)/.test(
    base
  );
}

interface SkillMatchResult {
  rows: SkillMatchRow[];
  score: number | null;
  matched: string[];
  notEvidenced: string[];
  resumeOnly: string[];
  resumeGaps: SkillMatchRow[];
  preparationGaps: SkillMatchRow[];
  reasons: string[];
  note: string;
}

function computeSkillMatch(input: AtsAnalysisInput, resumeText: string): SkillMatchResult {
  const resumeSkills = extractSkills(resumeText);
  const resumeEvidence = new Map(resumeSkills.map((hit) => [hit.canonical, hit.evidence]));
  const asserted = new Set((input.studentAssertedSkills ?? []).map((skill) => skill.toLowerCase()));
  const measured = new Map((input.measuredDomains ?? []).map((domain) => [domain.code, domain]));

  const jd = input.jobDescription ?? null;
  const rows: SkillMatchRow[] = [];

  const requirementSkills: { canonical: string; requirement: "required" | "preferred"; domain: SubjectCode | null }[] = [];
  if (jd) {
    for (const skill of jd.requiredSkills) {
      requirementSkills.push({ canonical: skill.canonical, requirement: "required", domain: skill.domain });
    }
    for (const skill of jd.preferredSkills) {
      if (!requirementSkills.some((entry) => entry.canonical === skill.canonical)) {
        requirementSkills.push({ canonical: skill.canonical, requirement: "preferred", domain: skill.domain });
      }
    }
  }

  const gradeSkill = (
    canonical: string,
    requirement: "required" | "preferred" | "not_in_jd",
    domain: SubjectCode | null
  ): SkillMatchRow => {
    const evidence = resumeEvidence.get(canonical) ?? null;
    const isAsserted = asserted.has(canonical.toLowerCase());
    const evidenced = Boolean(evidence) || isAsserted;
    const domainMeasurement = domain ? measured.get(domain) ?? null : null;
    const measuredAccuracy =
      domainMeasurement && domainMeasurement.accuracy !== null && domainMeasurement.questionsAttempted > 0
        ? domainMeasurement.accuracy
        : null;

    let gapType: SkillMatchRow["gapType"] = "none";
    const preparationWeak = measuredAccuracy !== null && measuredAccuracy < 60;

    if (!evidenced && requirement !== "not_in_jd") gapType = "resume_gap";
    else if (!evidenced && preparationWeak) gapType = "both";
    if (evidenced && preparationWeak) gapType = "preparation_gap";
    if (!evidenced && requirement === "not_in_jd") gapType = "resume_gap";
    if (!domain && gapType === "none" && measuredAccuracy === null && evidenced) gapType = "not_assessed";

    let recommendation: string | null = null;
    if (gapType === "resume_gap") {
      recommendation =
        "Not evidenced in your resume. If you have real experience with it, add a specific project or experience line — do not add it otherwise.";
    } else if (gapType === "preparation_gap") {
      recommendation = `Your resume evidences this, but your measured ${SUBJECT_CODE_LABELS[domain as SubjectCode]} accuracy is ${measuredAccuracy}%. Strengthen it in preparation before interviews.`;
    } else if (gapType === "both") {
      recommendation =
        "Neither evidenced in your resume nor strong in your measured preparation. Prioritise preparation first, then add evidence once it is real.";
    } else if (gapType === "not_assessed") {
      recommendation = "Placement OS has no measured performance for this area yet, so no preparation judgement is made.";
    }

    return {
      skill: canonical,
      canonical,
      domain,
      requirement,
      evidencedInResume: Boolean(evidence),
      resumeEvidence: evidence,
      provenance: (isAsserted && !evidence ? "student_asserted" : "resume_detected") as EvidenceSource,
      measuredDomainAccuracy: measuredAccuracy,
      measuredQuestionsAttempted: domainMeasurement?.questionsAttempted ?? 0,
      gapType,
      recommendation,
    };
  };

  for (const entry of requirementSkills) {
    rows.push(gradeSkill(entry.canonical, entry.requirement, entry.domain));
  }
  for (const hit of resumeSkills) {
    if (!rows.some((row) => row.canonical === hit.canonical)) {
      rows.push(gradeSkill(hit.canonical, "not_in_jd", hit.domain));
    }
  }

  const requiredRows = rows.filter((row) => row.requirement === "required");
  const preferredRows = rows.filter((row) => row.requirement === "preferred");
  const matched = rows.filter((row) => row.evidencedInResume).map((row) => row.canonical);
  const notEvidenced = rows
    .filter((row) => !row.evidencedInResume && row.requirement !== "not_in_jd")
    .map((row) => row.canonical);
  const resumeOnly = rows.filter((row) => row.requirement === "not_in_jd").map((row) => row.canonical);

  let score: number | null = null;
  const reasons: string[] = [];
  if (jd && (requiredRows.length > 0 || preferredRows.length > 0)) {
    const requiredRatio = requiredRows.length > 0
      ? ratio(requiredRows.filter((row) => row.evidencedInResume).length, requiredRows.length)
      : null;
    const preferredRatio = preferredRows.length > 0
      ? ratio(preferredRows.filter((row) => row.evidencedInResume).length, preferredRows.length)
      : null;
    let weighted = 0;
    let weightSum = 0;
    if (requiredRatio !== null) {
      weighted += requiredRatio * 0.75;
      weightSum += 0.75;
    }
    if (preferredRatio !== null) {
      weighted += preferredRatio * 0.25;
      weightSum += 0.25;
    }
    score = clamp((weighted / (weightSum || 1)) * 100);
    reasons.push(
      `${requiredRows.filter((row) => row.evidencedInResume).length}/${requiredRows.length} required skill(s) evidenced in the resume${
        preferredRows.length > 0
          ? `, ${preferredRows.filter((row) => row.evidencedInResume).length}/${preferredRows.length} preferred skill(s) evidenced`
          : ""
      }.`
    );
  } else {
    reasons.push("Skills match requires a job description; none is attached to this resume variant.");
  }

  const note = jd
    ? "These rows compare your resume's wording and your confirmed claims against the job description. They describe what appears in your document, not what you know."
    : "No job description was supplied, so skills are listed from your resume only.";

  return {
    rows,
    score,
    matched,
    notEvidenced,
    resumeOnly,
    resumeGaps: rows.filter((row) => row.gapType === "resume_gap" || row.gapType === "both"),
    preparationGaps: rows.filter((row) => row.gapType === "preparation_gap"),
    reasons,
    note,
  };
}

interface KeywordResult {
  rows: KeywordMatchRow[];
  matched: number;
  missing: number;
  overused: KeywordMatchRow[];
  roleTerms: string[];
  score: number | null;
  reasons: string[];
  note: string;
}

function computeKeywordAnalysis(input: AtsAnalysisInput, resumeText: string): KeywordResult {
  const jd = input.jobDescription ?? null;
  const rows: KeywordMatchRow[] = [];

  if (!jd) {
    return {
      rows,
      matched: 0,
      missing: 0,
      overused: [],
      roleTerms: [],
      score: null,
      reasons: ["Keyword match requires a job description; none is attached to this resume variant."],
      note: "Paste the job description you are targeting to compare keywords.",
    };
  }

  const seen = new Set<string>();
  const candidates = [
    ...jd.requiredSkills.map((skill) => ({ term: skill.canonical, requirement: "required" as const })),
    ...jd.preferredSkills.map((skill) => ({ term: skill.canonical, requirement: "preferred" as const })),
    ...jd.keywords.slice(0, 20).map((keyword) => ({ term: keyword.term, requirement: "required" as const })),
  ];

  for (const candidate of candidates) {
    const key = candidate.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const occurrences = countOccurrences(resumeText, candidate.term);
    const present = occurrences > 0 || containsTerm(resumeText, candidate.term);
    rows.push({
      keyword: candidate.term,
      status: present ? (occurrences > 6 ? "overused" : "matched") : "missing",
      occurrences,
      requirement: candidate.requirement,
      note: present
        ? occurrences > 6
          ? `Appears ${occurrences} times, which reads as keyword stuffing.`
          : null
        : "Not detected in your resume.",
    });
  }

  const matched = rows.filter((row) => row.status === "matched").length;
  const missing = rows.filter((row) => row.status === "missing").length;
  const overused = rows.filter((row) => row.status === "overused");
  const total = matched + missing + overused.length;
  const baseScore = total > 0 ? (matched / total) * 100 : null;
  const score = baseScore === null ? null : clamp(baseScore - Math.min(10, overused.length * 3));

  return {
    rows,
    matched,
    missing,
    overused,
    roleTerms: jd.roleTerminology,
    score,
    reasons:
      score === null
        ? []
        : [`${matched} of ${total} job-description keyword(s) detected in the resume${overused.length > 0 ? `, ${overused.length} over-used` : ""}.`],
    note: "Only add a keyword if you can honestly evidence it. Placement OS will never suggest claiming a skill you have not documented.",
  };
}

function computeExperienceScore(resume: StructuredResume, resumeText: string) {
  const bullets = getAllBullets(resume);
  const reasons: string[] = [];
  if (bullets.length === 0) {
    return { score: 0, reasons: ["No bullet points were detected, so experience quality could not be assessed."] };
  }

  const detectedSkills = new Set(extractSkills(resumeText).map((hit) => hit.canonical.toLowerCase()));
  const skillPattern = new RegExp(
    `\\b(${Array.from(detectedSkills)
      .map((skill) => skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b`,
    "i"
  );

  let actionVerbCount = 0;
  let technicalCount = 0;
  let numericCount = 0;
  let wellFormedCount = 0;
  let weakOpenerCount = 0;

  for (const bullet of bullets) {
    const text = bullet.text.trim();
    const firstWord = text.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    if (ACTION_VERB_SET.has(firstWord)) actionVerbCount++;
    if (WEAK_OPENERS.some((opener) => text.toLowerCase().startsWith(opener))) weakOpenerCount++;
    if (detectedSkills.size > 0 && (skillPattern.test(text) || /[A-Z][A-Z0-9+#.]{1,}/.test(text))) technicalCount++;
    if (/\d/.test(text)) numericCount++;
    const words = text.split(/\s+/).length;
    if (words >= 6 && words <= 40) wellFormedCount++;
  }

  const actionScore = ratio(actionVerbCount, bullets.length) * 30;
  const technicalScore = ratio(technicalCount, bullets.length) * 25;
  const numericScore = ratio(numericCount, bullets.length) * 15;
  const wellFormedScore = ratio(wellFormedCount, bullets.length) * 15;
  const datedEntries = resume.sections.reduce(
    (total, section) => total + section.entries.filter((entry) => entry.dates.raw).length,
    0
  );
  const entryDateScore = resume.stats.entryCount > 0 ? ratio(datedEntries, resume.stats.entryCount) * 15 : 15;

  const score = clamp(actionScore + technicalScore + numericScore + wellFormedScore + entryDateScore);
  reasons.push(`${actionVerbCount}/${bullets.length} bullet(s) start with an action verb.`);
  reasons.push(`${technicalCount}/${bullets.length} bullet(s) name a specific technology or tool.`);
  reasons.push(
    `${numericCount}/${bullets.length} bullet(s) contain a number. Placement OS cannot know whether an outcome is measurable — only you can add it if it is real.`
  );
  if (weakOpenerCount > 0) {
    reasons.push(`${weakOpenerCount} bullet(s) open with a weak phrase such as "Responsible for" or "Worked on".`);
  }

  return { score, reasons };
}

function computeContentQuality(resume: StructuredResume, resumeText: string, jd: JobDescriptionExtraction | null) {
  const bullets = getAllBullets(resume);
  const notes: string[] = [];
  const detectedSkills = extractSkills(resumeText).map((hit) => hit.canonical);

  const wordCounts = bullets.map((bullet) => bullet.text.split(/\s+/).length);
  const longBullets = bullets.filter((bullet) => bullet.text.split(/\s+/).length > 40).length;
  const veryLong = bullets.filter((bullet) => bullet.text.split(/\s+/).length > 60).length;
  const avgWords = wordCounts.length > 0 ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length : 0;

  const clarity = clamp(
    100 -
      Math.min(40, longBullets * 5) -
      Math.min(20, veryLong * 10) -
      (bullets.some((bullet) => /\b([A-Z]{4,}\s+){3,}/.test(bullet.text)) ? 10 : 0) -
      (bullets.filter((bullet) => / {2,}/.test(bullet.text)).length > 0 ? 5 : 0)
  );
  if (longBullets > 0) notes.push(`${longBullets} bullet(s) exceed 40 words and are hard to scan.`);

  const relevant = jd
    ? bullets.filter((bullet) => {
        const text = bullet.text.toLowerCase();
        return (
          jd.requiredSkills.some((skill) => text.includes(skill.canonical.toLowerCase())) ||
          jd.keywords.slice(0, 12).some((keyword) => text.includes(keyword.term))
        );
      }).length
    : bullets.filter((bullet) => detectedSkills.some((skill) => bullet.text.toLowerCase().includes(skill.toLowerCase()))).length;
  const relevance = clamp(ratio(relevant, bullets.length || 1) * 100);
  if (bullets.length > 0 && relevance < 50) {
    notes.push(
      jd
        ? "Fewer than half of your bullets connect to the target role's language."
        : "Fewer than half of your bullets name a specific technology or tool."
    );
  }

  const conciseness = clamp(
    100 - Math.min(30, Math.max(0, avgWords - 24) * 3) - Math.min(20, longBullets * 4) - (avgWords < 5 && bullets.length > 0 ? 15 : 0)
  );

  const technicalSpecificity = clamp(ratio(bullets.filter((bullet) => detectedSkills.some((skill) => bullet.text.toLowerCase().includes(skill.toLowerCase()))).length, bullets.length || 1) * 100);
  if (bullets.length > 0 && technicalSpecificity < 50) {
    notes.push("Add the concrete technologies you used — this is the single biggest keyword lever an ATS sees.");
  }

  const evidenceOfImpact = clamp(ratio(bullets.filter((bullet) => /\d/.test(bullet.text)).length, bullets.length || 1) * 100);
  if (bullets.length > 0 && evidenceOfImpact < 40) {
    notes.push(
      "Several bullets state what you did without a result. If you have a real measurable outcome (users, latency, time saved), add it — never invent one."
    );
  }

  const normalizedBullets = bullets.map((bullet) => normalizeForMatch(bullet.text));
  const duplicates = normalizedBullets.length - new Set(normalizedBullets).size;
  const nearDuplicates = normalizedBullets.filter((value, index) =>
    normalizedBullets.some((other, otherIndex) => otherIndex < index && other.length > 20 && (other.includes(value) || value.includes(other)))
  ).length;
  const redundancy = clamp(100 - Math.min(40, duplicates * 15) - Math.min(30, nearDuplicates * 10));
  if (duplicates > 0 || nearDuplicates > 0) {
    notes.push(`${duplicates + nearDuplicates} bullet(s) repeat content already stated elsewhere.`);
  }

  const hasTerminalPunctuation = bullets.filter((bullet) => /[.!?]$/.test(bullet.text.trim())).length;
  const punctuationConsistency = bullets.length > 1 && hasTerminalPunctuation > 0 && hasTerminalPunctuation < bullets.length;
  const doubleSpaces = (resumeText.match(/[a-z] {2,}[a-z]/gi) ?? []).length;
  const repeatedWords = (resumeText.match(/\b(\w+)\s+\1\b/gi) ?? []).length;
  const lowercaseStarts = bullets.filter((bullet) => /^[a-z]/.test(bullet.text.trim())).length;
  const grammar = clamp(
    100 -
      (punctuationConsistency ? 10 : 0) -
      Math.min(15, doubleSpaces * 3) -
      Math.min(20, repeatedWords * 8) -
      Math.min(20, lowercaseStarts * 4)
  );
  if (grammar < 90) {
    notes.push("Review punctuation consistency, spacing, and capitalisation at the start of each bullet.");
  }

  const shapes = distinct(
    resume.sections
      .flatMap((section) => section.entries.map((entry) => entry.dates.raw))
      .filter((raw): raw is string => Boolean(raw))
      .map(dateFormatShape)
  );
  const markerCount = distinct(resume.sections.flatMap((section) => section.rawLines.map(bulletMarker).filter(Boolean))).length;
  const tenseMix = (() => {
    let mixed = 0;
    for (const section of resume.sections) {
      for (const entry of section.entries) {
        const presentTense = entry.bullets.filter((bullet) => /\b(manage|develop|build|design|lead|maintain|create|support)s?\b/i.test(bullet)).length;
        const pastTense = entry.bullets.filter((bullet) => /\b(managed|developed|built|designed|led|maintained|created|supported)\b/i.test(bullet)).length;
        if (presentTense > 0 && pastTense > 0) mixed++;
      }
    }
    return mixed;
  })();
  const consistency = clamp(
    100 - (shapes.length > 2 ? 15 : 0) - (markerCount > 2 ? 10 : 0) - Math.min(25, tenseMix * 10)
  );
  if (consistency < 90) {
    notes.push("Use one date format, one bullet marker, and a consistent tense (past for completed work, present for current).");
  }

  const presentKeys = new Set(resume.sections.map((section) => section.key));
  const expectedPresent = STANDARD_SECTIONS.filter((key) => presentKeys.has(key)).length;
  const hasOrderIssue = (() => {
    const order = resume.sections.map((section) => section.order);
    const skillsIndex = order[resume.sections.findIndex((section) => section.key === "skills")];
    const experienceIndex = order[resume.sections.findIndex((section) => section.key === "experience")];
    return skillsIndex !== undefined && experienceIndex !== undefined && experienceIndex > skillsIndex;
  })();
  const organization = clamp(
    ratio(expectedPresent, STANDARD_SECTIONS.length) * 100 - (hasOrderIssue ? 5 : 0)
  );
  if (expectedPresent < STANDARD_SECTIONS.length) {
    const missing = STANDARD_SECTIONS.filter((key) => !presentKeys.has(key)).map((key) => RESUME_SECTION_LABELS[key]);
    notes.push(`No section detected for: ${missing.join(", ")}.`);
  }

  const quality: ContentQuality = {
    clarity,
    relevance,
    conciseness,
    technicalSpecificity,
    evidenceOfImpact,
    consistency,
    grammar,
    redundancy,
    organization,
    notes,
  };
  return quality;
}

function computeRoleMatch(
  input: AtsAnalysisInput,
  resumeText: string,
  skillMatch: SkillMatchResult
): RoleMatchSummary | null {
  const jd = input.jobDescription ?? null;
  const target = input.target ?? null;

  if (jd) {
    const requiredRows = skillMatch.rows.filter((row) => row.requirement === "required");
    const skillComponent = ratio(requiredRows.filter((row) => row.evidencedInResume).length, requiredRows.length || 1) * 55;

    const responsibilityTokens = jd.responsibilities
      .flatMap((line) => line.toLowerCase().match(/[a-z][a-z+#.]{3,}/g) ?? [])
      .filter((token, index, all) => all.indexOf(token) === index)
      .slice(0, 25);
    const responsibilityHits = responsibilityTokens.filter((token) => resumeText.toLowerCase().includes(token)).length;
    const responsibilityComponent = ratio(responsibilityHits, responsibilityTokens.length || 1) * 25;

    const terminologyHits = jd.roleTerminology.filter((term) => resumeText.toLowerCase().includes(term)).length;
    const terminologyComponent = ratio(terminologyHits, jd.roleTerminology.length || 1) * 20;

    const score = clamp(skillComponent + responsibilityComponent + terminologyComponent);
    const targetLabel = [target?.companyName, target?.roleName].filter(Boolean).join(" — ");

    return {
      score,
      basis: "job_description",
      basisLabel: targetLabel ? `Job description for ${targetLabel}` : "Supplied job description",
      matched: skillMatch.rows.filter((row) => row.evidencedInResume && row.requirement === "required").map((row) => row.canonical),
      notEvidenced: requiredRows.filter((row) => !row.evidencedInResume).map((row) => row.canonical),
      resumeOnly: [],
      note:
        "Computed from the job description you supplied: required skills evidenced in your resume, overlap with the listed responsibilities, and role terminology. It is not a prediction of any hiring outcome.",
    };
  }

  // Without a job description we can still compare the resume against the
  // curriculum domains the student's own target role requires (Phase 16 data).
  const domains = input.roleDomains ?? [];
  if (domains.length === 0) return null;

  const resumeDomains = new Set(
    extractSkills(resumeText)
      .map((hit) => hit.domain)
      .filter((domain): domain is SubjectCode => Boolean(domain))
  );

  const weightFor = (need: RoleDomainRequirement["need"]) => (need === "HIGH" ? 3 : need === "MEDIUM" ? 2 : 1);
  let weighted = 0;
  let total = 0;
  const covered: string[] = [];
  const uncovered: string[] = [];
  for (const requirement of domains) {
    const weight = weightFor(requirement.need);
    total += weight;
    if (resumeDomains.has(requirement.domain)) {
      weighted += weight;
      covered.push(SUBJECT_CODE_LABELS[requirement.domain]);
    } else {
      uncovered.push(SUBJECT_CODE_LABELS[requirement.domain]);
    }
  }

  const score = total > 0 ? clamp((weighted / total) * 100) : null;
  if (score === null) return null;

  return {
    score,
    basis: "target_role",
    basisLabel: target?.roleName ? `Target role curriculum: ${target.roleName}` : "Target role curriculum",
    matched: covered,
    notEvidenced: uncovered,
    resumeOnly: [],
    note:
      "No job description is attached, so this compares your resume against the curriculum domains your target role requires in Placement OS. It measures whether the area appears in your resume at all — not the depth of your knowledge.",
  };
}

// ============================================================================
// Main analysis
// ============================================================================

const DIMENSION_WEIGHTS: Record<AtsDimension, number> = {
  parsing: 0.2,
  keywords: 0.2,
  skills: 0.15,
  experience: 0.15,
  formatting: 0.15,
  roleMatch: 0.15,
};

export function analyzeResumeAtsScore(input: AtsAnalysisInput): AtsAnalysisResult {
  const resumeText = flattenResumeText(input.resume);
  const jd = input.jobDescription ?? null;

  const parsing = scoreParsing(input, input.resume);
  const formattingResult = scoreFormatting(input, input.resume);
  const skillMatchResult = computeSkillMatch(input, resumeText);
  const keywordResult = computeKeywordAnalysis(input, resumeText);
  const experience = computeExperienceScore(input.resume, resumeText);
  const roleMatch = computeRoleMatch(input, resumeText, skillMatchResult);
  const contentQuality = computeContentQuality(input.resume, resumeText, jd);

  const breakdown: AtsScoreBreakdown = {
    parsing: parsing.score,
    keywords: keywordResult.score,
    skills: skillMatchResult.score,
    experience: experience.score,
    formatting: formattingResult.score,
    roleMatch: roleMatch?.score ?? null,
  };

  const evaluatedDimensions = (Object.keys(breakdown) as AtsDimension[]).filter(
    (dimension) => breakdown[dimension] !== null
  );
  const unevaluatedDimensions = (Object.keys(breakdown) as AtsDimension[]).filter(
    (dimension) => breakdown[dimension] === null
  );

  const weightSum = evaluatedDimensions.reduce((total, dimension) => total + DIMENSION_WEIGHTS[dimension], 0);
  const weightedSum = evaluatedDimensions.reduce(
    (total, dimension) => total + (breakdown[dimension] as number) * DIMENSION_WEIGHTS[dimension],
    0
  );
  const atsScore = weightSum > 0 ? Math.round(weightedSum / weightSum) : 0;

  // ------------------------------------------------------------------ explanation
  const explanation: string[] = [];
  explanation.push(
    `Parsing ${parsing.score}/100 — ${parsing.reasons[0] ?? "document structure was readable."}`
  );
  explanation.push(
    `Formatting ${formattingResult.score}/100 — ${
      formattingResult.checks.filter((check) => check.status === "warn").length === 0
        ? "no structural parsing risks were detected."
        : `${formattingResult.checks.filter((check) => check.status === "warn").length} structural risk(s) detected.`
    }`
  );
  explanation.push(`Experience ${experience.score}/100 — ${experience.reasons[0] ?? ""}`);
  if (skillMatchResult.score !== null) {
    explanation.push(`Skills ${skillMatchResult.score}/100 — ${skillMatchResult.reasons[0] ?? ""}`);
  }
  if (keywordResult.score !== null) {
    explanation.push(`Keywords ${keywordResult.score}/100 — ${keywordResult.reasons[0] ?? ""}`);
  }
  if (roleMatch) {
    explanation.push(`Role Match ${roleMatch.score}/100 — ${roleMatch.basisLabel}.`);
  } else {
    explanation.push(
      "Role Match was not evaluated: attach a job description (or set a target role) to measure alignment."
    );
  }
  explanation.push(
    `Total is the weighted average of the ${evaluatedDimensions.length} evaluated dimension(s): ${evaluatedDimensions
      .map((dimension) => ATS_DIMENSION_LABELS[dimension])
      .join(", ")}.`
  );

  // ------------------------------------------------------------------ findings
  const findings: AtsFinding[] = [];
  const pushFinding = (finding: AtsFinding) => findings.push(finding);

  for (const check of formattingResult.checks) {
    if (check.status === "warn" || check.status === "fail") {
      pushFinding({
        id: `format-${check.id}`,
        category: check.id === "symbols" || check.id === "bullet_markers" || check.id === "date_formats" ? "formatting" : "parsing",
        severity: check.status === "fail" ? "critical" : "warning",
        title: check.label,
        detail: check.detail,
        evidence: null,
      });
    }
  }

  if (!input.resume.header.email || !input.resume.header.phone) {
    pushFinding({
      id: "contact-incomplete",
      category: "parsing",
      severity: "critical",
      title: "Contact details are incomplete",
      detail:
        "ATS parsers look for an email address and phone number in the document body. Detected: " +
        [
          input.resume.header.email ? `email (${input.resume.header.email})` : "email (not detected)",
          input.resume.header.phone ? `phone (${input.resume.header.phone})` : "phone (not detected)",
        ].join(", ") +
        ".",
      evidence: input.resume.header.rawLines.slice(0, 3).join(" | ") || null,
    });
  }

  for (const warning of [...input.extraction.warnings]) {
    pushFinding({
      id: `extraction-${findings.length}`,
      category: "parsing",
      severity: "info",
      title: "Extraction note",
      detail: warning,
      evidence: null,
    });
  }

  for (const row of skillMatchResult.resumeGaps.filter((row) => row.requirement === "required").slice(0, 6)) {
    pushFinding({
      id: `skill-gap-${row.canonical}`,
      category: "skills",
      severity: "warning",
      title: `${row.canonical} is required by the target role but is not evidenced in your resume`,
      detail:
        "This term was not detected in your resume. That is not a statement about your skills — if you have real experience with it, add a specific project or experience line. If you do not, treat it as preparation rather than wording.",
      evidence: null,
    });
  }

  if (jd) {
    for (const row of keywordResult.rows.filter((keyword) => keyword.status === "overused").slice(0, 4)) {
      pushFinding({
        id: `keyword-overuse-${row.keyword}`,
        category: "keywords",
        severity: "warning",
        title: `"${row.keyword}" appears ${row.occurrences} times`,
        detail: "Repeating a keyword does not improve matching and reads poorly to a human reviewer. Keep the natural mentions.",
        evidence: null,
      });
    }
  }

  if (contentQuality.notes.length > 0) {
    pushFinding({
      id: "content-quality",
      category: "content",
      severity: "info",
      title: "Content quality observations",
      detail: contentQuality.notes.join(" "),
      evidence: null,
    });
  }

  // ------------------------------------------------------------------ parsing checks
  const parsingChecks: AtsParsingCheck[] = [
    {
      id: "contact_email",
      label: "Email address detected",
      status: input.resume.header.email ? "pass" : "fail",
      detail: input.resume.header.email ?? "No email address was detected in the document text.",
    },
    {
      id: "contact_phone",
      label: "Phone number detected",
      status: input.resume.header.phone ? "pass" : "warn",
      detail: input.resume.header.phone ?? "No phone number was detected in the document text.",
    },
    {
      id: "name",
      label: "Candidate name detected",
      status: input.resume.header.name ? "pass" : "warn",
      detail: input.resume.header.name ?? "No candidate name was detected at the top of the document.",
    },
    {
      id: "standard_headings",
      label: "Standard section headings",
      status: input.resume.sections.filter((section) => section.recognized).length > 0 ? "pass" : "fail",
      detail: `${input.resume.sections.filter((section) => section.recognized).length} recognised heading(s), ${
        input.resume.sections.filter((section) => !section.recognized).length
      } non-standard.`,
    },
    {
      id: "dates",
      label: "Date ranges detected",
      status: input.resume.sections.some((section) => section.entries.some((entry) => entry.dates.raw)) ? "pass" : "warn",
      detail: "Entry date ranges are used by parsers to place your roles on a timeline.",
    },
    {
      id: "bullets",
      label: "Bullet structure",
      status: input.resume.stats.bulletCount > 0 ? "pass" : "warn",
      detail: `${input.resume.stats.bulletCount} bullet line(s) detected.`,
    },
    {
      id: "skills_representation",
      label: "Skills representation",
      status: input.resume.skills.detected.length > 0 ? (input.resume.skills.groups.some((group) => group.label) ? "pass" : "info") : "warn",
      detail:
        input.resume.skills.detected.length === 0
          ? "No recognisable skills were detected in the document text."
          : `${input.resume.skills.detected.length} known skill(s) detected in the text${input.resume.skills.groups.some((group) => group.label) ? "" : "; grouped labels (for example \"Languages: …\") parse more reliably than a single dense list"}.`,
    },
    ...formattingResult.checks,
  ];

  const limitations = [
    "This is an ATS compatibility assessment built from measurable signals in your document. It is not a prediction of any company's decision, and Placement OS has no access to any employer's ATS.",
    "\"Not evidenced in your resume\" means the term was not detected in your document. It is never a statement that you lack the skill.",
  ];
  if (!jd) {
    limitations.push(
      "Keyword, skills-match, and role-match dimensions require a job description and were excluded from the weighted total rather than estimated."
    );
  }
  return {
    atsScore,
    breakdown,
    evaluatedDimensions,
    unevaluatedDimensions,
    explanation,
    findings,
    parsingChecks,
    keywordAnalysis: {
      rows: keywordResult.rows,
      matched: keywordResult.matched,
      missing: keywordResult.missing,
      overused: keywordResult.overused,
      roleTerms: keywordResult.roleTerms,
      note: keywordResult.note,
    },
    skillMatch: {
      rows: skillMatchResult.rows,
      matched: skillMatchResult.matched,
      notEvidenced: skillMatchResult.notEvidenced,
      resumeOnly: skillMatchResult.resumeOnly,
      resumeGaps: skillMatchResult.resumeGaps,
      preparationGaps: skillMatchResult.preparationGaps,
      note: skillMatchResult.note,
    },
    roleMatch,
    contentQuality,
    sectionCoverage: STANDARD_SECTIONS.concat(["internships", "publications", "leadership", "extracurriculars"]).map(
      (key) => {
        const section = input.resume.sections.find((candidate) => candidate.key === key);
        return {
          key,
          present: Boolean(section),
          itemCount: section ? section.entries.length + section.items.length : 0,
        };
      }
    ),
    limitations,
  };
}
