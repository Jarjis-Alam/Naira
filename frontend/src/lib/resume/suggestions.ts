/**
 * Phase 18 — Resume optimisation suggestions + factual-scope guard.
 *
 * The engine is deterministic and evidence-driven. It may improve wording,
 * structure, consistency, and clarity. It may NOT increase the factual scope of
 * the source text.
 *
 * The guard (`analyzeFactualScope`) is the enforcement mechanism. Every
 * rewrite the engine emits is verified by it before it is returned, and the
 * verification result is stored with the suggestion so the student can see
 * exactly which rules were checked.
 *
 * Forbidden by construction:
 *  - new numbers, metrics, scale, or dates
 *  - scope-escalating verbs (worked on -> "led"/"owned"/"architected")
 *  - new responsibilities or scope nouns (users, clients, team, production)
 *  - new technologies, employers, institutions, titles, certifications, awards
 * Everything the guard cannot verify is emitted as an explicit advisory prompt
 * that the student must resolve themselves, never written into the resume.
 */

import { extractSkills, isKnownSkillTerm } from "./skill-taxonomy";
import { getAllBullets } from "./parse-resume";
import type {
  JobDescriptionExtraction,
  ResumeEntry,
  ResumeSectionKey,
  ResumeSuggestion,
  ScopeCheck,
  ScopeViolation,
  StructuredResume,
  SuggestionCategory,
  SuggestionTarget,
  SuggestionVerification,
} from "./types";

// ScopeCheck and ScopeViolation are declared in ./types so the persisted
// verification payload and the in-memory engine agree on one shape.

// ============================================================================
// Lexicons
// ============================================================================

/**
 * Same-scope rewrites for participation language. Every value here narrows or
 * preserves the claim made by the source; none of them escalate ownership.
 */
export const SAME_SCOPE_VERBS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /^worked on\b/i, replacement: "Contributed to" },
  { pattern: /^helped (?:with|to|in)\b/i, replacement: "Contributed to" },
  { pattern: /^was involved in\b/i, replacement: "Contributed to" },
  { pattern: /^involved in\b/i, replacement: "Contributed to" },
  { pattern: /^part of\b/i, replacement: "Contributed to" },
  { pattern: /^assisted (?:in|with)\b/i, replacement: "Supported" },
  { pattern: /^participated in\b/i, replacement: "Contributed to" },
  { pattern: /^tasked with\b/i, replacement: "Handled" },
  { pattern: /^duties included\b/i, replacement: "Performed" },
  { pattern: /^was responsible for\b/i, replacement: "Responsible for" },
  { pattern: /^did\b/i, replacement: "Performed" },
];

/** Ownership/impact verbs that must never be introduced by a rewrite. */
export const SCOPE_ESCALATION_VERBS = [
  "architected", "automated", "boosted", "built", "championed", "created", "delivered", "deployed", "designed",
  "developed", "directed", "drove", "engineered", "established", "founded", "headed", "implemented", "improved",
  "increased", "initiated", "integrated", "launched", "led", "manage", "managed", "maximised", "maximized",
  "mentored", "migrated", "modernised", "modernized", "optimised", "optimized", "owned", "oversaw", "pioneered",
  "reduced", "revamped", "scaled", "shipped", "spearheaded", "streamlined", "supervised", "transformed",
];

/** Nouns that imply responsibility, scale, or impact. */
export const SCOPE_NOUNS = [
  "clients", "client", "company", "company-wide", "cross-functional", "customers", "customer", "end-to-end",
  "enterprise", "globally", "global", "hundreds", "millions", "nationwide", "organisation", "organization",
  "production", "revenue", "scale", "stakeholder", "stakeholders", "team", "teams", "thousands", "users",
];

/** Relational words that describe composition without asserting new facts. */
export const COMPOSITIONAL_LEXICON = new Set([
  "about", "across", "along", "and", "as", "based", "backed", "by", "driven", "during", "enabled", "for", "focused",
  "from", "in", "including", "into", "of", "on", "or", "oriented", "powered", "related", "relatedly", "through",
  "to", "toward", "towards", "under", "using", "via", "well", "with", "within", "without", "responsible", "contributed",
  "supported", "supported", "handled", "performed", "participated", "assisted", "experience", "experienced",
  "skills", "skill", "knowledge", "familiarity", "exposure", "practice", "practical", "written", "spoken", "strong",
  "solid", "demonstrated", "documented", "projects", "project", "work", "works", "working", "tools", "tool",
  "technologies", "technology", "stack", "techniques", "methods", "concepts", "fundamentals", "principles",
  "development", "engineering", "analysis", "design", "testing", "debugging", "deployment", "maintenance",
  "improvement", "optimization", "automation", "collaboration", "communication", "mentoring", "leadership",
  "candidate", "role", "position", "opportunity", "teamwork", "delivery", "support", "usage", "application",
]);

/** Syntactic glue that carries no factual weight. */
export const FUNCTION_WORDS = new Set([
  "a", "an", "the", "this", "that", "these", "those", "i", "my", "me", "we", "our", "you", "your", "it", "its",
  "is", "are", "was", "were", "be", "been", "being", "am", "has", "have", "had", "do", "does", "did", "will",
  "would", "should", "could", "can", "may", "might", "must", "also", "then", "than", "so", "such", "both", "each",
  "few", "more", "most", "other", "some", "any", "all", "no", "not", "only", "own", "same", "too", "very", "just",
  "etc", "eg", "ie", "per", "at", "if", "while", "when", "where", "which", "who", "whom", "whose", "how", "why",
  "up", "out", "off", "over", "again", "further", "once", "here", "there", "every", "many", "much", "one", "two",
  "three", "s", "t", "ve", "re", "ll", "d", "m", "as", "onto", "upon", "plus",
]);

/**
 * Standard section labels and common section-level vocabulary. Renaming a
 * heading to an ATS-standard label is a structural change, not a factual claim.
 */
export const STRUCTURAL_LEXICON = new Set([
  "summary", "objective", "profile", "education", "academic", "academics", "experience", "internship", "internships",
  "professional", "employment", "projects", "project", "skills", "technical", "technologies", "certifications",
  "certification", "certificates", "courses", "achievements", "achievement", "awards", "honors", "honours",
  "publications", "research", "leadership", "responsibility", "responsibilities", "extracurricular", "activities",
  "links", "profiles", "contact", "information", "additional", "interests", "volunteer", "work", "history",
  "details", "overview", "highlights", "expertise", "competencies", "qualifications", "training", "gpa", "cgpa",
]);

const NUMBER_WORDS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "twenty", "thirty", "forty", "fifty", "hundred", "hundreds", "thousand", "thousands", "million", "millions",
  "billion", "billions", "dozen", "dozens", "half", "double", "triple", "twice", "quarter",
]);

const UNMARKED_PLACEHOLDER_PATTERN = /\b(?:tbd|tba|tk|n\/a|x{1,3}\s*(?:%|k|m|bn)?\s*(?:users|records|requests|items|students))\b/i;

// ============================================================================
// Tokenisation helpers
// ============================================================================

const TOKEN_PATTERN = /[A-Za-z0-9][A-Za-z0-9'’+#./-]*/g;
const PLACEHOLDER_PATTERN = /\[[^\]\n]{1,120}\]/g;

function tokenize(value: string): string[] {
  const withoutPlaceholders = value.replace(PLACEHOLDER_PATTERN, " ");
  const matches = withoutPlaceholders.match(TOKEN_PATTERN);
  if (!matches) return [];
  return matches
    .map((token) => token.toLowerCase().replace(/[.'’]+$/, "").replace(/^[.'’]+/, ""))
    .filter((token) => token.length > 0);
}

function stemOf(token: string): string {
  if (token.length <= 4) return token;
  return token
    .replace(/(?:ically|ations|ation|ments|ment|ness|ities|ity|ings|ing|ies|ied|ers|er|ors|or|eds|ed|es|s|ly)$/, "")
    .replace(/(.)\1$/, "$1");
}

function isContentToken(token: string): boolean {
  if (token.length < 3) return false;
  if (FUNCTION_WORDS.has(token)) return false;
  if (COMPOSITIONAL_LEXICON.has(token)) return false;
  if (STRUCTURAL_LEXICON.has(token)) return false;
  return true;
}

function numericTokens(value: string): string[] {
  const withoutPlaceholders = value.replace(PLACEHOLDER_PATTERN, " ");
  const digits = withoutPlaceholders.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const words = tokenize(withoutPlaceholders).filter((token) => NUMBER_WORDS.has(token));
  return [...digits.map((digit) => digit.replace(/,/g, "")), ...words];
}

function multisetDifference(required: string[], available: string[]): string[] {
  const pool = [...available];
  const missing: string[] = [];
  for (const item of required) {
    const index = pool.indexOf(item);
    if (index >= 0) pool.splice(index, 1);
    else missing.push(item);
  }
  return missing;
}

function looksLikeIdentifier(token: string): boolean {
  return (
    /[A-Z]{2,}/.test(token) ||
    /[A-Z][a-z]+[A-Z]/.test(token) ||
    /[.+#]/.test(token) ||
    /\d/.test(token)
  );
}

// ============================================================================
// The guard
// ============================================================================

export interface ScopeEvidenceContext {
  /** Additional text that counts as student evidence (resume body, target role). */
  evidenceText?: string;
}

export interface ScopeAnalysis {
  allowed: boolean;
  truthPreserving: boolean;
  placeholderRequired: boolean;
  checks: ScopeCheck[];
  violations: ScopeViolation[];
}

/**
 * Verify that a rewrite does not increase the factual scope of its source.
 *
 * A rewrite is allowed only when every content token it introduces is either
 * present in the source, present in the supplied evidence, part of the explicit
 * same-scope rewrite/relational vocabularies, or a bracketed placeholder that
 * the student must fill in themselves.
 */
export function analyzeFactualScope(
  original: string,
  suggested: string,
  context: ScopeEvidenceContext = {}
): ScopeAnalysis {
  const checks: ScopeCheck[] = [];
  const violations: ScopeViolation[] = [];

  const originalTokens = tokenize(original ?? "");
  const evidenceTokens = tokenize(context.evidenceText ?? "");

  const placeholders = (suggested ?? "").match(PLACEHOLDER_PATTERN) ?? [];
  const placeholderRequired = placeholders.length > 0;

  const originalNumbers = numericTokens(original ?? "");
  const evidenceNumbers = numericTokens(context.evidenceText ?? "");
  const suggestedNumbers = numericTokens(suggested ?? "");

  // Rule 1 — no new numbers, metrics, or scale.
  const newNumbers = multisetDifference(suggestedNumbers, [...originalNumbers, ...evidenceNumbers]);
  if (newNumbers.length > 0) {
    violations.push({
      rule: "no_new_numbers",
      detail: `Introduced numeric claim(s) that are not in the source: ${newNumbers.join(", ")}.`,
    });
    checks.push({ rule: "no_new_numbers", passed: false, detail: `New number(s): ${newNumbers.join(", ")}` });
  } else {
    checks.push({ rule: "no_new_numbers", passed: true, detail: "Every numeric claim in the rewrite exists in the source." });
  }

  // Rule 2 — no unmarked placeholders presented as facts.
  const unmarked = (suggested ?? "").match(UNMARKED_PLACEHOLDER_PATTERN);
  const unmarkedInSource = original ? unmarked && original.toLowerCase().includes(unmarked[0].toLowerCase()) : false;
  if (unmarked && !unmarkedInSource) {
    violations.push({
      rule: "no_unmarked_placeholders",
      detail: `Placeholder text "${unmarked[0]}" must be bracketed (for example "[add your real metric]") so it is never read as a fact.`,
    });
    checks.push({ rule: "no_unmarked_placeholders", passed: false, detail: `Unbracketed placeholder: ${unmarked[0]}` });
  } else {
    checks.push({ rule: "no_unmarked_placeholders", passed: true, detail: "No unbracketed placeholder text was introduced." });
  }

  // Rule 3 — no scope-escalating verbs.
  const sourceVocab = new Set([...originalTokens, ...evidenceTokens].map(stemOf));
  const escalated = tokenize(suggested ?? "")
    .filter((token) => SCOPE_ESCALATION_VERBS.includes(token) || SCOPE_ESCALATION_VERBS.includes(stemOf(token)))
    .filter((token) => !sourceVocab.has(stemOf(token)));
  if (escalated.length > 0) {
    const unique = Array.from(new Set(escalated));
    violations.push({
      rule: "no_scope_escalation",
      detail: `Introduced ownership/impact verb(s) the source does not assert: ${unique.join(", ")}.`,
    });
    checks.push({ rule: "no_scope_escalation", passed: false, detail: `Escalating verb(s): ${unique.join(", ")}` });
  } else {
    checks.push({ rule: "no_scope_escalation", passed: true, detail: "No ownership or impact verb was introduced." });
  }

  // Rule 4 — no new scope/responsibility nouns.
  const suggestedTokens = tokenize(suggested ?? "");
  const newScopeNouns = suggestedTokens
    .filter((token) => SCOPE_NOUNS.includes(token) || SCOPE_NOUNS.includes(stemOf(token)))
    .filter((token) => !sourceVocab.has(stemOf(token)));
  if (newScopeNouns.length > 0) {
    const unique = Array.from(new Set(newScopeNouns));
    violations.push({
      rule: "no_new_scope_nouns",
      detail: `Introduced responsibility/scale noun(s) not present in the source: ${unique.join(", ")}.`,
    });
    checks.push({ rule: "no_new_scope_nouns", passed: false, detail: `New scope noun(s): ${unique.join(", ")}` });
  } else {
    checks.push({ rule: "no_new_scope_nouns", passed: true, detail: "No new responsibility or scale noun was introduced." });
  }

  // Rule 5 — no new technologies.
  const newTechnologies = suggestedTokens
    .filter((token) => isKnownSkillTerm(token) || (looksLikeIdentifier(token) && token.length >= 2))
    .filter((token) => !sourceVocab.has(stemOf(token)) && !sourceVocab.has(token));
  if (newTechnologies.length > 0) {
    const unique = Array.from(new Set(newTechnologies));
    violations.push({
      rule: "no_new_technologies",
      detail: `Introduced technology/identifier(s) not evidenced in the source: ${unique.join(", ")}.`,
    });
    checks.push({ rule: "no_new_technologies", passed: false, detail: `New technology/identifier(s): ${unique.join(", ")}` });
  } else {
    checks.push({ rule: "no_new_technologies", passed: true, detail: "No new technology, tool, or identifier was introduced." });
  }

  // Rule 6 — the catch-all: every other content token must already be evidence.
  const newContentTokens = suggestedTokens
    .filter(isContentToken)
    .filter((token) => !sourceVocab.has(token) && !sourceVocab.has(stemOf(token)));
  if (newContentTokens.length > 0) {
    const unique = Array.from(new Set(newContentTokens));
    violations.push({
      rule: "no_new_facts",
      detail: `Introduced word(s) that assert information not present in the source (possible new employer, institution, certification, project, or responsibility): ${unique.join(", ")}.`,
    });
    checks.push({ rule: "no_new_facts", passed: false, detail: `New content word(s): ${unique.join(", ")}` });
  } else {
    checks.push({ rule: "no_new_facts", passed: true, detail: "Every content word already exists in the source evidence." });
  }

  checks.push({
    rule: "placeholders_marked",
    passed: true,
    detail: placeholderRequired
      ? `${placeholders.length} bracketed placeholder(s) require the student to supply the real value.`
      : "No placeholder text was introduced.",
  });

  const allowed = violations.length === 0;

  return {
    allowed,
    truthPreserving: allowed,
    placeholderRequired,
    checks,
    violations,
  };
}

/** Convenience predicate over the guard. */
export function containsFabrication(
  original: string,
  suggested: string,
  context: ScopeEvidenceContext = {}
): boolean {
  return !analyzeFactualScope(original, suggested, context).allowed;
}

// ============================================================================
// Suggestion generation
// ============================================================================

export interface SuggestionEngineInput {
  resume: StructuredResume;
  jobDescription?: JobDescriptionExtraction | null;
  target?: { companyName: string | null; roleName: string | null } | null;
  /** Canonical skills the student confirmed as real. */
  studentAssertedSkills?: string[];
}

function hashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function collapse(value: string): string {
  return value.replace(/\s{2,}/g, " ").trim();
}

/**
 * Skills worth naming in a generated summary. Surface terms are used verbatim
 * (they come straight from the resume), and umbrella concepts such as
 * "Data Structures" are skipped in favour of concrete technologies.
 */
function pickHighlightSkills(resume: StructuredResume, jd: JobDescriptionExtraction | null): string[] {
  const jdRequired = new Set((jd?.requiredSkills ?? []).map((skill) => skill.canonical));
  const jdPreferred = new Set((jd?.preferredSkills ?? []).map((skill) => skill.canonical));
  const umbrellaCategories = new Set(["concept", "soft", "domain"]);

  const hits = extractSkills(flattenResumeEvidence(resume));
  const seen = new Set<string>();
  const scored: { term: string; index: number; value: number }[] = [];

  hits.forEach((hit, index) => {
    const key = hit.term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    let value = 0;
    if (jdRequired.has(hit.canonical)) value += 100;
    else if (jdPreferred.has(hit.canonical)) value += 60;
    if (!umbrellaCategories.has(hit.category)) value += 30;
    if (value > 0) scored.push({ term: hit.term, index, value });
  });

  return scored
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map((entry) => entry.term);
}

function flattenResumeEvidence(resume: StructuredResume): string {
  const parts: string[] = [resume.summary ?? ""];
  for (const section of resume.sections) {
    parts.push(section.originalHeading ?? "", ...section.rawLines, ...section.items);
    for (const entry of section.entries) parts.push(entry.heading, ...entry.bullets);
  }
  parts.push(...resume.skills.groups.flatMap((group) => [group.label ?? "", ...group.skills]));
  return parts.join("\n");
}

/** Text a rewrite is verified against: the field's own text plus resume evidence. */
function evidenceFor(resume: StructuredResume, target: SuggestionEngineInput["target"]): string {
  const parts: string[] = [];
  parts.push(resume.header.name ?? "", resume.header.email ?? "", resume.header.phone ?? "");
  parts.push(resume.summary ?? "");
  for (const section of resume.sections) {
    parts.push(section.originalHeading ?? "", ...section.rawLines, ...section.items);
    for (const entry of section.entries) {
      parts.push(entry.heading, entry.title ?? "", entry.organization ?? "", ...entry.bullets);
    }
  }
  parts.push(...resume.skills.detected);
  parts.push(...resume.skills.groups.flatMap((group) => [group.label ?? "", ...group.skills]));
  parts.push(...resume.links);
  if (target?.roleName) parts.push(target.roleName);
  if (target?.companyName) parts.push(target.companyName);
  return parts.join("\n");
}

function makeSuggestion(params: {
  category: SuggestionCategory;
  target: SuggestionTarget;
  originalText: string;
  suggestedText: string | null;
  what: string;
  why: string;
  evidence: string;
  severity: ResumeSuggestion["severity"];
  actionable: boolean;
  source: ResumeSuggestion["source"];
  verification: SuggestionVerification;
  /** Extra identity for suggestions that share a target (e.g. one per missing skill). */
  idSalt?: string;
}): ResumeSuggestion {
  return {
    id: `sug-${params.category}-${hashId(
      `${params.target.sectionKey}:${params.target.entryId ?? ""}:${params.target.index ?? ""}:${params.originalText}:${params.idSalt ?? ""}`
    )}`,
    category: params.category,
    target: params.target,
    originalText: params.originalText,
    suggestedText: params.suggestedText,
    reason: { what: params.what, why: params.why, evidence: params.evidence },
    severity: params.severity,
    actionable: params.actionable,
    source: params.source,
    verification: params.verification,
  };
}

const FILLER_REWRITES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bin order to\b/gi, replacement: "to" },
  { pattern: /\b(?:utilised|utilized|utilizes|utilises)\b/gi, replacement: "used" },
  { pattern: /\bsuccessfully\s+/gi, replacement: "" },
  { pattern: /\bbasically\s+/gi, replacement: "" },
  { pattern: /\bvery\s+/gi, replacement: "" },
  { pattern: /\breally\s+/gi, replacement: "" },
  { pattern: /\bas well as\b/gi, replacement: "and" },
  { pattern: /\bwas able to\s+/gi, replacement: "" },
  { pattern: /\betc\.?\s*$/i, replacement: "" },
  { pattern: /\s+([,.;])/g, replacement: "$1" },
];

function rewriteWording(text: string): string | null {
  let next = text;
  for (const rule of SAME_SCOPE_VERBS) {
    if (rule.pattern.test(next)) {
      next = next.replace(rule.pattern, rule.replacement);
      break;
    }
  }
  for (const rule of FILLER_REWRITES) {
    next = next.replace(rule.pattern, rule.replacement);
  }
  next = collapse(next);
  if (next === text) return null;
  return sentenceCase(next);
}

/**
 * Generate every applicable suggestion. Candidate rewrites are verified by the
 * factual-scope guard; any candidate that fails is discarded (it is never
 * downgraded into an advisory item, because the text itself was unsafe).
 */
export function generateSuggestions(input: SuggestionEngineInput): ResumeSuggestion[] {
  const { resume } = input;
  const jd = input.jobDescription ?? null;
  const evidence = evidenceFor(resume, input.target ?? null);
  const suggestions: ResumeSuggestion[] = [];

  const verify = (original: string, suggested: string): ScopeAnalysis =>
    analyzeFactualScope(original, suggested, { evidenceText: evidence });

  const accepts = (original: string, suggested: string): SuggestionVerification | null => {
    const analysis = verify(original, suggested);
    if (!analysis.allowed) return null;
    return {
      truthPreserving: true,
      placeholderRequired: analysis.placeholderRequired,
      checks: analysis.checks,
      violations: analysis.violations,
    };
  };

  // ------------------------------------------------------------------ bullets
  const bullets = getAllBullets(resume);
  const entryById = new Map<string, ResumeEntry>();
  for (const section of resume.sections) {
    for (const entry of section.entries) entryById.set(entry.id, entry);
  }

  for (const bullet of bullets) {
    const text = bullet.text.trim();
    if (!text) continue;
    const target: SuggestionTarget = {
      sectionKey: bullet.sectionKey,
      entryId: bullet.entryId,
      field: "bullet",
      index: bullet.index,
    };
    const entry = entryById.get(bullet.entryId);

    // 1. Same-scope wording / filler cleanup (a real, applicable rewrite).
    const rewritten = rewriteWording(text);
    if (rewritten && rewritten !== text) {
      const verification = accepts(text, rewritten);
      if (verification) {
        suggestions.push(
          makeSuggestion({
            category: bullet.sectionKey === "projects" ? "project_bullet" : "experience_bullet",
            target,
            originalText: text,
            suggestedText: rewritten,
            what: "Tighten the wording of this bullet without changing what it claims.",
            why: "Recruiters and ATS keyword extraction both respond better to direct, specific phrasing than to filler and passive openers.",
            evidence: `Original starts with: "${text.split(/\s+/).slice(0, 4).join(" ")}".`,
            severity: "info",
            actionable: true,
            source: "resume_detected",
            verification,
          })
        );
      }
    }

    // 2. Missing technology evidence -> advisory prompt only.
    const lower = text.toLowerCase();
    const mentionsTechnology =
      resume.skills.detected.some((skill) => lower.includes(skill.toLowerCase())) ||
      /[A-Z]{2,}/.test(text) ||
      /[.+#]/.test(text);
    if (!mentionsTechnology) {
      suggestions.push(
        makeSuggestion({
          category: bullet.sectionKey === "projects" ? "project_bullet" : "experience_bullet",
          target,
          originalText: text,
          suggestedText: `${text} [name the specific tools or technologies you actually used]`,
          what: "Add the concrete technologies you used in this bullet.",
          why: "Technical specificity is what an ATS keyword index and a human reviewer both look for first.",
          evidence: "No recognisable technology or tool name appears in this bullet.",
          severity: "warning",
          actionable: false,
          source: "resume_detected",
          verification: verify(text, `${text} [name the specific tools or technologies you actually used]`),
        })
      );
    }

    // 3. Missing measurable outcome -> advisory prompt only, never a number.
    if (!/\d/.test(text)) {
      suggestions.push(
        makeSuggestion({
          category: "content_quality",
          target,
          originalText: text,
          suggestedText: `${text} [add a measurable impact if you have one]`,
          what: "Add a measurable outcome if one genuinely exists.",
          why: "Quantified bullets are more convincing, but Placement OS will never invent a metric for you.",
          evidence: "This bullet contains no number. Placement OS cannot know whether a measurable outcome exists — only you can.",
          severity: "info",
          actionable: false,
          source: "resume_detected",
          verification: verify(text, `${text} [add a measurable impact if you have one]`),
        })
      );
    }

    // 4. Over-long bullets -> advisory split.
    if (text.split(/\s+/).length > 40) {
      suggestions.push(
        makeSuggestion({
          category: "content_quality",
          target,
          originalText: text,
          suggestedText: null,
          what: "Split this long bullet into two shorter points, using only the information already written.",
          why: "Bullets longer than 40 words are frequently skimmed past, and they blur which part of the work you owned.",
          evidence: `This bullet is ${text.split(/\s+/).length} words long.`,
          severity: "info",
          actionable: false,
          source: "ats_formatting",
          verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
        })
      );
    }

    // 5. Entry-level tense consistency -> advisory.
    if (entry) {
      const usesPast = entry.bullets.some((value) => /\b(managed|developed|built|designed|led|maintained|created|supported)\b/i.test(value));
      const usesPresent = entry.bullets.some((value) => /\b(manage|develop|build|design|lead|maintain|create|support)s?\b/i.test(value));
      if (usesPast && usesPresent) {
        suggestions.push(
          makeSuggestion({
            category: "content_quality",
            target,
            originalText: text,
            suggestedText: null,
            what: "Use one tense inside this entry (past for completed work, present for ongoing work).",
            why: "Mixed tense inside a single role reads as an editing error and can obscure whether the work is finished.",
            evidence: `Entry "${entry.heading}" mixes past and present tense across its bullets.`,
            severity: "info",
            actionable: false,
            source: "ats_formatting",
            verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
          })
        );
      }
    }
  }

  // ------------------------------------------------------------------ summary
  const targetRole = input.target?.roleName?.trim() || jd?.roleTitle?.trim() || null;
  const topSkills = pickHighlightSkills(resume, jd).slice(0, 4);
  if (!resume.summary) {
    if (targetRole && topSkills.length >= 2) {
      const candidate = `${targetRole} with experience across ${topSkills.slice(0, 3).join(", ")}.`;
      const verification = accepts("", candidate);
      if (verification) {
        suggestions.push(
          makeSuggestion({
            category: "summary",
            target: { sectionKey: "summary", entryId: null, field: "summary", index: null },
            originalText: "",
            suggestedText: candidate,
            what: "Add a one-line summary built only from skills already evidenced in your resume.",
            why: "A short, factual summary gives parsers and reviewers an immediate frame for the document.",
            evidence: `Skills detected in your resume: ${topSkills.join(", ")}. Target role: ${targetRole}.`,
            severity: "info",
            actionable: true,
            source: "resume_detected",
            verification,
          })
        );
      }
    } else {
      suggestions.push(
        makeSuggestion({
          category: "summary",
          target: { sectionKey: "summary", entryId: null, field: "summary", index: null },
          originalText: "",
          suggestedText: null,
          what: "Consider adding a short summary, but only if it adds information.",
          why: "A summary is optional. A generic one wastes space; a factual one frames the document.",
          evidence: "No summary section was detected. Placement OS will not write one for you without evidence to base it on.",
          severity: "info",
          actionable: false,
          source: "resume_detected",
          verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
        })
      );
    }
  } else if (resume.summary.split(/\s+/).length < 12 && targetRole && topSkills.length >= 2) {
    const candidate = `${targetRole} with experience across ${topSkills.slice(0, 3).join(", ")}.`;
    const verification = accepts(resume.summary, candidate);
    if (verification) {
      suggestions.push(
        makeSuggestion({
          category: "summary",
          target: { sectionKey: "summary", entryId: null, field: "summary", index: null },
          originalText: resume.summary,
          suggestedText: candidate,
          what: "Replace the short summary with one built from evidence already in your resume.",
          why: "A vague one-line summary carries little weight; naming the skills already evidenced does.",
          evidence: `Skills detected in your resume: ${topSkills.join(", ")}. Target role: ${targetRole}.`,
          severity: "info",
          actionable: true,
          source: "resume_detected",
          verification,
        })
      );
    }
  }

  // ------------------------------------------------------------------ skills section
  const skillsSection = resume.sections.find((section) => section.key === "skills");
  if (skillsSection) {
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    for (const item of skillsSection.items) {
      const key = item.toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) duplicates.add(item);
      seen.add(key);
    }
    if (duplicates.size > 0) {
      suggestions.push(
        makeSuggestion({
          category: "skills_section",
          target: { sectionKey: "skills", entryId: null, field: "skills", index: null },
          originalText: skillsSection.rawLines.join(" | "),
          suggestedText: null,
          what: `Remove the duplicated skill entr${duplicates.size === 1 ? "y" : "ies"}: ${Array.from(duplicates).join(", ")}.`,
          why: "Repeated skills add no matching value and lengthen the section for no benefit.",
          evidence: `These tokens appear more than once in the skills section: ${Array.from(duplicates).join(", ")}.`,
          severity: "info",
          actionable: false,
          source: "resume_detected",
          verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
        })
      );
    }

    if (skillsSection.items.length > 12) {
      suggestions.push(
        makeSuggestion({
          category: "skills_section",
          target: { sectionKey: "skills", entryId: null, field: "skills", index: null },
          originalText: skillsSection.rawLines.join(" | "),
          suggestedText: null,
          what: "Group your skills under short labels such as Languages, Frameworks, and Databases.",
          why: "Labelled groups are easier for both parsers and reviewers to scan than one dense list.",
          evidence: `The skills section lists ${skillsSection.items.length} items with no grouping detected.`,
          severity: "info",
          actionable: false,
          source: "ats_formatting",
          verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
        })
      );
    }
  }

  // ------------------------------------------------------------------ JD-driven keyword evidence
  if (jd) {
    const resumeText = evidence.toLowerCase();
    const asserted = new Set((input.studentAssertedSkills ?? []).map((skill) => skill.toLowerCase()));
    const missingRequired = jd.requiredSkills
      .filter((skill) => !resumeText.includes(skill.canonical.toLowerCase()) && !asserted.has(skill.canonical.toLowerCase()))
      .slice(0, 6);

    for (const skill of missingRequired) {
      suggestions.push(
        makeSuggestion({
          category: "keyword_evidence",
          target: { sectionKey: "projects", entryId: null, field: "item", index: null },
          originalText: "",
          suggestedText: null,
          what: `Add evidence for ${skill.canonical} only if you have real experience with it.`,
          why: "This term is required by the job description you supplied, and it is not evidenced anywhere in your resume. Missing wording is fixable; missing experience is not.",
          evidence: `Job description: "${skill.evidence.slice(0, 160)}". Not detected in your resume.`,
          severity: "warning",
          actionable: false,
          source: "job_description_detected",
          idSalt: skill.canonical,
          verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
        })
      );
    }
  }

  // ------------------------------------------------------------------ entries
  for (const section of resume.sections) {
    for (const entry of section.entries) {
      if (!entry.dates.raw) {
        suggestions.push(
          makeSuggestion({
            category:
            section.key === "education"
              ? "education"
              : section.key === "projects"
                ? "project_entry"
                : "experience_entry",
            target: { sectionKey: section.key, entryId: entry.id, field: "entry_heading", index: null },
            originalText: entry.heading,
            suggestedText: null,
            what: "Add the start and end dates for this entry.",
            why: "Date ranges are how a parser (and a reviewer) places your work on a timeline. Without them the entry is often attached to the wrong period.",
            evidence: `No date range was detected in "${entry.heading}".`,
            severity: "warning",
            actionable: false,
            source: "ats_formatting",
            verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
          })
        );
      }

      if (section.key === "experience" && entry.confidence === "low") {
        suggestions.push(
          makeSuggestion({
            category: "experience_entry",
            target: { sectionKey: section.key, entryId: entry.id, field: "entry_heading", index: null },
            originalText: entry.heading,
            suggestedText: null,
            what: "Format this entry as: Job Title, Organisation, Location, Start – End.",
            why: "A single predictable heading line is what parsers use to separate one role from the next.",
            evidence: `Placement OS could not confidently identify the title and dates in "${entry.heading}".`,
            severity: "info",
            actionable: false,
            source: "ats_formatting",
            verification: { truthPreserving: true, placeholderRequired: false, checks: [], violations: [] },
          })
        );
      }
    }
  }

  // ------------------------------------------------------------------ headings
  for (const section of resume.sections) {
    if (!section.recognized && section.originalHeading) {
      const standardLabel =
        section.key === "other" ? null : STANDARD_HEADING_FOR[section.key] ?? null;
      if (standardLabel) {
        const verification = accepts(section.originalHeading, standardLabel);
        if (verification) {
          suggestions.push(
            makeSuggestion({
              category: "formatting",
              target: { sectionKey: section.key, entryId: null, field: "section_heading", index: null },
              originalText: section.originalHeading,
              suggestedText: standardLabel,
              what: `Rename the heading "${section.originalHeading}" to the standard "${standardLabel}".`,
              why: "ATS parsers look for standard section labels; an unusual heading can leave the entire section unclassified.",
              evidence: `"${section.originalHeading}" is not a standard ATS section name.`,
              severity: "warning",
              actionable: true,
              source: "ats_formatting",
              verification,
            })
          );
        }
      }
    }
  }

  // ------------------------------------------------------------------ stabilise
  const severityRank: Record<ResumeSuggestion["severity"], number> = { critical: 0, warning: 1, info: 2 };
  const unique = new Map<string, ResumeSuggestion>();
  for (const suggestion of suggestions) {
    if (!unique.has(suggestion.id)) unique.set(suggestion.id, suggestion);
  }
  return Array.from(unique.values())
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id))
    .slice(0, 16);
}

const STANDARD_HEADING_FOR: Record<ResumeSectionKey, string | null> = {
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
  other: null,
};

// ============================================================================
// Applying an accepted suggestion
// ============================================================================

export interface ApplyResult {
  resume: StructuredResume;
  applied: boolean;
  reason: string | null;
}

/**
 * Apply an accepted suggestion to the structured model. Refuses any suggestion
 * that carries an unverified rewrite, and refuses placeholder text so a prompt
 * can never end up stored as resume content.
 */
export function applySuggestion(resume: StructuredResume, suggestion: ResumeSuggestion): ApplyResult {
  if (!suggestion.actionable || !suggestion.suggestedText) {
    return { resume, applied: false, reason: "This suggestion is advisory and does not change the resume text." };
  }
  if (PLACEHOLDER_PATTERN.test(suggestion.suggestedText)) {
    PLACEHOLDER_PATTERN.lastIndex = 0;
    return {
      resume,
      applied: false,
      reason: "Fill in the bracketed placeholder with your own real information before applying this change.",
    };
  }
  PLACEHOLDER_PATTERN.lastIndex = 0;
  if (!suggestion.verification?.truthPreserving) {
    return { resume, applied: false, reason: "This change did not pass the truth-preservation check." };
  }

  const next: StructuredResume = {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => ({ ...entry, bullets: [...entry.bullets] })),
      items: [...section.items],
    })),
  };

  const { target } = suggestion;

  if (target.field === "summary") {
    next.summary = suggestion.suggestedText;
    const summarySection = next.sections.find((section) => section.key === "summary");
    if (summarySection) {
      if (summarySection.items.length > 0) summarySection.items[0] = suggestion.suggestedText;
      else summarySection.items.push(suggestion.suggestedText);
    }
    return { resume: next, applied: true, reason: null };
  }

  if (target.field === "bullet" && target.entryId && target.index !== null) {
    for (const section of next.sections) {
      const entry = section.entries.find((candidate) => candidate.id === target.entryId);
      if (entry && entry.bullets[target.index] !== undefined) {
        entry.bullets[target.index] = suggestion.suggestedText;
        return { resume: next, applied: true, reason: null };
      }
    }
    return { resume, applied: false, reason: "The bullet this suggestion refers to no longer exists." };
  }

  if (target.field === "section_heading") {
    const section = next.sections.find(
      (candidate) => candidate.key === target.sectionKey && candidate.originalHeading === suggestion.originalText
    );
    if (section) {
      section.originalHeading = suggestion.suggestedText;
      section.recognized = true;
      return { resume: next, applied: true, reason: null };
    }
    return { resume, applied: false, reason: "The section this suggestion refers to no longer exists." };
  }

  if (target.field === "entry_heading" && target.entryId) {
    for (const section of next.sections) {
      const entry = section.entries.find((candidate) => candidate.id === target.entryId);
      if (entry) {
        entry.heading = suggestion.suggestedText;
        return { resume: next, applied: true, reason: null };
      }
    }
  }

  return { resume, applied: false, reason: "This suggestion could not be applied automatically. Edit it in the builder." };
}
