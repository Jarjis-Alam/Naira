/**
 * Phase 18 — Job description analysis.
 *
 * Extracts what an employer actually wrote: required and preferred skills,
 * responsibilities, qualifications, tools, and repeated role terminology.
 *
 * Every extracted value is a literal quote or a canonicalised name of a term
 * present in the supplied text. Nothing is inferred about the employer, and
 * every inference the parser has to make (for example when a job description
 * does not separate required from preferred skills) is recorded in `warnings`.
 */

import { ROLE_TERMINOLOGY, extractSkills, getSkill } from "./skill-taxonomy";
import type { JobDescriptionExtraction, JobDescriptionSkill } from "./types";

type JdSectionKind = "responsibilities" | "required" | "preferred" | "about" | "other";

const SECTION_PATTERNS: { kind: JdSectionKind; patterns: string[] }[] = [
  {
    kind: "responsibilities",
    patterns: [
      "responsibilities",
      "key responsibilities",
      "responsibility",
      "what you will do",
      "what you'll do",
      "what you will be doing",
      "duties",
      "role",
      "the role",
      "job description",
      "day to day",
      "day-to-day",
      "your role",
    ],
  },
  {
    kind: "required",
    patterns: [
      "requirements",
      "required",
      "required skills",
      "minimum qualifications",
      "basic qualifications",
      "must have",
      "must-have",
      "must haves",
      "qualifications",
      "what we are looking for",
      "what we're looking for",
      "skills required",
      "essential",
      "eligibility",
    ],
  },
  {
    kind: "preferred",
    patterns: [
      "preferred",
      "preferred qualifications",
      "preferred skills",
      "nice to have",
      "good to have",
      "bonus",
      "bonus points",
      "plus",
      "plus points",
      "desirable",
      "added advantage",
      "additional advantage",
      "preferred experience",
    ],
  },
  {
    kind: "about",
    patterns: ["about", "about us", "about the company", "company", "who we are", "overview", "our mission", "benefits", "perks"],
  },
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "that", "this", "have", "has", "from", "not", "but",
  "who", "what", "when", "where", "which", "while", "into", "over", "under", "about", "also", "than", "then", "them",
  "they", "their", "there", "these", "those", "such", "some", "any", "all", "can", "could", "should", "would", "may",
  "might", "must", "able", "well", "more", "most", "other", "others", "own", "same", "very", "just", "only", "both",
  "each", "few", "nor", "too", "use", "using", "used", "work", "working", "role", "job", "team", "teams", "company",
  "candidate", "candidates", "apply", "applicants", "looking", "join", "including", "include", "includes", "plus",
  "years", "year", "experience", "strong", "good", "great", "excellent", "ability", "knowledge", "understanding",
  "skills", "skill", "preferred", "required", "requirements", "qualifications", "responsibilities", "responsibility",
  "new", "help", "support", "ensure", "across", "within", "including", "etc", "per", "via", "day", "days", "week",
  "will", "you'll", "we", "us", "as", "at", "by", "be", "is", "of", "to", "in", "on", "or", "an", "it", "its", "if",
  "how", "why", "him", "her", "his", "was", "were", "been", "being", "do", "does", "did", "doing", "so", "no", "yes",
]);

const INLINE_REQUIRED_MARKER = /\b(required|must|mandatory|minimum)\b/i;
const INLINE_PREFERRED_MARKER = /\b(preferred|nice to have|good to have|bonus|desirable|plus|added advantage|a plus)\b/i;

function normalizeLine(line: string): string {
  return line.replace(/^\s*(?:[-–—•▪◦●○*·‣∙►]|\d{1,2}[.)])\s*/, "").trim();
}

function headingKind(line: string): JdSectionKind | null {
  const cleaned = line
    .trim()
    .replace(/^[\d]+[.)\s-]+/, "")
    .replace(/[:\-–—\s]+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!cleaned || cleaned.length > 60) return null;
  for (const entry of SECTION_PATTERNS) {
    if (entry.patterns.includes(cleaned)) return entry.kind;
  }
  return null;
}

function isBulletish(line: string): boolean {
  return /^\s*(?:[-–—•▪◦●○*·‣∙►]|\d{1,2}[.)])\s+\S/.test(line);
}

export interface JobDescriptionInput {
  raw: string;
  source?: "paste" | "upload";
  providedRoleTitle?: string | null;
  providedCompanyName?: string | null;
  now?: string;
}

export function analyzeJobDescription(input: JobDescriptionInput): JobDescriptionExtraction {
  const raw = (input.raw ?? "").replace(/\r\n?/g, "\n").trim();
  const warnings: string[] = [];
  const lines = raw.split("\n");

  const sections: { label: string; lineCount: number }[] = [];
  const responsibilities: string[] = [];
  const qualifications: string[] = [];
  const requiredSkills = new Map<string, JobDescriptionSkill>();
  const preferredSkills = new Map<string, JobDescriptionSkill>();

  let currentKind: JdSectionKind | null = null;
  let currentLabel: string | null = null;
  let currentCount = 0;
  const flushSection = () => {
    if (currentLabel) sections.push({ label: currentLabel, lineCount: currentCount });
    currentCount = 0;
  };

  const addSkill = (
    bucket: "required" | "preferred",
    skill: JobDescriptionSkill
  ) => {
    const target = bucket === "required" ? requiredSkills : preferredSkills;
    const existing = target.get(skill.canonical);
    if (!existing) {
      target.set(skill.canonical, skill);
      return;
    }
    // A skill marked required anywhere stays required.
    if (bucket === "required" && !target.has(skill.canonical)) target.set(skill.canonical, skill);
    else if (bucket === "required") {
      requiredSkills.set(skill.canonical, { ...existing, requirement: "required" });
      preferredSkills.delete(skill.canonical);
    }
  };

  let sawExplicitRequired = false;
  let sawExplicitPreferred = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const kind = headingKind(line);
    if (kind && !isBulletish(line)) {
      flushSection();
      currentKind = kind;
      currentLabel = trimmed.replace(/[:\-–—\s]+$/, "");
      currentCount = 0;
      if (kind === "required") sawExplicitRequired = true;
      if (kind === "preferred") sawExplicitPreferred = true;
      continue;
    }

    currentCount++;

    const content = normalizeLine(line);
    if (!content) continue;

    const inlinePreferred = INLINE_PREFERRED_MARKER.test(content);
    const inlineRequired = INLINE_REQUIRED_MARKER.test(content);

    if (currentKind === "responsibilities") responsibilities.push(content);
    if (currentKind === "required") qualifications.push(content);

    const hits = extractSkills(content);
    for (const hit of hits) {
      const bucket: "required" | "preferred" =
        inlinePreferred ? "preferred" : inlineRequired ? "required" : currentKind === "preferred" ? "preferred" : "required";
      addSkill(bucket, {
        term: hit.term,
        canonical: hit.canonical,
        mapped: hit.domain !== null,
        domain: hit.domain,
        requirement: bucket,
        evidence: content,
      });
    }
  }
  flushSection();

  // A skill claims "required" only when the job description says so. When the
  // text never separates the two, every detected term is labelled required and
  // the inference is stated explicitly instead of being hidden.
  if (!sawExplicitRequired && !sawExplicitPreferred && (requiredSkills.size > 0 || preferredSkills.size > 0)) {
    warnings.push(
      "This job description does not explicitly separate required from preferred skills, so all detected terms are listed as required. Verify against the original posting."
    );
  }

  const requiredList = Array.from(requiredSkills.values());
  const preferredList = Array.from(preferredSkills.values()).filter(
    (skill) => !requiredSkills.has(skill.canonical)
  );

  // ------------------------------------------------------------------ keywords
  const tokenCounts = new Map<string, number>();
  for (const token of raw.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) ?? []) {
    const cleaned = token.replace(/[.]+$/, "");
    if (cleaned.length < 3 || STOPWORDS.has(cleaned)) continue;
    tokenCounts.set(cleaned, (tokenCounts.get(cleaned) ?? 0) + 1);
  }
  for (const skill of [...requiredList, ...preferredList]) {
    const key = skill.canonical.toLowerCase();
    tokenCounts.set(key, Math.max(tokenCounts.get(key) ?? 0, 1));
  }
  const keywords = Array.from(tokenCounts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => (b.count - a.count) || a.term.localeCompare(b.term))
    .slice(0, 30);

  // ------------------------------------------------------------------ terminology
  const lowerRaw = raw.toLowerCase();
  const roleTerminology = ROLE_TERMINOLOGY.filter((term) => lowerRaw.includes(term));

  // ------------------------------------------------------------------ tools
  const tools = [...requiredList, ...preferredList]
    .filter((skill) => {
      const taxonomy = getSkill(skill.canonical);
      if (!taxonomy) return false;
      return ["tool", "cloud", "framework", "database", "language"].includes(taxonomy.category);
    })
    .map((skill) => skill.canonical)
    .filter((value, index, all) => all.indexOf(value) === index);

  // ------------------------------------------------------------------ title & company
  let roleTitle = input.providedRoleTitle?.trim() || null;
  let company = input.providedCompanyName?.trim() || null;

  if (!roleTitle) {
    const titleLine = raw.match(/^\s*(?:job\s*title|position|role|designation)\s*[:\-]\s*(.+)$/im);
    if (titleLine) roleTitle = titleLine[1].trim().slice(0, 120);
  }
  if (!roleTitle) {
    const firstHeadingish = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length <= 80)
      .find((line) => /(engineer|developer|analyst|scientist|intern|architect|consultant|manager|designer|administrator|specialist)/i.test(line) && !/[.!?]$/.test(line));
    roleTitle = firstHeadingish ? normalizeLine(firstHeadingish).slice(0, 120) : null;
  }
  if (!company) {
    const companyLine = raw.match(/^\s*(?:company|organisation|organization|employer)\s*[:\-]\s*(.+)$/im);
    if (companyLine) company = companyLine[1].trim().slice(0, 120);
  }

  if (!raw) {
    warnings.push("No job description text was supplied, so target matching is unavailable.");
  }

  return {
    raw,
    source: input.source ?? "paste",
    extractedAt: input.now ?? new Date().toISOString(),
    roleTitle,
    company,
    requiredSkills: requiredList,
    preferredSkills: preferredList,
    responsibilities: responsibilities.slice(0, 40),
    qualifications: qualifications.slice(0, 40),
    tools,
    keywords,
    roleTerminology,
    sections,
    warnings,
  };
}

/** Convenience: text of a stored job description extraction, for re-analysis. */
export function jobDescriptionText(extraction: JobDescriptionExtraction | null | undefined): string {
  return extraction?.raw ?? "";
}
