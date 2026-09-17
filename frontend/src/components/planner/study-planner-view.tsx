"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type AdaptiveStudyPlanView,
  type StudyPlanItemData,
  type DaySchedule,
} from "@/server/adaptive-study-planner";
import {
  setStudyTimeBudgetAction,
  recalculateStudyPlanAction,
  updateStudyPlanItemStatusAction,
} from "@/server/actions";
import { Pill, PillTabBar, PillTab, MetaPill } from "@/components/ui/pill";
import { Eyebrow } from "@/components/ui/eyebrow";
import { NexoraLogo } from "@/components/ui/nexora-logo";

interface StudyPlannerViewProps {
  initialPlan: AdaptiveStudyPlanView;
}

export function StudyPlannerView({ initialPlan }: StudyPlannerViewProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<AdaptiveStudyPlanView>(initialPlan);
  const [activeTab, setActiveTab] = useState<"today" | "weekly">("today");
  const [isPending, startTransition] = useTransition();
  const [selectedBudget, setSelectedBudget] = useState<number>(
    plan.availableMinutesPerDay || 60
  );

  const handleBudgetSelect = (minutes: number) => {
    setSelectedBudget(minutes);
    startTransition(async () => {
      try {
        const updated = await setStudyTimeBudgetAction(minutes);
        setPlan(updated);
        router.refresh();
      } catch (err) {
        console.error("Failed to update study budget:", err);
      }
    });
  };

  const handleRecalculate = () => {
    startTransition(async () => {
      try {
        const updated = await recalculateStudyPlanAction("Manual student trigger");
        setPlan(updated);
        router.refresh();
      } catch (err) {
        console.error("Failed to recalculate study plan:", err);
      }
    });
  };

  const handleToggleItemStatus = (item: StudyPlanItemData) => {
    const newStatus = item.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    startTransition(async () => {
      try {
        await updateStudyPlanItemStatusAction(item.id, newStatus);
        // Optimistically update local plan
        const updatedItems = (plan.todaySchedule?.items || []).map((i) =>
          i.id === item.id ? { ...i, status: newStatus as any } : i
        );
        const completedCount = updatedItems.filter((i) => i.status === "COMPLETED").length;
        setPlan({
          ...plan,
          todaySchedule: {
            ...plan.todaySchedule,
            items: updatedItems,
            completedCount,
            isFullyCompleted: completedCount === updatedItems.length && updatedItems.length > 0,
          },
        });
        router.refresh();
      } catch (err) {
        console.error("Failed to update item status:", err);
      }
    });
  };

  // Render Empty State if applicable
  if (plan.emptyState && plan.emptyState.show) {
    return (
      <div className="space-y-8 pb-16">
        <div className="flex items-center gap-2 text-text-muted text-[12px] font-mono mb-1">
          <NexoraLogo size={16} />
          <span className="font-semibold text-white">NEXORA</span>
          <span className="text-zinc-600">/</span>
          <span>PREPARATION</span>
          <span className="text-zinc-600">/</span>
          <span className="text-white">STUDY PLANNER</span>
        </div>

        <div className="rounded-2xl bg-surface-container border border-outline-variant p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6 text-white">
            <span className="material-symbols-outlined text-[28px]">
              {plan.emptyState.type === "budget_unset" ? "schedule" : "quiz"}
            </span>
          </div>

          <h2 className="text-2xl font-bold font-heading text-white tracking-tight mb-2">
            {plan.emptyState.title}
          </h2>
          <p className="text-sm text-text-muted leading-relaxed mb-8 max-w-md mx-auto">
            {plan.emptyState.message}
          </p>

          {plan.emptyState.type === "budget_unset" ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {[30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleBudgetSelect(mins)}
                    disabled={isPending}
                    className={`px-5 py-2.5 rounded-full border text-xs font-mono font-semibold transition-all cursor-pointer ${
                      selectedBudget === mins
                        ? "bg-white text-black border-white shadow-sm scale-105"
                        : "bg-surface border-outline-variant text-zinc-300 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {mins} MIN / DAY
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-mono text-zinc-500">
                You can change your study capacity at any time without losing progress.
              </p>
            </div>
          ) : (
            <Link
              href={plan.emptyState.ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all shadow-md"
            >
              <span>{plan.emptyState.ctaLabel}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const today = plan.todaySchedule;
  const totalAllocated = today.totalAllocatedMinutes;
  const capacity = today.capacityMinutes || plan.availableMinutesPerDay || 60;

  return (
    <div className="space-y-8 pb-16">
      {/* ── Top Header & Strategic Breadcrumb ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-col max-w-3xl">
          <div className="flex items-center gap-1.5 text-text-muted text-[12px] font-mono mb-1">
            <NexoraLogo size={16} />
            <span className="font-semibold text-white">NEXORA</span>
            <span className="text-zinc-600">/</span>
            <span>PREPARATION</span>
            <span className="text-zinc-600">/</span>
            <span className="text-white">STUDY PLANNER</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
            Adaptive Study Planner
          </h1>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed">
            Evidence-calibrated preparation schedule synchronized with Phase 23 multidimensional intelligence, target role requirements, and retention spacing.
          </p>
        </div>

        {/* Recalculate & Capacity Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-end">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container border border-outline-variant text-[11px] font-mono text-zinc-300">
            <span className="material-symbols-outlined text-[15px] text-zinc-400">schedule</span>
            <span>Capacity: <strong className="text-white">{capacity}m/day</strong></span>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant text-zinc-300 hover:text-white text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-50"
            title="Recalibrate plan against latest performance evidence"
          >
            <span className={`material-symbols-outlined text-[15px] ${isPending ? "animate-spin" : ""}`}>
              refresh
            </span>
            <span>{isPending ? "Adapting..." : "Recalibrate Plan"}</span>
          </button>
        </div>
      </div>

      {/* ── View Switcher & Budget Presets ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        {/* Tab Navigation */}
        <PillTabBar>
          <PillTab
            active={activeTab === "today"}
            onClick={() => setActiveTab("today")}
          >
            <span className="material-symbols-outlined text-[16px]">today</span>
            <span>Today&apos;s Plan</span>
            <span className="ml-1 text-[10px] opacity-70">
              ({today.items.length})
            </span>
          </PillTab>
          <PillTab
            active={activeTab === "weekly"}
            onClick={() => setActiveTab("weekly")}
          >
            <span className="material-symbols-outlined text-[16px]">calendar_view_week</span>
            <span>7-Day Horizon</span>
          </PillTab>
        </PillTabBar>

        {/* Quick Capacity Adjuster */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider hidden sm:inline">
            Daily Target:
          </span>
          <div className="flex items-center gap-1">
            {[30, 60, 90, 120].map((mins) => (
              <button
                key={mins}
                onClick={() => handleBudgetSelect(mins)}
                disabled={isPending}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all cursor-pointer ${
                  capacity === mins
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-surface-container"
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── VIEW 1: TODAY'S PLAN ── */}
      {activeTab === "today" && (
        <div className="space-y-6">
          {/* Today Overview Banner */}
          <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                <span className="material-symbols-outlined text-[20px]">flag</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold font-heading text-white">
                    Today&apos;s Preparation Focus
                  </h2>
                  <Pill variant="neutral" size="sm" type="label">
                    v{plan.planVersion}
                  </Pill>
                </div>
                <p className="text-xs text-text-muted mt-0.5 font-mono">
                  {today.completedCount} of {today.totalCount} items completed · {totalAllocated} / {capacity} min allocated
                </p>
              </div>
            </div>

            {/* Capacity Progress Ring / Bar */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="w-32 bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-white h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((totalAllocated / capacity) * 100))}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-white whitespace-nowrap">
                {totalAllocated}/{capacity} min
              </span>
            </div>
          </div>

          {/* Action Items List */}
          <div className="space-y-3">
            {today.items.length === 0 ? (
              <div className="p-8 rounded-2xl bg-surface-container border border-outline-variant text-center">
                <p className="text-sm text-text-muted">No actions scheduled for today. All daily items cleared.</p>
              </div>
            ) : (
              today.items.map((item, idx) => {
                const isCompleted = item.status === "COMPLETED";
                const isFix = item.category === "FIX";
                const isReinforce = item.category === "REINFORCE";
                const isReview = item.category === "REVIEW";

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCompleted
                        ? "bg-surface-container-low/50 border-outline-variant/30 opacity-70"
                        : "bg-surface-container border-outline-variant hover:border-white/30 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Completion Toggle Button */}
                      <button
                        onClick={() => handleToggleItemStatus(item)}
                        disabled={isPending}
                        className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
                          isCompleted
                            ? "bg-white text-black border-white"
                            : "border-outline-variant hover:border-white text-transparent"
                        }`}
                        title={isCompleted ? "Mark as pending" : "Mark as completed"}
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </button>

                      {/* Content */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-text-muted font-semibold">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="font-heading font-semibold text-white text-sm sm:text-base">
                            {item.domain} — {item.topic}
                          </span>

                          {/* Category Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              isFix
                                ? "bg-zinc-800 text-white border border-zinc-700"
                                : isReinforce
                                ? "bg-white/10 text-white border border-white/20"
                                : isReview
                                ? "bg-zinc-900 text-zinc-300 border border-zinc-800"
                                : "bg-white/15 text-white border border-white/30"
                            }`}
                          >
                            {item.category}
                          </span>

                          {/* Duration Badge */}
                          <MetaPill>
                            <span className="material-symbols-outlined text-[12px] mr-1">schedule</span>
                            {item.estimatedMinutes} MIN
                          </MetaPill>

                          {/* Target Indicator */}
                          {item.metadata?.targetDomain && (
                            <span className="px-2 py-0.5 rounded-full bg-white text-black text-[9px] font-mono font-bold uppercase tracking-wider">
                              Target Priority
                            </span>
                          )}
                        </div>

                        {/* Reason / Evidence line */}
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {item.reason}
                        </p>
                        {item.evidence && (
                          <p className="text-[11px] font-mono text-text-muted">
                            Evidence: {item.evidence}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action CTA */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Link
                        href={item.ctaHref}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-xs transition-all shadow-sm ${
                          isCompleted
                            ? "bg-surface border border-outline-variant text-zinc-400 hover:text-white"
                            : "bg-white text-black hover:bg-zinc-200 active:scale-95"
                        }`}
                      >
                        <span>{item.ctaText}</span>
                        <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 2: 7-DAY HORIZON ── */}
      {activeTab === "weekly" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {plan.weeklySchedule.map((day) => (
              <div
                key={day.date}
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                  day.isToday
                    ? "bg-surface-container border-white/40 shadow-sm ring-1 ring-white/20"
                    : "bg-surface-container-low border-outline-variant/60"
                }`}
              >
                {/* Day Header */}
                <div className="border-b border-outline-variant/40 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                      {day.dayOfWeek}
                    </span>
                    {day.isToday && (
                      <span className="px-1.5 py-0.5 rounded bg-white text-black text-[9px] font-mono font-bold">
                        TODAY
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mt-0.5 truncate">
                    {day.displayDate}
                  </h3>
                  <div className="text-[10px] font-mono text-text-muted mt-1">
                    {day.totalAllocatedMinutes} / {day.capacityMinutes} min
                  </div>
                </div>

                {/* Day Items */}
                <div className="space-y-2 flex-1 min-h-[120px]">
                  {day.items.length === 0 ? (
                    <p className="text-[11px] font-mono text-zinc-500 italic py-2">
                      Rest / Spaced buffer
                    </p>
                  ) : (
                    day.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg bg-surface border border-outline-variant/40 text-left space-y-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-semibold text-white truncate">
                            {item.topic}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                            {item.estimatedMinutes}m
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-mono uppercase px-1 rounded bg-zinc-800 text-zinc-300">
                            {item.category}
                          </span>
                          {item.metadata?.isReassessment && (
                            <span className="text-[9px] font-mono text-white bg-zinc-800 px-1 rounded">
                              Reassess
                            </span>
                          )}
                          {item.metadata?.isSpacedReview && (
                            <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-1 rounded">
                              Spaced
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Evidence-Backed Architecture ("Why This Plan?") ── */}
      {plan.whyThisPlan && plan.whyThisPlan.keyDrivers.length > 0 && (
        <section className="p-6 rounded-2xl bg-surface-container border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-white">psychology</span>
            <h3 className="text-sm font-bold font-heading text-white tracking-wide uppercase">
              {plan.whyThisPlan.title}
            </h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {plan.whyThisPlan.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {plan.whyThisPlan.keyDrivers.map((driver, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-surface border border-outline-variant/50 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">
                    {driver.topic}
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {driver.category}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  {driver.reason}
                </p>
                {driver.evidence && (
                  <p className="text-[10px] font-mono text-text-muted">
                    Basis: {driver.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
