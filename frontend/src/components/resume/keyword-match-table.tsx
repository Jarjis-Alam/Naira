import type { AtsAnalysisResult } from "@/lib/resume/types";

export function KeywordMatchTable({ analysis }: { analysis: AtsAnalysisResult | null }) {
  const keywordAnalysis = analysis?.keywordAnalysis ?? null;
  if (!keywordAnalysis) return null;

  const rows = keywordAnalysis.rows ?? [];

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Keyword match</span>
          <h2 className="text-title-md font-bold text-text-primary mt-1">Job description terms in your resume</h2>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-secondary">✓ {keywordAnalysis.matched} matched</span>
            <span className="text-tertiary">✗ {keywordAnalysis.missing} missing</span>
            {keywordAnalysis.overused.length > 0 && (
              <span className="text-error">⚠ {keywordAnalysis.overused.length} over-used</span>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-body-sm font-mono text-text-muted">
          Paste the job description you are targeting to compare keywords.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] font-mono">
            <thead>
              <tr className="text-[10px] uppercase text-text-muted border-b border-border/60">
                <th className="py-2 pr-3 font-bold">Term</th>
                <th className="py-2 pr-3 font-bold">Requirement</th>
                <th className="py-2 pr-3 font-bold">In resume</th>
                <th className="py-2 font-bold">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.keyword}-${row.requirement}`} className="border-b border-border/30">
                  <td className="py-2 pr-3 text-text-primary">{row.keyword}</td>
                  <td className="py-2 pr-3 text-text-muted uppercase text-[10px]">{row.requirement}</td>
                  <td className="py-2 pr-3">
                    {row.status === "matched" && <span className="text-secondary">✓ {row.occurrences}×</span>}
                    {row.status === "overused" && <span className="text-error">⚠ {row.occurrences}×</span>}
                    {row.status === "missing" && <span className="text-tertiary">✗ not found</span>}
                  </td>
                  <td className="py-2 text-text-muted">{row.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] font-mono text-text-muted">{keywordAnalysis.note}</p>
    </section>
  );
}
