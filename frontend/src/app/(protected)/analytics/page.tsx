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
          <h2 className="text-2xl font-bold font-heading text-phosphor-white">
            Your analytics will appear here.
          </h2>
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

  const breadcrumbs = [
    { label: "NEXORA", href: "/dashboard" },
    { label: "PREPARATION", href: "/tests" },
    { label: "ANALYTICS INTELLIGENCE" },
  ];

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto">
      {/* ── Top Header & Filter Pills ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <PageHeader
          breadcrumbs={breadcrumbs}
          title="Placement Trajectory & Competency Analytics"
          subtitle="Longitudinal benchmarking against Tier-1 engineering cohorts, velocity telemetry, and algorithmic mastery projections."
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
            <span>Tier-1 Median Benchmark</span>
          </div>
        </div>
      </div>

      {/* ── Top KPI Summary Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Aggregate Placement Readiness */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 shadow-sm flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] font-mono tracking-wider uppercase text-sage-40 font-semibold">
              Placement Readiness
            </span>
            <div className="w-8 h-8 rounded-full bg-lime-pulse/15 border border-lime-pulse/30 flex items-center justify-center text-lime-pulse">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
                {analytics.readiness.score ?? "--"}%
              </span>
              <span className="text-[11px] font-mono text-lime-pulse flex items-center">
                <span className="material-symbols-outlined text-[13px]">arrow_upward</span>
                {readiness.level?.label || "CALIBRATED"}
              </span>
            </div>
            <p className="text-[11px] text-sage-40 mt-1">
              Deterministic across 7 placement domains
            </p>
          </div>
          <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-4 overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-lime-pulse h-full rounded-full transition-all duration-500"
              style={{ width: `${analytics.readiness.score ?? 0}%` }}
            />
          </div>
        </div>

        {/* Card 2: Tests Completed Velocity */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 shadow-sm flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] font-mono tracking-wider uppercase text-sage-40 font-semibold">
              Execution Velocity
            </span>
            <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <span className="material-symbols-outlined text-[18px]">speed</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
                {analytics.overview.testsCompleted}
              </span>
              <span className="text-[11px] font-mono text-sage-40">tests evaluated</span>
            </div>
            <p className="text-[11px] text-sage-40 mt-1">
              {analytics.overview.questionsAttempted} questions solved across topics
            </p>
          </div>
          <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-4 overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-purple-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, analytics.overview.testsCompleted * 10)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Overall Accuracy */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 shadow-sm flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] font-mono tracking-wider uppercase text-sage-40 font-semibold">
              Accuracy Index
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-[18px]">track_changes</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
                {analytics.overview.avgAccuracy}%
              </span>
              <span className="text-[11px] font-mono text-blue-400">
                {analytics.overview.questionsCorrect} correct
              </span>
            </div>
            <p className="text-[11px] text-sage-40 mt-1">
              Average across all attempted evaluation sessions
            </p>
          </div>
          <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-4 overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-blue-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${analytics.overview.avgAccuracy}%` }}
            />
          </div>
        </div>

        {/* Card 4: Average Score */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 shadow-sm flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] font-mono tracking-wider uppercase text-sage-40 font-semibold">
              Average Score
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-[18px]">psychology</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
                {analytics.overview.avgScore}%
              </span>
              <span className="text-[11px] font-mono text-amber-400">
                {analytics.overview.questionsAttempted} graded
              </span>
            </div>
            <p className="text-[11px] text-sage-40 mt-1">
              Normalized scoring benchmark across subjects
            </p>
          </div>
          <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-4 overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${analytics.overview.avgScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 01. READINESS SECTION ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#3f4a38]/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30">
              01
            </span>
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-phosphor-white">
              READINESS CALIBRATION
            </h2>
          </div>
          <span className="text-[11px] font-mono text-sage-40">Dynamic Calibration</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <ReadinessGaugeCard readiness={analytics.readiness} />
          </div>
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 space-y-4 shadow-md">
            <div>
              <span className="text-[11px] font-mono uppercase text-sage-40 block mb-1">
                Readiness Model Overview
              </span>
              <h3 className="text-base font-semibold text-phosphor-white">
                Comprehensive Multi-Domain Calibration
              </h3>
              <p className="mt-2 text-xs text-sage-40 leading-relaxed">
                Placement readiness is deterministically calculated across Aptitude, DSA, Core CS, and SQL benchmarks. Rather than a simple average, Nexora weights critical domain competencies against technical placement requirements.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#3f4a38]/30 text-center font-mono">
              <div className="p-3 rounded-xl bg-[#111413] border border-[#3f4a38]/30">
                <span className="text-[10px] text-sage-40 block">DSA</span>
                <span className="text-base font-bold text-lime-pulse">
                  {analytics.readiness.breakdown?.dsa ?? 0}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#111413] border border-[#3f4a38]/30">
                <span className="text-[10px] text-sage-40 block">Core CS</span>
                <span className="text-base font-bold text-lime-pulse">
                  {analytics.readiness.breakdown?.coreCs ?? 0}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#111413] border border-[#3f4a38]/30">
                <span className="text-[10px] text-sage-40 block">SQL</span>
                <span className="text-base font-bold text-lime-pulse">
                  {analytics.readiness.breakdown?.sql ?? 0}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#111413] border border-[#3f4a38]/30">
                <span className="text-[10px] text-sage-40 block">Aptitude</span>
                <span className="text-base font-bold text-lime-pulse">
                  {analytics.readiness.breakdown?.aptitude ?? 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02. DIFFICULTY BREAKDOWN ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#3f4a38]/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              02
            </span>
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-phosphor-white">
              DIFFICULTY CALIBRATION
            </h2>
          </div>
          <span className="text-[11px] font-mono text-sage-40">Easy • Medium • Hard</span>
        </div>

        <DifficultyPerformanceCard difficultyPerformance={analytics.difficultyPerformance} />
      </section>

      {/* ── 03. SUBJECT ATTRIBUTION DRIVERS ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#3f4a38]/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              03
            </span>
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-phosphor-white">
              DOMAIN ATTRIBUTION DRIVERS
            </h2>
          </div>
          <span className="text-[11px] font-mono text-sage-40">Helping vs Holding Back</span>
        </div>

        <div className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Positive Contributors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-lime-pulse uppercase">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Helping Your Readiness
                </span>
                <span className="text-[10px] text-sage-40">Benchmark Exceeded</span>
              </div>

              {readiness.positiveContributors.length > 0 ? (
                <div className="space-y-2">
                  {readiness.positiveContributors.slice(0, 3).map((c) => (
                    <div
                      key={c.code}
                      className="p-3.5 rounded-xl bg-[#111413] border border-[#3f4a38]/30 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium text-phosphor-white">
                          {c.name}
                        </div>
                        <div className="text-[10px] font-mono text-sage-40 mt-0.5">
                          {c.status} • Weight: {(c.weight * 100).toFixed(0)}%
                        </div>
                      </div>
                      <span className="text-base font-bold font-mono text-lime-pulse">
                        +{c.score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-sage-40 py-2">
                  Complete more tests to elevate domain scores into positive contributors.
                </p>
              )}
            </div>

            {/* Negative Contributors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-rose-400 uppercase">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                  Holding Your Readiness Back
                </span>
                <span className="text-[10px] text-sage-40">Targeted Deficits</span>
              </div>

              {readiness.negativeContributors.length > 0 ? (
                <div className="space-y-2">
                  {readiness.negativeContributors.slice(0, 3).map((c) => (
                    <div
                      key={c.code}
                      className="p-3.5 rounded-xl bg-[#111413] border border-[#3f4a38]/30 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium text-phosphor-white">
                          {c.name}
                        </div>
                        <div className="text-[10px] font-mono text-sage-40 mt-0.5">
                          {c.status} • Weight: {(c.weight * 100).toFixed(0)}%
                        </div>
                      </div>
                      <span className="text-base font-bold font-mono text-rose-400">
                        {c.score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-lime-pulse py-2">
                  No significant domain deficits detected. All tested domains meet benchmark.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 04. TOPIC STRENGTH MATRIX ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#3f4a38]/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
              04
            </span>
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-phosphor-white">
              GRANULAR TOPIC MATRIX
            </h2>
          </div>
          <span className="text-[11px] font-mono text-sage-40">Strengths vs Weaknesses</span>
        </div>

        <TopicStrengthMatrixCard
          strongestTopics={analytics.strongestTopics}
          weakestTopics={analytics.weakestTopics}
        />
      </section>

      {/* ── 05. PERFORMANCE OVER TIME ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#3f4a38]/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              05
            </span>
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-phosphor-white">
              HISTORICAL TRAJECTORY
            </h2>
          </div>
          <span className="text-[11px] font-mono text-sage-40">Performance Progression</span>
        </div>

        <PerformanceTrendsChart
          performanceOverTime={analytics.performanceOverTime}
          overallTrend={trend.overall}
        />
      </section>

      {/* ── 06. PRESCRIPTIVE RECOMMENDATIONS ── */}
      {recommendations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#3f4a38]/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30">
                06
              </span>
              <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-phosphor-white">
                PRESCRIPTIVE RECOMMENDATIONS
              </h2>
            </div>
            <span className="text-[11px] font-mono text-sage-40">
              {recommendations.length} Prioritized Actions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className="p-5 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 flex flex-col justify-between shadow-md group hover:border-[#88957f]/60 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        rec.priority === "Critical"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : rec.priority === "High"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-[#282b29] text-sage-40 border border-[#3f4a38]/40"
                      }`}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-[11px] font-mono text-lime-pulse font-medium">
                      {rec.metric}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-phosphor-white mb-1">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-sage-40 leading-relaxed mb-4">
                    {rec.reason}
                  </p>
                </div>

                <Link
                  href={rec.route || "/tests"}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-lime-pulse/10 text-lime-pulse border border-lime-pulse/30 hover:bg-lime-pulse hover:text-void-black transition-all flex items-center justify-center gap-1.5"
                >
                  <span>{rec.ctaText || "Take Action"}</span>
                  <span className="text-sm leading-none">→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 07. PHASE 23 INTELLIGENCE 2.0 FULL VIEW ── */}
      {placementIntelligence2 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#3f4a38]/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30">
                07
              </span>
              <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-phosphor-white">
                INTELLIGENCE 2.0 — MULTI-DIMENSIONAL COMPETENCY MATRIX
              </h2>
            </div>
            <span className="text-[11px] font-mono text-sage-40">14 Dimensions</span>
          </div>

          <PlacementIntelligence2View intelligence={placementIntelligence2} />
        </section>
      )}
    </div>
  );
}
