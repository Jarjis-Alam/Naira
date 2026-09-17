"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResumeVariantSummary } from "@/server/resume-intelligence";

export function VariantsPanel({
  variants,
  activeVariantId,
  defaultTargetLabel,
}: {
  variants: ResumeVariantSummary[];
  activeVariantId: string | null;
  defaultTargetLabel: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "The action could not be completed.");
    return data;
  }

  async function handleCreate() {
    setBusy("create");
    setError(null);
    try {
      const created = await call("/api/student/resume/variants", "POST", {});
      router.push(`/resume?variantId=${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The variant could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePrimary(variantId: string) {
    setBusy(variantId);
    setError(null);
    try {
      await call(`/api/student/resume/variants/${variantId}`, "PATCH", { isPrimary: true });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The primary variant could not be changed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(variantId: string, label: string) {
    if (!window.confirm(`Delete the resume variant "${label}"? Its versions and analyses are removed with it.`)) {
      return;
    }
    setBusy(variantId);
    setError(null);
    try {
      await call(`/api/student/resume/variants/${variantId}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The variant could not be deleted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">My resumes</span>
          <h2 className="text-title-md font-bold text-text-primary mt-1">Targeted variants</h2>
          <p className="text-[12px] font-mono text-text-secondary mt-1">
            Each variant keeps its own target and job description on top of the same student profile.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy === "create"}
          className="bg-primary text-text-inverse font-semibold text-[12px] px-4 py-2 rounded-lg hover:bg-primary-text transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {busy === "create" ? "Creating…" : "New variant"}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-body-sm text-error">
          {error}
        </div>
      )}

      {variants.length === 0 ? (
        <p className="text-body-sm font-mono text-text-muted">
          No variants yet. {defaultTargetLabel ? `New variants default to ${defaultTargetLabel}.` : ""}
        </p>
      ) : (
        <div className="space-y-2">
          {variants.map((variant) => {
            const isActive = variant.id === activeVariantId;
            const target = [variant.targetCompanyName, variant.targetRoleName].filter(Boolean).join(" — ");
            return (
              <div
                key={variant.id}
                className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3 ${
                  isActive ? "border-primary/40 bg-primary/5" : "border-border/60 bg-surface-high/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-body-sm font-semibold text-text-primary truncate">{variant.label}</span>
                    {variant.isPrimary && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-bold">
                        Primary
                      </span>
                    )}
                    {variant.status === "archived" && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface text-text-muted font-bold">
                        Archived
                      </span>
                    )}
                    {variant.hasJobDescription && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary-text font-bold">
                        JD attached
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-text-muted mt-1 truncate">
                    {target || "No target set"} · ATS {variant.atsScore ?? "--"} · Match{" "}
                    {variant.matchScore === null ? "--" : `${variant.matchScore}%`} ·{" "}
                    {new Date(variant.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/resume?variantId=${variant.id}`}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:text-text-primary transition-colors"
                  >
                    View
                  </Link>
                  <Link
                    href={`/resume/builder?variantId=${variant.id}`}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary-text hover:bg-primary/20 transition-colors"
                  >
                    Builder
                  </Link>
                  {!variant.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handlePrimary(variant.id)}
                      disabled={busy === variant.id}
                      className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(variant.id, variant.label)}
                    disabled={busy === variant.id}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-error/30 bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
