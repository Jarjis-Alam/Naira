import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAnalyticsData } from "@/server/analytics";
import { getStudentIntelligence } from "@/server/student-intelligence";
import { getPlacementIntelligence2 } from "@/server/placement-intelligence-2";
import { db } from "@/db";
import { tests } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ReadinessGaugeCard,
  PerformanceTrendsChart,
  DifficultyPerformanceCard,
  TopicStrengthMatrixCard,
} from "@/components/analytics/analytics-charts";
import { PlacementIntelligence2View } from "@/components/analytics/placement-intelligence-2-view";
import { PageHeader } from "@/components/ui/page-header";
import { CompactMetricStrip } from "@/components/ui/compact-metric-strip";
import { DisclosurePanel } from "@/components/ui/disclosure-panel";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;
  const [analytics, intelligence, placementIntelligence2] = await Promise.all([
    getAnalyticsData(userId),
    getStudentIntelligence(userId),
    getPlacementIntelligence2(userId).catch(() => null),
  ]);

  // Baseline test id for empty state CTA
  const baselineList = await db
    .select({ id: tests.id })
    .from(tests)
    .where(eq(tests.type, "baseline"))
    .limit(1);
  const baselineId = baselineList[0]?.id;

  // Empty State
  if (!analytics.hasData || !intelligence.dataSufficiency.hasCompletedBaseline) {
    return (
      <div className="py-20 text-center max-w-xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#191c1b] border border-[#3f4a38]/40 flex items-center justify-center text-lime-pulse mx-auto shadow-md">
          <span className="material-symbols-outlined text-[32px]">insights</span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-phosphor-white">
            Your analytics will appear here.
          </h1>
          <p className="text-[13px] text-sage-40 mt-2 leading-relaxed">
            Complete your baseline assessment to unlock personalized recommendations, readiness driver attribution, and trajectory tracking.
          </p>
        </div>

        <div className="pt-4">
          <Link
            href={baselineId ? `/tests` : "/tests"}
            className="bg-lime-pulse text-void-black font-semibold text-xs px-8 py-3 rounded-full hover:bg-mint-frost transition-all inline-flex items-center gap-2 shadow-[0_0_20px_rgba(127,238,100,0.25)]"
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            Start Baseline Assessment
          </Link>
        </div>
      </div>
    );
  }

  const { trend, readiness, recommendations } = intelligence;

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto">
      {/* ── Top Header & Filter Pills ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <PageHeader
          title="Performance Analytics"
          subtitle="Track performance trends, topic accuracy, and placement readiness across domains."
        />

        {/* Filter Pills Bar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#191c1b] p-1.5 rounded-full border border-[#3f4a38]/40 self-start lg:self-auto shrink-0 shadow-inner">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-lime-pulse text-void-black shadow-sm"
          >
            All Time
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-transparent text-sage-40 hover:text-phosphor-white hover:bg-[#282b29] transition-colors"
          >
            Last 30 Days
          </button>
          <div className="h-4 w-px bg-[#3f4a38]/60 mx-0.5" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-sage-40 font-mono">
            <span className="w-2 h-2 rounded-full bg-lime-pulse" />
            <span>Tier-1 Benchmark</span>
          </div>
        </div>
      </div>

      {/* ── Top KPI Summary Strip ── */}
      <CompactMetricStrip
        items={[
          {
            id: "readiness",
            label: "Placement Readiness",
            value: analytics.readiness.score != null ? `${analytics.readiness.score}%` : "--",
            detail: "7 placement domains",
            statusText: readiness.level?.label || "CALIBRATED",
            progressPct: analytics.readiness.score ?? null,
          },
          {
            id: "tests",
            label: "Tests Completed",
            value: analytics.overview.testsCompleted,
            detail: `${analytics.overview.questionsAttempted} attempted`,
            statusText: "Velocity",
            progressPct: Math.min(100, analytics.overview.testsCompleted * 10),
          },
          {
            id: "accuracy",
            label: "Accuracy",
            value: `${analytics.overview.avgAccuracy}%`,
            detail: `${analytics.overview.questionsCorrect} correct`,
            statusText: "Precision",
            progressPct: analytics.overview.avgAccuracy,
          },
          {
            id: "avg-score",
            label: "Average Score",
            value: `${analytics.overview.avgScore}%`,
            detail: "Across subjects",
            statusText: "Score",
            progressPct: analytics.overview.avgScore,
          },
        ]}
      />

      {/* ── READINESS SECTION ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <h2 className="text-sm font-semibold tracking-wider text-phosphor-white">
            Readiness Calibration
          </h2>
          <span className="text-[11px] font-mono text-zinc-400">Current Level</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <ReadinessGaugeCard readiness={analytics.readiness} />
          </div>
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-zinc-800 bg-[#0d0d10] p-6 space-y-4 shadow-md">
            <div>
              <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                Overview
              </span>
              <h3 className="text-base font-semibold text-phosphor-white">
                Domain Calibration
              </h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Placement readiness is weighted across Aptitude, DSA, Core CS, and SQL benchmarks based on technical placement requirements.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-800 text-center font-mono">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">DSA</span>
                <span className="text-base font-bold text-white">
                  {analytics.readiness.breakdown?.dsa ?? 0}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Core CS</span>
                <span className="text-base font-bold text-white">
                  {analytics.readiness.breakdown?.coreCs ?? 0}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">SQL</span>
                <span className="text-base font-bold text-white">
                  {analytics.readiness.breakdown?.sql ?? 0}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Aptitude</span>
                <span className="text-base font-bold text-white">
                  {analytics.readiness.breakdown?.aptitude ?? 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DOMAIN ATTRIBUTION ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <h2 className="text-sm font-semibold tracking-wider text-phosphor-white">
            Domain Attribution
          </h2>
          <span className="text-[11px] font-mono text-zinc-400">Benchmark Comparison</span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#0d0d10] p-6 shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Positive Contributors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-white uppercase">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Above Benchmark
                </span>
                <span className="text-[10px] text-zinc-400">Strong</span>
              </div>

              {readiness.positiveContributors.length > 0 ? (
                <div className="space-y-2">
                  {readiness.positiveContributors.slice(0, 3).map((c) => (
                    <div
                      key={c.code}
                      className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium text-phosphor-white">
                          {c.name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          {c.status} • Weight: {(c.weight * 100).toFixed(0)}%
                        </div>
                      </div>
                      <span className="text-base font-bold font-mono text-white">
                        +{c.score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-zinc-400 py-2">
                  Complete more tests to elevate domain scores into positive contributors.
                </p>
              )}
            </div>

            {/* Negative Contributors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                  Needs Focus
                </span>
                <span className="text-[10px] text-zinc-500">Below Benchmark</span>
              </div>

              {readiness.negativeContributors.length > 0 ? (
                <div className="space-y-2">
                  {readiness.negativeContributors.slice(0, 3).map((c) => (
                    <div
                      key={c.code}
                      className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium text-phosphor-white">
                          {c.name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          {c.status} • Weight: {(c.weight * 100).toFixed(0)}%
                        </div>
                      </div>
                      <span className="text-base font-bold font-mono text-zinc-300">
                        {c.score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-zinc-300 py-2">
                  No significant domain deficits detected. All tested domains meet benchmark.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLACEMENT INTELLIGENCE (14 DIMENSIONS & EVIDENCE) ── */}
      {placementIntelligence2 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <h2 className="text-sm font-semibold tracking-wider text-phosphor-white">
              Placement Intelligence
            </h2>
            <span className="text-[11px] font-mono text-zinc-400">14 Dimensions</span>
          </div>

          <PlacementIntelligence2View intelligence={placementIntelligence2} />
        </section>
      )}

      {/* ── DEEP DIAGNOSTICS & TRENDS (PROGRESSIVE DISCLOSURE) ── */}
      <section>
        <DisclosurePanel
          title="Diagnostic Analytics & Trends"
          subtitle="Performance over time, topic strengths/weaknesses, and difficulty breakdown"
          countBadge="Diagnostics"
          defaultOpen={false}
        >
          <div className="space-y-8 pt-2">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800/60">
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                  Performance Trends
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">Score Progression</span>
              </div>
              <PerformanceTrendsChart
                performanceOverTime={analytics.performanceOverTime}
                overallTrend={trend.overall}
              />
            </div>

            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800/60">
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                  Topic Performance
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">Strengths & Weaknesses</span>
              </div>
              <TopicStrengthMatrixCard
                strongestTopics={analytics.strongestTopics}
                weakestTopics={analytics.weakestTopics}
              />
            </div>

            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800/60">
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                  Difficulty Breakdown
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">Easy • Medium • Hard</span>
              </div>
              <DifficultyPerformanceCard difficultyPerformance={analytics.difficultyPerformance} />
            </div>
          </div>
        </DisclosurePanel>
      </section>

      {/* ── RECOMMENDED ACTIONS ── */}
      {recommendations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <h2 className="text-sm font-semibold tracking-wider text-phosphor-white">
              Recommended Actions
            </h2>
            <span className="text-[11px] font-mono text-zinc-400">
              {recommendations.length} Actions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className="p-5 rounded-xl bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between shadow-sm group hover:border-zinc-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        rec.priority === "Critical"
                          ? "bg-white/20 text-white border border-white/30"
                          : rec.priority === "High"
                          ? "bg-white/10 text-zinc-300 border border-white/20"
                          : "bg-white/5 text-zinc-400 border border-white/10"
                      }`}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-[11px] font-mono text-white font-medium">
                      {rec.metric}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-phosphor-white mb-1">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    {rec.reason}
                  </p>
                </div>

                <Link
                  href={rec.route || "/tests"}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>{rec.ctaText || "Take Action"}</span>
                  <span className="text-sm leading-none">→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
