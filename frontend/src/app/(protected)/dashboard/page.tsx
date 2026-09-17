import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { profiles, tests, attempts } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getStudentIntelligence } from "@/server/student-intelligence";
import { getStudentPlacementTargets } from "@/server/company-role-intelligence";
import { getPlacementIntelligence } from "@/server/placement-intelligence";
import { getDailyExecutionPlan } from "@/server/placement-execution";
import { getPlacementTargetStrategy } from "@/server/placement-target-strategy";
import { getStudentSimulationHistory } from "@/server/placement-simulation";
import { getResumeHealth } from "@/server/resume-intelligence";
import { getApplicationDashboardCard } from "@/server/application-intelligence";
import { getOutcomeDashboardCard } from "@/server/outcome-intelligence";
import { ResumeHealthCard } from "@/components/resume/resume-health-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getGreeting, formatDateTime, getScoreColor, getSkillLevel } from "@/lib/utils";

/**
 * A single non-critical intelligence widget must never take down the whole
 * dashboard.
 *
 * These reads only feed one card each, so a failure degrades to that card's
 * empty state instead of aborting the render (a missing relation used to bubble
 * out of the server component and render the global ERR_500_SYSTEM_FAULT page).
 * The failure is logged loudly — degraded, never concealed: a silent fallback
 * would hide a real schema/outage problem.
 */
async function degradeOnFailure<T>(
  label: string,
  read: Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await read;
  } catch (error) {
    console.error(
      `[dashboard] ${label} unavailable — rendering the dashboard without it:`,
      error
    );
    return fallback;
  }
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  // 1. Fetch user profile
  const profileList = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const profile = profileList[0];
  const userName = profile?.name || session.user.name || "Engineer";

  // 2. Fetch baseline test id
  const baselineList = await db
    .select({ id: tests.id })
    .from(tests)
    .where(eq(tests.type, "baseline"))
    .limit(1);
  const baselineTestId = baselineList[0]?.id;

  // 3. Centralized Student Intelligence, Phase 14 Action Engine, Phase 15 Execution OS, Phase 16 Target Strategy & Phase 17 Simulation
  const [intelligence, placementIntelligence, placementTargets, dailyPlan, targetStrategy, simulationHistory, resumeHealth, applicationCard, outcomeCard] = await Promise.all([
    getStudentIntelligence(userId),
    getPlacementIntelligence(userId),
    getStudentPlacementTargets(userId),
    getDailyExecutionPlan(userId),
    getPlacementTargetStrategy(userId),
    degradeOnFailure("simulation history", getStudentSimulationHistory(userId), []),
    degradeOnFailure("resume health", getResumeHealth(userId), null),
    degradeOnFailure("application pipeline", getApplicationDashboardCard(userId), null),
    degradeOnFailure("outcome intelligence", getOutcomeDashboardCard(userId), null),
  ]);

  const latestSimulation = simulationHistory[0] || null;

  const readiness = intelligence.readiness;
  const dataSufficiency = intelligence.dataSufficiency;
  const topAction = intelligence.topAction;

  // Preparation focus for the Placement Target card (real readiness data only)
  const prepFocus = (() => {
    if (!dataSufficiency.hasCompletedBaseline) {
      return {
        label: "Calibrate Readiness",
        score: null,
        detail: "Complete your baseline assessment to establish your placement readiness.",
      };
    }
    if (intelligence.weakAreas.length > 0) {
      const wa = intelligence.weakAreas[0];
      return {
        label: `${wa.subjectCode} — ${wa.topicName}`,
        score: wa.accuracy,
        detail: `${wa.topicName} accuracy is ${wa.accuracy}%. Targeted problem-solving required.`,
      };
    }
    const weakest = [...readiness.subjectScores]
      .filter((s) => s.score > 0)
      .sort((a, b) => a.score - b.score)[0];
    if (weakest && weakest.score < 70) {
      return {
        label: `Focus: ${weakest.name}`,
        score: weakest.score,
        detail: `${weakest.score}% accuracy — prioritize this domain.`,
      };
    }
    return {
      label: "No critical gaps",
      score: null,
      detail: "Maintain momentum with consistent mock tests.",
    };
  })();

  // 4. Fetch recent submitted activity
  const recentActivity = await db
    .select({
      id: attempts.id,
      testId: attempts.testId,
      testTitle: tests.title,
      score: attempts.score,
      accuracy: attempts.accuracy,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "submitted")))
    .orderBy(desc(attempts.submittedAt))
    .limit(4);

  // SVG Ring calculation for readiness (circumference = 2 * PI * 54 = ~339.29)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const readinessValue = readiness.score ?? 0;
  const strokeDashoffset = dataSufficiency.hasCompletedBaseline
    ? circumference - (readinessValue / 100) * circumference
    : circumference;

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-circuit-border">
        <div>
          <Eyebrow system="NEXORA" category="COMMAND CENTER">ACTIVE SESSION</Eyebrow>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-phosphor-white">
            {getGreeting()}, {userName.split(" ")[0]}
          </h1>
          <p className="text-body-sm text-sage-60 mt-1 max-w-2xl leading-relaxed">
            Your personalized placement command center. Actionable intelligence, deterministic readiness drivers, and prioritized next steps.
          </p>
        </div>

        {/* Quick Header Badge */}
        <div className="flex items-center gap-2.5 self-start md:self-auto px-3.5 py-2 rounded-cards bg-ground-iron border border-circuit-border">
          <span className="material-symbols-outlined text-[18px] text-lime-pulse">verified</span>
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-mono text-moss-70 uppercase tracking-wider leading-none">Curriculum</span>
            <span className="text-[12px] font-mono font-semibold text-phosphor-white mt-1 leading-none">7 Subjects • 160 Questions</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Span 8) */}
        <div className="lg:col-span-8 space-y-8">
          {/* 1. Placement Readiness Card & Readiness Contributors */}
          <section className="bg-ground-iron border border-circuit-border rounded-cards p-6 sm:p-8 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
              {/* Circular Progress Ring or Clean Uncalibrated Gauge */}
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    fill="none"
                    r={radius}
                    stroke="#1f2a33"
                    strokeWidth="8"
                  />
                  <circle
                    className="text-lime-pulse circle-progress"
                    cx="60"
                    cy="60"
                    fill="none"
                    r={radius}
                    stroke="currentColor"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    strokeWidth="8"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                  {dataSufficiency.hasCompletedBaseline ? (
                    <>
                      <div className="flex items-baseline justify-center font-mono">
                        <span className="text-3xl sm:text-4xl font-bold text-phosphor-white leading-none tracking-tight">
                          {readiness.score}
                        </span>
                        <span className="text-xs sm:text-sm text-sage-40 ml-0.5">/ 100</span>
                      </div>
                      <span
                        className={`text-label-xs font-semibold mt-1.5 uppercase tracking-wider font-mono ${
                          readiness.level?.color || "text-lime-pulse"
                        }`}
                      >
                        {readiness.level?.label || "COMPETITIVE"}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center font-mono">
                        <span className="text-3xl sm:text-4xl font-bold text-sage-40 leading-none tracking-wider">
                          --
                        </span>
                        <span className="text-xs sm:text-sm text-sage-40 ml-0.5">/ 100</span>
                      </div>
                      <span className="text-[10px] font-mono text-sage-40 mt-1.5 uppercase tracking-widest">
                        NOT ASSESSED
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Card Content & CTAs */}
              <div className="flex-1 text-center md:text-left z-10">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-pills bg-carbon-veil border border-circuit-border text-[11px] font-mono text-moss-70 mb-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      dataSufficiency.hasCompletedBaseline ? "bg-lime-pulse animate-pulse" : "bg-sage-40"
                    }`}
                  />
                  <span>
                    {dataSufficiency.hasCompletedBaseline
                      ? "BENCHMARK CALIBRATED"
                      : "READINESS: NOT ASSESSED (UNCALIBRATED)"}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-phosphor-white tracking-tight mb-2">
                  Placement Readiness Score
                </h2>

                <p className="text-body-sm text-sage-60 mb-5 leading-relaxed max-w-xl">
                  {dataSufficiency.hasCompletedBaseline
                    ? "Calculated dynamically across Core CS fundamentals, problem-solving proficiency, and interview speed indexing against standard placement benchmarks."
                    : "Complete your baseline assessment to establish your starting benchmark across all 7 placement domains."}
                </p>

                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {dataSufficiency.hasCompletedBaseline ? (
                    <>
                      <Link
                        href="/tests"
                        className="bg-lime-pulse text-void-black font-mono font-semibold text-body-sm px-6 py-2.5 rounded-buttons hover:bg-lime-pulse/90 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-lime-pulse/50"
                      >
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        Take Mock Test
                      </Link>
                      <Link
                        href="/analytics"
                        className="bg-carbon-veil border border-circuit-border text-phosphor-white font-mono font-medium text-body-sm px-6 py-2.5 rounded-buttons hover:bg-circuit-border/40 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-circuit-border"
                      >
                        <span className="material-symbols-outlined text-[18px]">insights</span>
                        View Detailed Report
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={baselineTestId ? `/tests/${baselineTestId}` : "/assessment"}
                      className="bg-lime-pulse text-void-black font-mono font-semibold text-body-sm px-7 py-3 rounded-buttons hover:bg-lime-pulse/90 transition-all flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-lime-pulse/50 text-base"
                    >
                      <span className="material-symbols-outlined text-[20px]">play_circle</span>
                      Start Baseline Assessment
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Readiness Drivers (Contributors Analysis) */}
            {dataSufficiency.hasCompletedBaseline && (
              <div className="mt-8 pt-6 border-t border-circuit-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-body-sm font-semibold text-phosphor-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-lime-pulse">swap_vert</span>
                    Readiness Contributors
                  </h3>
                  <span className="text-[11px] font-mono text-moss-70">
                    Deterministic Impact Breakdown
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Positive Contributors (Helping) */}
                  <div className="p-3.5 rounded-cards bg-carbon-veil border border-circuit-border">
                    <div className="flex items-center gap-2 mb-2 text-label-xs font-mono font-semibold text-lime-pulse uppercase">
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                      Helping Your Readiness
                    </div>
                    {readiness.positiveContributors.length > 0 ? (
                      <div className="space-y-2">
                        {readiness.positiveContributors.slice(0, 2).map((c) => (
                          <div
                            key={c.code}
                            className="flex items-center justify-between text-body-sm bg-ground-iron p-2 rounded-cards border border-circuit-border"
                          >
                            <span className="text-phosphor-white font-medium">{c.name}</span>
                            <span className="font-mono text-lime-pulse font-semibold">
                              +{c.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] font-mono text-sage-40">
                        Take more tests to establish strong benchmark areas.
                      </p>
                    )}
                  </div>

                  {/* Negative Contributors (Holding it back) */}
                  <div className="p-3.5 rounded-cards bg-carbon-veil border border-rose-500/30">
                    <div className="flex items-center gap-2 mb-2 text-label-xs font-mono font-semibold text-rose-400 uppercase">
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                      Holding It Back
                    </div>
                    {readiness.negativeContributors.length > 0 ? (
                      <div className="space-y-2">
                        {readiness.negativeContributors.slice(0, 2).map((c) => (
                          <div
                            key={c.code}
                            className="flex items-center justify-between text-body-sm bg-ground-iron p-2 rounded-cards border border-rose-500/20"
                          >
                            <span className="text-phosphor-white font-medium">{c.name}</span>
                            <span className="font-mono text-rose-400 font-semibold">
                              {c.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] font-mono text-lime-pulse">
                        No critical deficits holding your score back.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 3. Placement Execution OS: "WHAT SHOULD I DO TODAY?" */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-lime-pulse font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse animate-pulse" />
                  <span>Execution OS • Your Next Actions</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-phosphor-white tracking-tight mt-0.5">
                  WHAT SHOULD I DO TODAY?
                </h2>
                <p className="text-body-sm text-sage-60 mt-0.5">
                  Your Next Actions: Daily prioritized execution plan derived from your verified test performance
                </p>
              </div>
              <Link
                href="/roadmap"
                className="text-lime-pulse font-mono text-[12px] hover:underline transition-colors flex items-center gap-1 font-medium"
              >
                <span>View Roadmap</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            {/* Zero-Data / Empty Experience */}
            {!dailyPlan.hasEnoughData ? (
              <div className="p-6 sm:p-8 rounded-cards bg-ground-iron border border-circuit-border text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-carbon-veil border border-circuit-border flex items-center justify-center text-lime-pulse mb-1">
                  <span className="material-symbols-outlined text-[28px]">flag</span>
                </div>
                <div className="max-w-md">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-lime-pulse font-bold">
                    CALIBRATION REQUIRED
                  </span>
                  <h3 className="text-title-md font-bold text-phosphor-white mt-1 mb-1.5">
                    BUILD YOUR BASELINE
                  </h3>
                  <p className="text-body-sm text-sage-60 leading-relaxed">
                    Complete an assessment to unlock your personalized preparation plan. Nexora analyzes your verified responses across 7 core placement domains.
                  </p>
                </div>

                <Link
                  href={baselineTestId ? `/tests/${baselineTestId}` : "/assessment"}
                  className="bg-lime-pulse text-void-black font-mono font-semibold text-body-sm px-7 py-3 rounded-buttons hover:bg-lime-pulse/90 transition-all inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  Start Assessment
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Partial-Data State Banner */}
                {dailyPlan.isPartialData && (
                  <div className="p-4 rounded-cards bg-carbon-veil border border-circuit-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[22px] text-amber-400">info</span>
                      <div>
                        <h4 className="text-body-sm font-bold text-phosphor-white">
                          KEEP BUILDING YOUR BASELINE
                        </h4>
                        <p className="text-[12px] font-mono text-sage-40 mt-0.5">
                          You have enough data for an initial recommendation, but more practice will make your plan more precise.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/tests"
                      className="text-lime-pulse font-mono text-[12px] font-semibold hover:underline whitespace-nowrap"
                    >
                      CONTINUE PRACTICE →
                    </Link>
                  </div>
                )}

                {/* Compact Execution Progress Component */}
                <div className="p-5 sm:p-6 rounded-cards bg-ground-iron border border-circuit-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lime-pulse text-[20px]">task_alt</span>
                      <h3 className="text-title-md font-bold text-phosphor-white">
                        TODAY&apos;S PROGRESS
                      </h3>
                    </div>
                    <div className="flex items-baseline gap-2 font-mono">
                      <span className="text-2xl font-bold text-phosphor-white">
                        {dailyPlan.completedCount} / {dailyPlan.totalCount}
                      </span>
                      <span className="text-[12px] text-sage-40">actions complete</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#1f2a33] h-2 rounded-pills overflow-hidden">
                    <div
                      className="h-full bg-lime-pulse transition-all duration-500 rounded-pills"
                      style={{ width: `${dailyPlan.progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-moss-70">
                    <span className="text-lime-pulse font-semibold">
                      {dailyPlan.completedCount} completed
                    </span>
                    <span className="font-semibold text-phosphor-white">
                      {dailyPlan.progressPercent}%
                    </span>
                    <span>
                      {dailyPlan.remainingCount} remaining
                    </span>
                  </div>
                </div>

                {/* Execution Plan Action Cards */}
                {dailyPlan.actions.map((action) => {
                  const orderStr = action.order < 10 ? `0${action.order}` : `${action.order}`;
                  const isCompleted = action.status === "COMPLETED";
                  const isInProgress = action.status === "IN_PROGRESS";
                  const isPartiallyCompleted = action.status === "PARTIALLY_COMPLETED";

                  return (
                    <div
                      key={action.id}
                      className={`p-5 sm:p-6 rounded-cards border transition-all relative overflow-hidden ${
                        isCompleted
                          ? "bg-ground-iron/60 border-circuit-border opacity-80"
                          : isInProgress
                          ? "bg-carbon-veil border-lime-pulse/50 shadow-sm"
                          : isPartiallyCompleted
                          ? "bg-carbon-veil border-amber-400/40"
                          : action.order === 1
                          ? "bg-ground-iron border-lime-pulse/40"
                          : "bg-ground-iron border-circuit-border hover:border-moss-70/40"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold font-mono text-lime-pulse">
                            {orderStr}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-pills font-bold uppercase tracking-wider ${
                                action.type === "FIX"
                                  ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                                  : action.type === "REINFORCE"
                                  ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                                  : "bg-carbon-veil text-moss-80 border border-circuit-border"
                              }`}
                            >
                              {action.type}
                            </span>
                            <span className="text-[11px] font-mono text-sage-40 uppercase">
                              {action.impact}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {isCompleted ? (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-pills bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              COMPLETED
                            </span>
                          ) : isPartiallyCompleted ? (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-pills bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">pending</span>
                              PARTIAL PROGRESS
                            </span>
                          ) : isInProgress ? (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-pills bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30 flex items-center gap-1 animate-pulse">
                              <span className="material-symbols-outlined text-[14px]">autorenew</span>
                              IN PROGRESS
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-pills bg-carbon-veil text-sage-40 border border-circuit-border">
                              PENDING
                            </span>
                          )}
                          <span className="text-label-xs font-mono text-lime-pulse font-semibold bg-carbon-veil px-2.5 py-1 rounded-pills border border-circuit-border">
                            {action.accuracy}% ACCURACY
                          </span>
                          {action.targetFocus && (
                            <span className="text-[10px] font-mono text-lime-pulse bg-lime-pulse/10 border border-lime-pulse/30 px-2 py-0.5 rounded-pills">
                              TARGET FOCUS
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold text-phosphor-white tracking-tight mb-2">
                        {isCompleted && (
                          <span className="text-lime-pulse mr-2">✓</span>
                        )}
                        {action.domain} → {action.topic}
                      </h3>

                      <div className="space-y-2 mb-5 max-w-3xl">
                        <div className="flex items-center gap-3 text-[12px] font-mono text-sage-40">
                          <span className="text-phosphor-white font-semibold">
                            {action.completedQuestionsCount !== undefined && action.completedQuestionsCount > 0
                              ? `${action.completedQuestionsCount} / ${action.targetCount} questions answered`
                              : `${action.targetCount} targeted questions`}
                          </span>
                          <span>•</span>
                          <span>Current accuracy: {action.accuracy}%</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-sage-40 block mb-0.5">
                            Why:
                          </span>
                          <p className="text-body-sm text-sage-60 leading-relaxed">
                            {action.reason}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-sage-40 block mb-0.5">
                            Evidence:
                          </span>
                          <p className="text-[12px] font-mono text-sage-40 leading-relaxed">
                            {action.evidence}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-sage-40 block mb-0.5">
                            Action:
                          </span>
                          <p className="text-body-sm text-phosphor-white font-medium leading-relaxed">
                            {action.action}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-circuit-border">
                        {isCompleted ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-buttons bg-lime-pulse/10 border border-lime-pulse/30 text-lime-pulse text-body-sm font-semibold font-mono">
                              <span className="material-symbols-outlined text-[16px]">check</span>
                              Completed Today
                            </span>
                            <Link
                              href={action.ctaHref}
                              className="text-sage-40 hover:text-phosphor-white text-[12px] font-mono underline transition-colors"
                            >
                              Practice again
                            </Link>
                          </div>
                        ) : isPartiallyCompleted || isInProgress ? (
                          <Link
                            href={action.ctaHref}
                            className="bg-lime-pulse text-void-black font-semibold font-mono text-body-sm px-6 py-2.5 rounded-buttons hover:bg-lime-pulse/90 transition-colors inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-lime-pulse/50"
                          >
                            <span>CONTINUE</span>
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          </Link>
                        ) : (
                          <Link
                            href={action.ctaHref}
                            className="bg-lime-pulse text-void-black font-semibold font-mono text-body-sm px-6 py-2.5 rounded-buttons hover:bg-lime-pulse/90 transition-colors inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-lime-pulse/50"
                          >
                            <span>
                              {action.type === "REVIEW"
                                ? "Review"
                                : action.practiceTarget?.testId
                                ? "Start Test"
                                : "Practice"}
                            </span>
                            <span className="material-symbols-outlined text-[18px]">
                              {action.type === "REVIEW" ? "sync" : "play_arrow"}
                            </span>
                          </Link>
                        )}
                        <span className="text-[12px] font-mono text-sage-40">
                          Direct Practice: <span className="text-phosphor-white">{action.domain}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Resume-aligned actions (Phase 18 integration with the execution loop).
                    These never replace measured preparation tasks: a RESUME action asks the
                    student to add evidence they already have, and an ALIGN action is only
                    raised when Preparation OS independently measured the weakness. */}
                {dailyPlan.resumeActions && dailyPlan.resumeActions.length > 0 && (
                  <div className="p-4 rounded-cards bg-carbon-veil border border-circuit-border space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-moss-70 font-semibold">
                        RESUME-ALIGNED ACTIONS
                      </span>
                      <Link href="/resume" className="text-[11px] font-mono text-lime-pulse hover:underline">
                        Open Resume Intelligence
                      </Link>
                    </div>
                    {dailyPlan.resumeActions.slice(0, 3).map((action) => (
                      <div
                        key={action.id}
                        className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-t border-circuit-border pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-pills font-bold uppercase tracking-wider ${
                              action.type === "RESUME"
                                ? "bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30"
                                : "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                            }`}
                          >
                            {action.type === "RESUME" ? "RESUME" : "ALIGN"}
                          </span>
                          <p className="text-body-sm text-phosphor-white mt-1.5">{action.title}</p>
                          <p className="text-[11px] font-mono text-sage-60 leading-relaxed mt-1">
                            {action.reason}
                          </p>
                          <p className="text-[11px] font-mono text-sage-40 mt-1">
                            Evidence: {action.evidence}
                          </p>
                        </div>
                        {action.ctaHref && (
                          <Link
                            href={action.ctaHref}
                            className="shrink-0 text-[11px] font-mono px-3 py-1.5 rounded-buttons border border-circuit-border bg-ground-iron text-moss-80 hover:text-phosphor-white transition-colors self-start"
                          >
                            {action.ctaLabel}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Preparation History (Optional View) */}
                {dailyPlan.history && dailyPlan.history.length > 0 && (
                  <div className="p-4 rounded-cards bg-carbon-veil border border-circuit-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-moss-70 font-semibold">
                        PREPARATION HISTORY
                      </span>
                      <span className="text-[10px] font-mono text-sage-40">
                        Verified Daily Completion
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 font-mono text-[12px]">
                      {dailyPlan.history.map((h) => (
                        <div
                          key={h.date}
                          className="p-2 rounded-cards bg-ground-iron border border-circuit-border flex flex-col items-center text-center"
                        >
                          <span className="text-sage-40 text-[10px]">
                            {new Date(h.date + "T00:00:00").toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="font-bold text-phosphor-white mt-0.5">
                            {h.completedCount} / {h.totalCount}
                          </span>
                          <span className="text-[10px] text-lime-pulse">
                            {h.percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 4. Skill Overview Grid (All 7 Placement Domains) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-title-md font-semibold text-phosphor-white">
                  Subject Performance
                </h2>
                <p className="text-label-xs text-moss-70 mt-0.5">
                  Performance across 7 placement domains
                </p>
              </div>
              <Link
                href="/analytics"
                className="text-lime-pulse font-mono text-[12px] hover:underline transition-colors flex items-center gap-1 font-medium"
              >
                <span>Full Analytics</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {readiness.subjectScores.map((subj) => {
                const skillLevel = getSkillLevel(subj.score);
                const isTested = dataSufficiency.hasCompletedBaseline && subj.score > 0;

                const displayName =
                  subj.code === "APT"
                    ? "Aptitude"
                    : subj.code === "DBMS"
                    ? "DBMS"
                    : subj.code === "DSA"
                    ? "DSA"
                    : subj.code === "OS"
                    ? "OS"
                    : subj.code === "CN"
                    ? "Networks"
                    : subj.code === "OOP"
                    ? "OOP"
                    : subj.code === "SQL"
                    ? "SQL"
                    : subj.name;

                return (
                  <div
                    key={subj.subjectId}
                    className="bg-ground-iron border border-circuit-border rounded-cards p-4 flex min-w-0 flex-col justify-between gap-3 hover:border-moss-70/40 hover:bg-carbon-veil transition-all"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <span className="min-w-0 text-body-sm font-semibold text-phosphor-white" title={subj.name}>
                        {displayName}
                      </span>
                    </div>

                    <div>
                      <div className="text-2xl font-bold font-mono text-phosphor-white tracking-tight">
                        {isTested ? (
                          `${subj.score}%`
                        ) : (
                          <span className="text-sage-40">—</span>
                        )}
                      </div>
                      <span
                        className={`mt-1 inline-flex text-[9px] font-mono px-1.5 py-0.5 rounded-pills font-semibold tracking-wider ${
                          isTested
                            ? `${skillLevel.bgClass} ${skillLevel.colorClass}`
                            : "bg-carbon-veil text-sage-40 border border-circuit-border"
                        }`}
                      >
                        {isTested ? subj.status : "NOT TESTED"}
                      </span>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full bg-[#1f2a33] h-1 rounded-pills overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-pills ${
                          isTested ? "bg-lime-pulse" : "bg-transparent"
                        }`}
                        style={{
                          width: isTested ? `${subj.score}%` : "0%",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. Critical Focus Areas (Weak Topics) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-title-md font-semibold text-phosphor-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-rose-400">track_changes</span>
                Critical Focus Areas
              </h2>
              {intelligence.weakAreas.length > 0 && (
                <span className="text-[11px] font-mono text-moss-70">
                  {intelligence.weakAreas.length}{" "}
                  {intelligence.weakAreas.length === 1 ? "TOPIC" : "TOPICS"} DETECTED
                </span>
              )}
            </div>

            {intelligence.weakAreas.length > 0 ? (
              <div className="flex flex-col gap-3">
                {intelligence.weakAreas.slice(0, 4).map((wa) => (
                  <div
                    key={wa.topicId}
                    className="bg-ground-iron border border-circuit-border rounded-cards p-4 flex items-center justify-between hover:border-moss-70/40 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-cards flex items-center justify-center border ${
                          wa.priority === "CRITICAL"
                            ? "bg-rose-950/40 text-rose-400 border-rose-800/40"
                            : "bg-amber-950/40 text-amber-300 border-amber-800/40"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {wa.subjectCode === "OS"
                            ? "memory"
                            : wa.subjectCode === "DSA"
                            ? "account_tree"
                            : wa.subjectCode === "SQL" || wa.subjectCode === "DBMS"
                            ? "database"
                            : "insights"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-body-sm text-phosphor-white font-medium">
                          {wa.topicName}
                        </h3>
                        <p className="text-label-xs text-sage-40 mt-0.5 font-mono">
                          {wa.subjectCode} • {wa.accuracy}% accuracy ({wa.totalAttempts} questions)
                          {wa.trend === "declining" && " • declining trend"}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/tests"
                      className="text-lime-pulse font-mono text-[12px] uppercase hover:bg-carbon-veil px-3 py-1.5 rounded-buttons transition-colors hidden sm:flex items-center gap-1 font-semibold"
                    >
                      <span>Practice Topic</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-cards bg-ground-iron border border-circuit-border text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-carbon-veil border border-circuit-border flex items-center justify-center text-lime-pulse mb-3">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <h3 className="text-body-sm font-semibold text-phosphor-white mb-1">
                  {dataSufficiency.hasCompletedBaseline ? "No Critical Weaknesses" : "Awaiting Evaluation"}
                </h3>
                <p className="text-label-xs text-sage-60 max-w-md leading-relaxed">
                  {dataSufficiency.hasCompletedBaseline
                    ? "Great performance! No topics are currently below the accuracy threshold. Keep taking mock tests to maintain consistency."
                    : "Focus areas will appear here after your baseline assessment provides real performance data."}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column (Span 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Placement Target & Preparation Roadmap Card (Section 4 Hierarchy) */}
          <section className="bg-ground-iron border border-circuit-border rounded-cards p-5 sm:p-6 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-lime-pulse font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">target</span>
                Placement Target
              </span>
              <Link
                href="/profile"
                className="text-moss-80 hover:text-phosphor-white text-[11px] font-mono font-medium underline transition-colors"
              >
                {placementTargets.configured ? "Manage Targets" : "Set Targets"}
              </Link>
            </div>

            {placementTargets.configured ? (
              <div className="space-y-3.5">
                {/* Primary Target Role & Company */}
                <div>
                  <h3 className="text-xl font-bold text-phosphor-white tracking-tight">
                    {placementTargets.primaryRole?.name || "Target Role Not Selected"}
                  </h3>
                  {placementTargets.primaryCompany && (
                    <p className="text-body-md font-semibold text-lime-pulse mt-0.5">
                      {placementTargets.primaryCompany.name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-sage-40 mt-1.5">
                    <span>
                      {placementTargets.targetCount}{" "}
                      {placementTargets.targetCount === 1 ? "target company" : "target companies"}
                    </span>
                    <span>·</span>
                    <span>
                      {placementTargets.roleCount}{" "}
                      {placementTargets.roleCount === 1 ? "target role" : "target roles"}
                    </span>
                  </div>
                </div>

                {/* Preparation Focus */}
                <div className="pt-3 border-t border-circuit-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-moss-70 font-bold block">
                      Preparation Focus
                    </span>
                    {prepFocus.score !== null && (
                      <span className="text-[11px] font-mono font-bold text-rose-400">
                        {prepFocus.score}%
                      </span>
                    )}
                  </div>
                  <div className="text-body-sm font-bold text-phosphor-white">
                    {prepFocus.label}
                  </div>
                  <p className="text-[12px] font-mono text-sage-60 leading-relaxed">
                    {prepFocus.detail}
                  </p>
                </div>

                {/* Highest-Priority Next Action */}
                {dataSufficiency.hasCompletedBaseline && topAction && (
                  <div className="pt-3 border-t border-circuit-border space-y-1">
                    <span className="text-[10px] font-mono uppercase text-moss-70 font-bold block">
                      Next Action
                    </span>
                    <p className="text-[12px] font-medium text-lime-pulse truncate">
                      {topAction.title}
                    </p>
                  </div>
                )}

                {/* Target Strategy Alignment (Phase 16) */}
                {dataSufficiency.hasCompletedBaseline && targetStrategy.readiness.targetScore !== null && (
                  <div className="pt-3 border-t border-circuit-border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-moss-70 font-bold block">
                        Target Readiness
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase text-lime-pulse">
                        {targetStrategy.readiness.targetLevel || "ON TRACK"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono text-lime-pulse">
                        {targetStrategy.readiness.targetScore}%
                      </span>
                      <span className="text-[11px] font-mono text-amber-300">
                        {targetStrategy.gaps.length} {targetStrategy.gaps.length === 1 ? "priority gap" : "priority gaps"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Link
                    href="/target"
                    id="dashboard-view-target-strategy-btn"
                    className="flex-1 bg-carbon-veil border border-circuit-border text-phosphor-white font-medium text-[12px] py-2.5 px-3 rounded-buttons hover:bg-circuit-border/40 transition-colors flex items-center justify-center gap-1.5 font-mono"
                  >
                    <span className="material-symbols-outlined text-[15px]">track_changes</span>
                    <span>View Target Strategy</span>
                  </Link>
                  <Link
                    href="/roadmap"
                    id="dashboard-view-roadmap-btn"
                    className="bg-lime-pulse text-void-black font-semibold text-[12px] py-2.5 px-4 rounded-buttons hover:bg-lime-pulse/90 transition-colors flex items-center justify-center gap-1.5 font-mono"
                  >
                    <span>View Roadmap</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                <p className="text-body-sm text-sage-40 font-mono text-[12px]">
                  No target role or company selected. Set placement targets to focus your preparation roadmap.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href="/profile"
                    className="flex-1 py-2 px-3 rounded-buttons border border-lime-pulse/40 bg-lime-pulse/10 hover:bg-lime-pulse/20 text-lime-pulse text-[12px] font-medium font-mono transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">add_circle</span>
                    <span>Set Targets</span>
                  </Link>
                  <Link
                    href="/target"
                    className="py-2 px-3 rounded-buttons border border-circuit-border bg-carbon-veil hover:bg-circuit-border/40 text-sage-60 text-[12px] font-mono transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <span>Strategy</span>
                    <span className="material-symbols-outlined text-[15px]">track_changes</span>
                  </Link>
                  <Link
                    href="/roadmap"
                    className="py-2 px-3 rounded-buttons border border-circuit-border bg-carbon-veil hover:bg-circuit-border/40 text-phosphor-white text-[12px] font-mono transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <span>View Roadmap</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* Resume Health Card (Phase 18) — compact by design; ATS compatibility is
              reported as its own dimension and never folded into readiness math. */}
          {resumeHealth && <ResumeHealthCard health={resumeHealth} />}

          {/* Application Pipeline Card (Phase 19) — compact by design; only counts and
              the next real deadline. Full history lives in /applications. */}
          {applicationCard && applicationCard.show && (
            <section className="bg-ground-iron border border-circuit-border rounded-cards p-5 sm:p-6 space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-lime-pulse font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">work</span>
                  Application Pipeline
                </span>
                <Link
                  href={applicationCard.ctaHref}
                  className="text-moss-80 hover:text-phosphor-white text-[11px] font-mono font-medium underline transition-colors"
                >
                  {applicationCard.ctaLabel}
                </Link>
              </div>

              <p className="text-headline-md font-bold text-phosphor-white tracking-tight">
                {applicationCard.activeApplications}{" "}
                {applicationCard.activeApplications === 1 ? "Active Application" : "Active Applications"}
              </p>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-cards bg-carbon-veil border border-circuit-border px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-moss-70 font-bold">Interviews</p>
                  <p className="text-body-md font-bold text-phosphor-white">{applicationCard.interviews}</p>
                </div>
                <div className="rounded-cards bg-carbon-veil border border-circuit-border px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-moss-70 font-bold">Assessments</p>
                  <p className="text-body-md font-bold text-phosphor-white">{applicationCard.assessments}</p>
                </div>
                <div className="rounded-cards bg-carbon-veil border border-circuit-border px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-moss-70 font-bold">Offers</p>
                  <p className="text-body-md font-bold text-phosphor-white">{applicationCard.offers}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-circuit-border flex items-center justify-between">
                <span className="text-[11px] font-mono text-sage-40">
                  {applicationCard.nextDeadline
                    ? `Next deadline: ${applicationCard.nextDeadline.companyName} — ${new Date(applicationCard.nextDeadline.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : "No upcoming deadlines"}
                </span>
                <Link
                  href={applicationCard.ctaHref}
                  className="inline-flex items-center gap-1 text-[12px] font-mono font-semibold text-lime-pulse hover:underline"
                >
                  <span>Track</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </section>
          )}

          {/* Placement Outcomes Card (Phase 20) — compact, descriptive only.
              Counts and the most recent recorded outcome; no success score. */}
          {outcomeCard && outcomeCard.show && (
            <section className="bg-ground-iron border border-circuit-border rounded-cards p-5 sm:p-6 space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-lime-pulse font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">insights</span>
                  Placement Outcomes
                </span>
                <Link
                  href={outcomeCard.ctaHref}
                  className="text-moss-80 hover:text-phosphor-white text-[11px] font-mono font-medium underline transition-colors"
                >
                  {outcomeCard.ctaLabel}
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-cards bg-carbon-veil border border-circuit-border px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-moss-70 font-bold">Applications</p>
                  <p className="text-body-md font-bold text-phosphor-white">{outcomeCard.applications}</p>
                </div>
                <div className="rounded-cards bg-carbon-veil border border-circuit-border px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-moss-70 font-bold">Interviews</p>
                  <p className="text-body-md font-bold text-phosphor-white">{outcomeCard.interviews}</p>
                </div>
                <div className="rounded-cards bg-carbon-veil border border-circuit-border px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-moss-70 font-bold">Offers</p>
                  <p className="text-body-md font-bold text-phosphor-white">{outcomeCard.offers}</p>
                </div>
              </div>

              {outcomeCard.recentOutcome && (
                <div className="pt-3 border-t border-circuit-border">
                  <p className="text-[10px] font-mono uppercase text-moss-70 font-bold">Recent outcome</p>
                  <p className="text-body-sm font-semibold text-phosphor-white mt-1">
                    {outcomeCard.recentOutcome.companyName}
                  </p>
                  <p className="text-[11px] font-mono text-sage-40">{outcomeCard.recentOutcome.label}</p>
                  {outcomeCard.observedFocus.length > 0 && (
                    <p className="text-[11px] text-sage-60 mt-1.5 font-mono">
                      Observed focus: {outcomeCard.observedFocus.join(" · ")}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[10px] text-sage-40 font-mono">{outcomeCard.disclaimer}</p>
            </section>
          )}

          {/* Placement Simulation Card (Phase 17) */}
          <section className="bg-ground-iron border border-circuit-border rounded-cards p-5 sm:p-6 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-lime-pulse font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                Placement Simulation
              </span>
              <Link
                href="/simulation"
                className="text-moss-80 hover:text-phosphor-white text-[11px] font-mono font-medium underline transition-colors"
              >
                {latestSimulation ? "Simulation Hub" : "Launch"}
              </Link>
            </div>

            {latestSimulation ? (
              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-body-md font-bold text-phosphor-white tracking-tight">
                      {latestSimulation.companyName ? `${latestSimulation.companyName} — ` : ""}{latestSimulation.roleName}
                    </h3>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-pills border ${
                        latestSimulation.status === "completed"
                          ? "bg-lime-pulse/10 border-lime-pulse/30 text-lime-pulse"
                          : "bg-carbon-veil border-circuit-border text-moss-80"
                      }`}
                    >
                      {latestSimulation.status === "completed" ? "COMPLETED" : `ROUND ${latestSimulation.currentRoundOrder}/5`}
                    </span>
                  </div>
                  <p className="text-[12px] font-mono text-sage-40 mt-0.5">
                    {latestSimulation.status === "completed"
                      ? `Simulation Readiness: ${latestSimulation.overallReadinessScore}%`
                      : "Simulation in progress"}
                  </p>
                </div>

                <div className="pt-3 border-t border-circuit-border flex items-center justify-between">
                  <span className="text-[11px] font-mono text-sage-40">
                    {latestSimulation.status === "completed"
                      ? `Verdict: ${latestSimulation.readinessLevel || "Evaluated"}`
                      : `Next: Round ${latestSimulation.currentRoundOrder}`}
                  </span>
                  <Link
                    href={`/simulation/${latestSimulation.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-mono font-semibold text-lime-pulse hover:underline"
                  >
                    <span>{latestSimulation.status === "completed" ? "View Report" : "Resume"}</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                <p className="text-body-sm text-sage-40 font-mono text-[12px]">
                  Simulate your target company&apos;s full 5-round hiring process: Screening, Coding, Debugging, AI Tech &amp; HR.
                </p>
                <Link
                  href="/simulation"
                  className="w-full py-2 px-3 rounded-buttons border border-lime-pulse/40 bg-lime-pulse/10 hover:bg-lime-pulse/20 text-lime-pulse text-[12px] font-medium font-mono transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">play_circle</span>
                  <span>Start Placement Simulation</span>
                </Link>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className="bg-ground-iron border border-circuit-border rounded-cards p-6">
            <h2 className="text-title-md font-semibold text-phosphor-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-lime-pulse">bolt</span>
              Quick Actions
            </h2>
            <div className="flex flex-col gap-3">
              {/* PRIMARY ACTION */}
              <Link
                href="/simulation"
                className="w-full h-11 bg-lime-pulse text-void-black font-semibold font-mono text-body-sm px-4 rounded-buttons hover:bg-lime-pulse/90 transition-all flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-lime-pulse/50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px]">terminal</span>
                  Run Placement Simulation
                </span>
                <span className="material-symbols-outlined text-[18px] opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  arrow_forward
                </span>
              </Link>

              {/* SECONDARY ACTION 1 */}
              <Link
                href="/tests"
                className="w-full h-11 bg-carbon-veil border border-circuit-border text-phosphor-white hover:bg-circuit-border/40 font-medium font-mono text-body-sm px-4 rounded-buttons transition-all flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-circuit-border"
              >
                <span className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-moss-70 group-hover:text-phosphor-white transition-colors">
                    quiz
                  </span>
                  Take Mock Test
                </span>
                <span className="material-symbols-outlined text-[18px] opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  arrow_forward
                </span>
              </Link>

              {/* SECONDARY ACTION 2 */}
              <Link
                href="/analytics"
                className="w-full h-11 bg-carbon-veil border border-circuit-border text-phosphor-white hover:bg-circuit-border/40 font-medium font-mono text-body-sm px-4 rounded-buttons transition-all flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-circuit-border"
              >
                <span className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-moss-70 group-hover:text-phosphor-white transition-colors">
                    insights
                  </span>
                  View Intelligence & Analytics
                </span>
                <span className="material-symbols-outlined text-[18px] opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  arrow_forward
                </span>
              </Link>
            </div>
          </section>

          {/* Test Discipline & Optimization Signals (if issues exist) */}
          {dataSufficiency.hasCompletedBaseline &&
            (intelligence.discipline.hasNegativeMarkingIssue ||
              intelligence.discipline.hasUnansweredIssue) && (
              <section className="bg-ground-iron border border-amber-500/30 rounded-cards p-5">
                <h3 className="text-body-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Exam Strategy Optimization
                </h3>
                <div className="space-y-2.5 text-label-xs font-mono">
                  {intelligence.discipline.hasNegativeMarkingIssue && (
                    <div className="p-2.5 rounded-cards bg-carbon-veil border border-circuit-border text-sage-60 leading-relaxed">
                      <span className="text-phosphor-white font-bold block mb-0.5">
                        Negative Marking Penalty
                      </span>
                      Losing ~{intelligence.discipline.negativeMarkingLossAvg.toFixed(1)} marks per test to incorrect answers. Reduce guessing.
                    </div>
                  )}
                  {intelligence.discipline.hasUnansweredIssue && (
                    <div className="p-2.5 rounded-cards bg-carbon-veil border border-circuit-border text-sage-60 leading-relaxed">
                      <span className="text-phosphor-white font-bold block mb-0.5">
                        Unanswered Questions
                      </span>
                      {intelligence.discipline.unansweredRate}% of questions left blank ({intelligence.discipline.unansweredCount} questions). Improve test pacing.
                    </div>
                  )}
                </div>
              </section>
            )}

          {/* Recent Activity Timeline */}
          <section className="bg-ground-iron border border-circuit-border rounded-cards p-6 flex-1">
            <h2 className="text-title-md font-semibold text-phosphor-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-moss-70">schedule</span>
              Recent Activity
            </h2>

            {recentActivity.length > 0 ? (
              <div className="relative border-l border-circuit-border ml-3 space-y-5 pb-2">
                {recentActivity.map((act) => {
                  const score = act.score ?? 0;
                  const dotColor =
                    score >= 75
                      ? "bg-lime-pulse"
                      : score >= 50
                      ? "bg-amber-300"
                      : "bg-rose-400";

                  return (
                    <div key={act.id} className="relative pl-5">
                      <div
                        className={`absolute w-2.5 h-2.5 ${dotColor} rounded-full -left-[5.5px] top-1.5 ring-4 ring-ground-iron`}
                      />
                      <div className="flex flex-col">
                        <span className="text-[11px] text-sage-40 font-mono mb-0.5">
                          {act.submittedAt ? formatDateTime(act.submittedAt) : "Recently"}
                        </span>
                        <Link
                          href={`/tests/${act.testId}/result?attemptId=${act.id}`}
                          className="text-body-sm text-phosphor-white hover:text-lime-pulse font-medium transition-colors"
                        >
                          {act.testTitle}
                        </Link>
                        <span className="text-[12px] font-mono mt-1 text-sage-60">
                          Score:{" "}
                          <span className={getScoreColor(score)}>
                            {score}/100
                          </span>{" "}
                          • {act.accuracy}% Acc
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-cards bg-carbon-veil border border-circuit-border text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-ground-iron border border-circuit-border flex items-center justify-center text-moss-70 mb-3">
                  <span className="material-symbols-outlined text-[20px]">history</span>
                </div>
                <h3 className="text-body-sm font-semibold text-phosphor-white mb-1">
                  No activity yet
                </h3>
                <p className="text-label-xs text-sage-60 max-w-xs leading-relaxed font-mono">
                  Complete your baseline assessment to start building your placement profile and test history.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
