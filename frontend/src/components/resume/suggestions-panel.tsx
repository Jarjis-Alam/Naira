"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeSuggestionRecord } from "@/server/resume-intelligence";

const SEVERITY_TONE: Record<string, string> = {
  critical: "border-error/30 bg-error/10 text-error",
  warning: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  info: "border-border bg-surface-high text-text-muted",
};

const CATEGORY_LABEL: Record<string, string> = {
  summary: "Summary",
  experience_bullet: "Experience bullet",
  project_bullet: "Project bullet",
  experience_entry: "Experience entry",
  project_entry: "Project entry",
  skills_section: "Skills section",
  keyword_evidence: "Evidence check",
  content_quality: "Content quality",
  formatting: "Formatting",
  education: "Education",
  general: "General",
};

function VerificationBadge({ suggestion }: { suggestion: ResumeSuggestionRecord }) {
  const verification = suggestion.verification;
  if (suggestion.suggestedText && verification?.truthPreserving) {
    return (
      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary/15 text-secondary font-bold whitespace-nowrap">
        ✓ Truth-preserving
      </span>
    );
  }
  if (verification?.placeholderRequired) {
    return (
      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/15 text-primary-text font-bold whitespace-nowrap">
        Needs your input
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-high text-text-muted font-bold whitespace-nowrap">
      Advisory
    </span>
  );
}

export function SuggestionsPanel({
  variantId,
  suggestions,
  assertedSkills,
}: {
  variantId: string;
  suggestions: ResumeSuggestionRecord[];
  assertedSkills: string[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDecided, setShowDecided] = useState(false);
  const [confirmed, setConfirmed] = useState<string[]>(assertedSkills);

  const pending = suggestions.filter((suggestion) => suggestion.status === "pending");
  const decided = suggestions.filter((suggestion) => suggestion.status !== "pending");

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "The action could not be completed.");
    return data;
  }

  async function decide(suggestion: ResumeSuggestionRecord, decision: "accepted" | "rejected") {
    setBusyId(suggestion.id);
    setError(null);
    try {
      await post(`/api/student/resume/suggestions/${suggestion.id}/decision`, { decision, variantId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action could not be completed.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAsserted(skill: string, asserted: boolean) {
    setBusyId(`skill:${skill}`);
    setError(null);
    try {
      await post(`/api/student/resume/variants/${variantId}/asserted-skills`, { skill, asserted });
      setConfirmed((current) =>
        asserted ? Array.from(new Set([...current, skill])) : current.filter((entry) => entry !== skill)
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The skill could not be recorded.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Suggestions
          </span>
          <h2 className="text-title-md font-bold text-text-primary mt-1">Resume optimisation</h2>
          <p className="text-[12px] font-mono text-text-secondary mt-1">
            Every rewrite is verified against your own text. Placement OS will not add metrics, technologies,
            responsibilities, employers, or certifications you have not documented.
          </p>
        </div>
        <span className="text-[11px] font-mono text-text-muted whitespace-nowrap">
          {pending.length} pending
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-body-sm text-error">
          {error}
        </div>
      )}

      {pending.length === 0 && (
        <p className="text-body-sm text-text-muted font-mono">
          No open suggestions. Attach a job description or update your resume to generate new ones.
        </p>
      )}

      <div className="space-y-3">
        {pending.map((suggestion) => {
          const isSkillCheck = suggestion.category === "keyword_evidence";
          const skillName = suggestion.reason.what.match(/Add evidence for (.+?) only if/)?.[1] ?? null;
          const isConfirmed = skillName
            ? confirmed.some((entry) => entry.toLowerCase() === skillName.toLowerCase())
            : false;

          return (
            <article
              key={suggestion.id}
              className={`rounded-xl border p-4 space-y-3 ${SEVERITY_TONE[suggestion.severity] ?? SEVERITY_TONE.info}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold">
                  {CATEGORY_LABEL[suggestion.category] ?? suggestion.category}
                </span>
                <VerificationBadge suggestion={suggestion} />
                {suggestion.source === "student_asserted" && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/15 text-primary-text font-bold">
                    Student-asserted
                  </span>
                )}
              </div>

              <p className="text-body-sm font-semibold text-text-primary">{suggestion.reason.what}</p>

              {suggestion.suggestedText && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {suggestion.originalText && (
                    <div className="rounded-lg border border-border/60 bg-base/60 p-3">
                      <span className="text-[9px] font-mono uppercase text-text-muted font-bold block mb-1">
                        Original
                      </span>
                      <p className="text-[12px] text-text-secondary whitespace-pre-wrap">{suggestion.originalText}</p>
                    </div>
                  )}
                  <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3">
                    <span className="text-[9px] font-mono uppercase text-secondary font-bold block mb-1">
                      {suggestion.actionable ? "Suggested" : "Template — complete it yourself"}
                    </span>
                    <p className="text-[12px] text-text-primary whitespace-pre-wrap">{suggestion.suggestedText}</p>
                  </div>
                </div>
              )}

              <dl className="space-y-1 text-[12px] font-mono">
                <div className="flex gap-2">
                  <dt className="text-text-muted uppercase text-[10px] font-bold pt-0.5 w-16 shrink-0">Why</dt>
                  <dd className="text-text-secondary">{suggestion.reason.why}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-text-muted uppercase text-[10px] font-bold pt-0.5 w-16 shrink-0">Evidence</dt>
                  <dd className="text-text-secondary">{suggestion.reason.evidence}</dd>
                </div>
              </dl>

              {suggestion.verification?.checks?.length > 0 && (
                <details className="text-[11px] font-mono">
                  <summary className="cursor-pointer text-text-muted hover:text-text-secondary">
                    Truth checks applied ({suggestion.verification.checks.length})
                  </summary>
                  <ul className="mt-2 space-y-0.5">
                    {suggestion.verification.checks.map((check) => (
                      <li key={check.rule} className={check.passed ? "text-secondary" : "text-error"}>
                        {check.passed ? "✓" : "✗"} {check.detail}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {suggestion.actionable && suggestion.suggestedText ? (
                  <button
                    type="button"
                    onClick={() => decide(suggestion, "accepted")}
                    disabled={busyId === suggestion.id}
                    className="bg-primary text-text-inverse font-semibold text-[12px] px-4 py-2 rounded-lg hover:bg-primary-text transition-all disabled:opacity-50"
                  >
                    {busyId === suggestion.id ? "Applying…" : "Accept"}
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-text-muted">
                    {isSkillCheck
                      ? "This is a check, not a rewrite. Placement OS will not edit your resume for you."
                      : "Advisory only — make this change yourself in the builder."}
                  </span>
                )}

                {isSkillCheck && skillName && (
                  <button
                    type="button"
                    onClick={() => toggleAsserted(skillName, !isConfirmed)}
                    disabled={busyId === `skill:${skillName}`}
                    className={`text-[12px] font-mono px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                      isConfirmed
                        ? "border-secondary/40 bg-secondary/10 text-secondary"
                        : "border-border bg-surface-high text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {isConfirmed
                      ? `✓ Confirmed as real (student-asserted)`
                      : "I do have real experience with this"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => decide(suggestion, "rejected")}
                  disabled={busyId === suggestion.id}
                  className="text-[12px] font-mono px-3 py-2 rounded-lg border border-border bg-surface-high text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {decided.length > 0 && (
        <div className="pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowDecided((value) => !value)}
            className="text-[11px] font-mono uppercase text-text-muted hover:text-text-primary"
          >
            {showDecided ? "Hide" : "Show"} decided ({decided.length})
          </button>
          {showDecided && (
            <ul className="mt-3 space-y-2">
              {decided.map((suggestion) => (
                <li key={suggestion.id} className="text-[12px] font-mono flex flex-wrap items-center gap-2">
                  <span className={suggestion.status === "accepted" ? "text-secondary" : "text-text-muted"}>
                    {suggestion.status === "accepted" ? "✓ Accepted" : "✗ Rejected"}
                  </span>
                  <span className="text-text-secondary">{suggestion.reason.what}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
