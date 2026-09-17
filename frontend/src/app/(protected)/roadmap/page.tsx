import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentPlacementRoadmap } from "@/server/roadmap";
import { getDailyExecutionPlan } from "@/server/placement-execution";
import { getStudentSimulationHistory } from "@/server/placement-simulation";
import { getUpcomingApplicationEvents } from "@/server/application-intelligence";
import { PageHeader } from "@/components/ui/page-header";

export default async function RoadmapPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/roadmap");
  }

  const [roadmap, dailyPlan, simulationHistory, upcomingApplicationEvents] = await Promise.all([
    getStudentPlacementRoadmap(session.user.id),
    getDailyExecutionPlan(session.user.id),
    getStudentSimulationHistory(session.user.id),
    getUpcomingApplicationEvents(session.user.id, 30).catch(() => []),
  ]);
  const nextApplicationEvent = upcomingApplicationEvents[0] ?? null;
  const baselineHref = roadmap.baselineTestId
    ? `/tests/${roadmap.baselineTestId}`
    : "/tests";
  const todayActiveAction = dailyPlan.actions.find((a) => a.status !== "COMPLETED") || dailyPlan.actions[0];

  const breadcrumbs = [
    { label: "NEXORA", href: "/dashboard" },
    { label: "PREPARATION", href: "/tests" },
    { label: "ROADMAP TRAJECTORY" },
  ];

  const readinessPct = roadmap.hasBaseline && roadmap.readiness.score !== null ? roadmap.readiness.score : 0;
  const circumference = 2 * Math.PI * 18;
  const strokeOffset = circumference - (readinessPct / 100) * circumference;

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* ── Top Header ── */}
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Placement Trajectory Roadmap"
        subtitle="Deterministic preparation trajectory, calibrated continuously by verified assessment results."
        badge={{
          label: roadmap.hasBaseline ? "CALIBRATED" : "ZERO DATA",
          variant: roadmap.hasBaseline ? "green" : "neutral",
          ping: roadmap.hasBaseline,
        }}
      />

      {/* ── Master Target Cockpit Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-6 md:p-8 shadow-xl">
        {/* Ambient Chromatic Glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-lime-pulse/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#111413] border border-[#3f4a38]/40 flex items-center justify-center text-lime-pulse shadow-inner shrink-0">
                <span className="material-symbols-outlined text-[26px]">hub</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-phosphor-white tracking-tight">
                    {roadmap.targets.primaryCompany?.name || "Target Benchmark"} — {roadmap.targets.primaryRole?.name || "Software Engineering"}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30 text-[10px] font-mono uppercase tracking-wider font-semibold">
                    {roadmap.targets.configured ? "Target Configured" : "General Track"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sage-40 text-xs mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-blue-400">calendar_today</span>
                    <span>Continuous Milestone Verification</span>
                  </span>
                  <span>•</span>
                  <span className="text-lime-pulse font-medium">Adaptive Syllabus</span>
                  <span>•</span>
                  <span>7 Core CS Domains</span>
                </div>
              </div>
            </div>

            {/* Master Gauge Pill Indicator */}
            <div className="flex items-center gap-4 bg-[#111413] px-5 py-2.5 rounded-full border border-[#3f4a38]/40 shadow-inner self-start lg:self-auto">
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-mono text-sage-40 uppercase tracking-wider">
                  Readiness
                </span>
                <span className="text-lg font-bold font-mono text-phosphor-white">
                  {roadmap.hasBaseline && roadmap.readiness.score !== null
                    ? `${roadmap.readiness.score}%`
                    : "--"}
                </span>
              </div>
              <div className="relative w-11 h-11">
                <svg className="w-11 h-11 -rotate-90" viewBox="0 0 48 48">
                  <circle
                    className="text-[#282b29]"
                    cx="24"
                    cy="24"
                    fill="none"
                    r="18"
                    stroke="currentColor"
                    strokeWidth="3.5"
                  />
                  <circle
                    className="text-lime-pulse transition-all duration-500"
                    cx="24"
                    cy="24"
                    fill="none"
                    r="18"
                    stroke="currentColor"
                    strokeDasharray={circumference}
                    strokeDashoffset={roadmap.hasBaseline ? strokeOffset : circumference}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-phosphor-white">
                  {roadmap.hasBaseline && roadmap.readiness.score !== null
                    ? `${roadmap.readiness.score}`
                    : "--"}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Semantic Progress Metric Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Metric 1: Core CS */}
            <div className="p-4 rounded-xl bg-[#111413] border border-[#3f4a38]/30 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sage-40">
                  Core CS
                </span>
                <span className="text-xs font-mono font-bold text-lime-pulse">
                  {roadmap.readiness.breakdown?.coreCs ?? 0}%
                </span>
              </div>
              <div className="text-sm font-semibold text-phosphor-white truncate">OS &amp; Networks</div>
              <div className="w-full h-1.5 rounded-full bg-[#282b29] overflow-hidden">
                <div
                  className="h-full bg-lime-pulse rounded-full"
                  style={{ width: `${roadmap.readiness.breakdown?.coreCs ?? 0}%` }}
                />
              </div>
            </div>

            {/* Metric 2: DSA Mastery */}
            <div className="p-4 rounded-xl bg-[#111413] border border-[#3f4a38]/30 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sage-40">
                  Algorithmic DSA
                </span>
                <span className="text-xs font-mono font-bold text-purple-400">
                  {roadmap.readiness.breakdown?.dsa ?? 0}%
                </span>
              </div>
              <div className="text-sm font-semibold text-phosphor-white truncate">Data Structures</div>
              <div className="w-full h-1.5 rounded-full bg-[#282b29] overflow-hidden">
                <div
                  className="h-full bg-purple-400 rounded-full"
                  style={{ width: `${roadmap.readiness.breakdown?.dsa ?? 0}%` }}
                />
              </div>
            </div>

            {/* Metric 3: Database / SQL */}
            <div className="p-4 rounded-xl bg-[#111413] border border-[#3f4a38]/30 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sage-40">
                  DBMS &amp; SQL
                </span>
                <span className="text-xs font-mono font-bold text-blue-400">
                  {roadmap.readiness.breakdown?.sql ?? 0}%
                </span>
              </div>
              <div className="text-sm font-semibold text-phosphor-white truncate">Query &amp; Schema Design</div>
              <div className="w-full h-1.5 rounded-full bg-[#282b29] overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${roadmap.readiness.breakdown?.sql ?? 0}%` }}
                />
              </div>
            </div>

            {/* Metric 4: Aptitude */}
            <div className="p-4 rounded-xl bg-[#111413] border border-[#3f4a38]/30 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sage-40">
                  Quantitative Aptitude
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {roadmap.readiness.breakdown?.aptitude ?? 0}%
                </span>
              </div>
              <div className="text-sm font-semibold text-phosphor-white truncate">Screening Velocity</div>
              <div className="w-full h-1.5 rounded-full bg-[#282b29] overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${roadmap.readiness.breakdown?.aptitude ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Progression Loop Indicator ── */}
      <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4 rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] font-mono text-xs shadow-md">
        <span className="text-sage-40 uppercase tracking-wider text-[10px] mr-1 font-semibold">
          Progression:
        </span>
        {[
          { step: "01", label: "Current State", active: roadmap.hasBaseline },
          { step: "02", label: "Weakness", active: roadmap.preparationFocus.items.length > 0 },
          { step: "03", label: "Action", active: roadmap.nextActions.length > 0 },
          { step: "04", label: "Practice", active: roadmap.nextActions.length > 0 },
          { step: "05", label: "Improvement", active: roadmap.hasBaseline },
        ].map((item, idx, arr) => (
          <div key={item.step} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] transition-colors ${
                item.active
                  ? "border-lime-pulse/30 bg-lime-pulse/10 text-lime-pulse font-semibold"
                  : "border-[#3f4a38]/30 bg-[#111413] text-sage-40"
              }`}
            >
              <span className="text-[10px] opacity-80">{item.step}</span>
              <span>{item.label}</span>
            </span>
            {idx < arr.length - 1 && (
              <span className="text-[#3f4a38] text-xs">→</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Zero-Data Experience Banner ── */}
      {!roadmap.hasBaseline && (
        <section className="p-6 sm:p-8 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 relative overflow-hidden shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="w-12 h-12 rounded-full bg-lime-pulse/15 border border-lime-pulse/30 flex items-center justify-center text-lime-pulse shrink-0">
                <span className="material-symbols-outlined text-[24px]">flag</span>
              </div>
              <div>
                <h2 className="text-lg font-bold font-heading text-phosphor-white">
                  Your roadmap will calibrate following your baseline assessment.
                </h2>
                <p className="text-xs text-sage-40 mt-1 leading-relaxed">
                  Complete your baseline diagnostic so Nexora can evaluate your current readiness profile across Core CS domains.
                </p>
              </div>
            </div>
            <Link
              href={baselineHref}
              className="bg-lime-pulse text-void-black font-semibold text-xs px-6 py-2.5 rounded-full hover:bg-mint-frost transition-all flex items-center gap-2 whitespace-nowrap shadow-[0_0_15px_rgba(127,238,100,0.2)] shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Take Baseline Assessment</span>
            </Link>
          </div>
        </section>
      )}

      {/* ── Upcoming Application Focus ── */}
      {nextApplicationEvent && dailyPlan.actions.length > 0 && (
        <section className="p-5 rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] space-y-3 shadow-md">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-phosphor-white">
              {nextApplicationEvent.companyName} {nextApplicationEvent.label.toLowerCase()} in{" "}
              {nextApplicationEvent.daysRemaining !== null ? `${nextApplicationEvent.daysRemaining} day${nextApplicationEvent.daysRemaining === 1 ? "" : "s"}` : "upcoming timeline"}.
            </p>
            <Link
              href={`/applications/${nextApplicationEvent.applicationId}`}
              className="text-xs font-mono text-lime-pulse hover:underline"
            >
              Open application →
            </Link>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
            Recommended focus (Execution Core)
          </p>
          <ul className="space-y-1.5">
            {dailyPlan.actions.slice(0, 3).map((action) => (
              <li key={action.id} className="flex items-center justify-between gap-3">
                <span className="text-xs text-sage-40">
                  <span className="font-mono text-[10px] font-bold text-lime-pulse mr-1">[{action.type}]</span>{" "}
                  {action.title}
                </span>
                <Link
                  href={action.ctaHref}
                  className="text-xs font-mono font-semibold text-lime-pulse hover:text-mint-frost underline whitespace-nowrap"
                >
                  Practice Now →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Main Two-Column Composition ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Preparation Focus & Targets */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: PREPARATION FOCUS */}
          <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono tracking-wider uppercase text-sage-40 font-semibold">
                Preparation Focus
              </h3>
              {roadmap.hasBaseline && (
                <span className="text-[10px] font-mono text-lime-pulse">VERIFIED SIGNALS</span>
              )}
            </div>

            <p className="text-xs text-sage-40 leading-relaxed">
              {roadmap.preparationFocus.summary}
            </p>

            {roadmap.preparationFocus.items.length > 0 ? (
              <div className="space-y-3">
                {roadmap.preparationFocus.items.map((item) => {
                  const displayScore = item.type === "subject" ? item.score : item.accuracy;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-[#111413] border border-[#3f4a38]/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-phosphor-white">
                          {item.name}
                        </span>
                        <span className="font-mono text-xs font-bold text-lime-pulse">
                          {displayScore !== undefined ? `${displayScore}%` : "—"}
                        </span>
                      </div>

                      <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-lime-pulse"
                          style={{ width: `${displayScore || 0}%` }}
                        />
                      </div>

                      <p className="text-[11px] text-sage-40 leading-normal">
                        {item.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : !roadmap.hasBaseline ? (
              <div className="p-4 rounded-xl bg-[#111413] border border-[#3f4a38]/30 text-center font-mono text-xs text-sage-40">
                <p>No assessment data available yet.</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-lime-pulse/10 border border-lime-pulse/30 text-phosphor-white text-xs font-mono">
                No critical gaps detected — maintain momentum with periodic practice.
              </div>
            )}
          </section>

          {/* Card: PLACEMENT TARGET */}
          <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-wider uppercase text-sage-40 font-semibold">
                Placement Targets
              </span>
              <Link
                href="/profile"
                className="text-lime-pulse font-mono text-xs hover:underline inline-flex items-center gap-1"
              >
                <span>{roadmap.targets.configured ? "Manage" : "Set Targets"}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            {roadmap.targets.configured ? (
              <div className="space-y-3">
                {roadmap.targets.primaryRole && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-sage-40 block mb-0.5">
                      Target Role
                    </span>
                    <h3 className="text-sm font-semibold text-phosphor-white">
                      {roadmap.targets.primaryRole.name}
                    </h3>
                  </div>
                )}

                {roadmap.targets.primaryCompany && (
                  <div className="pt-2 border-t border-[#3f4a38]/30">
                    <span className="text-[10px] font-mono uppercase text-sage-40 block mb-0.5">
                      Target Company
                    </span>
                    <p className="text-xs font-semibold text-lime-pulse">
                      {roadmap.targets.primaryCompany.name}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-2 space-y-3">
                <p className="text-xs text-sage-40 leading-relaxed">
                  Configure targets to tailor recommendations to specific company hiring benchmarks.
                </p>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111413] border border-[#3f4a38]/40 text-phosphor-white hover:border-lime-pulse text-xs font-mono font-medium transition-all"
                >
                  <span className="material-symbols-outlined text-[15px] text-lime-pulse">add_circle</span>
                  <span>Set Targets</span>
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Prioritized Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Execution OS: TODAY'S OPERATIONAL FOCUS */}
          {dailyPlan.hasEnoughData && todayActiveAction && (
            <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-lime-pulse animate-pulse" />
                    <span className="text-xs font-mono tracking-wider uppercase text-sage-40 font-semibold">
                      TODAY&apos;S FOCUS
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#282b29] border border-[#3f4a38]/40 text-lime-pulse">
                      {dailyPlan.completedCount} / {dailyPlan.totalCount} COMPLETE
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-phosphor-white">
                    {todayActiveAction.domain} → {todayActiveAction.topic}
                  </h3>
                  <p className="text-xs text-sage-40 mt-1">
                    {todayActiveAction.targetCount} targeted questions • Verified accuracy: {todayActiveAction.accuracy}%
                  </p>
                </div>

                <Link
                  href={todayActiveAction.ctaHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-lime-pulse text-void-black font-semibold hover:bg-mint-frost px-5 py-2.5 text-xs transition-all shrink-0 shadow-[0_0_15px_rgba(127,238,100,0.2)]"
                >
                  <span>
                    {todayActiveAction.status === "COMPLETED"
                      ? "PRACTICE AGAIN"
                      : "START PRACTICE"}
                  </span>
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                </Link>
              </div>
            </section>
          )}

          {/* Prioritized Preparation Sequence */}
          <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-mono tracking-wider uppercase text-sage-40 font-medium">
                  Prioritized Preparation Sequence
                </span>
                <h2 className="text-base font-bold text-phosphor-white mt-0.5">
                  Execution Actions
                </h2>
              </div>
              <span className="text-xs font-mono text-sage-40">
                {roadmap.nextActions.length}{" "}
                {roadmap.nextActions.length === 1 ? "STEP" : "STEPS"}
              </span>
            </div>

            <div className="space-y-4">
              {roadmap.nextActions.map((action) => (
                <article
                  key={action.id}
                  className="p-5 rounded-xl bg-[#111413] border border-[#3f4a38]/30 hover:border-lime-pulse/50 transition-all relative"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold font-mono text-lime-pulse">
                        {action.stepNumber}
                      </span>
                      {action.category && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            action.category === "FIX"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : action.category === "REINFORCE"
                              ? "bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30"
                              : "bg-[#282b29] text-sage-40 border border-[#3f4a38]/40"
                          }`}
                        >
                          {action.category}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-sage-40">
                      {action.domain}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-phosphor-white mb-1">
                    {action.title}
                  </h3>
                  <p className="text-xs text-sage-40 leading-relaxed mb-4">
                    {action.why}
                  </p>

                  <Link
                    href={action.ctaHref}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-lime-pulse/10 text-lime-pulse border border-lime-pulse/30 hover:bg-lime-pulse hover:text-void-black transition-all"
                  >
                    <span>{action.ctaLabel}</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
