import type { AtsAnalysisResult } from "@/lib/resume/types";

export function RoleMatchPanel({
  analysis,
  targetRoleName,
  targetCompanyName,
}: {
  analysis: AtsAnalysisResult | null;
  targetRoleName: string | null;
  targetCompanyName: string | null;
}) {
  const roleMatch = analysis?.roleMatch ?? null;
  const targetLabel = [targetCompanyName, targetRoleName].filter(Boolean).join(" — ");

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Role match</span>
          <h2 className="text-title-md font-bold text-text-primary mt-1">
            {targetLabel || "No target set"}
          </h2>
          {roleMatch && (
            <span className="text-[11px] font-mono text-text-muted block mt-1">Basis: {roleMatch.basisLabel}</span>
          )}
        </div>
        {roleMatch && (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-primary-text">{roleMatch.score}%</span>
          </div>
        )}
      </div>

      {!roleMatch ? (
        <p className="text-body-sm font-mono text-text-muted">
          Attach a job description, or set a target role in Profile, to measure how your resume lines up with it.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-secondary/25 bg-secondary/5 p-4 space-y-2">
              <span className="text-[10px] font-mono uppercase text-secondary font-bold block">
                Matched ({roleMatch.matched.length})
              </span>
              {roleMatch.matched.length === 0 ? (
                <span className="text-[12px] font-mono text-text-muted">
                  No matched requirements detected yet.
                </span>
              ) : (
                <ul className="space-y-1">
                  {roleMatch.matched.map((item) => (
                    <li key={item} className="text-[12px] font-mono text-text-secondary">
                      ✓ {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-tertiary/25 bg-tertiary/5 p-4 space-y-2">
              <span className="text-[10px] font-mono uppercase text-tertiary font-bold block">
                Not found in resume ({roleMatch.notEvidenced.length})
              </span>
              {roleMatch.notEvidenced.length === 0 ? (
                <span className="text-[12px] font-mono text-text-muted">
                  Nothing required by this target is missing from your resume text.
                </span>
              ) : (
                <ul className="space-y-1">
                  {roleMatch.notEvidenced.map((item) => (
                    <li key={item} className="text-[12px] font-mono text-text-secondary">
                      ! {item}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] font-mono text-text-muted pt-1">
                &quot;Not found in resume&quot; means the term was not detected in your document — not that you lack the
                skill.
              </p>
            </div>
          </div>

          <p className="text-[12px] font-mono text-text-muted">{roleMatch.note}</p>
        </>
      )}
    </section>
  );
}
