import type { AtsAnalysisResult } from "@/lib/resume/types";

const STATUS_TONE: Record<string, { icon: string; className: string }> = {
  pass: { icon: "check_circle", className: "text-secondary" },
  info: { icon: "info", className: "text-primary-text" },
  warn: { icon: "warning", className: "text-tertiary" },
  fail: { icon: "cancel", className: "text-error" },
  unknown: { icon: "help", className: "text-text-muted" },
};

const SEVERITY_TONE: Record<string, string> = {
  critical: "border-error/30 bg-error/10",
  warning: "border-tertiary/30 bg-tertiary/10",
  info: "border-border bg-surface-high/50",
};

export function ParsingFindings({ analysis }: { analysis: AtsAnalysisResult | null }) {
  if (!analysis) return null;

  const checks = analysis.parsingChecks ?? [];
  const findings = analysis.findings ?? [];

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div>
        <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
          ATS parsing analysis
        </span>
        <h2 className="text-title-md font-bold text-text-primary mt-1">Can parsers read your document?</h2>
        <p className="text-[12px] font-mono text-text-secondary mt-1">
          These checks reflect measurable signals in your file. Placement OS does not claim compatibility with every
          ATS system.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {checks.map((check) => {
          const tone = STATUS_TONE[check.status] ?? STATUS_TONE.unknown;
          return (
            <div key={check.id} className="flex items-start gap-2 py-1">
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${tone.className}`}>{tone.icon}</span>
              <div>
                <span className="text-body-sm text-text-primary block">{check.label}</span>
                <span className="text-[11px] font-mono text-text-muted block">{check.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      {findings.length > 0 && (
        <div className="pt-3 border-t border-border/60 space-y-2">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Flagged items ({findings.length})
          </span>
          {findings.map((finding) => (
            <div key={finding.id} className={`rounded-xl border p-3 ${SEVERITY_TONE[finding.severity] ?? SEVERITY_TONE.info}`}>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase font-bold text-text-muted">{finding.category}</span>
                <span className="text-body-sm font-semibold text-text-primary">{finding.title}</span>
              </div>
              <p className="text-[12px] font-mono text-text-secondary mt-1">{finding.detail}</p>
              {finding.evidence && (
                <p className="text-[11px] font-mono text-text-muted mt-1">Evidence: {finding.evidence}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
