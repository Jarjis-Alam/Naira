"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeVersionSummary } from "@/server/resume-intelligence";

interface Comparison {
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

function deltaTone(value: number | null): string {
  if (value === null) return "text-text-muted";
  if (value > 0) return "text-secondary";
  if (value < 0) return "text-error";
  return "text-text-muted";
}

export function VersionHistory({
  variantId,
  versions,
}: {
  variantId: string;
  versions: ResumeVersionSummary[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromId, setFromId] = useState(versions[1]?.id ?? "");
  const [toId, setToId] = useState(versions[0]?.id ?? "");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [label, setLabel] = useState("");

  async function handleSaveVersion() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/resume/variants/${variantId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(label.trim() ? { label: label.trim() } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "The version could not be saved.");
      setLabel("");
      setComparison(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The version could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompare() {
    if (!fromId || !toId || fromId === toId) {
      setError("Select two different versions to compare.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/student/resume/variants/${variantId}/versions/compare?from=${fromId}&to=${toId}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "The versions could not be compared.");
      setComparison(data as Comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The versions could not be compared.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div>
        <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Version history</span>
        <h2 className="text-title-md font-bold text-text-primary mt-1">Tracked resume versions</h2>
        <p className="text-[12px] font-mono text-text-secondary mt-1">
          A version is snapshotted whenever you save manually or accept a suggestion, together with its scores.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-body-sm text-error">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Optional version label"
          className="flex-1 min-w-[200px] rounded-lg bg-surface-high border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSaveVersion}
          disabled={busy}
          className="bg-primary text-text-inverse font-semibold text-[12px] px-4 py-2 rounded-lg hover:bg-primary-text transition-all disabled:opacity-50"
        >
          {busy ? "Working…" : "Save current version"}
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="text-body-sm font-mono text-text-muted">
          No versions yet. Save one before a big edit so you can compare the results.
        </p>
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className="rounded-xl border border-border/60 bg-surface-high/40 p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <span className="text-body-sm font-semibold text-text-primary">{version.label}</span>
                <div className="text-[11px] font-mono text-text-muted mt-0.5">
                  ATS {version.atsScore ?? "--"} · Match{" "}
                  {version.matchScore === null ? "--" : `${version.matchScore}%`} ·{" "}
                  {new Date(version.createdAt).toLocaleDateString()}
                </div>
              </div>
              {typeof version.changeSummary?.type === "string" && (
                <span className="text-[10px] font-mono uppercase text-text-muted">
                  {String(version.changeSummary.type).replace(/_/g, " ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {versions.length >= 2 && (
        <div className="pt-3 border-t border-border/60 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="compare-from" className="text-[10px] font-mono uppercase text-text-muted block mb-1">
                Compare from
              </label>
              <select
                id="compare-from"
                value={fromId}
                onChange={(event) => setFromId(event.target.value)}
                className="rounded-lg bg-surface-high border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="compare-to" className="text-[10px] font-mono uppercase text-text-muted block mb-1">
                Compare to
              </label>
              <select
                id="compare-to"
                value={toId}
                onChange={(event) => setToId(event.target.value)}
                className="rounded-lg bg-surface-high border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleCompare}
              disabled={busy}
              className="text-[12px] font-mono px-4 py-2 rounded-lg border border-border bg-surface-high text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              Compare
            </button>
          </div>

          {comparison && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
              <p className="text-body-sm font-semibold text-text-primary">{comparison.summary}</p>

              <div className="flex flex-wrap gap-4 text-[12px] font-mono">
                <span>
                  ATS: <span className={deltaTone(comparison.deltas.atsScore)}>
                    {comparison.from.atsScore ?? "--"} → {comparison.to.atsScore ?? "--"}
                    {comparison.deltas.atsScore !== null && ` (${comparison.deltas.atsScore >= 0 ? "+" : ""}${comparison.deltas.atsScore})`}
                  </span>
                </span>
                <span>
                  Match: <span className={deltaTone(comparison.deltas.matchScore)}>
                    {comparison.from.matchScore ?? "--"} → {comparison.to.matchScore ?? "--"}
                    {comparison.deltas.matchScore !== null && ` (${comparison.deltas.matchScore >= 0 ? "+" : ""}${comparison.deltas.matchScore})`}
                  </span>
                </span>
              </div>

              {comparison.changedBullets.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                    Rewritten bullets ({comparison.changedBullets.length})
                  </span>
                  {comparison.changedBullets.map((change, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <p className="rounded-lg border border-border/60 bg-base/60 p-2 text-[11px] font-mono text-text-muted">
                        {change.before}
                      </p>
                      <p className="rounded-lg border border-secondary/25 bg-secondary/5 p-2 text-[11px] font-mono text-text-secondary">
                        {change.after}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {(comparison.addedSkills.length > 0 || comparison.removedSkills.length > 0) && (
                <div className="flex flex-wrap gap-4 text-[11px] font-mono">
                  {comparison.addedSkills.length > 0 && (
                    <span className="text-secondary">+ {comparison.addedSkills.join(", ")}</span>
                  )}
                  {comparison.removedSkills.length > 0 && (
                    <span className="text-error">− {comparison.removedSkills.join(", ")}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
