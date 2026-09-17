/**
 * Phase 18 — ATS-safe resume rendering.
 *
 * Produces a single-column document from the structured model using only
 * parser-friendly constructs: a plain text layer, standard section headings,
 * simple bullet lists, and no tables, graphics, icons, text boxes, backgrounds,
 * or multi-column layouts.
 *
 * Both renderers are pure functions over the structured model, so the preview
 * shown in the builder and the exported document are byte-identical.
 */

import type { ResumeSectionKey, StructuredResume } from "./types";
import { RESUME_SECTION_LABELS } from "./types";

const RENDER_ORDER: ResumeSectionKey[] = [
  "summary",
  "education",
  "experience",
  "internships",
  "projects",
  "skills",
  "certifications",
  "achievements",
  "leadership",
  "publications",
  "extracurriculars",
  "links",
  "other",
];

export interface AtsRenderOptions {
  /** Optional line stating the resume's target, e.g. "Target: Microsoft — Software Engineer". */
  targetLine?: string | null;
}

function orderedSections(resume: StructuredResume) {
  const sections = [...resume.sections];
  return sections
    .filter((section) => section.key !== "summary")
    .sort((a, b) => {
      const indexA = RENDER_ORDER.indexOf(a.key);
      const indexB = RENDER_ORDER.indexOf(b.key);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB) || a.order - b.order;
    });
}

function skillLines(resume: StructuredResume): string[] {
  const groups = resume.skills.groups.filter((group) => group.skills.length > 0);
  if (groups.length === 0) return [];
  return groups.map((group) => (group.label ? `${group.label}: ${group.skills.join(", ")}` : group.skills.join(", ")));
}

function sectionBodies(resume: StructuredResume, sectionKey: ResumeSectionKey): string[] {
  if (sectionKey === "skills") return skillLines(resume);
  const section = resume.sections.find((candidate) => candidate.key === sectionKey);
  if (!section) return [];
  const lines: string[] = [];
  for (const entry of section.entries) {
    if (entry.heading) lines.push(`### ${entry.heading}`);
    for (const bullet of entry.bullets) lines.push(`- ${bullet}`);
  }
  for (const item of section.items) lines.push(`- ${item}`);
  return lines;
}

/** ATS-safe plain text rendering (the safest supported export format). */
export function renderAtsPlainText(resume: StructuredResume, options: AtsRenderOptions = {}): string {
  const lines: string[] = [];
  const header = resume.header;

  if (header.name) lines.push(header.name.toUpperCase());
  const contact = [header.email, header.phone, header.location]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" | ");
  if (contact) lines.push(contact);
  if (header.links.length > 0) lines.push(header.links.join(" | "));
  if (options.targetLine) lines.push(options.targetLine);

  if (resume.summary) {
    lines.push("", RESUME_SECTION_LABELS.summary.toUpperCase(), resume.summary);
  }

  for (const section of orderedSections(resume)) {
    const bodies = sectionBodies(resume, section.key);
    if (bodies.length === 0) continue;
    const label = section.originalHeading ? section.originalHeading.toUpperCase() : RESUME_SECTION_LABELS[section.key].toUpperCase();
    lines.push("", label);
    for (const body of bodies) {
      lines.push(body.startsWith("### ") ? body.replace("### ", "") : body);
    }
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * ATS-safe HTML rendering: semantic headings and lists, one column, no images,
 * no tables, system fonts. Designed to be printed to PDF by the browser, and
 * to be safe to embed in a sandboxed iframe preview.
 */
export function renderAtsHtml(resume: StructuredResume, options: AtsRenderOptions = {}): string {
  const header = resume.header;
  const contact = [header.email, header.phone, header.location].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(header.name ?? "Your Name")}</h1>`);
  if (contact.length > 0) {
    parts.push(`<p class="contact">${contact.map((value) => escapeHtml(value)).join(" &middot; ")}</p>`);
  }
  if (header.links.length > 0) {
    parts.push(`<p class="contact">${header.links.map((link) => escapeHtml(link)).join(" &middot; ")}</p>`);
  }
  if (options.targetLine) {
    parts.push(`<p class="target">${escapeHtml(options.targetLine)}</p>`);
  }

  if (resume.summary) {
    parts.push(`<h2>${escapeHtml(RESUME_SECTION_LABELS.summary)}</h2>`);
    parts.push(`<p>${escapeHtml(resume.summary)}</p>`);
  }

  for (const section of orderedSections(resume)) {
    const bodies = sectionBodies(resume, section.key);
    if (bodies.length === 0) continue;
    const label = section.originalHeading ?? RESUME_SECTION_LABELS[section.key];
    parts.push(`<h2>${escapeHtml(label)}</h2>`);
    let listOpen = false;
    const closeList = () => {
      if (listOpen) {
        parts.push("</ul>");
        listOpen = false;
      }
    };
    for (const body of bodies) {
      if (body.startsWith("### ")) {
        closeList();
        parts.push(`<h3>${escapeHtml(body.replace("### ", ""))}</h3>`);
      } else if (body.startsWith("- ")) {
        if (!listOpen) {
          parts.push("<ul>");
          listOpen = true;
        }
        parts.push(`<li>${escapeHtml(body.replace("- ", ""))}</li>`);
      } else {
        closeList();
        parts.push(`<p>${escapeHtml(body)}</p>`);
      }
    }
    closeList();
  }

  const style = `
    :root { color-scheme: light; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; margin: 0; padding: 24px; }
    h1 { font-size: 18pt; margin: 0 0 4px; letter-spacing: 0.4px; }
    h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 0.8px; margin: 18px 0 6px; border-bottom: 1px solid #999; padding-bottom: 2px; }
    h3 { font-size: 11pt; margin: 10px 0 4px; }
    p { margin: 0 0 6px; }
    ul { margin: 0 0 6px; padding-left: 18px; }
    li { margin: 0 0 3px; }
    .contact, .target { font-size: 10pt; margin: 0 0 3px; }
    @media print { body { padding: 0; } }
  `;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(
    header.name ?? "Resume"
  )}</title><style>${style}</style></head><body>${parts.join("")}</body></html>`;
}

/** Human-readable section list used by the builder navigation. */
export function renderableSectionKeys(resume: StructuredResume): ResumeSectionKey[] {
  return orderedSections(resume)
    .filter((section) => sectionBodies(resume, section.key).length > 0)
    .map((section) => section.key);
}
