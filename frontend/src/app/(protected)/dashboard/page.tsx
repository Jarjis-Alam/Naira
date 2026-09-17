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
import { getGreeting, formatDateTime, getScoreColor, getSkillLevel } from "@/lib/utils";

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
    getStudentSimulationHistory(userId),
    getResumeHealth(userId).catch(() => null),
    getApplicationDashboardCard(userId).catch(() => null),
    getOutcomeDashboardCard(userId).catch(() => null),
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">
              Nexora • Active Session
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            {getGreeting()}, {userName.split(" ")[0]}
          </h1>
          <p className="text-body-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Your personalized placement command center. Actionable intelligence, deterministic readiness drivers, and prioritized next steps.
          </p>
        </div>

        {/* Quick Header Badge */}
        <div className="flex items-center gap-2.5 self-start md:self-auto px-3.5 py-2 rounded-lg bg-surface/90 border border-border">
          <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider leading-none">Curriculum</span>
            <span className="text-[12px] font-mono font-semibold text-text-primary mt-1 leading-none">7 Subjects • 160 Questions</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Span 8) */}
        <div className="lg:col-span-8 space-y-8">
          {/* 1. Placement Readiness Card & Readiness Contributors */}
          <section className="bg-surface/90 border border-border/80 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
              {/* Circular Progress Ring or Clean Uncalibrated Gauge */}
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    fill="none"
                    r={radius}
                    stroke="#1A1A1A"
                    strokeWidth="8"
                  />
                  <circle
                    className="text-primary circle-progress"
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
                        <span className="text-3xl sm:text-4xl font-bold text-text-primary leading-none tracking-tight">
                          {readiness.score}
                        </span>
                        <span className="text-xs sm:text-sm text-text-muted ml-0.5">/ 100</span>
                      </div>
                      <span
                        className={`text-label-xs font-semibold mt-1.5 uppercase tracking-wider font-mono ${
                          readiness.level?.color || "text-primary-text"
                        }`}
                      >
                        {readiness.level?.label || "COMPETITIVE"}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center font-mono">
                        <span className="text-3xl sm:text-4xl font-bold text-text-muted leading-none tracking-wider">
                          --
                        </span>
                        <span className="text-xs sm:text-sm text-text-muted ml-0.5">/ 100</span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted mt-1.5 uppercase tracking-widest">
                        NOT ASSESSED
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Card Content & CTAs */}
              <div className="flex-1 text-center md:text-left z-10">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-high border border-border/80 text-[11px] font-mono text-text-muted mb-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      dataSufficiency.hasCompletedBaseline ? "bg-secondary" : "bg-primary"
                    }`}
                  />
                  <span>
                    {dataSufficiency.hasCompletedBaseline
                      ? "BENCHMARK CALIBRATED"
                      : "READINESS: NOT ASSESSED (UNCALIBRATED)"}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight mb-2">
                  Placement Readiness Score
                </h2>

                <p className="text-body-sm text-text-secondary mb-5 leading-relaxed max-w-xl">
                  {dataSufficiency.hasCompletedBaseline
                    ? "Calculated dynamically across Core CS fundamentals, problem-solving proficiency, and interview speed indexing against standard placement benchmarks."
                    : "Complete your baseline assessment to establish your starting benchmark across all 7 placement domains."}
                </p>

                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {dataSufficiency.hasCompletedBaseline ? (
                    <>
                      <Link
                        href="/tests"
                        className="bg-primary text-text-inverse font-medium text-body-sm px-6 py-2.5 rounded-lg hover:bg-primary-text transition-colors flex items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        Take Mock Test
                      </Link>
                      <Link
                        href="/analytics"
                        className="bg-surface-high border border-border text-text-primary font-medium text-body-sm px-6 py-2.5 rounded-lg hover:bg-surface-highest transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-border"
                      >
                        <span className="material-symbols-outlined text-[18px]">insights</span>
                        View Detailed Report
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={baselineTestId ? `/tests/${baselineTestId}` : "/assessment"}
                      className="bg-primary text-text-inverse font-medium text-body-sm px-7 py-3 rounded-lg hover:bg-primary-text transition-all flex items-center gap-2.5 shadow-md shadow-primary/10 hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
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
              <div className="mt-8 pt-6 border-t border-border/80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-body-sm font-semibold text-text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">swap_vert</span>
                    Readiness Contributors
                  </h3>
                  <span className="text-[11px] font-mono text-text-muted">
                    Deterministic Impact Breakdown
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Positive Contributors (Helping) */}
                  <div className="p-3.5 rounded-xl bg-surface-high/60 border border-secondary/20">
                    <div className="flex items-center gap-2 mb-2 text-label-xs font-mono font-semibold text-secondary uppercase">
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                      Helping Your Readiness
                    </div>
                    {readiness.positiveContributors.length > 0 ? (
                      <div className="space-y-2">
                        {readiness.positiveContributors.slice(0, 2).map((c) => (
                          <div
                            key={c.code}
                            className="flex items-center justify-between text-body-sm bg-surface/80 p-2 rounded-lg border border-border/60"
                          >
                            <span className="text-text-primary font-medium">{c.name}</span>
                            <span className="font-mono text-secondary font-semibold">
                              +{c.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] font-mono text-text-muted">
                        Take more tests to establish strong benchmark areas.
                      </p>
                    )}
                  </div>

                  {/* Negative Contributors (Holding it back) */}
                  <div className="p-3.5 rounded-xl bg-surface-high/60 border border-error/20">
                    <div className="flex items-center gap-2 mb-2 text-label-xs font-mono font-semibold text-error uppercase">
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                      Holding It Back
                    </div>
                    {readiness.negativeContributors.length > 0 ? (
                      <div className="space-y-2">
                        {readiness.negativeContributors.slice(0, 2).map((c) => (
                          <div
                            key={c.code}
                            className="flex items-center justify-between text-body-sm bg-surface/80 p-2 rounded-lg border border-border/60"
                          >
                            <span className="text-text-primary font-medium">{c.name}</span>
                            <span className="font-mono text-error font-semibold">
                              {c.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] font-mono text-secondary">
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
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-primary font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span>Execution OS • Your Next Actions</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight mt-0.5">
                  WHAT SHOULD I DO TODAY?
                </h2>
                <p className="text-body-sm text-text-secondary mt-0.5">
                  Your Next Actions: Daily prioritized execution plan derived from your verified test performance
                </p>
              </div>
              <Link
                href="/roadmap"
                className="text-primary-text font-mono text-[12px] hover:text-primary transition-colors flex items-center gap-1 font-medium"
              >
                <span>View Roadmap</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            {/* Zero-Data / Empty Experience */}
            {!dailyPlan.hasEnoughData ? (
              <div className="p-6 sm:p-8 rounded-2xl bg-surface/90 border border-border/80 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
                  <span className="material-symbols-outlined text-[28px]">flag</span>
                </div>
                <div className="max-w-md">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
                    CALIBRATION REQUIRED
                  </span>
                  <h3 className="text-title-md font-bold text-text-primary mt-1 mb-1.5">
                    BUILD YOUR BASELINE
                  </h3>
                  <p className="text-body-sm text-text-secondary leading-relaxed">
                    Complete an assessment to unlock your personalized preparation plan. Nexora analyzes your verified responses across 7 core placement domains.
                  </p>
                </div>

                <Link
                  href={baselineTestId ? `/tests/${baselineTestId}` : "/assessment"}
                  className="bg-primary text-text-inverse font-medium text-body-sm px-7 py-3 rounded-lg hover:bg-primary-text transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  Start Assessment
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Partial-Data State Banner */}
                {dailyPlan.isPartialData && (
                  <div className="p-4 rounded-xl bg-surface-high/80 border border-tertiary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[22px] text-tertiary">info</span>
                      <div>
                        <h4 className="text-body-sm font-bold text-text-primary">
                          KEEP BUILDING YOUR BASELINE
                        </h4>
                        <p className="text-[12px] font-mono text-text-muted mt-0.5">
                          You have enough data for an initial recommendation, but more practice will make your plan more precise.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/tests"
                      className="text-primary-text font-mono text-[12px] font-semibold hover:underline whitespace-nowrap"
                    >
                      CONTINUE PRACTICE →
                    </Link>
                  </div>
                )}

                {/* Compact Execution Progress Component */}
                <div className="p-5 sm:p-6 rounded-2xl bg-surface/90 border border-border/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">task_alt</span>
                      <h3 className="text-title-md font-bold text-text-primary">
                        TODAY&apos;S PROGRESS
                      </h3>
                    </div>
                    <div className="flex items-baseline gap-2 font-mono">
                      <span className="text-2xl font-bold text-text-primary">
                        {dailyPlan.completedCount} / {dailyPlan.totalCount}
                      </span>
                      <span className="text-[12px] text-text-muted">actions complete</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-surface-highest h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500 rounded-full"
                      style={{ width: `${dailyPlan.progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                    <span className="text-secondary font-semibold">
                      {dailyPlan.completedCount} completed
                    </span>
                    <span className="font-semibold text-text-primary">
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
                      className={`p-5 sm:p-6 rounded-2xl border transition-all relative overflow-hidden shadow-sm ${
                        isCompleted
                          ? "bg-surface/50 border-secondary/30 opacity-90"
                          : isInProgress
                          ? "bg-surface border-primary/50 shadow-md ring-1 ring-primary/20"
                          : isPartiallyCompleted
                          ? "bg-surface border-tertiary/50 shadow-md ring-1 ring-tertiary/20"
                          : action.order === 1
                          ? "bg-surface border-primary/30"
                          : "bg-surface/90 border-border/80 hover:border-border-variant"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold font-mono text-primary-text">
                            {orderStr}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                                action.type === "FIX"
                                  ? "bg-error/20 text-error border border-error/30"
                                  : action.type === "REINFORCE"
                                  ? "bg-tertiary/20 text-tertiary border border-tertiary/30"
                                  : "bg-secondary/20 text-secondary border border-secondary/30"
                              }`}
                            >
                              {action.type}
                            </span>
                            <span className="text-[11px] font-mono text-text-muted uppercase">
                              {action.impact}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {isCompleted ? (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-secondary/15 text-secondary border border-secondary/30 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              COMPLETED
                            </span>
                          ) : isPartiallyCompleted ? (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-tertiary/15 text-tertiary border border-tertiary/30 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">pending</span>
                              PARTIAL PROGRESS
                            </span>
                          ) : isInProgress ? (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-primary/15 text-primary-text border border-primary/30 flex items-center gap-1 animate-pulse">
                              <span className="material-symbols-outlined text-[14px]">autorenew</span>
                              IN PROGRESS
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-surface-high text-text-muted border border-border">
                              PENDING
                            </span>
                          )}
                          <span className="text-label-xs font-mono text-secondary font-semibold bg-surface-high px-2.5 py-1 rounded-md border border-border">
                            {action.accuracy}% ACCURACY
                          </span>
                          {action.targetFocus && (
                            <span className="text-[10px] font-mono text-primary-text bg-primary/10 border border-primary/25 px-2 py-0.5 rounded">
                              TARGET FOCUS
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight mb-2">
                        {isCompleted && (
                          <span className="text-secondary mr-2">✓</span>
                        )}
                        {action.domain} → {action.topic}
                      </h3>

                      <div className="space-y-2 mb-5 max-w-3xl">
                        <div className="flex items-center gap-3 text-[12px] font-mono text-text-muted">
                          <span className="text-text-primary font-semibold">
                            {action.completedQuestionsCount !== undefined && action.completedQuestionsCount > 0
                              ? `${action.completedQuestionsCount} / ${action.targetCount} questions answered`
                              : `${action.targetCount} targeted questions`}
                          </span>
                          <span>•</span>
                          <span>Current accuracy: {action.accuracy}%</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-text-muted block mb-0.5">
                            Why:
                          </span>
                          <p className="text-body-sm text-text-secondary leading-relaxed">
                            {action.reason}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-text-muted block mb-0.5">
                            Evidence:
                          </span>
                          <p className="text-[12px] font-mono text-text-muted leading-relaxed">
                            {action.evidence}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-text-muted block mb-0.5">
                            Action:
                          </span>
                          <p className="text-body-sm text-text-primary font-medium leading-relaxed">
                            {action.action}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60">
                        {isCompleted ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary text-body-sm font-semibold font-mono">
                              <span className="material-symbols-outlined text-[16px]">check</span>
                              Completed Today
                            </span>
                            <Link
                              href={action.ctaHref}
                              className="text-text-muted hover:text-text-primary text-[12px] font-mono underline transition-colors"
                            >
                              Practice again
                            </Link>
                          </div>
                        ) : isPartiallyCompleted || isInProgress ? (
                          <Link
                            href={action.ctaHref}
                            className="bg-primary text-text-inverse font-semibold text-body-sm px-6 py-2.5 rounded-lg hover:bg-primary-text transition-colors inline-flex items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <span>CONTINUE</span>
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          </Link>
                        ) : (
                          <Link
                            href={action.ctaHref}
                            className="bg-primary text-text-inverse font-semibold text-body-sm px-6 py-2.5 rounded-lg hover:bg-primary-text transition-colors inline-flex items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                        <span className="text-[12px] font-mono text-text-muted">
                          Direct Practice: <span className="text-text-primary">{action.domain}</span>
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
                  <div className="p-4 rounded-xl bg-surface/80 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-semibold">
                        RESUME-ALIGNED ACTIONS
                      </span>
                      <Link href="/resume" className="text-[11px] font-mono text-primary-text hover:underline">
                        Open Resume Intelligence
                      </Link>
                    </div>
                    {dailyPlan.resumeActions.slice(0, 3).map((action) => (
                      <div
                        key={action.id}
                        className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-t border-border/60 pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                              action.type === "RESUME"
                                ? "bg-primary/15 text-primary-text border border-primary/30"
                                : "bg-tertiary/20 text-tertiary border border-tertiary/30"
                            }`}
                          >
                            {action.type === "RESUME" ? "RESUME" : "ALIGN"}
                          </span>
                          <p className="text-body-sm text-text-primary mt-1.5">{action.title}</p>
                          <p className="text-[11px] font-mono text-text-secondary leading-relaxed mt-1">
                            {action.reason}
                          </p>
                          <p className="text-[11px] font-mono text-text-muted mt-1">
                            Evidence: {action.evidence}
                          </p>
                        </div>
                        {action.ctaHref && (
                          <Link
                            href={action.ctaHref}
                            className="shrink-0 text-[11px] font-mono px-3 py-1.5 rounded-md border border-border bg-surface-high text-text-secondary hover:text-text-primary transition-colors self-start"
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
                  <div className="p-4 rounded-xl bg-surface/80 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-semibold">
                        PREPARATION HISTORY
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">
                        Verified Daily Completion
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 font-mono text-[12px]">
                      {dailyPlan.history.map((h) => (
                        <div
                          key={h.date}
                          className="p-2 rounded-lg bg-surface-high border border-border/60 flex flex-col items-center text-center"
                        >
                          <span className="text-text-muted text-[10px]">
                            {new Date(h.date + "T00:00:00").toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="font-bold text-text-primary mt-0.5">
                            {h.completedCount} / {h.totalCount}
                          </span>
                          <span className="text-[10px] text-secondary">
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
                <h2 className="text-title-md font-semibold text-text-primary">
                  Subject Performance
                </h2>
                <p className="text-label-xs text-text-muted mt-0.5">
                  Performance across 7 placement domains
                </p>
              </div>
              <Link
                href="/analytics"
                className="text-primary-text font-mono text-[12px] hover:text-primary transition-colors flex items-center gap-1 font-medium"
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
                    className="bg-surface/90 border border-border/80 rounded-xl p-4 flex min-w-0 flex-col justify-between gap-3 hover:border-border-variant hover:bg-surface-high transition-all"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <span className="min-w-0 text-body-sm font-semibold text-text-primary" title={subj.name}>
                        {displayName}
                      </span>
                    </div>

                    <div>
                      <div className="text-2xl font-bold font-mono text-text-primary tracking-tight">
                        {isTested ? (
                          `${subj.score}%`
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                      <span
                        className={`mt-1 inline-flex text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold tracking-wider ${
                          isTested
                            ? `${skillLevel.bgClass} ${skillLevel.colorClass}`
                            : "bg-surface-highest/60 text-text-muted"
                        }`}
                      >
                        {isTested ? subj.status : "NOT TESTED"}
                      </span>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full bg-surface-highest h-1 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isTested ? "bg-primary" : "bg-transparent"
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
              <h2 className="text-title-md font-semibold text-text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-error">track_changes</span>
                Critical Focus Areas
              </h2>
              {intelligence.weakAreas.length > 0 && (
                <span className="text-[11px] font-mono text-text-muted">
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
                    className="bg-surface/90 border border-border/80 rounded-xl p-4 flex items-center justify-between hover:border-border-variant transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                          wa.priority === "CRITICAL"
                            ? "bg-error/10 text-error border-error/20"
                            : "bg-tertiary/10 text-tertiary border-tertiary/20"
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
                        <h3 className="text-body-sm text-text-primary font-medium">
                          {wa.topicName}
                        </h3>
                        <p className="text-label-xs text-text-muted mt-0.5 font-mono">
                          {wa.subjectCode} • {wa.accuracy}% accuracy ({wa.totalAttempts} questions)
                          {wa.trend === "declining" && " • declining trend"}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/tests"
                      className="text-primary-text font-mono text-[12px] uppercase hover:bg-primary/10 px-3 py-1.5 rounded-md transition-colors hidden sm:flex items-center gap-1 font-semibold"
                    >
                      <span>Practice Topic</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-surface/90 border border-border/80 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary mb-3">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <h3 className="text-body-sm font-semibold text-text-primary mb-1">
                  {dataSufficiency.hasCompletedBaseline ? "No Critical Weaknesses" : "Awaiting Evaluation"}
                </h3>
                <p className="text-label-xs text-text-muted max-w-md leading-relaxed">
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
          <section className="bg-surface/90 border border-primary/30 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">target</span>
                Placement Target
              </span>
              <Link
                href="/profile"
                className="text-primary-text hover:text-primary text-[11px] font-mono font-medium underline transition-colors"
              >
                {placementTargets.configured ? "Manage Targets" : "Set Targets"}
              </Link>
            </div>

            {placementTargets.configured ? (
              <div className="space-y-3.5">
                {/* Primary Target Role & Company */}
                <div>
                  <h3 className="text-xl font-bold text-text-primary tracking-tight">
                    {placementTargets.primaryRole?.name || "Target Role Not Selected"}
                  </h3>
                  {placementTargets.primaryCompany && (
                    <p className="text-body-md font-semibold text-primary-text mt-0.5">
                      {placementTargets.primaryCompany.name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted mt-1.5">
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
                <div className="pt-3 border-t border-border/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                      Preparation Focus
                    </span>
                    {prepFocus.score !== null && (
                      <span className="text-[11px] font-mono font-bold text-error">
                        {prepFocus.score}%
                      </span>
                    )}
                  </div>
                  <div className="text-body-sm font-bold text-text-primary">
                    {prepFocus.label}
                  </div>
                  <p className="text-[12px] font-mono text-text-secondary leading-relaxed">
                    {prepFocus.detail}
                  </p>
                </div>

                {/* Highest-Priority Next Action */}
                {dataSufficiency.hasCompletedBaseline && topAction && (
                  <div className="pt-3 border-t border-border/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                      Next Action
                    </span>
                    <p className="text-[12px] font-medium text-primary-text truncate">
                      {topAction.title}
                    </p>
                  </div>
                )}

                {/* Target Strategy Alignment (Phase 16) */}
                {dataSufficiency.hasCompletedBaseline && targetStrategy.readiness.targetScore !== null && (
                  <div className="pt-3 border-t border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                        Target Readiness
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase text-secondary">
                        {targetStrategy.readiness.targetLevel || "ON TRACK"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono text-primary-text">
                        {targetStrategy.readiness.targetScore}%
                      </span>
                      <span className="text-[11px] font-mono text-tertiary">
                        {targetStrategy.gaps.length} {targetStrategy.gaps.length === 1 ? "priority gap" : "priority gaps"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Link
                    href="/target"
                    id="dashboard-view-target-strategy-btn"
                    className="flex-1 bg-surface-high border border-primary/30 text-primary-text font-medium text-[12px] py-2.5 px-3 rounded-lg hover:bg-surface-highest transition-colors flex items-center justify-center gap-1.5 font-mono shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[15px]">track_changes</span>
                    <span>View Target Strategy</span>
                  </Link>
                  <Link
                    href="/roadmap"
                    id="dashboard-view-roadmap-btn"
                    className="bg-primary text-text-inverse font-semibold text-[12px] py-2.5 px-4 rounded-lg hover:bg-primary-text transition-colors flex items-center justify-center gap-1.5 shadow-sm font-mono"
                  >
                    <span>View Roadmap</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                <p className="text-body-sm text-text-muted font-mono text-[12px]">
                  No target role or company selected. Set placement targets to focus your preparation roadmap.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href="/profile"
                    className="flex-1 py-2 px-3 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary-text text-[12px] font-medium transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">add_circle</span>
                    <span>Set Targets</span>
                  </Link>
                  <Link
                    href="/target"
                    className="py-2 px-3 rounded-lg border border-border bg-surface-high hover:bg-surface-highest text-text-secondary text-[12px] font-mono transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <span>Strategy</span>
                    <span className="material-symbols-outlined text-[15px]">track_changes</span>
                  </Link>
                  <Link
                    href="/roadmap"
                    className="py-2 px-3 rounded-lg border border-border bg-surface-high hover:bg-surface-highest text-text-primary text-[12px] font-mono transition-colors inline-flex items-center justify-center gap-1"
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
            <section className="bg-surface/90 border border-primary/20 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">work</span>
                  Application Pipeline
                </span>
                <Link
                  href={applicationCard.ctaHref}
                  className="text-primary-text hover:text-primary text-[11px] font-mono font-medium underline transition-colors"
                >
                  {applicationCard.ctaLabel}
                </Link>
              </div>

              <p className="text-headline-md font-bold text-text-primary tracking-tight">
                {applicationCard.activeApplications}{" "}
                {applicationCard.activeApplications === 1 ? "Active Application" : "Active Applications"}
              </p>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-high/60 px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">Interviews</p>
                  <p className="text-body-md font-bold text-text-primary">{applicationCard.interviews}</p>
                </div>
                <div className="rounded-lg bg-surface-high/60 px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">Assessments</p>
                  <p className="text-body-md font-bold text-text-primary">{applicationCard.assessments}</p>
                </div>
                <div className="rounded-lg bg-surface-high/60 px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">Offers</p>
                  <p className="text-body-md font-bold text-text-primary">{applicationCard.offers}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] font-mono text-text-muted">
                  {applicationCard.nextDeadline
                    ? `Next deadline: ${applicationCard.nextDeadline.companyName} — ${new Date(applicationCard.nextDeadline.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : "No upcoming deadlines"}
                </span>
                <Link
                  href={applicationCard.ctaHref}
                  className="inline-flex items-center gap-1 text-[12px] font-mono font-semibold text-primary-text hover:underline"
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
            <section className="bg-surface/90 border border-secondary/20 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">insights</span>
                  Placement Outcomes
                </span>
                <Link
                  href={outcomeCard.ctaHref}
                  className="text-primary-text hover:text-primary text-[11px] font-mono font-medium underline transition-colors"
                >
                  {outcomeCard.ctaLabel}
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-high/60 px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">Applications</p>
                  <p className="text-body-md font-bold text-text-primary">{outcomeCard.applications}</p>
                </div>
                <div className="rounded-lg bg-surface-high/60 px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">Interviews</p>
                  <p className="text-body-md font-bold text-text-primary">{outcomeCard.interviews}</p>
                </div>
                <div className="rounded-lg bg-surface-high/60 px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">Offers</p>
                  <p className="text-body-md font-bold text-text-primary">{outcomeCard.offers}</p>
                </div>
              </div>

              {outcomeCard.recentOutcome && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-[10px] font-mono uppercase text-text-muted font-bold">Recent outcome</p>
                  <p className="text-body-sm font-semibold text-text-primary mt-1">
                    {outcomeCard.recentOutcome.companyName}
                  </p>
                  <p className="text-[11px] font-mono text-text-muted">{outcomeCard.recentOutcome.label}</p>
                  {outcomeCard.observedFocus.length > 0 && (
                    <p className="text-[11px] text-text-secondary mt-1.5">
                      Observed focus: {outcomeCard.observedFocus.join(" · ")}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[10px] text-text-muted">{outcomeCard.disclaimer}</p>
            </section>
          )}

          {/* Placement Simulation Card (Phase 17) */}
          <section className="bg-surface/90 border border-primary/20 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                Placement Simulation
              </span>
              <Link
                href="/simulation"
                className="text-primary-text hover:text-primary text-[11px] font-mono font-medium underline transition-colors"
              >
                {latestSimulation ? "Simulation Hub" : "Launch"}
              </Link>
            </div>

            {latestSimulation ? (
              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-body-md font-bold text-text-primary tracking-tight">
                      {latestSimulation.companyName ? `${latestSimulation.companyName} — ` : ""}{latestSimulation.roleName}
                    </h3>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        latestSimulation.status === "completed"
                          ? "bg-secondary/10 border-secondary/30 text-secondary"
                          : "bg-primary/10 border-primary/30 text-primary"
                      }`}
                    >
                      {latestSimulation.status === "completed" ? "COMPLETED" : `ROUND ${latestSimulation.currentRoundOrder}/5`}
                    </span>
                  </div>
                  <p className="text-[12px] font-mono text-text-muted mt-0.5">
                    {latestSimulation.status === "completed"
                      ? `Simulation Readiness: ${latestSimulation.overallReadinessScore}%`
                      : "Simulation in progress"}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted">
                    {latestSimulation.status === "completed"
                      ? `Verdict: ${latestSimulation.readinessLevel || "Evaluated"}`
                      : `Next: Round ${latestSimulation.currentRoundOrder}`}
                  </span>
                  <Link
                    href={`/simulation/${latestSimulation.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-mono font-semibold text-primary-text hover:underline"
                  >
                    <span>{latestSimulation.status === "completed" ? "View Report" : "Resume"}</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                <p className="text-body-sm text-text-muted font-mono text-[12px]">
                  Simulate your target company&apos;s full 5-round hiring process: Screening, Coding, Debugging, AI Tech &amp; HR.
                </p>
                <Link
                  href="/simulation"
                  className="w-full py-2 px-3 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary-text text-[12px] font-medium transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">play_circle</span>
                  <span>Start Placement Simulation</span>
                </Link>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className="bg-surface/90 border border-border/80 rounded-2xl p-6">
            <h2 className="text-title-md font-semibold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">bolt</span>
              Quick Actions
            </h2>
            <div className="flex flex-col gap-3">
              {/* PRIMARY ACTION */}
              <Link
                href="/simulation"
                className="w-full h-11 bg-primary text-text-inverse font-semibold text-body-sm px-4 rounded-lg hover:bg-primary-text transition-all flex items-center justify-between group shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="w-full h-11 bg-surface-high border border-border text-text-secondary hover:text-text-primary font-medium text-body-sm px-4 rounded-lg hover:border-border-variant hover:bg-surface-highest transition-all flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-border"
              >
                <span className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-text-muted group-hover:text-text-primary transition-colors">
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
                className="w-full h-11 bg-surface-high border border-border text-text-secondary hover:text-text-primary font-medium text-body-sm px-4 rounded-lg hover:border-border-variant hover:bg-surface-highest transition-all flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-border"
              >
                <span className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-text-muted group-hover:text-text-primary transition-colors">
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
              <section className="bg-surface/90 border border-tertiary/30 rounded-2xl p-5">
                <h3 className="text-body-sm font-semibold text-tertiary mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Exam Strategy Optimization
                </h3>
                <div className="space-y-2.5 text-label-xs font-mono">
                  {intelligence.discipline.hasNegativeMarkingIssue && (
                    <div className="p-2.5 rounded bg-surface-high border border-border text-text-secondary leading-relaxed">
                      <span className="text-text-primary font-bold block mb-0.5">
                        Negative Marking Penalty
                      </span>
                      Losing ~{intelligence.discipline.negativeMarkingLossAvg.toFixed(1)} marks per test to incorrect answers. Reduce guessing.
                    </div>
                  )}
                  {intelligence.discipline.hasUnansweredIssue && (
                    <div className="p-2.5 rounded bg-surface-high border border-border text-text-secondary leading-relaxed">
                      <span className="text-text-primary font-bold block mb-0.5">
                        Unanswered Questions
                      </span>
                      {intelligence.discipline.unansweredRate}% of questions left blank ({intelligence.discipline.unansweredCount} questions). Improve test pacing.
                    </div>
                  )}
                </div>
              </section>
            )}

          {/* Recent Activity Timeline */}
          <section className="bg-surface/90 border border-border/80 rounded-2xl p-6 flex-1">
            <h2 className="text-title-md font-semibold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-text-muted">schedule</span>
              Recent Activity
            </h2>

            {recentActivity.length > 0 ? (
              <div className="relative border-l border-border/80 ml-3 space-y-5 pb-2">
                {recentActivity.map((act) => {
                  const score = act.score ?? 0;
                  const dotColor =
                    score >= 75
                      ? "bg-secondary"
                      : score >= 50
                      ? "bg-primary-text"
                      : "bg-error";

                  return (
                    <div key={act.id} className="relative pl-5">
                      <div
                        className={`absolute w-2.5 h-2.5 ${dotColor} rounded-full -left-[5.5px] top-1.5 ring-4 ring-surface`}
                      />
                      <div className="flex flex-col">
                        <span className="text-[11px] text-text-muted font-mono mb-0.5">
                          {act.submittedAt ? formatDateTime(act.submittedAt) : "Recently"}
                        </span>
                        <Link
                          href={`/tests/${act.testId}/result?attemptId=${act.id}`}
                          className="text-body-sm text-text-primary hover:text-primary-text font-medium transition-colors"
                        >
                          {act.testTitle}
                        </Link>
                        <span className="text-[12px] font-mono mt-1 text-text-secondary">
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
              <div className="p-6 rounded-xl bg-surface-high/40 border border-border/60 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-surface-highest/60 flex items-center justify-center text-text-muted mb-3">
                  <span className="material-symbols-outlined text-[20px]">history</span>
                </div>
                <h3 className="text-body-sm font-semibold text-text-primary mb-1">
                  No activity yet
                </h3>
                <p className="text-label-xs text-text-muted max-w-xs leading-relaxed">
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
