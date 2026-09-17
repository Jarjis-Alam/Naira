"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoredJobDescription } from "@/lib/resume/types";

export function JobDescriptionPanel({
  variantId,
  jobDescription,
}: {
  variantId: string;
  jobDescription: StoredJobDescription | null;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState(jobDescription?.raw ?? "");
  const [roleTitle, setRoleTitle] = useState(jobDescription?.providedRoleTitle ?? "");
  const [companyName, setCompanyName] = useState(jobDescription?.providedCompanyName ?? "");
  const [editing, setEditing] = useState(!jobDescription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraction = jobDescription?.extraction ?? null;

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/resume/variants/${variantId}/job-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw,
          source: "paste",
          providedRoleTitle: roleTitle.trim() || null,
          providedCompanyName: companyName.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "The job description could not be analysed.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("The job description could not be analysed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/resume/variants/${variantId}/job-description`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "The job description could not be removed.");
        return;
      }
      setRaw("");
      setRoleTitle("");
      setCompanyName("");
      setEditing(true);
      router.refresh();
    } catch {
      setError("The job description could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Job description
          </span>
          <h2 className="text-title-md font-bold text-text-primary mt-1">Target role requirements</h2>
          <p className="text-[12px] font-mono text-text-secondary mt-1">
            Paste the posting you are targeting. Placement OS extracts what the employer actually wrote — it never
            invents requirements.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-mono uppercase text-primary-text hover:underline whitespace-nowrap"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-body-sm text-error">
          {error}
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={8}
            placeholder="Paste the full job description here (requirements, responsibilities, preferred skills)…"
            className="w-full rounded-xl bg-surface-high border border-border px-4 py-3 text-body-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-text-muted block mb-1" htmlFor="jd-role">
                Role title (optional)
              </label>
              <input
                id="jd-role"
                value={roleTitle}
                onChange={(event) => setRoleTitle(event.target.value)}
                className="w-full rounded-lg bg-surface-high border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-text-muted block mb-1" htmlFor="jd-company">
                Company (optional)
              </label>
              <input
                id="jd-company"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="w-full rounded-lg bg-surface-high border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || raw.trim().length < 20}
              className="bg-primary text-text-inverse font-semibold text-body-sm px-5 py-2.5 rounded-lg hover:bg-primary-text transition-all disabled:opacity-50"
            >
              {busy ? "Analysing…" : "Analyse job description"}
            </button>
            {jobDescription && (
              <button
                type="button"
                onClick={() => {
                  setRaw(jobDescription.raw);
                  setEditing(false);
                }}
                className="text-[12px] font-mono text-text-muted hover:text-text-primary underline"
              >
                Cancel
              </button>
            )}
            {jobDescription && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="text-[12px] font-mono text-error/80 hover:text-error underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        extraction && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-text-muted">
              {extraction.roleTitle && <span>ROLE {extraction.roleTitle}</span>}
              {extraction.company && <span>COMPANY {extraction.company}</span>}
              <span>ADDED {new Date(extraction.extractedAt).toLocaleDateString()}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-surface-high/50 p-4 space-y-2">
                <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                  Required ({extraction.requiredSkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extraction.requiredSkills.length === 0 && (
                    <span className="text-[12px] text-text-muted font-mono">None detected.</span>
                  )}
                  {extraction.requiredSkills.map((skill) => (
                    <span
                      key={skill.canonical}
                      className="text-[11px] font-mono px-2 py-0.5 rounded border border-primary/25 bg-primary/10 text-primary-text"
                      title={skill.evidence}
                    >
                      {skill.canonical}
                      {skill.domain ? ` · ${skill.domain}` : ""}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface-high/50 p-4 space-y-2">
                <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                  Preferred ({extraction.preferredSkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extraction.preferredSkills.length === 0 && (
                    <span className="text-[12px] text-text-muted font-mono">None detected.</span>
                  )}
                  {extraction.preferredSkills.map((skill) => (
                    <span
                      key={skill.canonical}
                      className="text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-surface text-text-secondary"
                      title={skill.evidence}
                    >
                      {skill.canonical}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {extraction.responsibilities.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                  Responsibilities ({extraction.responsibilities.length})
                </span>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {extraction.responsibilities.slice(0, 8).map((line, index) => (
                    <li key={index} className="text-[12px] font-mono text-text-secondary">
                      — {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {extraction.warnings.length > 0 && (
              <ul className="space-y-1">
                {extraction.warnings.map((warning, index) => (
                  <li key={index} className="text-[12px] font-mono text-tertiary flex gap-2">
                    <span aria-hidden>⚠</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}
    </section>
  );
}
