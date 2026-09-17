"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/metric-card";

type TestCatalogItem = {
  id: string;
  title: string;
  description: string | null;
  type: "aptitude" | "cs_fundamentals" | "mixed" | "baseline";
  duration: number;
  difficulty: "easy" | "medium" | "hard" | null;
  questionCount: number;
  bestScore: number | null;
  status: string;
  effectiveStatus?: "draft" | "scheduled" | "active" | "closed" | "archived";
  scheduledStartAt?: Date | string | null;
  scheduledEndAt?: Date | string | null;
  scheduleTimezone?: string | null;
};

type Filter = "all" | TestCatalogItem["type"];

const filters: { value: Filter; label: string }[] = [
  { value: "all",             label: "All Tests" },
  { value: "baseline",        label: "Baseline" },
  { value: "aptitude",        label: "Aptitude" },
  { value: "cs_fundamentals", label: "CS Fundamentals" },
  { value: "mixed",           label: "Mixed Placement" },
];

const typeLabels: Record<TestCatalogItem["type"], string> = {
  baseline:        "BASELINE",
  aptitude:        "APTITUDE",
  cs_fundamentals: "CS FUNDAMENTALS",
  mixed:           "MIXED PLACEMENT",
};

const typeIcons: Record<TestCatalogItem["type"], string> = {
  baseline:        "assignment",
  aptitude:        "calculate",
  cs_fundamentals: "memory",
  mixed:           "hub",
};

const difficultyColor: Record<string, string> = {
  easy:   "text-lime-pulse bg-lime-pulse/10 border-lime-pulse/30",
  medium: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30",
  hard:   "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/30",
};

export function TestCatalog({ tests }: { tests: TestCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  // Computed metrics from real tests data
  const metrics = useMemo(() => {
    const total = tests.length;
    const completed = tests.filter((t) => t.status === "completed");
    const inProgress = tests.filter((t) => t.status === "in_progress");
    const scoredTests = completed.filter((t) => t.bestScore !== null);
    const avgScore = scoredTests.length > 0
      ? Math.round(scoredTests.reduce((acc, t) => acc + (t.bestScore ?? 0), 0) / scoredTests.length)
      : 0;
    const topScorers = scoredTests.filter((t) => (t.bestScore ?? 0) >= 75).length;
    const completionPct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    return {
      total,
      completedCount: completed.length,
      completionPct,
      inProgressCount: inProgress.length,
      avgScore,
      topScorersCount: topScorers,
    };
  }, [tests]);

  // Spotlight test (in-progress test, or baseline if uncompleted, or first test)
  const spotlightTest = useMemo(() => {
    const inProg = tests.find((t) => t.status === "in_progress");
    if (inProg) return inProg;
    const uncompletedBaseline = tests.find((t) => t.type === "baseline" && t.status !== "completed");
    if (uncompletedBaseline) return uncompletedBaseline;
    const uncompleted = tests.find((t) => t.status !== "completed");
    return uncompleted ?? tests[0] ?? null;
  }, [tests]);

  const visibleTests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...tests]
      .sort((a, b) => Number(b.type === "baseline") - Number(a.type === "baseline"))
      .filter((test) => {
        const matchesFilter = activeFilter === "all" || test.type === activeFilter;
        const searchable = `${test.title} ${test.description} ${typeLabels[test.type]}`.toLowerCase();
        return matchesFilter && (!q || searchable.includes(q));
      });
  }, [activeFilter, query, tests]);

  return (
    <section aria-labelledby="test-library-heading" className="space-y-8">
      {/* Metric Strip: 4 Diagnostic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Completed (Green) */}
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:border-lime-pulse/40 transition-colors group">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-lime-pulse/5 blur-xl pointer-events-none group-hover:bg-lime-pulse/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-semibold">
              Tests Completed
            </span>
            <div className="w-7 h-7 rounded-full bg-lime-pulse/20 flex items-center justify-center text-lime-pulse">
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-mono text-white tracking-tight">
                {metrics.completedCount}
              </span>
              <span className="text-xs font-mono text-text-muted">/ {metrics.total} total</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-3 mb-2">
              <div
                className="h-full bg-lime-pulse rounded-full transition-all duration-500"
                style={{ width: `${metrics.completionPct}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-text-muted text-[11px] font-mono">
              <span className="text-lime-pulse font-semibold">{metrics.completionPct}% Coverage</span>
              <span>Placement Catalog</span>
            </div>
          </div>
        </div>

        {/* Card 2: Average Score (Blue) */}
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:border-[#38bdf8]/40 transition-colors group">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[#38bdf8]/5 blur-xl pointer-events-none group-hover:bg-[#38bdf8]/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-semibold">
              Diagnostic Average
            </span>
            <div className="w-7 h-7 rounded-full bg-[#38bdf8]/20 flex items-center justify-center text-[#38bdf8]">
              <span className="material-symbols-outlined text-[16px]">query_stats</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-mono text-white tracking-tight">
                {metrics.avgScore > 0 ? `${metrics.avgScore}%` : "--"}
              </span>
              {metrics.avgScore >= 70 && (
                <span className="text-[11px] font-mono text-lime-pulse font-semibold flex items-center">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span> Good
                </span>
              )}
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-3 mb-2">
              <div
                className="h-full bg-[#38bdf8] rounded-full transition-all duration-500"
                style={{ width: `${metrics.avgScore}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-text-muted text-[11px] font-mono">
              <span className="text-[#38bdf8] font-semibold">Calibrated Rubric</span>
              <span>Tier-1 Threshold</span>
            </div>
          </div>
        </div>

        {/* Card 3: In Progress (Amber) */}
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:border-[#f59e0b]/40 transition-colors group">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[#f59e0b]/5 blur-xl pointer-events-none group-hover:bg-[#f59e0b]/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-semibold">
              In Progress Sessions
            </span>
            <div className="w-7 h-7 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
              <span className="material-symbols-outlined text-[16px]">pending</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-mono text-[#f59e0b] tracking-tight">
                {metrics.inProgressCount}
              </span>
              <span className="text-xs font-mono text-text-muted">active tests</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-3 mb-2">
              <div
                className="h-full bg-[#f59e0b] rounded-full transition-all duration-500"
                style={{ width: metrics.inProgressCount > 0 ? "50%" : "0%" }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-text-muted text-[11px] font-mono">
              <span className="text-[#f59e0b] font-semibold">
                {metrics.inProgressCount > 0 ? "Needs Completion" : "All Caught Up"}
              </span>
              <span>Active</span>
            </div>
          </div>
        </div>

        {/* Card 4: Top Benchmark (Purple) */}
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:border-purple-400/40 transition-colors group">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-purple-500/5 blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted font-semibold">
              Mastered Tests (&ge;75%)
            </span>
            <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
              <span className="material-symbols-outlined text-[16px]">military_tech</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-mono text-white tracking-tight">
                {metrics.topScorersCount}
              </span>
              <span className="text-xs font-mono text-text-muted">high scores</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-3 mb-2">
              <div
                className="h-full bg-purple-400 rounded-full transition-all duration-500"
                style={{ width: `${metrics.total > 0 ? (metrics.topScorersCount / metrics.total) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-text-muted text-[11px] font-mono">
              <span className="text-purple-400 font-semibold">Tier-1 Shortlist Ready</span>
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Adaptive Drill Spotlight Banner */}
      {spotlightTest && (
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-6 sm:p-8 relative overflow-hidden shadow-md">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-lime-pulse/10 via-[#38bdf8]/5 to-transparent blur-3xl pointer-events-none"></div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col max-w-3xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-0.5 rounded-full bg-lime-pulse/20 text-lime-pulse font-mono text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse animate-pulse"></span>
                  {spotlightTest.status === "in_progress" ? "ACTIVE IN PROGRESS" : "RECOMMENDED DIAGNOSTIC"}
                </span>
                <span className="text-xs font-mono text-text-muted">
                  {typeLabels[spotlightTest.type]}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                {spotlightTest.title}
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
                {spotlightTest.description || "Calibrated placement assessment designed to evaluate fundamental and domain concepts under timed conditions."}
              </p>
              {/* Meta pills */}
              <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 text-text-primary">
                  <span className="material-symbols-outlined text-[15px] text-text-muted">quiz</span>
                  <span>{spotlightTest.questionCount} Questions</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 text-text-primary">
                  <span className="material-symbols-outlined text-[15px] text-text-muted">schedule</span>
                  <span>{spotlightTest.duration} Mins</span>
                </div>
                {spotlightTest.difficulty && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold uppercase ${difficultyColor[spotlightTest.difficulty]}`}>
                    <span>{spotlightTest.difficulty} Difficulty</span>
                  </div>
                )}
                {spotlightTest.bestScore !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-pulse/10 border border-lime-pulse/30 text-lime-pulse">
                    <span>Best Score: {spotlightTest.bestScore}%</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-center gap-2 shrink-0">
              <Link
                href={`/tests/${spotlightTest.id}`}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-lime-pulse text-void-black font-semibold text-xs hover:brightness-110 shadow-md transition-all"
              >
                <span>{spotlightTest.status === "in_progress" ? "Resume Test" : "Start Test Now"}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
              <span className="text-[11px] font-mono text-text-muted text-center lg:text-right">
                Timed Placement Environment
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter Strip Pill Matrix */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant/30">
        {/* Search Input with ⌘K style */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-text-muted pointer-events-none">
            search
          </span>
          <input
            id="test-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search diagnostic tests, skills, topics..."
            className="w-full h-10 bg-surface-container-low border border-outline-variant/40 rounded-full pl-10 pr-4 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-lime-pulse transition-colors"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filters.map((f) => {
            const count = f.value === "all"
              ? tests.length
              : tests.filter((t) => t.type === f.value).length;
            const isActive = activeFilter === f.value;

            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-white text-void-black shadow-sm"
                    : "bg-surface-container hover:bg-surface-container-high text-text-secondary hover:text-white border border-outline-variant/30"
                }`}
              >
                <span>{f.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? "bg-void-black/20 text-void-black" : "bg-surface-container-low text-text-muted"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Tests */}
      {visibleTests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleTests.map((test) => {
            const isBaseline  = test.type === "baseline";
            const isCompleted = test.status === "completed";
            const isInProgress = test.status === "in_progress";
            const isClosed    = test.effectiveStatus === "closed";
            const isScheduled = test.effectiveStatus === "scheduled";

            const ctaLabel =
              isInProgress ? "Resume Test" :
              isScheduled  ? "View Schedule" :
              isClosed && !isCompleted ? "Assessment Closed" :
              isCompleted  ? "Retake Test" :
              "Start Test";

            const ctaIcon =
              isInProgress ? "play_arrow" :
              isScheduled  ? "schedule" :
              isCompleted  ? "refresh" :
              "arrow_forward";

            const scoreColor =
              (test.bestScore ?? 0) >= 75 ? "text-lime-pulse" :
              (test.bestScore ?? 0) >= 50 ? "text-[#f59e0b]" :
              "text-[#f87171]";

            return (
              <article
                key={test.id}
                className={`group flex flex-col rounded-2xl border p-5 transition-all duration-200 bg-surface-container-low ${
                  isBaseline
                    ? "border-lime-pulse/40 shadow-[0_0_15px_rgba(127,238,100,0.06)]"
                    : "border-outline-variant/30 hover:border-outline-variant/70 hover:bg-surface-container"
                }`}
              >
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  {/* Icon Avatar */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isBaseline
                        ? "bg-lime-pulse/15 border-lime-pulse/30 text-lime-pulse"
                        : "bg-surface-container-highest border-outline-variant/30 text-text-secondary group-hover:text-lime-pulse transition-colors"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {typeIcons[test.type]}
                    </span>
                  </div>

                  {/* Status & Difficulty Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {isBaseline && (
                      <span className="px-2 py-0.5 rounded-full bg-lime-pulse/15 border border-lime-pulse/30 text-lime-pulse font-mono text-[10px] font-bold uppercase">
                        BASELINE
                      </span>
                    )}
                    {isScheduled && (
                      <span className="px-2 py-0.5 rounded-full bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#38bdf8] font-mono text-[10px] font-bold uppercase">
                        UPCOMING
                      </span>
                    )}
                    {isInProgress && (
                      <span className="px-2 py-0.5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[#f59e0b] font-mono text-[10px] font-bold uppercase flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#f59e0b] animate-ping"></span>
                        IN PROGRESS
                      </span>
                    )}
                    {isClosed && !isCompleted && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/40 text-text-muted font-mono text-[10px] font-bold uppercase">
                        CLOSED
                      </span>
                    )}
                    {test.difficulty && (
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase ${difficultyColor[test.difficulty] ?? ""}`}>
                        {test.difficulty}
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1">
                    {typeLabels[test.type]}
                  </div>
                  <h3 className="text-base font-bold text-white leading-snug mb-1.5 line-clamp-2">
                    {test.title}
                  </h3>
                  {test.description && (
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3">
                      {test.description}
                    </p>
                  )}

                  {/* Meta Pills */}
                  <div className="flex items-center gap-2 flex-wrap mb-4 text-[11px] font-mono">
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-text-muted">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      {test.duration} MIN
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-text-muted">
                      <span className="material-symbols-outlined text-[13px]">format_list_numbered</span>
                      {test.questionCount} Q
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-outline-variant/20 pt-3 mt-auto space-y-2.5">
                  {/* Score / Status Row */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-text-muted text-[10px] uppercase tracking-wider">Status</span>
                    <span className={`font-semibold ${
                      isCompleted ? scoreColor :
                      isInProgress ? "text-[#f59e0b]" :
                      "text-text-muted"
                    }`}>
                      {isInProgress ? "IN PROGRESS" :
                       isCompleted && test.bestScore !== null ? `COMPLETED · ${test.bestScore}/100` :
                       isCompleted ? "COMPLETED" :
                       isScheduled ? "UPCOMING" :
                       isClosed ? "CLOSED" :
                       "NOT ATTEMPTED"}
                    </span>
                  </div>

                  {/* Progress Bar if has score */}
                  {isCompleted && test.bestScore !== null && (
                    <ProgressBar
                      value={test.bestScore}
                      color={test.bestScore >= 75 ? "green" : test.bestScore >= 50 ? "amber" : "rose"}
                      size="xs"
                      animated
                    />
                  )}

                  {/* CTA Link */}
                  <Link
                    href={`/tests/${test.id}`}
                    className={`w-full h-9 flex items-center justify-center gap-2 rounded-full font-semibold text-xs border transition-all ${
                      isClosed && !isCompleted
                        ? "border-outline-variant/30 bg-surface-container text-text-muted cursor-not-allowed pointer-events-none opacity-60"
                        : isBaseline || (!isCompleted && !isInProgress)
                        ? "border-lime-pulse bg-lime-pulse text-void-black hover:brightness-110 shadow-sm"
                        : "border-outline-variant/40 bg-surface-container text-text-primary hover:border-lime-pulse hover:text-lime-pulse"
                    }`}
                  >
                    <span>{ctaLabel}</span>
                    <span className="material-symbols-outlined text-[15px]">{ctaIcon}</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="search_off"
          title="No diagnostic tests found"
          description="Try a different search query or select another category filter."
          accentColor="neutral"
          size="md"
        />
      )}
    </section>
  );
}