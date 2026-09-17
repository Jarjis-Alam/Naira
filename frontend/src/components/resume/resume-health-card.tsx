import Link from "next/link";
import type { ResumeHealth } from "@/server/resume-intelligence";

const SIGNAL_TONE: Record<string, string> = {
  ok: "text-secondary",
  warn: "text-tertiary",
  info: "text-text-muted",
};

const SIGNAL_ICON: Record<string, string> = {
  ok: "check_circle",
  warn: "warning",
  info: "info",
};

export function ResumeHealthCard({ health }: { health: ResumeHealth }) {
  return (
    <section
      id="dashboard-resume-health"
      className="bg-surface/90 border border-border rounded-2xl p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">description</span>
          Resume Health
        </span>
        <Link href={health.ctaHref} className="text-primary-text hover:text-primary text-[11px] font-mono underline">
          {health.hasResume ? "Improve Resume" : "Add Resume"}
        </Link>
      </div>

      {health.hasResume ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase text-text-muted block">ATS Score</span>
              <span className="text-2xl font-bold font-mono text-text-primary">{health.atsScore ?? "--"}</span>
            </div>
            <div className="border-l border-border/60 pl-4">
              <span className="text-[10px] font-mono uppercase text-text-muted block">Target Match</span>
              <span className="text-2xl font-bold font-mono text-primary-text">
                {health.matchScore === null ? "--" : `${health.matchScore}%`}
              </span>
            </div>
          </div>

          {health.targetLabel && (
            <div className="text-[11px] font-mono text-text-muted truncate">
              Target: <span className="text-text-secondary">{health.targetLabel}</span>
              {health.level && <span className="ml-2 text-primary-text uppercase font-bold">{health.level}</span>}
            </div>
          )}

          {health.signals.length > 0 && (
            <ul className="space-y-1 pt-2 border-t border-border/60">
              {health.signals.map((signal) => (
                <li key={signal.id} className="flex items-start gap-2 text-[11px] font-mono">
                  <span className={`material-symbols-outlined text-[15px] shrink-0 ${SIGNAL_TONE[signal.status]}`}>
                    {SIGNAL_ICON[signal.status]}
                  </span>
                  <span className="text-text-secondary">
                    <span className="text-text-primary">{signal.label}</span>
                    <span className="text-text-muted"> — {signal.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {health.topRecommendations.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Next improvements</span>
              {health.topRecommendations.slice(0, 2).map((recommendation) => (
                <p key={recommendation.id} className="text-[11px] font-mono text-text-secondary truncate" title={recommendation.why}>
                  • {recommendation.title}
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[12px] font-mono text-text-secondary">
          {health.signals[0]?.detail ?? "Upload your resume to measure ATS compatibility and target match."}
        </p>
      )}

      <Link
        id="dashboard-resume-health-cta"
        href={health.ctaHref}
        className="w-full bg-surface-high border border-primary/30 text-primary-text font-medium text-[12px] py-2.5 px-3 rounded-lg hover:bg-surface-highest transition-colors flex items-center justify-center gap-1.5 font-mono"
      >
        <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
        <span>{health.ctaLabel}</span>
      </Link>
    </section>
  );
}
