"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationOutcomeDetail } from "@/server/outcome-intelligence";

/**
 * Phase 20 — Outcome Intelligence panel on the application detail page.
 *
 * Renders the derived outcome, evidence with explicit provenance
 * ("System detected" vs "Student reported"), non-causal observations, and
 * next focus with Practice Now links into the existing Phase 15 flow. The
 * disclaimer text comes from the engine's constant — never hand-edited here.
 */
export function OutcomePanel({ detail }: { detail: ApplicationOutcomeDetail }) {
  const router = useRouter();
  const { analysis, reflection, interviewFeedback } = detail;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function submitReflection(form: FormData) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const payload = {
        whatWentWell: String(form.get("whatWentWell") ?? "").trim() || undefined,
        whatWasDifficult: String(form.get("whatWasDifficult") ?? "").trim() || undefined,
        whatWasAsked: String(form.get("whatWasAsked") ?? "").trim() || undefined,
        whatWouldImprove: String(form.get("whatWouldImprove") ?? "").trim() || undefined,
      };
      const res = await fetch(`/api/student/applications/${analysis.applicationId}/reflection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to save reflection");
      setSaved("Reflection saved — recorded as student-reported evidence.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reflection");
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(form: FormData) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const interviewId = String(form.get("interviewId") ?? "");
      const topics = String(form.get("topicsDiscussed") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const questions = String(form.get("questionsRemembered") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const res = await fetch(`/api/student/applications/${analysis.applicationId}/interviews/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          difficulty: String(form.get("difficulty") ?? "").trim() || null,
          topicsDiscussed: topics.length > 0 ? topics : null,
          studentConfidence: String(form.get("studentConfidence") ?? "").trim() || null,
          questionsRemembered: questions.length > 0 ? questions : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to save feedback");
      setSaved("Interview feedback saved — recorded as student-reported evidence.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary";
  const labelCls = "text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold";
  const pendingFeedback = interviewFeedback.filter(
    (f) => f.difficulty === null && (f.topicsDiscussed === null || f.topicsDiscussed.length === 0)
  );

  return (
    <section className="rounded-2xl border border-border/80 bg-surface/90 p-5 space-y-5">
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
          Outcome Intelligence
        </h2>
        <p className="text-body-sm text-text-primary mt-2">
          <span className="font-semibold">Outcome: </span>
          {analysis.outcome.label}
        </p>
        {analysis.outcome.stageUnknown && (
          <p className="text-[11px] font-mono text-text-muted mt-0.5">
            Stage not recorded — the timeline does not prove how far this application progressed,
            so no stage is claimed.
          </p>
        )}
      </div>

      {/* Evidence with provenance */}
      {analysis.evidence.length > 0 && (
        <div>
          <p className={labelCls}>Evidence</p>
          <ul className="mt-2 space-y-1.5">
            {analysis.evidence.slice(0, 8).map((e, idx) => (
              <li key={`${e.type}-${idx}`} className="flex items-start justify-between gap-3 rounded-lg bg-surface-high/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-body-sm text-text-primary truncate">
                    {e.confidence === "student_reported" ? "🟡" : "🟢"} {e.label}
                  </p>
                  <p className="text-[10px] text-text-muted">{e.detail}</p>
                </div>
                <span className="text-body-sm font-mono font-bold text-text-primary shrink-0">{e.value}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-text-muted mt-1.5">
            🟢 System detected · 🟡 Student reported — provenance is preserved on every line.
          </p>
        </div>
      )}

      {/* Observations (engine-rendered, non-causal) */}
      {analysis.observations.length > 0 && (
        <div>
          <p className={labelCls}>Observed preparation signals</p>
          <ul className="mt-2 space-y-1.5">
            {analysis.observations.map((o, idx) => (
              <li key={idx} className="text-body-sm text-text-secondary">
                • {o.observation}
                <span className="text-[10px] font-mono text-text-muted"> ({o.basis})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resume signal */}
      <div className="rounded-lg border border-border/60 px-3 py-2">
        <p className="text-body-sm text-text-secondary">
          <span className="font-semibold">Resume: </span>
          {analysis.resumeSignals.note}
        </p>
      </div>

      {/* Next focus */}
      {analysis.nextFocus.length > 0 && (
        <div>
          <p className={labelCls}>Next preparation focus</p>
          <ul className="mt-2 space-y-1.5">
            {analysis.nextFocus.slice(0, 3).map((f) => (
              <li key={`${f.domain}-${f.topic}`} className="flex items-center justify-between gap-3">
                <span className="text-body-sm text-text-primary">
                  <span className="font-mono text-[10px] font-bold text-primary">{f.actionType}</span>{" "}
                  {f.topic}
                </span>
                {f.topicId ? (
                  <a
                    href={`/practice?topicId=${f.topicId}&subjectCode=${f.domain}`}
                    className="text-[11px] font-mono font-semibold text-primary-text hover:underline whitespace-nowrap"
                  >
                    Practice Now →
                  </a>
                ) : (
                  <a href="/roadmap" className="text-[11px] font-mono text-text-muted hover:underline">
                    View plan →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The immutable disclaimer */}
      <p className="text-[11px] font-mono text-zinc-400 border-t border-border/60 pt-3">
        ⚠ {analysis.causalityDisclaimer}
      </p>

      {/* Reflection form (student-reported) */}
      <details className="rounded-lg border border-border/60 p-3" open={Boolean(reflection)}>
        <summary className="cursor-pointer text-[11px] font-mono uppercase text-text-muted">
          {reflection ? "Student reflection (edit)" : "Add student reflection"}
        </summary>
        <form
          className="mt-3 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            submitReflection(new FormData(e.currentTarget));
          }}
        >
          <label className="block space-y-1">
            <span className={labelCls}>What went well?</span>
            <textarea name="whatWentWell" rows={2} defaultValue={reflection?.whatWentWell ?? ""} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>What was difficult?</span>
            <textarea name="whatWasDifficult" rows={2} defaultValue={reflection?.whatWasDifficult ?? ""} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>What was asked?</span>
            <textarea name="whatWasAsked" rows={2} defaultValue={reflection?.whatWasAsked ?? ""} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>What would you improve?</span>
            <textarea name="whatWouldImprove" rows={2} defaultValue={reflection?.whatWouldImprove ?? ""} className={inputCls} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-text-inverse hover:bg-primary-text disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save reflection"}
          </button>
        </form>
      </details>

      {/* Interview feedback form (student-reported) */}
      {pendingFeedback.length > 0 && (
        <details className="rounded-lg border border-border/60 p-3">
          <summary className="cursor-pointer text-[11px] font-mono uppercase text-text-muted">
            Add interview feedback (student-reported)
          </summary>
          <form
            className="mt-3 space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitFeedback(new FormData(e.currentTarget));
            }}
          >
            <label className="block space-y-1">
              <span className={labelCls}>Interview</span>
              <select name="interviewId" className={inputCls} required>
                {pendingFeedback.map((f) => (
                  <option key={f.interviewId} value={f.interviewId}>
                    Round {f.roundNumber} · {f.roundType}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className={labelCls}>Difficulty (your words)</span>
              <input name="difficulty" maxLength={120} placeholder="moderate / hard" className={inputCls} />
            </label>
            <label className="block space-y-1">
              <span className={labelCls}>Topics discussed (comma-separated)</span>
              <input name="topicsDiscussed" placeholder="SQL, Graphs, OOP" className={inputCls} />
            </label>
            <label className="block space-y-1">
              <span className={labelCls}>Your confidence</span>
              <input name="studentConfidence" maxLength={120} placeholder="confident on SQL, shaky on graphs" className={inputCls} />
            </label>
            <label className="block space-y-1">
              <span className={labelCls}>Questions you remember (comma-separated)</span>
              <input name="questionsRemembered" className={inputCls} />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border border-primary/40 px-4 py-2 text-body-sm font-semibold text-primary-text hover:bg-primary/10 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save feedback"}
            </button>
          </form>
        </details>
      )}

      {/* Recorded feedback display */}
      {interviewFeedback.some((f) => f.topicsDiscussed || f.difficulty) && (
        <div>
          <p className={labelCls}>Interview reviews (student reported)</p>
          <ul className="mt-2 space-y-2">
            {interviewFeedback
              .filter((f) => f.topicsDiscussed || f.difficulty)
              .map((f) => (
                <li key={f.interviewId} className="rounded-lg border border-border/60 p-3">
                  <p className="text-body-sm font-semibold text-text-primary">
                    Round {f.roundNumber} · {f.roundType}
                    {f.difficulty ? ` — difficulty: ${f.difficulty}` : ""}
                  </p>
                  {f.topicsDiscussed && (
                    <p className="text-[11px] text-text-secondary mt-1">
                      Topics reported: {f.topicsDiscussed.join(", ")}
                    </p>
                  )}
                  {f.studentConfidence && (
                    <p className="text-[11px] text-text-secondary">Confidence: {f.studentConfidence}</p>
                  )}
                  {f.questionsRemembered && (
                    <p className="text-[11px] text-text-secondary">Questions: {f.questionsRemembered.join(" · ")}</p>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      {saved && <p className="text-body-sm text-white">{saved}</p>}
      {error && (
        <p className="text-body-sm text-zinc-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
