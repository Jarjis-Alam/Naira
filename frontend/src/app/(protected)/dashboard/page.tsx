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
import { MetricCardV2 } from "@/components/ui/metric-card-v2";
import { QuickActionsGrid } from "@/components/ui/quick-actions-grid";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { getGreeting, formatDateTime } from "@/lib/utils";

/**
 * A single non-critical intelligence widget must never take down the whole
 * dashboard.
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
    .limit(5);

  const timelineItems = recentAttempts.map((att) => {
    const acc = att.accuracy ?? 0;
    return {
      id: att.id,
      title: att.testTitle,
      subtitle: `Accuracy: ${acc}%`,
      timestamp: att.submittedAt ? formatDateTime(att.submittedAt) : "Recently",
      icon: "code",
      accentColor:
        acc >= 80
          ? ("green" as const)
          : acc >= 50
          ? ("amber" as const)
          : ("rose" as const),
      scoreBadge: `${att.score ?? 0} pts`,
      href: `/tests`,
    };
  });

  const quickActions = [
    {
      title: "Take a Test",
      subtitle: "Assess your skills",
      icon: "quiz",
      href: "/tests",
      accentColor: "purple" as const,
    },
    {
      title: "Update Resume",
      subtitle: "Improve your ATS score",
      icon: "description",
      href: "/resume",
      accentColor: "blue" as const,
    },
    {
      title: "Run Simulation",
      subtitle: "Practice mock interview",
      icon: "videocam",
      href: "/simulation",
      accentColor: "green" as const,
    },
    {
      title: "Target Strategy",
      subtitle: "Calibrate company roles",
      icon: "radar",
      href: "/target",
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
      {/* ── 1. Hero Greeting & Poetic Inspiration Card ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Greeting & Category Tabs */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <span className="text-xs text-sage-40 tracking-wide block">
              Good afternoon,
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight font-heading text-phosphor-white flex items-center gap-2 mt-0.5">
              {firstName} <span className="inline-block animate-wave origin-[70%_70%]">👋</span>
            </h1>
            <p className="text-xs text-sage-40 mt-1">
              Here&apos;s your placement preparation at a glance.
            </p>
          </div>

          {/* Horizontal Pill Navigation Tabs */}
          <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1 text-xs no-scrollbar">
            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-full bg-lime-pulse text-void-black font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(127,238,100,0.25)] shrink-0 transition-all hover:brightness-105"
            >
              <span className="material-symbols-outlined text-[15px]">dashboard</span>
              <span>Overview</span>
            </Link>
            <Link
              href="/tests"
              className="px-3.5 py-1.5 rounded-full bg-[#131816] text-sage-40 hover:text-phosphor-white border border-[#3f4a38]/40 flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">code</span>
              <span>Preparation</span>
            </Link>
            <Link
              href="/applications"
              className="px-3.5 py-1.5 rounded-full bg-[#131816] text-sage-40 hover:text-phosphor-white border border-[#3f4a38]/40 flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">send</span>
              <span>Applications</span>
            </Link>
            <Link
              href="/resume"
              className="px-3.5 py-1.5 rounded-full bg-[#131816] text-sage-40 hover:text-phosphor-white border border-[#3f4a38]/40 flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">description</span>
              <span>Resume</span>
            </Link>
            <Link
              href="/simulation"
              className="px-3.5 py-1.5 rounded-full bg-[#131816] text-sage-40 hover:text-phosphor-white border border-[#3f4a38]/40 flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">videocam</span>
              <span>Simulations</span>
            </Link>
          </div>
        </div>

        {/* Right Inspiration Landscape Graphic Card */}
        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-[#3f4a38]/40 bg-[#0f1412] h-28 p-5 flex items-center justify-between shadow-xl">
            {/* Background Mountain/Sunset Graphic */}
            <div className="absolute inset-y-0 right-0 w-3/5 pointer-events-none overflow-hidden">
              <svg
                className="absolute inset-0 w-full h-full"
                fill="none"
                preserveAspectRatio="none"
                viewBox="0 0 300 120"
              >
                <defs>
                  <radialGradient cx="65%" cy="35%" id="sunGlow" r="60%">
                    <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.85" />
                    <stop offset="40%" stopColor="#fb7185" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#141a18" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* Glowing Sun Orb */}
                <circle cx="210" cy="40" fill="url(#sunGlow)" r="28" />
                {/* Back Mountains */}
                <path d="M80 120 L160 55 L240 120 Z" fill="#151a1d" opacity="0.8" />
                <path d="M150 120 L230 40 L310 120 Z" fill="#151a1d" opacity="0.6" />
                {/* Front Layer Mountains */}
                <path d="M100 120 L180 75 L250 120 Z" fill="#0c1011" opacity="0.95" />
                <path d="M190 120 L260 60 L330 120 Z" fill="#0c1011" opacity="0.95" />
              </svg>
              {/* Pillars Words */}
              <div className="absolute right-4 top-3 text-[8px] font-mono tracking-widest text-sage-40/70 uppercase flex flex-col gap-0.5 text-right font-semibold">
                <span>LEARN</span>
                <span>BUILD</span>
                <span>APPLY</span>
                <span>GROW</span>
              </div>
            </div>

            {/* Quote Text */}
            <div className="relative z-10 max-w-[65%]">
              <p className="text-xs text-phosphor-white/90 italic font-medium leading-relaxed">
                “Small, consistent steps<br />compound into opportunities.”
              </p>
              <span className="text-[9px] font-mono uppercase tracking-widest text-lime-pulse/80 mt-2 block font-semibold">
                NEXORA
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. 4-Column Readiness Metric Cards ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Preparation Readiness */}
        <MetricCardV2
          title="Preparation Readiness"
          value={
            dataSufficiency.hasCompletedBaseline && readiness.score !== null
              ? `${readiness.score}%`
              : "--"
          }
          accentColor="green"
          icon="query_stats"
          progressPct={dataSufficiency.hasCompletedBaseline ? readiness.score : 0}
          footerText={
            dataSufficiency.hasCompletedBaseline
              ? "Keep going. Consistency matters."
              : "Complete baseline assessment"
          }
          href={baselineTestId ? `/tests` : "/tests"}
        />

        {/* Metric 2: Target Readiness */}
        <MetricCardV2
          title="Target Readiness"
          value={
            targetStrategy.readiness.targetScore !== null
              ? `${targetStrategy.readiness.targetScore}%`
              : "--"
          }
          accentColor="pink"
          icon="radar"
          progressPct={targetStrategy.readiness.targetScore}
          footerText={
            targetStrategy.readiness.targetScore !== null
              ? `${targetStrategy.gaps.length} target gaps remaining`
              : "Set a target to measure this."
          }
          href="/target"
        />

        {/* Metric 3: Resume ATS Compatibility */}
        <MetricCardV2
          title="Resume ATS Compatibility"
          value={resumeHealth?.atsScore ? `${resumeHealth.atsScore}%` : "--"}
          accentColor="blue"
          icon="description"
          progressPct={resumeHealth?.atsScore}
          footerText={
            resumeHealth?.atsScore
              ? "Your resume is on the right track."
              : "Upload resume to scan ATS."
          }
          href="/resume"
        />

        {/* Metric 4: Interview Readiness */}
        <MetricCardV2
          title="Interview Readiness"
          value={
            latestSimulation?.overallReadinessScore !== null && latestSimulation?.overallReadinessScore !== undefined
              ? `${latestSimulation.overallReadinessScore}%`
              : "--"
          }
          accentColor="amber"
          icon="videocam"
          progressPct={latestSimulation?.overallReadinessScore}
          footerText={
            latestSimulation?.overallReadinessScore !== null && latestSimulation?.overallReadinessScore !== undefined
              ? `Last simulation: ${latestSimulation.overallReadinessScore}%`
              : "Complete a simulation to measure."
          }
          href="/simulation"
        />
      </section>

      {/* ── 3. Midsection Grid (Two Columns) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Today + Focus Areas + Intelligence Engine */}
        <div className="lg:col-span-7 space-y-6">
          {/* Today Card */}
          <div className="bg-[#191c1b] rounded-2xl p-5 border border-[#3f4a38]/40 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-sage-40">
                  calendar_today
                </span>
                <h2 className="text-sm font-bold text-phosphor-white">Today</h2>
                <span className="text-[10px] bg-[#282b29] border border-[#3f4a38]/60 text-sage-40 px-2 py-0.5 rounded-full font-mono">
                  {currentDateFormatted}
                </span>
              </div>
              <Link
                href="/roadmap"
                className="text-xs text-sage-40 hover:text-lime-pulse flex items-center gap-1 transition-colors"
              >
                View All <span className="text-sm leading-none">→</span>
              </Link>
            </div>
            <p className="text-[11px] text-sage-40 mb-3.5">
              Your next best action based on your progress.
            </p>

            {/* Inner Focus Item Box */}
            <div className="bg-[#111413] rounded-xl p-4 border border-[#3f4a38]/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">
                      database
                    </span>
                  </div>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                      {prepFocus.category}
                    </span>
                    <h3 className="text-sm font-bold text-phosphor-white leading-tight">
                      {prepFocus.label}
                    </h3>
                    <p className="text-[11px] text-sage-40 mt-1">
                      {prepFocus.detail}
                    </p>
                  </div>
                </div>

                {/* Start Practice Pill Button */}
                <Link
                  href={topAction?.route || (baselineTestId ? `/tests` : "/tests")}
                  className="px-4 py-2 rounded-full bg-lime-pulse text-void-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(127,238,100,0.2)] hover:bg-mint-frost transition-all shrink-0"
                >
                  <span>Start Practice</span>
                  <span className="text-sm leading-none">→</span>
                </Link>
              </div>

              {/* Metadata pills row */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#3f4a38]/40 text-[10px] text-sage-40">
                <span className="px-2.5 py-1 rounded-full bg-[#1d201f] border border-[#3f4a38]/40 flex items-center gap-1.5 font-mono">
                  <span className="material-symbols-outlined text-[13px] text-deep-fern">
                    quiz
                  </span>
                  10 questions
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#1d201f] border border-[#3f4a38]/40 flex items-center gap-1.5 font-mono">
                  <span className="material-symbols-outlined text-[13px] text-deep-fern">
                    schedule
                  </span>
                  ~25 mins
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#1d201f] border border-[#3f4a38]/40 flex items-center gap-1.5 font-mono">
                  <span className="material-symbols-outlined text-[13px] text-deep-fern">
                    bolt
                  </span>
                  Based on your performance
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#1d201f] border border-[#3f4a38]/40 flex items-center gap-1.5 font-mono">
                  <span className="material-symbols-outlined text-[13px] text-deep-fern">
                    psychology
                  </span>
                  Adaptive
                </span>
              </div>
            </div>
          </div>

          {/* Focus Areas Table Card */}
          <div className="bg-[#191c1b] rounded-2xl p-5 border border-[#3f4a38]/40 shadow-md">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-sage-40">
                  track_changes
                </span>
                <h2 className="text-sm font-bold text-phosphor-white">Focus Areas</h2>
              </div>
              <Link
                href="/analytics"
                className="text-xs text-sage-40 hover:text-lime-pulse flex items-center gap-1 transition-colors"
              >
                View All <span className="text-sm leading-none">→</span>
              </Link>
            </div>
            <p className="text-[11px] text-sage-40 mb-4">
              Topics to focus on based on your performance and targets.
            </p>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-mono text-sage-40 uppercase tracking-wider border-b border-[#3f4a38]/40">
                    <th className="pb-2 font-medium">Topic</th>
                    <th className="pb-2 font-medium">Domain</th>
                    <th className="pb-2 font-medium">Accuracy</th>
                    <th className="pb-2 font-medium">Trend</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3f4a38]/20">
                  {intelligence.weakAreas.length > 0 ? (
                    intelligence.weakAreas.slice(0, 4).map((wa) => (
                      <tr
                        key={wa.topicId}
                        className="group hover:bg-[#282b29]/40 transition-colors"
                      >
                        <td className="py-3 pr-2 font-medium text-phosphor-white/90 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-deep-fern">
                            description
                          </span>
                          <span className="group-hover:text-phosphor-white truncate max-w-[180px]">
                            {wa.topicName}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sage-40 text-[11px] font-mono">
                          {wa.subjectCode}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-phosphor-white font-mono text-[11px]">
                              {wa.accuracy}%
                            </span>
                            <div className="w-14 h-1.5 bg-[#0c0f0e] rounded-full overflow-hidden">
                              <div
                                className="bg-amber-400 h-full rounded-full"
                                style={{ width: `${wa.accuracy}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-[11px]">
                          {wa.trend === "improving" ? (
                            <span className="text-lime-pulse font-medium">
                              ↗ Improving
                            </span>
                          ) : wa.trend === "declining" ? (
                            <span className="text-rose-400 font-medium">
                              ↘ Declining
                            </span>
                          ) : (
                            <span className="text-sage-40 font-medium">
                              — Stable
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <Link
                            href="/tests"
                            className="px-3 py-1 rounded-full text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors inline-block"
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
                          className="group hover:bg-[#282b29]/40 transition-colors"
                        >
                          <td className="py-3 pr-2 font-medium text-phosphor-white/90 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-deep-fern">
                              code
                            </span>
                            <span className="group-hover:text-phosphor-white">
                              {subj.name}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sage-40 text-[11px] font-mono">
                            {subj.code}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <span className="text-phosphor-white font-mono text-[11px]">
                                {subj.score}%
                              </span>
                              <div className="w-14 h-1.5 bg-[#0c0f0e] rounded-full overflow-hidden">
                                <div
                                  className="bg-lime-pulse h-full rounded-full"
                                  style={{ width: `${subj.score}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-lime-pulse font-medium text-[11px]">
                            ↗ Calibrated
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <Link
                              href="/tests"
                              className="px-3 py-1 rounded-full text-[11px] font-semibold text-lime-pulse bg-lime-pulse/10 border border-lime-pulse/30 hover:bg-lime-pulse/20 transition-colors inline-block"
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
                        className="py-6 text-center text-sage-40 text-[12px]"
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
            <div className="bg-[#191c1b] rounded-2xl p-5 border border-[#3f4a38]/40 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-lime-pulse font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">radar</span>
                  Primary Target
                </span>
                <Link
                  href="/target"
                  className="text-sage-40 hover:text-lime-pulse text-[11px] font-mono transition-colors"
                >
                  Manage →
                </Link>
              </div>

              <div>
                <h3 className="text-base font-bold text-phosphor-white tracking-tight">
                  {placementTargets.primaryRole?.name || "Software Engineer"}
                </h3>
                {placementTargets.primaryCompany && (
                  <p className="text-xs font-semibold text-lime-pulse mt-0.5">
                    {placementTargets.primaryCompany.name}
                  </p>
                )}
              </div>

              {targetStrategy.readiness.targetScore !== null && (
                <div className="pt-2.5 border-t border-[#3f4a38]/30 flex items-center justify-between">
                  <span className="text-[11px] text-sage-40">Target Fit Score</span>
                  <span className="text-sm font-mono font-bold text-lime-pulse">
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
