import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentPlacementRoadmap } from "@/server/roadmap";
import { getDailyExecutionPlan } from "@/server/placement-execution";
import { getStudentSimulationHistory } from "@/server/placement-simulation";
import { getUpcomingApplicationEvents } from "@/server/application-intelligence";
import { getOutcomePlanContext } from "@/server/outcome-intelligence";
import { Eyebrow } from "@/components/ui/eyebrow";

export default async function RoadmapPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/roadmap");
  }

  const [roadmap, dailyPlan, simulationHistory, upcomingApplicationEvents, outcomePlanContext] = await Promise.all([
    getStudentPlacementRoadmap(session.user.id),
    getDailyExecutionPlan(session.user.id),
    getStudentSimulationHistory(session.user.id),
    getUpcomingApplicationEvents(session.user.id, 30).catch(() => []),
    getOutcomePlanContext(session.user.id).catch(() => null),
  ]);
  const nextApplicationEvent = upcomingApplicationEvents[0] ?? null;
  const latestSimulation = simulationHistory[0] || null;
  const baselineHref = roadmap.baselineTestId
    ? `/tests/${roadmap.baselineTestId}`
    : "/assessment";
  const todayActiveAction = dailyPlan.actions.find((a) => a.status !== "COMPLETED") || dailyPlan.actions[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Page Header */}
      <header className="flex flex-col gap-2 border-b border-circuit-border/60 pb-6">
        <Eyebrow system="NEXORA" category="PLACEMENT ROADMAP">
          PREPARATION LOOP & SEQUENCING
        </Eyebrow>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-heading text-headline-lg font-semibold text-phosphor-white tracking-tight">
              Placement Roadmap
            </h1>
            <p className="text-body-sm text-sage-60 mt-1">
              Your deterministic preparation trajectory, calibrated continuously by verified assessment results.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pills text-caption font-mono font-medium border ${
                roadmap.hasBaseline
                  ? "bg-lime-pulse/15 border-lime-pulse/40 text-phosphor-white font-semibold"
                  : "bg-carbon-veil border-circuit-border text-sage-40"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  roadmap.hasBaseline ? "bg-lime-pulse" : "bg-circuit-border"
                }`}
              />
              {roadmap.hasBaseline ? "CALIBRATED" : "ZERO DATA"}
            </span>
          </div>
        </div>
      </header>

      {/* Progression Loop Indicator */}
      <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4 rounded-cards border border-circuit-border bg-ground-iron font-mono text-caption">
        <span className="text-moss-70 uppercase tracking-wider text-[10px] mr-1 font-semibold">Progression:</span>
        {[
          { step: "01", label: "Current State", active: roadmap.hasBaseline },
          { step: "02", label: "Weakness", active: roadmap.preparationFocus.items.length > 0 },
          { step: "03", label: "Action", active: roadmap.nextActions.length > 0 },
          { step: "04", label: "Practice", active: roadmap.nextActions.length > 0 },
          { step: "05", label: "Improvement", active: roadmap.hasBaseline },
        ].map((item, idx, arr) => (
          <div key={item.step} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] ${
                item.active
                  ? "border-circuit-border bg-carbon-veil text-phosphor-white font-semibold"
                  : "border-circuit-border/40 bg-ground-iron/40 text-sage-40"
              }`}
            >
              <span className="text-[10px] opacity-70 text-lime-pulse">{item.step}</span>
              <span>{item.label}</span>
            </span>
            {idx < arr.length - 1 && (
              <span className="text-circuit-border text-[11px]">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Zero-Data Experience Banner */}
      {!roadmap.hasBaseline && (
        <section
          aria-labelledby="zero-data-heading"
          className="p-6 sm:p-8 rounded-cards bg-ground-iron border border-circuit-border relative overflow-hidden"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="w-12 h-12 rounded-lg bg-carbon-veil border border-circuit-border flex items-center justify-center text-lime-pulse shrink-0">
                <span className="material-symbols-outlined text-[24px]">flag</span>
              </div>
              <div>
                <h2
                  id="zero-data-heading"
                  className="font-heading text-title-md font-semibold text-phosphor-white"
                >
                  Your roadmap will calibrate following your baseline assessment.
                </h2>
                <p className="text-body-sm text-sage-60 mt-1.5 leading-relaxed">
                  Complete your baseline diagnostic so Nexora can evaluate your current readiness profile across Core CS domains.
                </p>
              </div>
            </div>
            <Link
              href={baselineHref}
              id="start-baseline-assessment-btn"
              className="bg-lime-pulse text-void-black font-semibold text-body-sm px-6 py-2.5 rounded-pills hover:bg-[#6edc54] transition-all flex items-center gap-2 whitespace-nowrap shadow-none"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Take Baseline Assessment</span>
            </Link>
          </div>
        </section>
      )}

      {/* Upcoming Application Focus */}
      {nextApplicationEvent && dailyPlan.actions.length > 0 && (
        <section className="p-4 sm:p-5 rounded-cards border border-circuit-border bg-carbon-veil/60 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-body-sm font-semibold text-phosphor-white">
              {nextApplicationEvent.companyName} {nextApplicationEvent.label.toLowerCase()} in{" "}
              {nextApplicationEvent.daysRemaining !== null ? `${nextApplicationEvent.daysRemaining} day${nextApplicationEvent.daysRemaining === 1 ? "" : "s"}` : "upcoming timeline"}.
            </p>
            <Link
              href={`/applications/${nextApplicationEvent.applicationId}`}
              className="text-caption font-mono text-fern-link hover:text-phosphor-white underline"
            >
              Open application
            </Link>
          </div>
          <p className="text-caption font-mono uppercase tracking-wider text-moss-70 font-semibold">
            Recommended focus (Phase 15 execution core)
          </p>
          <ul className="space-y-1.5">
            {dailyPlan.actions.slice(0, 3).map((action) => (
              <li key={action.id} className="flex items-center justify-between gap-3">
                <span className="text-body-sm text-sage-60">
                  <span className="font-mono text-[10px] font-bold text-lime-pulse mr-1">[{action.type}]</span>{" "}
                  {action.title}
                </span>
                <Link
                  href={action.ctaHref}
                  className="text-caption font-mono font-semibold text-fern-link hover:text-phosphor-white underline whitespace-nowrap"
                >
                  Practice Now →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Main Two-Column Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Readiness, Target, Preparation Focus */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: READINESS */}
          <section
            aria-labelledby="readiness-section-heading"
            className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <span
                id="readiness-section-heading"
                className="text-caption font-mono tracking-wider uppercase text-moss-70 font-medium"
              >
                Readiness Score
              </span>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-pills border ${
                  roadmap.hasBaseline
                    ? "bg-lime-pulse/15 border-lime-pulse/40 text-phosphor-white"
                    : "text-sage-40 bg-carbon-veil border-circuit-border/60"
                }`}
              >
                {roadmap.hasBaseline
                  ? roadmap.readiness.level?.label || "COMPETITIVE"
                  : "NOT ASSESSED"}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-bold font-mono text-phosphor-white tracking-tight leading-none">
                {roadmap.hasBaseline && roadmap.readiness.score !== null
                  ? `${roadmap.readiness.score}`
                  : "--"}
              </span>
              <span className="text-body-md font-mono text-sage-40">/ 100</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-carbon-veil h-2 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-lime-pulse transition-all duration-500 rounded-full"
                style={{
                  width: `${roadmap.hasBaseline ? roadmap.readiness.score || 0 : 0}%`,
                }}
              />
            </div>

            <p className="text-caption font-mono text-sage-60 mt-3 leading-relaxed">
              {roadmap.hasBaseline
                ? "Calculated dynamically across 7 placement domains and verified attempt metrics."
                : "Calibrate readiness by completing your baseline diagnostic assessment."}
            </p>

            {roadmap.hasBaseline && roadmap.readiness.breakdown && (
              <div className="mt-4 pt-4 border-t border-circuit-border/60 grid grid-cols-2 gap-2 text-caption font-mono">
                <div className="flex justify-between p-2 rounded bg-carbon-veil/70 border border-circuit-border/40">
                  <span className="text-sage-40">DSA</span>
                  <span className="text-phosphor-white font-semibold">{roadmap.readiness.breakdown.dsa}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-carbon-veil/70 border border-circuit-border/40">
                  <span className="text-sage-40">Core CS</span>
                  <span className="text-phosphor-white font-semibold">{roadmap.readiness.breakdown.coreCs}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-carbon-veil/70 border border-circuit-border/40">
                  <span className="text-sage-40">SQL</span>
                  <span className="text-phosphor-white font-semibold">{roadmap.readiness.breakdown.sql}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-carbon-veil/70 border border-circuit-border/40">
                  <span className="text-sage-40">Aptitude</span>
                  <span className="text-phosphor-white font-semibold">{roadmap.readiness.breakdown.aptitude}%</span>
                </div>
              </div>
            )}
          </section>

          {/* Card 2: PLACEMENT TARGET */}
          <section
            aria-labelledby="placement-target-heading"
            className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <span
                id="placement-target-heading"
                className="text-caption font-mono tracking-wider uppercase text-moss-70 font-medium"
              >
                Placement Targets
              </span>
              <Link
                href="/profile"
                className="text-fern-link font-mono text-caption hover:text-phosphor-white underline inline-flex items-center gap-1"
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
                    <h3 className="font-heading text-title-md font-semibold text-phosphor-white">
                      {roadmap.targets.primaryRole.name}
                    </h3>
                    {roadmap.targets.primaryRole.category && (
                      <span className="text-caption font-mono text-sage-40">
                        {roadmap.targets.primaryRole.category}
                      </span>
                    )}
                  </div>
                )}

                {roadmap.targets.primaryCompany && (
                  <div className="pt-2 border-t border-circuit-border/60">
                    <span className="text-[10px] font-mono uppercase text-sage-40 block mb-0.5">
                      Target Company
                    </span>
                    <p className="text-body font-semibold text-phosphor-white">
                      {roadmap.targets.primaryCompany.name}
                    </p>
                    {roadmap.targets.primaryCompany.industry && (
                      <span className="text-caption font-mono text-sage-40">
                        {roadmap.targets.primaryCompany.industry}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-2 space-y-3">
                <p className="text-body-sm text-sage-60 leading-relaxed">
                  Configure targets to tailor recommendations to specific company hiring benchmarks.
                </p>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-buttons bg-carbon-veil border border-circuit-border text-phosphor-white hover:border-lime-pulse text-caption font-mono font-medium transition-all"
                >
                  <span className="material-symbols-outlined text-[15px] text-lime-pulse">add_circle</span>
                  <span>Set Targets</span>
                </Link>
              </div>
            )}
          </section>

          {/* Card 3: PREPARATION FOCUS */}
          <section
            aria-labelledby="prep-focus-heading"
            className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                id="prep-focus-heading"
                className="text-caption font-mono tracking-wider uppercase text-moss-70 font-medium"
              >
                Preparation Focus
              </span>
              {roadmap.hasBaseline && (
                <span className="text-[10px] font-mono text-lime-pulse">VERIFIED SIGNALS</span>
              )}
            </div>

            <p className="text-body-sm text-sage-60 mb-4 leading-relaxed">
              {roadmap.preparationFocus.summary}
            </p>

            {roadmap.preparationFocus.items.length > 0 ? (
              <div className="space-y-3">
                {roadmap.preparationFocus.items.map((item) => {
                  const displayScore = item.type === "subject" ? item.score : item.accuracy;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-md bg-carbon-veil/70 border border-circuit-border/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm font-semibold text-phosphor-white">
                          {item.name}
                        </span>
                        <span className="font-mono text-caption font-bold text-lime-pulse">
                          {displayScore !== undefined ? `${displayScore}%` : "—"}
                        </span>
                      </div>

                      <div className="w-full bg-ground-iron h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-lime-pulse"
                          style={{ width: `${displayScore || 0}%` }}
                        />
                      </div>

                      <p className="text-[11px] font-mono text-sage-40 leading-normal">
                        {item.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : !roadmap.hasBaseline ? (
              <div className="p-4 rounded-md bg-carbon-veil/40 border border-circuit-border/60 text-center font-mono text-caption text-sage-40">
                <p>No assessment data available yet.</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-md bg-lime-pulse/10 border border-lime-pulse/30 text-phosphor-white text-caption font-mono">
                No critical gaps detected — maintain momentum with periodic practice.
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Next Actions, Preparation Progress */}
        <div className="lg:col-span-7 space-y-6">
          {/* Execution OS: TODAY'S OPERATIONAL FOCUS */}
          {dailyPlan.hasEnoughData && todayActiveAction && (
            <section
              aria-labelledby="today-focus-heading"
              className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-lime-pulse animate-pulse" />
                    <span
                      id="today-focus-heading"
                      className="text-caption font-mono tracking-wider uppercase text-moss-70 font-semibold"
                    >
                      TODAY&apos;S FOCUS
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-pills bg-carbon-veil border border-circuit-border text-sage-40">
                      {dailyPlan.completedCount} / {dailyPlan.totalCount} COMPLETE
                    </span>
                  </div>
                  <h3 className="font-heading text-title-md font-semibold text-phosphor-white">
                    {todayActiveAction.domain} → {todayActiveAction.topic}
                  </h3>
                  <p className="text-body-sm text-sage-60 mt-1">
                    {todayActiveAction.targetCount} targeted questions • Verified accuracy: {todayActiveAction.accuracy}%
                  </p>
                </div>

                <Link
                  href={todayActiveAction.ctaHref}
                  className="inline-flex items-center justify-center gap-2 rounded-buttons bg-carbon-veil border border-circuit-border hover:border-lime-pulse px-5 py-2.5 text-body-sm font-medium text-phosphor-white transition-all shrink-0 shadow-none"
                >
                  <span>
                    {todayActiveAction.status === "COMPLETED"
                      ? "PRACTICE AGAIN"
                      : "START PRACTICE"}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-lime-pulse">play_arrow</span>
                </Link>
              </div>
            </section>
          )}

          {/* Prioritized Preparation Sequence */}
          <section
            aria-labelledby="next-actions-heading"
            className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span
                  id="next-actions-heading"
                  className="text-caption font-mono tracking-wider uppercase text-moss-70 font-medium"
                >
                  Prioritized Preparation Sequence
                </span>
                <h2 className="font-heading text-title-md font-semibold text-phosphor-white mt-0.5">
                  Execution Actions
                </h2>
              </div>
              <span className="text-caption font-mono text-sage-40">
                {roadmap.nextActions.length}{" "}
                {roadmap.nextActions.length === 1 ? "STEP" : "STEPS"}
              </span>
            </div>

            <div className="space-y-4">
              {roadmap.nextActions.map((action) => (
                <article
                  key={action.id}
                  className="p-5 rounded-md bg-carbon-veil/60 border border-circuit-border/60 hover:border-lime-pulse/50 transition-all relative"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold font-mono text-lime-pulse">
                        {action.stepNumber}
                      </span>
                      {action.category && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-pills font-bold uppercase tracking-wider ${
                            action.category === "FIX"
                              ? "bg-[#331c1c] text-[#ff7b72] border border-[#663131]"
                              : action.category === "REINFORCE"
                              ? "bg-lime-pulse/15 text-phosphor-white border border-lime-pulse/40"
                              : "bg-ground-iron text-sage-60 border border-circuit-border"
                          }`}
                        >
                          {action.category}
                        </span>
                      )}
                      <h3 className="text-body font-semibold text-phosphor-white tracking-tight">
                        {action.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {action.accuracy !== undefined && (
                        <span className="text-caption font-mono font-medium px-2 py-0.5 rounded-pills bg-ground-iron border border-circuit-border text-phosphor-white">
                          {action.accuracy}% ACCURACY
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 pl-0 sm:pl-9">
                    <p className="text-body-sm text-sage-60 leading-relaxed">
                      {action.why}
                    </p>
                    {action.evidence && (
                      <p className="text-caption font-mono text-sage-40 leading-relaxed">
                        Evidence: {action.evidence}
                      </p>
                    )}
                    {action.recommendedAction && (
                      <p className="text-body-sm text-phosphor-white font-medium leading-relaxed">
                        Action: {action.recommendedAction}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-circuit-border/40 pl-0 sm:pl-9">
                    <span className="text-caption font-mono text-sage-40 truncate">
                      {action.recommendedTestTitle ?? "Target Practice Flow"}
                    </span>

                    <Link
                      href={action.ctaHref}
                      className="bg-ground-iron border border-circuit-border hover:border-lime-pulse text-phosphor-white font-medium text-caption px-4 py-2 rounded-buttons transition-all inline-flex items-center gap-1.5"
                    >
                      <span>{action.ctaLabel}</span>
                      <span className="material-symbols-outlined text-[15px] text-lime-pulse">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
