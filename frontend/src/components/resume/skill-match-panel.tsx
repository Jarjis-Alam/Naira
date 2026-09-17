import Link from "next/link";
import type { AtsAnalysisResult, SkillMatchRow } from "@/lib/resume/types";
import { SUBJECT_CODE_LABELS } from "@/lib/resume/skill-taxonomy";

const GAP_LABEL: Record<SkillMatchRow["gapType"], { label: string; tone: string }> = {
  none: { label: "Aligned", tone: "text-secondary" },
  resume_gap: { label: "Resume gap", tone: "text-tertiary" },
  preparation_gap: { label: "Preparation gap", tone: "text-error" },
  both: { label: "Resume + preparation gap", tone: "text-error" },
  not_assessed: { label: "Not assessed", tone: "text-text-muted" },
};

function SkillRow({ row }: { row: SkillMatchRow }) {
  const gap = GAP_LABEL[row.gapType] ?? GAP_LABEL.not_assessed;
  return (
    <div className="rounded-xl border border-border/60 bg-surface-high/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={row.evidencedInResume ? "text-secondary" : "text-tertiary"}>
            {row.evidencedInResume ? "✓" : "⚠"}
          </span>
          <span className="text-body-sm font-semibold text-text-primary">{row.canonical}</span>
          {row.domain && (
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface text-text-muted">
              {SUBJECT_CODE_LABELS[row.domain]}
            </span>
          )}
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface text-text-muted">
            {row.requirement === "not_in_jd" ? "resume only" : row.requirement}
          </span>
        </div>
        <span className={`text-[10px] font-mono uppercase font-bold ${gap.tone}`}>{gap.label}</span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
        <div className="flex gap-1.5">
          <dt className="text-text-muted">Resume:</dt>
          <dd className={row.evidencedInResume ? "text-secondary" : "text-tertiary"}>
            {row.evidencedInResume
              ? row.resumeEvidence
                ? `evidenced — "${row.resumeEvidence.slice(0, 90)}"`
                : "evidenced"
              : "not evidenced"}
            {row.provenance === "student_asserted" && " (student-asserted)"}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-text-muted">Preparation:</dt>
          <dd className="text-text-secondary">
            {row.measuredDomainAccuracy === null
              ? "no measured performance yet"
              : `${row.measuredDomainAccuracy}% across ${row.measuredQuestionsAttempted} answered question(s)`}
          </dd>
        </div>
      </dl>

      {row.recommendation && (
        <p className="text-[11px] font-mono text-text-secondary">→ {row.recommendation}</p>
      )}

      {row.gapType === "preparation_gap" && row.domain && (
        <Link
          href={`/practice?subjectCode=${row.domain}`}
          className="inline-flex items-center gap-1 text-[11px] font-mono text-primary-text hover:underline"
        >
          Start targeted practice
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      )}
    </div>
  );
}

export function SkillMatchPanel({ analysis }: { analysis: AtsAnalysisResult | null }) {
  const skillMatch = analysis?.skillMatch ?? null;
  if (!skillMatch) return null;

  const rows = skillMatch.rows ?? [];
  const requiredRows = rows.filter((row) => row.requirement === "required");
  const preferredRows = rows.filter((row) => row.requirement === "preferred");
  const resumeOnlyRows = rows.filter((row) => row.requirement === "not_in_jd");

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div>
        <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Skill match</span>
        <h2 className="text-title-md font-bold text-text-primary mt-1">Resume gap vs preparation gap</h2>
        <p className="text-[12px] font-mono text-text-secondary mt-1">
          A <span className="text-tertiary">resume gap</span> means the skill is not represented in your document. A{" "}
          <span className="text-error">preparation gap</span> means Placement OS has measured weakness in the mapped
          subject — a different problem with a different fix.
        </p>
      </div>

      {requiredRows.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Required by your target ({requiredRows.length})
          </span>
          <div className="space-y-2">
            {requiredRows.map((row) => (
              <SkillRow key={`required-${row.canonical}`} row={row} />
            ))}
          </div>
        </div>
      )}

      {preferredRows.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/60">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Preferred ({preferredRows.length})
          </span>
          <div className="space-y-2">
            {preferredRows.map((row) => (
              <SkillRow key={`preferred-${row.canonical}`} row={row} />
            ))}
          </div>
        </div>
      )}

      {resumeOnlyRows.length > 0 && (
        <details className="pt-2 border-t border-border/60">
          <summary className="text-[10px] font-mono uppercase text-text-muted font-bold cursor-pointer hover:text-text-secondary">
            In your resume but not required by this target ({resumeOnlyRows.length})
          </summary>
          <div className="space-y-2 mt-2">
            {resumeOnlyRows.map((row) => (
              <SkillRow key={`resume-${row.canonical}`} row={row} />
            ))}
          </div>
        </details>
      )}

      <p className="text-[11px] font-mono text-text-muted">{skillMatch.note}</p>
    </section>
  );
}
