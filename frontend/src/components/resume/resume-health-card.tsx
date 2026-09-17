import Link from "next/link";
import type { ResumeHealth } from "@/server/resume-intelligence";

const SIGNAL_TONE: Record<string, string> = {
  ok: "text-lime-pulse",
  warn: "text-[#ffd37a]",
  info: "text-sage-40",
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
      className="bg-ground-iron border border-circuit-border rounded-cards p-6 space-y-4 shadow-none"
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-lime-pulse">description</span>
          Resume Intelligence
        </span>
        <Link
          href={health.ctaHref}
          className="text-fern-link hover:text-phosphor-white text-caption font-mono underline transition-colors"
        >
          {health.hasResume ? "Open Workspace" : "Add Resume"}
        </Link>
      </div>

      {health.hasResume ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase text-sage-40 block">ATS Score</span>
              <span className="text-2xl font-bold font-mono text-phosphor-white">{health.atsScore ?? "--"}</span>
            </div>
            <div className="border-l border-circuit-border/60 pl-4">
              <span className="text-[10px] font-mono uppercase text-sage-40 block">Target Match</span>
              <span className="text-2xl font-bold font-mono text-lime-pulse">
                {health.matchScore === null ? "--" : `${health.matchScore}%`}
              </span>
            </div>
          </div>

          {health.targetLabel && (
            <div className="text-[11px] font-mono text-sage-40 truncate">
              Target: <span className="text-sage-60">{health.targetLabel}</span>
              {health.level && <span className="ml-2 text-moss-80 uppercase font-semibold">{health.level}</span>}
            </div>
          )}

          {health.signals.length > 0 && (
            <ul className="space-y-1 pt-2 border-t border-circuit-border/60">
              {health.signals.map((signal) => (
                <li key={signal.id} className="flex items-start gap-2 text-[11px] font-mono">
                  <span className={`material-symbols-outlined text-[15px] shrink-0 ${SIGNAL_TONE[signal.status]}`}>
                    {SIGNAL_ICON[signal.status]}
                  </span>
                  <span className="text-sage-60">
                    <span className="text-phosphor-white">{signal.label}</span>
                    <span className="text-sage-40"> — {signal.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {health.topRecommendations.length > 0 && (
            <div className="pt-2 border-t border-circuit-border/60 space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-moss-70 font-medium block">
                Next improvements
              </span>
              {health.topRecommendations.slice(0, 2).map((recommendation) => (
                <p key={recommendation.id} className="text-[11px] font-mono text-sage-60 truncate" title={recommendation.why}>
                  • {recommendation.title}
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-body-sm font-sans text-sage-60">
          {health.signals[0]?.detail ?? "Upload your resume to measure ATS compatibility and target match."}
        </p>
      )}

      <Link
        id="dashboard-resume-health-cta"
        href={health.ctaHref}
        className="w-full bg-carbon-veil border border-circuit-border hover:border-lime-pulse text-phosphor-white font-medium text-body-sm py-2.5 px-3 rounded-buttons transition-all flex items-center justify-center gap-1.5 font-sans"
      >
        <span className="material-symbols-outlined text-[16px] text-lime-pulse">auto_fix_high</span>
        <span>{health.ctaLabel}</span>
      </Link>
    </section>
  );
}
