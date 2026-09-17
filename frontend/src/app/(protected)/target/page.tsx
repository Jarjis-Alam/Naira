import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlacementTargetStrategy } from "@/server/placement-target-strategy";
import { getStudentPlacementTargets } from "@/server/company-role-intelligence";

export default async function TargetStrategyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const [strategy, placementTargets] = await Promise.all([
    getPlacementTargetStrategy(session.user.id),
    getStudentPlacementTargets(session.user.id),
  ]);
  const { target, readiness, matrix, gaps, advantages, preparationStrategy, emptyState, partialDataBanner } = strategy;

  const totalTargetsCount = (placementTargets.targetRoles?.length || 0) + (placementTargets.targetCompanies?.length || 0);
  const secondaryRolesCount = placementTargets.targetRoles?.filter((r) => !r.isPrimary)?.length || 0;
  const secondaryCompaniesCount = placementTargets.targetCompanies?.filter((c) => c.priority !== 1)?.length || 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Navigation / Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-text-muted text-[12px] font-mono">
            <span>Nexora</span>
            <span className="text-border">/</span>
            <span className="text-text-secondary">Placement Strategy</span>
            <span className="text-border">/</span>
            <span className="text-lime-pulse font-semibold">Target Console</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
            Target Strategy
          </h1>
          <p className="text-sm text-text-secondary">
            Calibrate role archetypes, company benchmarks, and competency coverage for high-velocity offers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Link
            href="/profile"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container border border-outline-variant/40 text-text-primary hover:bg-surface-container-high transition-colors text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            <span>Manage Targets</span>
          </Link>
          <Link
            href="/roadmap"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-lime-pulse text-void-black font-semibold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            <span>View Roadmap</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>

      {/* Filter / Scope Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/30">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-void-black font-semibold text-xs transition-all">
            <span>Configured Targets</span>
            <span className="px-1.5 py-0.2 rounded-full bg-void-black/20 text-void-black text-[10px] font-mono font-bold">
              {totalTargetsCount || 1}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container border border-outline-variant/40 text-text-primary text-xs">
            <span className="w-2 h-2 rounded-full bg-lime-pulse"></span>
            <span>Primary Role</span>
            <span className="text-text-muted text-[11px] font-mono">(1)</span>
          </div>
          {secondaryRolesCount > 0 && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container border border-outline-variant/40 text-text-primary text-xs">
              <span className="w-2 h-2 rounded-full bg-zinc-300"></span>
              <span>Secondary Roles</span>
              <span className="text-text-muted text-[11px] font-mono">({secondaryRolesCount})</span>
            </div>
          )}
          {secondaryCompaniesCount > 0 && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container border border-outline-variant/40 text-text-primary text-xs">
              <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
              <span>Target Companies</span>
              <span className="text-text-muted text-[11px] font-mono">({secondaryCompaniesCount})</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low border border-outline-variant/40 text-text-muted text-xs font-mono">
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Calibrated: <strong className="text-text-primary font-semibold">Phase 16 Engine</strong></span>
          </div>
        </div>
      </div>

      {/* EMPTY STATES */}
      {emptyState && (
        <div className="rounded-2xl border border-lime-pulse/30 bg-surface-container-low/90 p-8 text-center max-w-2xl mx-auto my-12 space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-lime-pulse/10 border border-lime-pulse/25 text-lime-pulse flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">
              {emptyState.type === "no_target" ? "ads_click" : "verified"}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-mono text-lime-pulse font-bold uppercase tracking-wider block mb-1">
              Strategy Activation Required
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {emptyState.title}
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-lg mx-auto">
              {emptyState.message}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href={emptyState.ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-lime-pulse text-void-black font-semibold text-sm hover:brightness-110 transition-all shadow-md"
            >
              <span>{emptyState.ctaLabel}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      )}

      {/* ACTIVE TARGET STRATEGY CONSOLE */}
      {!emptyState && (
        <div className="space-y-8">
          {/* Partial Data Banner */}
          {partialDataBanner && (
            <div className="rounded-xl border border-tertiary/30 bg-tertiary/10 p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">info</span>
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-tertiary block">
                  {partialDataBanner.title}
                </span>
                <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">
                  {partialDataBanner.message}
                </p>
              </div>
            </div>
          )}

          {/* Primary Active Target Spotlight Card */}
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-low border border-outline-variant/40 p-6 sm:p-8 transition-all shadow-md">
            {/* Ambient glow accent */}
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-lime-pulse/10 blur-3xl pointer-events-none"></div>

            <div className="flex flex-col gap-6 relative z-10">
              {/* Card Pill Tags Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-pulse/15 border border-lime-pulse/35 text-lime-pulse font-mono text-[11px] font-bold tracking-wider uppercase">
                    <span className="w-2 h-2 rounded-full bg-lime-pulse animate-ping"></span>
                    ACTIVE PRIMARY TARGET
                  </span>
                  {target.primaryRole?.category && (
                    <span className="px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/30 text-text-secondary font-mono text-[11px] tracking-wider uppercase">
                      {target.primaryRole.category}
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/30 text-text-secondary font-mono text-[11px] tracking-wider uppercase">
                    {readiness.targetLevel || "CALIBRATING"}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-surface-container px-3.5 py-1.5 rounded-full border border-outline-variant/40">
                  <span className="font-mono text-[11px] text-text-muted uppercase tracking-wider">FIT MATCH</span>
                  <span className="font-mono text-lg font-bold text-lime-pulse leading-none">
                    {readiness.targetScore !== null ? `${readiness.targetScore}%` : "--"}
                  </span>
                </div>
              </div>

              {/* Main Target Header Info */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-lime-pulse border border-outline-variant/40 shadow-inner shrink-0">
                    <span className="material-symbols-outlined text-[32px]">hub</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
                        {target.primaryRole?.name || "Software Engineer"}
                      </h2>
                      {target.primaryCompany && (
                        <span className="text-xl sm:text-2xl font-semibold text-lime-pulse">
                          @ {target.primaryCompany.name}
                        </span>
                      )}
                      <span className="material-symbols-outlined text-lime-pulse text-[20px]" title="Primary Placement Target">
                        verified
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-text-muted text-xs font-mono flex-wrap mt-1">
                      {target.primaryCompany?.industry && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">domain</span>
                          {target.primaryCompany.industry}
                        </span>
                      )}
                      <span>•</span>
                      <span>{target.targetCompaniesCount} Target Companies</span>
                      <span>•</span>
                      <span>{target.targetRolesCount} Target Roles</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/simulation"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-lime-pulse text-void-black font-semibold text-xs hover:brightness-110 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_circle</span>
                    <span>Run Mock Interview</span>
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-high border border-outline-variant/40 text-text-primary hover:border-outline transition-colors text-xs font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>Edit Target Parameters</span>
                  </Link>
                </div>
              </div>

              {/* 3-Column Key Performance Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Col 1: Technical Fit Score */}
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Target Readiness Index</span>
                    <span className="text-xl font-bold font-mono text-lime-pulse">
                      {readiness.targetScore !== null ? `${readiness.targetScore}%` : "--"}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container-low overflow-hidden">
                    <div
                      className="h-full rounded-full bg-lime-pulse transition-all duration-500"
                      style={{ width: `${readiness.targetScore ?? 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-text-secondary font-mono">
                    Weighted target accuracy across evaluated subject domains.
                  </p>
                </div>

                {/* Col 2: General Baseline vs Target */}
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Overall Baseline</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {readiness.overallScore !== null ? `${readiness.overallScore}%` : "--"}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container-low overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white/70 transition-all duration-500"
                      style={{ width: `${readiness.overallScore ?? 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-text-secondary font-mono">
                    General technical baseline across all curriculum subjects.
                  </p>
                </div>

                {/* Col 3: Domain Distribution */}
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Domain Coverage</span>
                    <span className="text-xs font-mono font-bold uppercase text-lime-pulse">
                      {readiness.targetLevel || "EVALUATING"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 text-sm font-mono font-bold">
                    <span className="text-lime-pulse">{readiness.strongCount} Strong</span>
                    <span className="text-text-muted">•</span>
                    <span className="text-zinc-300">{readiness.developingCount} Dev</span>
                    <span className="text-text-muted">•</span>
                    <span className="text-zinc-400">{readiness.weakCount} Weak</span>
                  </div>
                  <p className="text-xs text-text-secondary font-mono">
                    {matrix.length} domain rubrics tracked against target benchmark.
                  </p>
                </div>
              </div>

              {/* Additional Target Roles & Companies pill list */}
              {(placementTargets.targetRoles.length > 1 || placementTargets.targetCompanies.length > 1) && (
                <div className="pt-3 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-mono">
                  {placementTargets.targetRoles.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-text-muted text-[11px] uppercase font-bold">
                        Additional Roles:
                      </span>
                      {placementTargets.targetRoles
                        .filter((r) => !r.isPrimary)
                        .map((r) => (
                          <span
                            key={r.id}
                            className="px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/40 text-text-secondary text-[11px]"
                          >
                            {r.name}
                          </span>
                        ))}
                    </div>
                  )}
                  {placementTargets.targetCompanies.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-text-muted text-[11px] uppercase font-bold">
                        Target Companies:
                      </span>
                      {placementTargets.targetCompanies
                        .filter((c) => c.priority !== 1)
                        .map((c) => (
                          <span
                            key={c.id}
                            className="px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/40 text-text-secondary text-[11px]"
                          >
                            {c.name}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Strategy Recommendation Banner */}
          {preparationStrategy.summary && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-container border border-outline-variant/30 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-lime-pulse"></div>
              <div className="flex items-center gap-3.5 pl-2">
                <div className="w-10 h-10 rounded-full bg-lime-pulse/15 border border-lime-pulse/30 flex items-center justify-center text-lime-pulse shrink-0">
                  <span className="material-symbols-outlined text-[20px]">lightbulb</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-lime-pulse font-bold tracking-widest uppercase">
                      STRATEGIC DIRECTIVE
                    </span>
                    <span className="text-border">•</span>
                    <span className="text-[11px] font-mono text-text-muted">High-Yield Priority</span>
                  </div>
                  <p className="text-sm text-text-primary mt-0.5 leading-relaxed">
                    {preparationStrategy.summary}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {preparationStrategy.practiceHref && (
                  <Link
                    href={preparationStrategy.practiceHref}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-lime-pulse text-void-black font-semibold text-xs hover:brightness-110 transition-all shadow-sm"
                  >
                    <span>Start Priority Practice</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Section 02: Target Requirements & Performance Matrix */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="text-lime-pulse font-mono">01</span>
                  TARGET REQUIREMENTS & COMPETENCY EVIDENCE
                </h2>
                <p className="text-xs font-mono text-text-muted mt-0.5">
                  Authoritative domain requirements mapped against your measured scores
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-text-muted text-xs font-mono">
                <span className="material-symbols-outlined text-lime-pulse text-[16px]">auto_fix_high</span>
                <span>{strategy.requirements.hasAuthoritativeData ? "Authoritative Syllabus" : "Curriculum Standard"}</span>
              </div>
            </div>

            {/* Modern Dark Table */}
            <div className="w-full overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container text-text-muted font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">Skill / Domain</th>
                    <th className="py-3.5 px-4 font-semibold">Required Benchmark</th>
                    <th className="py-3.5 px-4 font-semibold">Current Accuracy</th>
                    <th className="py-3.5 px-4 font-semibold">Target Need</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-xs">
                  {matrix.map((row) => (
                    <tr key={row.domain} className="hover:bg-surface-container/60 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[18px] text-lime-pulse">
                            {row.studentState === "STRONG" ? "check_circle" : row.studentState === "DEVELOPING" ? "trending_up" : "error"}
                          </span>
                          <div>
                            <div className="font-semibold text-text-primary text-sm">
                              {row.domain} — {row.domainName}
                            </div>
                            <div className="text-text-muted text-[11px] font-mono">
                              Weight & Need: {row.targetNeed}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-text-secondary">
                        {row.benchmark}% Target
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-white text-sm">
                          {row.accuracy !== null ? `${row.accuracy}%` : "--"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                            row.targetNeed === "HIGH"
                              ? "bg-lime-pulse/20 text-lime-pulse border border-lime-pulse/35"
                              : row.targetNeed === "MEDIUM"
                              ? "bg-surface-container-high text-text-primary border border-outline-variant/40"
                              : "bg-surface-container text-text-muted border border-outline-variant/30"
                          }`}
                        >
                          {row.targetNeed}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase ${
                            row.studentState === "STRONG"
                              ? "bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30"
                              : row.studentState === "DEVELOPING"
                              ? "bg-white/10 text-zinc-300 border border-white/20"
                              : row.studentState === "WEAK"
                              ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              : "bg-surface-container text-text-muted border border-outline-variant/40"
                          }`}
                        >
                          {row.studentState}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/tests?domain=${encodeURIComponent(row.domain)}`}
                          className="px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/40 text-text-secondary hover:text-white hover:border-lime-pulse font-mono text-[11px] transition-colors inline-block"
                        >
                          Practice
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 03: Target Gaps & Priority Deficits */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="text-lime-pulse font-mono">02</span>
                  TARGET GAPS & PRIORITY DEFICITS
                </h2>
                <p className="text-xs font-mono text-text-muted mt-0.5">
                  Areas below the target benchmark requiring targeted intervention
                </p>
              </div>
              <span className="text-xs font-mono text-text-muted">
                {gaps.length} {gaps.length === 1 ? "priority gap" : "priority gaps"}
              </span>
            </div>

            {gaps.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {gaps.map((gap) => (
                  <div
                    key={gap.id}
                    className="rounded-2xl border border-white/20 bg-surface-container-low p-5 hover:border-white/40 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold font-mono text-lime-pulse">
                          #{gap.orderNumber}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          {gap.domain} → {gap.topic}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase ${
                            gap.priority === "CRITICAL"
                              ? "bg-white/20 text-white border border-white/30"
                              : "bg-white/10 text-zinc-300 border border-white/20"
                          }`}
                        >
                          {gap.priority}
                        </span>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/25 font-bold uppercase">
                          TARGET {gap.targetRelevance}
                        </span>
                        <span className="text-xs font-mono text-zinc-300 font-semibold bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant/40">
                          {gap.currentAccuracy}% ACCURACY
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-text-secondary">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block font-semibold">
                          Why:
                        </span>
                        <p className="text-text-secondary leading-relaxed">
                          {gap.why}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block font-semibold">
                          Evidence:
                        </span>
                        <p className="font-mono text-text-muted leading-relaxed">
                          {gap.evidence}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block font-semibold">
                          Action:
                        </span>
                        <p className="text-white font-medium leading-relaxed">
                          {gap.action}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                      <span className="text-xs font-mono text-text-muted">
                        Target Benchmark: {gap.targetBenchmark}%
                      </span>
                      <Link
                        href={gap.ctaHref}
                        className="px-4 py-1.5 rounded-full bg-lime-pulse text-void-black hover:brightness-110 text-xs font-semibold font-mono transition-all inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{gap.ctaLabel}</span>
                        <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-lime-pulse/30 bg-surface-container-low p-6 text-center">
                <span className="material-symbols-outlined text-lime-pulse text-[28px] mb-2 block">
                  verified
                </span>
                <h3 className="text-base font-bold text-white">No Critical Target Gaps</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
                  Your current measured accuracy in all target-required domains meets the placement benchmark.
                </p>
              </div>
            )}
          </div>

          {/* Section 04: Your Advantages */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span className="text-lime-pulse font-mono">03</span>
                YOUR COMPETITIVE ADVANTAGES
              </h2>
              <p className="text-xs font-mono text-text-muted mt-0.5">
                Areas where your measured performance exceeds target benchmarks
              </p>
            </div>

            {advantages.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {advantages.map((adv) => (
                  <div
                    key={adv.id}
                    className="rounded-2xl border border-lime-pulse/30 bg-surface-container-low p-5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-lime-pulse font-bold px-2.5 py-0.5 rounded-full bg-lime-pulse/10 border border-lime-pulse/25">
                        ADVANTAGE
                      </span>
                      <span className="text-base font-bold font-mono text-lime-pulse">
                        {adv.accuracy}%
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {adv.domain} → {adv.topic}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {adv.why}
                    </p>
                    <div className="text-[11px] font-mono text-text-muted pt-2 border-t border-outline-variant/20">
                      {adv.evidence}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 text-center text-xs font-mono text-text-muted">
                Complete more practice to establish validated target advantages.
              </div>
            )}
          </div>

          {/* Section 05: Preparation Strategy & Directives */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span className="text-lime-pulse font-mono">04</span>
                PREPARATION STRATEGY DIRECTIVE
              </h2>
              <span className="text-[10px] font-mono text-lime-pulse font-bold uppercase tracking-wider">
                Action Plan
              </span>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
              {preparationStrategy.summary}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-outline-variant/20">
              {preparationStrategy.practiceHref && (
                <Link
                  href={preparationStrategy.practiceHref}
                  className="px-4 py-2 rounded-full bg-lime-pulse text-void-black hover:brightness-110 font-semibold text-xs transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                  <span>Start Priority Practice</span>
                </Link>
              )}
              <Link
                href={preparationStrategy.roadmapHref}
                className="px-4 py-2 rounded-full bg-surface-container border border-outline-variant/40 text-text-primary hover:bg-surface-container-high font-medium text-xs transition-colors inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">alt_route</span>
                <span>View Strategic Roadmap</span>
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-full bg-surface-container border border-outline-variant/40 text-text-secondary hover:text-white font-mono text-xs transition-colors inline-flex items-center gap-1.5"
              >
                <span>Today&apos;s Execution Plan</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
