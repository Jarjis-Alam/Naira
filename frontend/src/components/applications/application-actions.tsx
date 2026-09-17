"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_META } from "@/lib/applications/status-meta";
import { INTERVIEW_TYPES, type ApplicationStatus } from "@/lib/applications/domain";

type Transition = { status: ApplicationStatus; label: string; terminal: boolean };

/**
 * Phase 19 — application detail action forms.
 *
 * Every action goes through the Phase 19 API routes; optimistic UI is
 * deliberately avoided so a failed transition never pretends to have worked.
 * Status transitions use PATCH ?action=status (guarded server-side), other
 * sub-resources use the dedicated routes.
 */
export function ApplicationActions({
  applicationId,
  allowedTransitions,
  hasResume,
}: {
  applicationId: string;
  allowedTransitions: ApplicationStatus[];
  hasResume: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const transitions: Transition[] = allowedTransitions.map((status) => ({
    status,
    label: STATUS_META[status].label,
    terminal: ["REJECTED", "WITHDRAWN", "CLOSED"].includes(status),
  }));

  async function call(
    key: string,
    url: string,
    method: string,
    payload: unknown,
    done: string
  ) {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Request failed");
      setSuccess(done);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary";
  const labelCls =
    "text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold";

  return (
    <section className="rounded-2xl border border-border/80 bg-surface/90 p-5 space-y-4">
      <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
        Actions
      </h2>

      {/* Status transition */}
      <div className="space-y-2">
        <span className={labelCls}>Update status</span>
        <div className="flex flex-wrap gap-2">
          {transitions.length === 0 && (
            <p className="text-body-sm text-text-muted">
              This application is closed. Terminal statuses are final (history is preserved).
            </p>
          )}
          {transitions.map((t) => (
            <button
              key={t.status}
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (
                  t.terminal &&
                  typeof window !== "undefined" &&
                  !window.confirm(
                    `Mark this application as "${t.label}"? This is a terminal state that closes the application.`
                  )
                ) {
                  return;
                }
                call(
                  `status-${t.status}`,
                  `/api/student/applications/${applicationId}?action=status`,
                  "PATCH",
                  { status: t.status },
                  `Status updated to ${t.label}`
                );
              }}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-mono font-bold uppercase transition-colors disabled:opacity-50 ${t.terminal ? "border border-zinc-700 text-zinc-400 hover:bg-zinc-800" : "bg-primary/10 text-primary-text hover:bg-primary/20"}`}
            >
              {busy === `status-${t.status}` ? "…" : t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deadline */}
      <form
        className="grid sm:grid-cols-[auto_1fr_auto] gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const raw = String(f.get("deadline") ?? "");
          if (!raw) return;
          const kind = String(f.get("kind") ?? "application") as
            | "application"
            | "assessment"
            | "interview"
            | "offer";
          call(
            "deadline",
            `/api/student/applications/${applicationId}`,
            "PATCH",
            {
              [kind === "application"
                ? "deadline"
                : kind === "assessment"
                  ? "assessmentDeadline"
                  : kind === "interview"
                    ? "interviewDate"
                    : "offerDeadline"]: new Date(`${raw}T12:00:00`).toISOString(),
            },
            "Deadline saved"
          );
        }}
      >
        <label className="space-y-1.5 sm:w-40">
          <span className={labelCls}>Deadline type</span>
          <select name="kind" className={inputCls}>
            <option value="application">Application</option>
            <option value="assessment">Assessment</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className={labelCls}>Date</span>
          <input type="date" name="deadline" className={inputCls} />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-lg border border-primary/40 px-4 py-2 text-body-sm font-semibold text-primary-text hover:bg-primary/10 disabled:opacity-50 h-[38px]"
        >
          {busy === "deadline" ? "Saving…" : "Save deadline"}
        </button>
      </form>

      {/* Resume */}
      <ResumeAttachForm
        applicationId={applicationId}
        hasResume={hasResume}
        busy={busy !== null}
        onCall={call}
      />

      {/* JD */}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const jd = String(new FormData(e.currentTarget).get("jd") ?? "").trim();
          if (!jd) return;
          call(
            "jd",
            `/api/student/applications/${applicationId}`,
            "PATCH",
            { jobDescription: jd },
            "Job description attached"
          );
        }}
      >
        <label className="block space-y-1.5">
          <span className={labelCls}>Job description (Phase 18 analyzer)</span>
          <textarea name="jd" rows={3} maxLength={40000} className={inputCls} />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-lg border border-primary/40 px-4 py-2 text-body-sm font-semibold text-primary-text hover:bg-primary/10 disabled:opacity-50"
        >
          {busy === "jd" ? "Saving…" : "Attach JD"}
        </button>
      </form>

      {/* Interview */}
      <form
        className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const roundType = String(f.get("roundType") ?? "");
          const scheduledAt = String(f.get("scheduledAt") ?? "");
          if (!roundType || !scheduledAt) return;
          call(
            "interview",
            `/api/student/applications/${applicationId}/interviews`,
            "POST",
            {
              roundType,
              scheduledAt: new Date(`${scheduledAt}T12:00:00`).toISOString(),
            },
            "Interview scheduled"
          );
        }}
      >
        <label className="space-y-1.5">
          <span className={labelCls}>Interview round</span>
          <select name="roundType" className={inputCls}>
            {INTERVIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className={labelCls}>Scheduled date</span>
          <input type="date" name="scheduledAt" className={inputCls} />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-lg border border-primary/40 px-4 py-2 text-body-sm font-semibold text-primary-text hover:bg-primary/10 disabled:opacity-50 h-[38px]"
        >
          {busy === "interview" ? "Saving…" : "Schedule"}
        </button>
      </form>

      {/* Assessment */}
      <form
        className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const name = String(f.get("name") ?? "").trim();
          if (!name) return;
          call(
            "assessment",
            `/api/student/applications/${applicationId}/records?kind=assessment`,
            "POST",
            { name },
            "Assessment recorded"
          );
        }}
      >
        <label className="space-y-1.5">
          <span className={labelCls}>Assessment name</span>
          <input name="name" maxLength={255} placeholder="Online Assessment 1" className={inputCls} />
        </label>
        <label className="space-y-1.5">
          <span className={labelCls}>Deadline (optional)</span>
          <input type="date" name="deadline" className={inputCls} />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-lg border border-primary/40 px-4 py-2 text-body-sm font-semibold text-primary-text hover:bg-primary/10 disabled:opacity-50 h-[38px]"
        >
          {busy === "assessment" ? "Saving…" : "Record"}
        </button>
      </form>

      {/* Offer */}
      <form
        className="grid sm:grid-cols-[1fr_auto] gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const compensationText = String(f.get("compensationText") ?? "").trim();
          if (!compensationText) return;
          call(
            "offer",
            `/api/student/applications/${applicationId}/records?kind=offer`,
            "POST",
            { compensationText },
            "Offer recorded"
          );
        }}
      >
        <label className="space-y-1.5">
          <span className={labelCls}>Offer — compensation (as provided to you)</span>
          <input
            name="compensationText"
            maxLength={255}
            placeholder='e.g. "18 LPA fixed + 2L joining bonus"'
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-lg border border-white/40 px-4 py-2 text-body-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 h-[38px]"
        >
          {busy === "offer" ? "Saving…" : "Record offer"}
        </button>
      </form>

      {error && (
        <p className="text-body-sm text-zinc-400" role="alert">
          {error}
        </p>
      )}
      {success && <p className="text-body-sm text-white">{success}</p>}

      {/* Destructive zone */}
      <div className="pt-4 border-t border-border/60 flex items-center justify-between">
        <span className="text-[11px] font-mono text-text-muted">Need to remove this application?</span>
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            if (
              typeof window !== "undefined" &&
              !window.confirm(
                "Delete this application? All recorded events, assessments, and interview logs for this application will be permanently removed."
              )
            ) {
              return;
            }
            setBusy("delete");
            try {
              const res = await fetch(`/api/student/applications/${applicationId}`, { method: "DELETE" });
              if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error(b?.error ?? "Failed to delete application");
              }
              router.push("/applications");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete application");
              setBusy(null);
            }
          }}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] font-mono font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {busy === "delete" ? "Deleting…" : "Delete Application"}
        </button>
      </div>
    </section>
  );
}

function ResumeAttachForm({
  applicationId,
  hasResume,
  busy,
  onCall,
}: {
  applicationId: string;
  hasResume: boolean;
  busy: boolean;
  onCall: (key: string, url: string, method: string, payload: unknown, done: string) => Promise<void>;
}) {
  const [variants, setVariants] = useState<{ id: string; label: string; atsScore: number | null }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("");

  async function loadVariants() {
    setLoading(true);
    try {
      const res = await fetch("/api/student/resume/variants");
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const list: { id: string; label: string; atsScore: number | null }[] =
          body?.variants ?? body ?? [];
        setVariants(list.filter((v) => typeof v?.id === "string"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
        Resume (Phase 18 variant)
      </span>
      {hasResume ? (
        <button
          type="button"
          onClick={() => onCall("resume-detach", `/api/student/applications/${applicationId}`, "PATCH", { resumeVariantId: null }, "Resume detached")}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-mono text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          Detach current resume
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadVariants}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-mono text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load my resume variants"}
        </button>
        {variants.length > 0 && (
          <>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
            >
              <option value="">Select variant…</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.atsScore !== null ? ` · ATS ${v.atsScore}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selected || busy}
              onClick={() =>
                onCall(
                  "resume-attach",
                  `/api/student/applications/${applicationId}`,
                  "PATCH",
                  { resumeVariantId: selected },
                  "Resume attached"
                )
              }
              className="rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-mono font-bold text-primary-text hover:bg-primary/20 disabled:opacity-50"
            >
              Attach
            </button>
          </>
        )}
      </div>
    </div>
  );
}
