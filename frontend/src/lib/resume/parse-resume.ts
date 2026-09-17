/**
 * Phase 18 — Structured resume model builder.
 *
 * Converts extracted resume text into the structured model consumed by the ATS
 * engine, the builder, and the suggestion engine.
 *
 * Preservation contract (enforced here and asserted in the test suite):
 *  - Every original line is retained somewhere in the model (`rawLines`).
 *  - Nothing is rewritten, reworded, reordered within a line, or discarded.
 *  - Lines that cannot be attributed to a section are kept in `unclassified`.
 *  - Low-confidence interpretations are flagged rather than guessed silently.
 */

import { detectCanonicalSkills } from "./skill-taxonomy";
import type {
  ResumeDateRange,
  ResumeEntry,
  ResumeHeader,
  ResumeSection,
  ResumeSectionKey,
  ResumeSkillGroup,
  StructuredResume,
} from "./types";

// ============================================================================
// Heading lexicon
// ============================================================================

const HEADING_LEXICON: { patterns: string[]; key: ResumeSectionKey }[] = [
  { key: "summary", patterns: ["summary", "professional summary", "career summary", "profile", "professional profile", "objective", "career objective", "about", "about me", "overview"] },
  { key: "education", patterns: ["education", "educational background", "academic background", "academics", "academic qualifications", "qualifications", "academic details", "education and training"] },
  { key: "experience", patterns: ["experience", "work experience", "professional experience", "employment history", "employment", "work history", "work experience and internships", "relevant experience", "industry experience"] },
  { key: "internships", patterns: ["internship", "internships", "internship experience", "industrial training", "training", "summer internship"] },
  { key: "projects", patterns: ["projects", "project", "project experience", "academic projects", "personal projects", "technical projects", "key projects", "major projects", "selected projects", "project work"] },
  { key: "skills", patterns: ["skills", "technical skills", "technical skill set", "skills and interests", "skill set", "core competencies", "competencies", "technologies", "technical proficiencies", "technical proficiency", "tools and technologies", "areas of expertise", "expertise", "technology stack", "tech stack"] },
  { key: "certifications", patterns: ["certifications", "certification", "certificates", "certificate", "licenses", "licenses and certifications", "courses", "coursework", "training and certifications"] },
  { key: "achievements", patterns: ["achievements", "achievement", "awards", "awards and achievements", "honors", "honours", "accomplishments", "accolades", "awards and recognitions", "honors and awards"] },
  { key: "publications", patterns: ["publications", "publication", "papers", "research", "research papers", "research experience", "patents", "presentations"] },
  { key: "leadership", patterns: ["leadership", "leadership experience", "positions of responsibility", "position of responsibility", "responsibilities", "volunteer experience", "volunteering", "community involvement"] },
  { key: "extracurriculars", patterns: ["extracurricular", "extracurriculars", "extracurricular activities", "extra curricular activities", "activities", "co-curricular activities", "cocurricular activities", "hobbies", "interests", "hobbies and interests", "sports"] },
  { key: "links", patterns: ["links", "profiles", "online profiles", "online presence", "portfolios", "portfolio", "coding profiles", "social links"] },
];

const CANONICAL_HEADINGS = new Map<string, ResumeSectionKey>();
for (const entry of HEADING_LEXICON) {
  for (const pattern of entry.patterns) {
    CANONICAL_HEADINGS.set(pattern, entry.key);
  }
}

function normalizeHeadingText(line: string): string {
  return line
    .trim()
    .replace(/^[\d]+[.)\s-]+/, "")
    .replace(/^[\-–—_=*•·\s]+/, "")
    .replace(/[\-–—_=*•·:\s]+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Recognised heading key for a line, or null when it is not a known heading. */
export function classifyHeading(line: string): ResumeSectionKey | null {
  const normalized = normalizeHeadingText(line);
  if (!normalized) return null;
  const exact = CANONICAL_HEADINGS.get(normalized);
  if (exact) return exact;
  // Compound headings, e.g. "Technical Skills & Tools".
  for (const [pattern, key] of CANONICAL_HEADINGS) {
    if (normalized === pattern) return key;
    if (normalized.startsWith(`${pattern} `) || normalized.endsWith(` ${pattern}`)) return key;
  }
  return null;
}

export function isBulletLine(line: string): boolean {
  return /^\s*(?:[-–—•▪◦●○*·‣∙►]|\d{1,2}[.)]|[a-zA-Z][.)])\s+\S/.test(line);
}

export function stripBulletMarker(line: string): string {
  return line.replace(/^\s*(?:[-–—•▪◦●○*·‣∙►]|\d{1,2}[.)]|[a-zA-Z][.)])\s+/, "").trim();
}

function letterStats(line: string): { letters: string; upperRatio: number; wordCount: number } {
  const letters = line.replace(/[^A-Za-z]/g, "");
  const upper = line.replace(/[^A-Z]/g, "");
  return {
    letters,
    upperRatio: letters.length > 0 ? upper.length / letters.length : 0,
    wordCount: line.trim().split(/\s+/).filter(Boolean).length,
  };
}

export interface HeadingDetection {
  isHeading: boolean;
  key: ResumeSectionKey | null;
  recognized: boolean;
}

/**
 * Decide whether a line is a section heading. Unknown headings are still
 * treated as headings (so the structure is preserved) but are marked
 * unrecognized, which the ATS engine reports as a readability signal.
 */
export function detectHeading(
  line: string,
  context: { previousLineBlankOrBullet: boolean; isFirstLine: boolean }
): HeadingDetection {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 64) return { isHeading: false, key: null, recognized: false };
  if (isBulletLine(trimmed)) return { isHeading: false, key: null, recognized: false };
  if (hasDateRange(trimmed)) return { isHeading: false, key: null, recognized: false };

  const { letters, upperRatio, wordCount } = letterStats(trimmed);
  if (letters.length < 3 || wordCount > 6) return { isHeading: false, key: null, recognized: false };

  const lexiconKey = classifyHeading(trimmed);
  const endsWithColon = /:$/.test(trimmed);
  const isAllCaps = upperRatio >= 0.85 && letters.length >= 4;

  if (lexiconKey) {
    // A recognized heading is accepted when it is short and heading-shaped.
    const headingShaped = isAllCaps || endsWithColon || upperRatio > 0.4 || wordCount <= 4;
    if (headingShaped) return { isHeading: true, key: lexiconKey, recognized: true };
    return { isHeading: false, key: null, recognized: false };
  }

  // Unknown ALL-CAPS headings split sections, but only when they clearly begin
  // a block (preceded by a blank or bulleted line) and are not the document's
  // first line — the first line of a resume is nearly always the candidate's
  // name, which belongs in the header block.
  if (isAllCaps && wordCount <= 4 && !context.isFirstLine && context.previousLineBlankOrBullet) {
    return { isHeading: true, key: "other", recognized: false };
  }

  return { isHeading: false, key: null, recognized: false };
}

// ============================================================================
// Dates
// ============================================================================

const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10",
  october: "10", nov: "11", november: "11", dec: "12", december: "12",
};

const MONTH_PATTERN = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const DATE_TOKEN = new RegExp(
  `(?:${MONTH_PATTERN})[a-z]*\\.?\\s*'?\\d{2,4}` + // Jun 2024 / Jun '24
    `|\\d{1,2}[/-]\\d{4}` + // 06/2024
    `|\\d{4}` + // 2024
    `|present|current|now|ongoing|till date|to date|today`,
  "gi"
);

const RANGE_SEPARATOR = /\s*(?:[-–—]{1,2}|to|until|till)\s*/i;

/** True when the text contains a recognisable date or date range. */
export function hasDateRange(text: string): boolean {
  DATE_TOKEN.lastIndex = 0;
  const matches = text.match(new RegExp(DATE_TOKEN.source, "gi"));
  if (!matches || matches.length === 0) return false;
  // A single 4-digit year is only a date when it looks like a year.
  return matches.some((m) => /\d{4}/.test(m) || /^\d{1,2}[/-]\d{4}$/.test(m) || /present|current|ongoing|now/i.test(m));
}

function toIsoPart(token: string): string | null {
  const trimmed = token.trim().toLowerCase();
  if (!trimmed) return null;
  if (/present|current|ongoing|now|till date|to date|today/.test(trimmed)) return null;

  const monthYear = trimmed.match(new RegExp(`^(${MONTH_PATTERN})[a-z]*\\.?\\s*'?(\\d{2,4})$`, "i"));
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()] ?? null;
    const year = monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2];
    return month ? `${year}-${month}` : year;
  }

  const numeric = trimmed.match(/^(\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const month = numeric[1].padStart(2, "0");
    return `${numeric[2]}-${month}`;
  }

  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) return yearOnly[1];

  return null;
}

/**
 * Extract a date range from a line. Only literal date tokens are used; nothing
 * is inferred from context, and the verbatim text is always kept in `raw`.
 */
export function extractDateRange(text: string): ResumeDateRange {
  const tokens = text.match(new RegExp(DATE_TOKEN.source, "gi"));
  if (!tokens || tokens.length === 0) {
    return { raw: null, start: null, end: null, isCurrent: false };
  }

  const separatorMatch = text.match(RANGE_SEPARATOR);
  const isCurrent = tokens.some((token) => /present|current|ongoing|now|till date|to date|today/i.test(token));
  const meaningful = tokens.filter((token) => /\d/.test(token) || /present|current|ongoing|now/i.test(token));

  if (meaningful.length === 1) {
    const raw = meaningful[0];
    const iso = toIsoPart(raw);
    return {
      raw: separatorMatch ? raw : raw,
      start: iso,
      end: isCurrent ? null : iso,
      isCurrent,
    };
  }

  const start = toIsoPart(meaningful[0]);
  const last = meaningful[meaningful.length - 1];
  const end = isCurrent ? null : toIsoPart(last);
  return {
    raw: `${meaningful[0]}${separatorMatch ? separatorMatch[0] : " - "}${last}`.trim(),
    start,
    end,
    isCurrent,
  };
}

// ============================================================================
// Header block
// ============================================================================

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const URL_PATTERN = /(?:https?:\/\/[^\s|,;)]+|www\.[^\s|,;)]+|(?:linkedin|github|gitlab|behance|dribbble|medium|leetcode|hackerrank|codechef|codeforces|kaggle)\.com\/[^\s|,;)]+)/i;

export function extractLinks(text: string): string[] {
  const links = new Set<string>();
  const urlMatches = text.match(/https?:\/\/[^\s|,;)]+|www\.[^\s|,;)]+/gi) ?? [];
  for (const url of urlMatches) links.add(url.replace(/[.)]+$/, ""));
  if (!links.size) {
    const profileMatches = text.match(/(?:linkedin|github|gitlab|behance|dribbble|medium|leetcode|hackerrank|codechef|codeforces|kaggle)\.com\/[^\s|,;)]+/gi) ?? [];
    for (const url of profileMatches) links.add(url);
  }
  return Array.from(links);
}

function extractPhone(text: string): string | null {
  const candidates = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(\d{1,4}\)[\s-]?)?[\d][\d\s().-]{7,17}\d/g);
  if (!candidates) return null;
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return candidate.trim();
  }
  return null;
}

function parseHeaderBlock(lines: string[]): { header: ResumeHeader; unclassified: string[] } {
  const block = lines.join("\n");
  const email = block.match(EMAIL_PATTERN)?.[0] ?? null;
  const phone = extractPhone(block);
  const links = extractLinks(block);

  let name: string | null = null;
  let location: string | null = null;
  const unclassified: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Derive what remains once contact identifiers are removed, so a combined
    // line such as "email | phone | City, Country" still yields the location.
    let remainder = trimmed;
    if (email) remainder = remainder.replace(email, " ");
    if (phone) remainder = remainder.replace(phone.replace(/\s+/g, " "), " ");
    for (const link of links) remainder = remainder.replace(link, " ");
    // Separators are collapsed but commas are kept so "City, Country" stays readable.
    remainder = remainder.replace(/[|·•]+/g, " ").replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").trim();

    if (!location && /^[A-Za-z][A-Za-z .'-]*,\s*[A-Za-z][A-Za-z .'-]*$/.test(remainder) && remainder.split(/\s+/).length <= 6) {
      location = remainder;
      continue;
    }

    if (email && trimmed.includes(email) && !remainder) continue;
    if (phone && trimmed.replace(/\s+/g, " ").includes(phone.replace(/\s+/g, " ")) && !remainder) continue;
    if (URL_PATTERN.test(trimmed) && links.some((link) => trimmed.includes(link)) && !remainder) continue;

    if (!name) {
      const words = trimmed.split(/\s+/).filter(Boolean);
      const lettersOnly = /^[A-Za-z][A-Za-z.'\-\s]+$/.test(trimmed);
      if (lettersOnly && words.length >= 1 && words.length <= 5) {
        name = trimmed;
        continue;
      }
    }

    if (!location && /^[A-Za-z][A-Za-z .'-]*,\s*[A-Za-z][A-Za-z .'-]*$/.test(trimmed) && trimmed.split(/\s+/).length <= 6) {
      location = trimmed;
      continue;
    }

    unclassified.push(line);
  }

  return {
    header: { name, email, phone, location, links, rawLines: lines },
    unclassified,
  };
}

// ============================================================================
// Entries
// ============================================================================

function hashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return `e${(hash >>> 0).toString(36)}`;
}

const ROLE_NOUNS = /(intern|engineer|developer|analyst|scientist|consultant|designer|architect|manager|associate|specialist|administrator|programmer|researcher|lead|officer|assistant|trainee)/i;

function splitHeadingSegments(heading: string): string[] {
  const separators = [/\s*\|\s*/, /\s+[—–]\s+/, /\s+-\s+/, /\s+at\s+/i, /\s*·\s*/];
  for (const separator of separators) {
    if (separator.test(heading)) {
      return heading.split(separator).map((part) => part.trim()).filter(Boolean);
    }
  }
  return [heading.trim()];
}

function buildEntry(entryLines: string[], sectionKey: ResumeSectionKey, index: number): ResumeEntry {
  const heading = entryLines[0] ?? "";
  const rest = entryLines.slice(1);
  const bullets: string[] = [];
  const metaLines: string[] = [];

  for (const line of rest) {
    if (isBulletLine(line)) {
      bullets.push(stripBulletMarker(line));
    } else if (bullets.length > 0 && line.trim().length > 0) {
      // Unmarked continuation of the previous bullet (common in PDF text runs).
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line.trim()}`;
    } else if (line.trim().length > 0) {
      metaLines.push(line.trim());
    }
  }

  // Segments that look like a modality/arrangement rather than an employer.
  const NON_ORGANIZATION_SEGMENT = /^(remote|hybrid|on-?site|full[- ]time|part[- ]time|internship|contract|freelance|temporary)$/i;

  const segments = splitHeadingSegments(heading);
  const contentSegments = segments.filter((segment) => !hasDateRange(segment));

  let title: string | null = null;
  let organization: string | null = null;

  if (contentSegments.length > 0) {
    const roleIndex = contentSegments.findIndex((segment) => ROLE_NOUNS.test(segment));
    title = roleIndex >= 0 ? contentSegments[roleIndex] : contentSegments[0];
    const remaining = contentSegments.filter((segment) => segment !== title);
    organization = remaining[0] ?? null;
  }

  // "Role — Employer" in a single segment (very common) is split without
  // inventing anything: the heading itself is retained verbatim in `rawLines`.
  if (!organization && title) {
    const parts = title
      .split(/\s+[—–]\s+|\s+at\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 2 && !NON_ORGANIZATION_SEGMENT.test(parts[1]) && !hasDateRange(parts[1])) {
      title = parts[0];
      organization = parts[1];
    }
  }

  if (!organization && metaLines.length > 0) {
    const orgCandidate = metaLines.find((line) => !hasDateRange(line) && !URL_PATTERN.test(line));
    if (orgCandidate) organization = orgCandidate;
  }

  if (!title && metaLines.length > 0) {
    title = metaLines[0];
  }

  const dates = extractDateRange(heading) ?? { raw: null, start: null, end: null, isCurrent: false };
  const dateSource = dates.raw ? dates : (metaLines.map(extractDateRange).find((range) => range.raw) ?? dates);

  let confidence: ResumeEntry["confidence"] = "low";
  if (title && dateSource.raw) confidence = "high";
  else if (title || dateSource.raw) confidence = "medium";

  return {
    id: hashId(`${sectionKey}:${index}:${heading}`),
    heading,
    title,
    organization,
    dates: dateSource,
    bullets,
    rawLines: entryLines,
    confidence,
  };
}

export function buildEntries(sectionKey: ResumeSectionKey, lines: string[]): ResumeEntry[] {
  const entries: ResumeEntry[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const hasContent = current.some((line) => line.trim().length > 0);
    if (hasContent) entries.push(buildEntry(current, sectionKey, entries.length));
    current = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      // Blank lines separate entries inside list sections.
      if (current.length > 0) flush();
      continue;
    }

    if (current.length === 0) {
      current = [line];
      continue;
    }

    const currentHasBullets = current.some(isBulletLine);
    const lineHasDate = hasDateRange(line);
    const currentHeadingHasDate = hasDateRange(current[0]);
    const words = line.trim().split(/\s+/).length;

    const startsNewEntry =
      isBulletLine(line)
        ? false
        : currentHasBullets
          ? lineHasDate || words <= 12
          : lineHasDate && currentHeadingHasDate;

    if (startsNewEntry) {
      flush();
      current = [line];
    } else {
      current.push(line);
    }
  }

  flush();
  return entries;
}

// ============================================================================
// Skills section
// ============================================================================

export function parseSkillsSection(lines: string[]): { groups: ResumeSkillGroup[]; rawLines: string[] } {
  const groups: ResumeSkillGroup[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const content = stripBulletMarker(line);
    const labelled = content.match(/^([A-Za-z][A-Za-z /&+#.-]{1,34}):\s*(.+)$/);
    if (labelled) {
      groups.push({
        label: labelled[1].trim(),
        skills: splitSkillTokens(labelled[2]),
        rawLine,
      });
    } else {
      groups.push({ label: null, skills: splitSkillTokens(content), rawLine });
    }
  }
  return { groups, rawLines: lines };
}

export function splitSkillTokens(value: string): string[] {
  return value
    .split(/[,;|•·/]|\s{3,}|\s+[–—]\s+/)
    .map((token) => token.trim().replace(/^[-–—•·\s]+/, "").trim())
    .filter((token) => token.length > 0 && token.length < 60)
    .map((token) => token.replace(/[.]+$/, ""))
    .filter((token) => !/^(and|etc|others|other|various)$/i.test(token));
}

// ============================================================================
// Main parser
// ============================================================================

export interface StructuredParseResult {
  resume: StructuredResume;
  warnings: string[];
}

export function parseStructuredResume(rawText: string, now: string = new Date().toISOString()): StructuredParseResult {
  const warnings: string[] = [];
  const allLines = rawText.replace(/\r\n?/g, "\n").split("\n");

  const headerLines: string[] = [];
  const sections: ResumeSection[] = [];
  let currentSection: { key: ResumeSectionKey; recognized: boolean; originalHeading: string; lines: string[] } | null = null;
  let order = 0;

  for (let index = 0; index < allLines.length; index++) {
    const line = allLines[index];
    const trimmed = line.trim();
    const previousLine = index > 0 ? allLines[index - 1] : "";
    const context = {
      previousLineBlankOrBullet: previousLine.trim().length === 0 || isBulletLine(previousLine),
      isFirstLine: index === 0,
    };

    const heading = detectHeading(line, context);
    if (heading.isHeading && heading.key) {
      if (currentSection) {
        sections.push({
          key: currentSection.key,
          originalHeading: currentSection.originalHeading,
          order: order++,
          entries: [],
          items: [],
          rawLines: currentSection.lines,
          recognized: currentSection.recognized,
        });
      }
      currentSection = { key: heading.key, recognized: heading.recognized, originalHeading: trimmed, lines: [] };
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      key: currentSection.key,
      originalHeading: currentSection.originalHeading,
      order: order++,
      entries: [],
      items: [],
      rawLines: currentSection.lines,
      recognized: currentSection.recognized,
    });
  }

  const { header, unclassified } = parseHeaderBlock(headerLines);

  // Materialise section bodies.
  let summary: string | null = null;
  const links = new Set<string>(header.links);
  let skillsGroups: ResumeSkillGroup[] = [];
  let skillsRawLines: string[] = [];

  const materialisedSections: ResumeSection[] = sections.map((section) => {
    const contentLines = section.rawLines.filter((line) => line.trim().length > 0);
    switch (section.key) {
      case "summary": {
        const text = contentLines.map((line) => stripBulletMarker(line)).join(" ").trim();
        if (!summary && text) summary = text;
        return { ...section, items: contentLines.map((line) => stripBulletMarker(line)) };
      }
      case "skills": {
        const parsed = parseSkillsSection(contentLines);
        skillsGroups = skillsGroups.concat(parsed.groups);
        skillsRawLines = skillsRawLines.concat(contentLines);
        return { ...section, items: parsed.groups.flatMap((group) => group.skills) };
      }
      case "experience":
      case "internships":
      case "projects":
      case "education":
      case "leadership":
      case "other": {
        const isEntrySection =
          section.key === "experience" ||
          section.key === "internships" ||
          section.key === "projects" ||
          section.key === "education" ||
          section.key === "leadership";
        if (!isEntrySection) {
          return {
            ...section,
            items: contentLines.map((line) => stripBulletMarker(line)),
          };
        }
        const entries = buildEntries(section.key, contentLines);
        return { ...section, entries };
      }
      case "certifications":
      case "achievements":
      case "publications":
      case "extracurriculars":
      default: {
        const items = contentLines.map((line) => stripBulletMarker(line));
        for (const item of items) {
          for (const link of extractLinks(item)) links.add(link);
        }
        return { ...section, items };
      }
    }
  });

  const linksSection = materialisedSections.find((section) => section.key === "links");
  if (linksSection) {
    for (const item of linksSection.items) {
      for (const link of extractLinks(item)) links.add(link);
    }
    for (const line of linksSection.rawLines) {
      for (const link of extractLinks(line)) links.add(link);
    }
  }

  const entryCount = materialisedSections.reduce((total, section) => total + section.entries.length, 0);
  const bulletCount = materialisedSections.reduce(
    (total, section) => total + section.entries.reduce((sum, entry) => sum + entry.bullets.length, 0),
    0
  );
  const wordCount = (rawText.match(/[A-Za-z0-9][A-Za-z0-9'’+#./-]*/g) ?? []).length;

  if (sections.length === 0) {
    warnings.push(
      "No standard resume sections were detected. Section headings (for example EXPERIENCE, EDUCATION, SKILLS) help ATS parsers place your content correctly."
    );
  }
  const unrecognizedHeadings = materialisedSections.filter((section) => !section.recognized);
  if (unrecognizedHeadings.length > 0) {
    warnings.push(
      `These headings are not standard ATS section names: ${unrecognizedHeadings
        .map((section) => `"${section.originalHeading}"`)
        .join(", ")}. Their content was preserved under "Additional Information".`
    );
  }

  const resume: StructuredResume = {
    schemaVersion: 1,
    generatedAt: now,
    header,
    summary,
    skills: {
      groups: skillsGroups,
      detected: detectCanonicalSkills(rawText),
      rawLines: skillsRawLines,
    },
    sections: materialisedSections,
    links: Array.from(links),
    studentAssertedFacts: [],
    unclassified,
    stats: {
      lineCount: allLines.filter((line) => line.trim().length > 0).length,
      wordCount,
      bulletCount,
      entryCount,
      sectionKeys: materialisedSections.map((section) => section.key),
    },
  };

  return { resume, warnings };
}

// ============================================================================
// Helpers used by the builder and suggestion engine
// ============================================================================

export function getSection(resume: StructuredResume, key: ResumeSectionKey): ResumeSection | null {
  return resume.sections.find((section) => section.key === key) ?? null;
}

export function getAllBullets(resume: StructuredResume): { sectionKey: ResumeSectionKey; entryId: string; index: number; text: string }[] {
  const bullets: { sectionKey: ResumeSectionKey; entryId: string; index: number; text: string }[] = [];
  for (const section of resume.sections) {
    for (const entry of section.entries) {
      entry.bullets.forEach((text, index) => {
        bullets.push({ sectionKey: section.key, entryId: entry.id, index, text });
      });
    }
  }
  return bullets;
}

/**
 * Flatten the *current* structured state back to plain text for keyword and
 * evidence scans. This intentionally reads the editable fields (not rawLines)
 * so that an accepted suggestion immediately affects the next analysis run.
 * `rawLines` stays untouched as the verbatim record of the uploaded document.
 */
export function flattenResumeText(resume: StructuredResume): string {
  const parts: string[] = [];
  const header = resume.header;
  parts.push([header.name, header.email, header.phone, header.location, ...header.links].filter(Boolean).join("\n"));
  if (resume.summary) parts.push(resume.summary);

  for (const section of resume.sections) {
    if (section.originalHeading) parts.push(section.originalHeading);
    for (const entry of section.entries) {
      if (entry.heading) parts.push(entry.heading);
      parts.push(...entry.bullets);
    }
    if (section.key !== "skills") {
      parts.push(...section.items);
    }
  }

  for (const group of resume.skills.groups) {
    parts.push(group.label ? `${group.label}: ${group.skills.join(", ")}` : group.skills.join(", "));
  }
  parts.push(...resume.links);

  return parts.filter((part) => part && part.trim().length > 0).join("\n");
}
