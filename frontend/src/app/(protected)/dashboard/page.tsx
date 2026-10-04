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
import { PlacementIntelligence2Widget } from "@/components/analytics/placement-intelligence-2-widget";
import { CompactMetricStrip } from "@/components/ui/compact-metric-strip";
import { QuickActionsGrid } from "@/components/ui/quick-actions-grid";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { getGreeting, formatDateTime } from "@/lib/utils";

/**
 * A single non-critical intelligence widget must never take down the whole dashboard.
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
  const userName = profile?.name || session.user?.name || "Engineer";
  const firstName = userName.split(" ")[0];

  // 2. Fetch baseline test id
  const baselineList = await db
    .select({ id: tests.id })
    .from(tests)
    .where(eq(tests.type, "baseline"))
    .limit(1);
  const baselineTestId = baselineList[0]?.id;

  // 3. Parallel fetch of all student intelligence engines
  const [
    intelligence,
    placementIntelligence,
    placementTargets,
    dailyPlan,
    targetStrategy,
    simulationHistory,
    resumeHealth,
    applicationCard,
    outcomeCard,
  ] = await Promise.all([
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

  // Preparation focus derived strictly from real performance data
  const prepFocus = (() => {
    if (!dataSufficiency.hasCompletedBaseline) {
      return {
        label: "Calibrate Readiness",
        score: null,
        detail: "Complete your baseline assessment to establish your placement readiness.",
        category: "CALIBRATE",
      };
    }
    if (intelligence.weakAreas.length > 0) {
      const wa = intelligence.weakAreas[0];
      return {
        label: `${wa.subjectCode} — ${wa.topicName}`,
        score: wa.accuracy,
        detail: `${wa.topicName} accuracy is ${wa.accuracy}%. Targeted problem-solving required.`,
        category: "REINFORCE",
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
        category: "FOCUS",
      };
    }
    return {
      label: "Core CS Mastery",
      score: null,
      detail: "Maintain momentum with regular practice simulations.",
      category: "MAINTAIN",
    };
  })();

  // 4. Fetch recent submitted attempts
  const recentAttempts = await db
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

  // Build timeline items from real recent attempts
  const timelineItems = recentAttempts.map((att) => ({
    id: att.id,
    title: att.testTitle,
    subtitle: `Accuracy: ${att.accuracy}% • Score: ${att.score}/100`,
    timestamp: att.submittedAt ? formatDateTime(att.submittedAt) : "Recently",
    icon: "task_alt",
    accentColor: "green" as const,
    scoreBadge: `${att.score}%`,
    href: `/tests/${att.testId}/result?attemptId=${att.id}`,
  }));

  // Quick action items leading to real product workflows
  const quickActions = [
    {
      title: "Placement Target",
      subtitle: placementTargets.primaryRole?.name || "Configure role & company targets",
      icon: "track_changes",
      href: "/target",
      accentColor: "purple" as const,
    },
    {
      title: "Resume Intelligence",
      subtitle: resumeHealth?.atsScore ? `ATS Score: ${resumeHealth.atsScore}%` : "Upload & analyze ATS score",
      icon: "description",
      href: "/resume",
      accentColor: "blue" as const,
    },
    {
      title: "Adaptive Test",
      subtitle: "Practice targeted placement problems",
      icon: "quiz",
      href: "/tests",
      accentColor: "green" as const,
    },
    {
      title: "Placement Mock",
      subtitle: "Full 5-round interview simulation",
      icon: "terminal",
      href: "/simulation",
      accentColor: "amber" as const,
    },
  ];

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-text-muted tracking-wide block">
            {getGreeting()},
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight font-heading text-white flex items-center gap-2 mt-0.5">
            {firstName} <span className="inline-block animate-wave origin-[70%_70%]">👋</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Here&apos;s your placement preparation at a glance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/planner"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">event_note</span>
            <span>Study Planner</span>
          </Link>
          <Link
            href="/tests"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">quiz</span>
            <span>Practice Tests</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Unified 4-Metric Overview Strip ── */}
      <section aria-label="Performance Overview">
        <CompactMetricStrip
          items={[
            {
              id: "prep",
              label: "Preparation",
              value:
                dataSufficiency.hasCompletedBaseline && readiness.score !== null
                  ? `${readiness.score}%`
                  : "--",
              detail: dataSufficiency.hasCompletedBaseline
                ? "Calibrated"
                : "Baseline pending",
              progressPct: dataSufficiency.hasCompletedBaseline ? readiness.score : 0,
              href: baselineTestId ? "/tests" : "/tests",
            },
            {
              id: "target",
              label: "Target Fit",
              value:
                targetStrategy.readiness.targetScore !== null
                  ? `${targetStrategy.readiness.targetScore}%`
                  : "--",
              detail:
                targetStrategy.readiness.targetScore !== null
                  ? `${targetStrategy.gaps.length} gaps remaining`
                  : "Set target role",
              progressPct: targetStrategy.readiness.targetScore,
              href: "/target",
            },
            {
              id: "ats",
              label: "Resume ATS",
              value: resumeHealth?.atsScore ? `${resumeHealth.atsScore}%` : "--",
              detail: resumeHealth?.atsScore ? "Analyzed" : "Upload resume",
              progressPct: resumeHealth?.atsScore,
              href: "/resume",
            },
            {
              id: "interview",
              label: "Simulation",
              value:
                latestSimulation?.overallReadinessScore !== null &&
                latestSimulation?.overallReadinessScore !== undefined
                  ? `${latestSimulation.overallReadinessScore}%`
                  : "--",
              detail:
                latestSimulation?.overallReadinessScore !== null &&
                latestSimulation?.overallReadinessScore !== undefined
                  ? "Latest verified"
                  : "Start mock",
              progressPct: latestSimulation?.overallReadinessScore,
              href: "/simulation",
            },
          ]}
        />
      </section>

      {/* ── 3. Midsection Grid (Two Columns) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Today + Focus Areas + Intelligence Engine */}
        <div className="lg:col-span-7 space-y-6">
          {/* Today's Focus Card (Flattened, no nested cards) */}
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-white">
                  calendar_today
                </span>
                <h2 className="text-sm font-bold text-white">Today&apos;s Focus</h2>
                <span className="text-[10px] bg-surface-container border border-outline-variant text-text-muted px-2 py-0.5 rounded-full font-mono">
                  {currentDateFormatted}
                </span>
              </div>
              <Link
                href="/planner"
                className="text-xs text-text-muted hover:text-white flex items-center gap-1 transition-colors font-mono"
              >
                Plan Details <span className="text-sm leading-none">→</span>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">
                    flag
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2 py-0.5 rounded text-white bg-white/15 text-[10px] font-mono font-bold uppercase tracking-wider">
                      {prepFocus.category}
                    </span>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {prepFocus.label}
                    </h3>
                  </div>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                    {prepFocus.detail}
                  </p>
                </div>
              </div>

              {/* Start Practice CTA */}
              <Link
                href={topAction?.route || (baselineTestId ? `/tests` : "/tests")}
                className="px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-zinc-200 transition-all shrink-0 self-start sm:self-center"
              >
                <span>Start Practice</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </Link>
            </div>

            {/* Clean metadata strip without nested card borders */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-outline-variant/40 text-[11px] font-mono text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">quiz</span>
                10 questions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                ~25 mins
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">psychology</span>
                Adaptive
              </span>
            </div>
          </div>

          {/* Focus Areas Table Card */}
          <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant shadow-md">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-text-muted">
                  track_changes
                </span>
                <h2 className="text-sm font-bold text-white">Focus Areas</h2>
              </div>
              <Link
                href="/analytics"
                className="text-xs text-text-muted hover:text-white flex items-center gap-1 transition-colors font-mono"
              >
                View All <span className="text-sm leading-none">→</span>
              </Link>
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              Key topics to practice based on your performance.
            </p>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-mono text-text-muted uppercase tracking-wider border-b border-outline-variant">
                    <th className="pb-2 font-medium">Topic</th>
                    <th className="pb-2 font-medium">Domain</th>
                    <th className="pb-2 font-medium">Accuracy</th>
                    <th className="pb-2 font-medium">Trend</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {intelligence.weakAreas.length > 0 ? (
                    intelligence.weakAreas.slice(0, 4).map((wa) => (
                      <tr
                        key={wa.topicId}
                        className="group hover:bg-surface-container-high/40 transition-colors"
                      >
                        <td className="py-3 pr-2 font-medium text-white/90 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-text-muted">
                            description
                          </span>
                          <span className="group-hover:text-white truncate max-w-[180px]">
                            {wa.topicName}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-text-muted text-[11px] font-mono">
                          {wa.subjectCode}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-[11px]">
                              {wa.accuracy}%
                            </span>
                            <div className="w-14 h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
                              <div
                                className="bg-white h-full rounded-full"
                                style={{ width: `${wa.accuracy}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-[11px]">
                          {wa.trend === "improving" ? (
                            <span className="text-white font-medium">
                              ↗ Improving
                            </span>
                          ) : wa.trend === "declining" ? (
                            <span className="text-zinc-400 font-medium">
                              ↘ Declining
                            </span>
                          ) : (
                            <span className="text-text-muted font-medium">
                              — Stable
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <Link
                            href="/tests"
                            className="px-3 py-1 rounded-full text-[11px] font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-colors inline-block"
                          >
                            Practice
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : readiness.subjectScores.filter((s) => s.score > 0).length > 0 ? (
                    readiness.subjectScores
                      .filter((s) => s.score > 0)
                      .slice(0, 4)
                      .map((subj) => (
                        <tr
                          key={subj.subjectId}
                          className="group hover:bg-surface-container-high/40 transition-colors"
                        >
                          <td className="py-3 pr-2 font-medium text-white/90 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-text-muted">
                              code
                            </span>
                            <span className="group-hover:text-white">
                              {subj.name}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-text-muted text-[11px] font-mono">
                            {subj.code}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-[11px]">
                                {subj.score}%
                              </span>
                              <div className="w-14 h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
                                <div
                                  className="bg-white h-full rounded-full"
                                  style={{ width: `${subj.score}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-white font-medium text-[11px]">
                            ↗ Calibrated
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <Link
                              href="/tests"
                              className="px-3 py-1 rounded-full text-[11px] font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-colors inline-block"
                            >
                              Review
                            </Link>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-text-muted text-[12px]"
                      >
                        Complete your baseline assessment to reveal focus topics.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phase 23 Intelligence 2.0 Engine Widget */}
          <PlacementIntelligence2Widget intelligence={placementIntelligence.intelligence2 ?? null} />
        </div>

        {/* Right Column (5 cols): Recent Activity + Quick Actions + Target Summary */}
        <div className="lg:col-span-5 space-y-6">
          {/* Recent Activity Card */}
          <ActivityTimeline
            title="Recent Activity"
            items={timelineItems}
            viewAllHref="/analytics"
            emptyMessage="No tests completed yet. Take a test to build your history."
          />

          {/* Quick Actions Grid */}
          <QuickActionsGrid actions={quickActions} />

          {/* Target Strategy Alignment Card */}
          {placementTargets.configured && (
            <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">radar</span>
                  Primary Target
                </span>
                <Link
                  href="/target"
                  className="text-text-muted hover:text-white text-[11px] font-mono transition-colors"
                >
                  Manage →
                </Link>
              </div>

              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {placementTargets.primaryRole?.name || "Software Engineer"}
                </h3>
                {placementTargets.primaryCompany && (
                  <p className="text-xs font-semibold text-zinc-300 mt-0.5">
                    {placementTargets.primaryCompany.name}
                  </p>
                )}
              </div>

              {targetStrategy.readiness.targetScore !== null && (
                <div className="pt-2.5 border-t border-outline-variant/40 flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">Target Fit</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {targetStrategy.readiness.targetScore}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
