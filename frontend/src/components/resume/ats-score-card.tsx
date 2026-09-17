import type { AtsAnalysisResult, AtsDimension } from "@/lib/resume/types";
import { ATS_DIMENSION_LABELS } from "@/lib/resume/types";

const DIMENSION_ORDER: AtsDimension[] = ["parsing", "keywords", "skills", "experience", "formatting", "roleMatch"];

function toneFor(score: number): string {
  if (score >= 85) return "text-secondary";
  if (score >= 70) return "text-primary-text";
  if (score >= 50) return "text-tertiary";
  return "text-error";
}

function barColor(score: number): string {
  if (score >= 85) return "bg-secondary";
  if (score >= 70) return "bg-primary";
  if (score >= 50) return "bg-tertiary";
  return "bg-error";
}

export function AtsScoreCard({
  atsScore,
  matchScore,
  analysis,
}: {
  atsScore: number | null;
  matchScore: number | null;
  analysis: AtsAnalysisResult | null;
}) {
  const breakdown = analysis?.breakdown ?? null;

  return (
    <section className="rounded-2xl border border-primary/30 bg-surface/90 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">fact_check</span>
            ATS Compatibility Score
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-5xl font-bold font-mono ${atsScore === null ? "text-text-muted" : toneFor(atsScore)}`}>
              {atsScore ?? "--"}
            </span>
            <span className="text-body-sm font-mono text-text-muted">/ 100</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold block">
            Target Match
          </span>
          <div className="flex items-baseline gap-2 justify-end mt-2">
            <span className={`text-3xl font-bold font-mono ${matchScore === null ? "text-text-muted" : toneFor(matchScore)}`}>
              {matchScore === null ? "--" : `${matchScore}%`}
            </span>
          </div>
          {matchScore === null && (
            <span className="text-[11px] font-mono text-text-muted block mt-1 max-w-[220px]">
              Attach a job description to measure target match.
            </span>
          )}
        </div>
      </div>

      {breakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t border-border/60">
          {DIMENSION_ORDER.map((dimension) => {
            const value = breakdown[dimension];
            return (
              <div key={dimension} className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-text-muted uppercase">{ATS_DIMENSION_LABELS[dimension]}</span>
                  <span className={value === null ? "text-text-muted" : toneFor(value)}>
                    {value === null ? "not evaluated" : `${value}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
                  <div
                    className={`h-full ${value === null ? "bg-surface-highest" : barColor(value)}`}
                    style={{ width: value === null ? "0%" : `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {analysis && analysis.explanation.length > 0 && (
        <div className="pt-3 border-t border-border/60 space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            What contributed to this score
          </span>
          <ul className="space-y-1">
            {analysis.explanation.map((line, index) => (
              <li key={index} className="text-[12px] font-mono text-text-secondary">
                — {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-surface-high/40 p-3">
        <span className="text-[10px] font-mono uppercase text-text-muted font-bold block mb-1">
          What this score means
        </span>
        <ul className="space-y-1">
          {(
            analysis?.limitations ?? [
              "This is an ATS compatibility assessment built from measurable signals in your document. It is not a prediction of any company's decision, and Placement OS has no access to any employer's ATS.",
              '"Not evidenced in your resume" means the term was not detected in your document — it is never a statement that you lack the skill.',
            ]
          ).map((limitation, index) => (
            <li key={index} className="text-[11px] font-mono text-text-muted">
              • {limitation}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
