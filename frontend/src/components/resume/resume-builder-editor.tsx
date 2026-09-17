"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StructuredResume } from "@/lib/resume/types";
import { RESUME_SECTION_LABELS } from "@/lib/resume/types";

interface DraftEntry {
  id: string;
  heading: string;
  title: string | null;
  organization: string | null;
  dates: { raw: string | null; start: string | null; end: string | null; isCurrent: boolean };
  bullets: string[];
}

interface DraftSection {
  key: StructuredResume["sections"][number]["key"];
  originalHeading: string | null;
  order: number;
  recognized: boolean;
  entries: DraftEntry[];
  items: string[];
}

function toDraft(resume: StructuredResume): { summary: string; sections: DraftSection[]; skillGroups: { label: string | null; skills: string }[] } {
  return {
    summary: resume.summary ?? "",
    sections: resume.sections.map((section) => ({
      key: section.key,
      originalHeading: section.originalHeading,
      order: section.order,
      recognized: section.recognized,
      items: [...section.items],
      entries: section.entries.map((entry) => ({
        id: entry.id,
        heading: entry.heading,
        title: entry.title,
        organization: entry.organization,
        dates: entry.dates,
        bullets: [...entry.bullets],
      })),
    })),
    skillGroups: resume.skills.groups.map((group) => ({
      label: group.label,
      skills: group.skills.join(", "),
    })),
  };
}

export function ResumeBuilderEditor({
  variantId,
  structured,
  previewHtml,
  originalRawText,
}: {
  variantId: string;
  structured: StructuredResume;
  previewHtml: string;
  originalRawText: string | null;
}) {
  const router = useRouter();
  const initial = useMemo(() => toDraft(structured), [structured]);
  const [summary, setSummary] = useState(initial.summary);
  const [sections, setSections] = useState<DraftSection[]>(initial.sections);
  const [skillGroups, setSkillGroups] = useState(initial.skillGroups);
  const [busy, setBusy] = useState<"save" | "version" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const editableSections = sections.filter(
    (section) => section.key !== "summary" && section.key !== "links"
  );

  function updateBullet(sectionIndex: number, entryIndex: number, bulletIndex: number, value: string) {
    setSections((current) =>
      current.map((section, index) =>
        index !== sectionIndex
          ? section
          : {
              ...section,
              entries: section.entries.map((entry, entryIdx) =>
                entryIdx !== entryIndex
                  ? entry
                  : { ...entry, bullets: entry.bullets.map((bullet, idx) => (idx === bulletIndex ? value : bullet)) }
              ),
            }
      )
    );
  }

  function addBullet(sectionIndex: number, entryIndex: number) {
    setSections((current) =>
      current.map((section, index) =>
        index !== sectionIndex
          ? section
          : {
              ...section,
              entries: section.entries.map((entry, entryIdx) =>
                entryIdx !== entryIndex ? entry : { ...entry, bullets: [...entry.bullets, ""] }
              ),
            }
      )
    );
  }

  function removeBullet(sectionIndex: number, entryIndex: number, bulletIndex: number) {
    setSections((current) =>
      current.map((section, index) =>
        index !== sectionIndex
          ? section
          : {
              ...section,
              entries: section.entries.map((entry, entryIdx) =>
                entryIdx !== entryIndex
                  ? entry
                  : { ...entry, bullets: entry.bullets.filter((_, idx) => idx !== bulletIndex) }
              ),
            }
      )
    );
  }

  function updateHeading(sectionIndex: number, entryIndex: number, value: string) {
    setSections((current) =>
      current.map((section, index) =>
        index !== sectionIndex
          ? section
          : {
              ...section,
              entries: section.entries.map((entry, entryIdx) =>
                entryIdx !== entryIndex ? entry : { ...entry, heading: value }
              ),
            }
      )
    );
  }

  async function handleSave() {
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      const payload = {
        summary: summary.trim() ? summary.trim() : null,
        sections: sections.map((section, index) => ({
          key: section.key,
          originalHeading: section.originalHeading,
          order: section.order ?? index,
          recognized: section.recognized,
          items: section.items,
          entries: section.entries.map((entry) => ({
            id: entry.id,
            heading: entry.heading,
            title: entry.title,
            organization: entry.organization,
            dates: entry.dates,
            bullets: entry.bullets.map((bullet) => bullet.trim()).filter((bullet) => bullet.length > 0),
          })),
        })),
        skills: {
          groups: skillGroups.map((group, index) => ({
            label: group.label,
            skills: group.skills
              .split(",")
              .map((skill) => skill.trim())
              .filter((skill) => skill.length > 0),
            rawLine: structured.skills.groups[index]?.rawLine ?? group.skills,
          })),
        },
      };

      const res = await fetch(`/api/student/resume/variants/${variantId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Your changes could not be saved.");
      setMessage("Saved. The ATS analysis was re-run against your edits.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your changes could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveVersion() {
    setBusy("version");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/student/resume/variants/${variantId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "The version could not be saved.");
      setMessage(`Version ${data.versionNumber} saved with its current scores.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The version could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Summary</span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            placeholder="No summary yet. Write only what you can evidence."
            className="w-full rounded-xl bg-surface-high border border-border px-4 py-3 text-body-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-[11px] font-mono text-text-muted">
            Placement OS never writes claims here for you — suggestions you accept are verified against your own text
            first.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 space-y-2">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Skills</span>
          {skillGroups.length === 0 && (
            <p className="text-[12px] font-mono text-text-muted">No skills groups were detected in your resume.</p>
          )}
          {skillGroups.map((group, index) => (
            <div key={index} className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-muted block">
                {group.label ?? "Ungrouped skills"}
              </label>
              <input
                value={group.skills}
                onChange={(event) =>
                  setSkillGroups((current) =>
                    current.map((entry, idx) => (idx === index ? { ...entry, skills: event.target.value } : entry))
                  )
                }
                className="w-full rounded-lg bg-surface-high border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          ))}
          <p className="text-[11px] font-mono text-text-muted">
            Comma-separated. Remove anything you cannot back up — never add a skill you do not have.
          </p>
        </section>

        {editableSections.map((section) => {
          const sectionIndex = sections.findIndex((candidate) => candidate.key === section.key);
          return (
            <section key={section.key} className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-text-muted font-bold">
                  {RESUME_SECTION_LABELS[section.key]}
                  {!section.recognized && " · non-standard heading"}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  {section.entries.length} entr{section.entries.length === 1 ? "y" : "ies"}
                </span>
              </div>

              {section.entries.map((entry, entryIndex) => (
                <div key={entry.id} className="rounded-xl border border-border/60 bg-surface-high/40 p-3 space-y-2">
                  <input
                    value={entry.heading}
                    onChange={(event) => updateHeading(sectionIndex, entryIndex, event.target.value)}
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-body-sm font-semibold text-text-primary focus:border-primary focus:outline-none"
                  />
                  {entry.bullets.map((bullet, bulletIndex) => (
                    <div key={bulletIndex} className="flex items-start gap-2">
                      <textarea
                        value={bullet}
                        onChange={(event) => updateBullet(sectionIndex, entryIndex, bulletIndex, event.target.value)}
                        rows={2}
                        className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-[12px] text-text-secondary focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeBullet(sectionIndex, entryIndex, bulletIndex)}
                        aria-label="Remove bullet"
                        className="text-[11px] font-mono px-2 py-1.5 rounded-lg border border-error/30 bg-error/10 text-error hover:bg-error/20"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addBullet(sectionIndex, entryIndex)}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:text-text-primary"
                  >
                    + Add bullet
                  </button>
                </div>
              ))}
            </section>
          );
        })}

        {error && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-body-sm text-error">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-body-sm text-secondary">
            {message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null}
            className="bg-primary text-text-inverse font-semibold text-body-sm px-5 py-2.5 rounded-lg hover:bg-primary-text transition-all disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleSaveVersion}
            disabled={busy !== null}
            className="text-[12px] font-mono px-4 py-2.5 rounded-lg border border-border bg-surface-high text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {busy === "version" ? "Saving…" : "Save as version"}
          </button>
          <a
            href={`/api/student/resume/variants/${variantId}/export?format=txt`}
            className="text-[12px] font-mono px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary-text hover:bg-primary/20 transition-colors"
          >
            Download ATS text
          </a>
          <a
            href={`/api/student/resume/variants/${variantId}/export?format=html`}
            className="text-[12px] font-mono px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary-text hover:bg-primary/20 transition-colors"
          >
            Download printable HTML
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold">ATS-safe preview</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOriginal((value) => !value)}
              className="text-[10px] font-mono uppercase text-primary-text hover:underline"
            >
              {showOriginal ? "Show rendered" : "Show original text"}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white overflow-hidden">
          {showOriginal ? (
            <pre className="p-4 text-[11px] leading-relaxed text-[#111] whitespace-pre-wrap max-h-[80vh] overflow-y-auto font-mono">
              {originalRawText ?? "No original document text is stored for this variant."}
            </pre>
          ) : (
            <iframe
              title="ATS-safe resume preview"
              srcDoc={previewHtml}
              sandbox=""
              className="w-full h-[80vh] bg-white"
            />
          )}
        </div>
        <p className="text-[11px] font-mono text-text-muted">
          Single column, standard headings, no tables, graphics, icons, or text boxes. This layout is generated from
          your structured data — the preview and both exports are identical.
        </p>
      </div>
    </div>
  );
}
