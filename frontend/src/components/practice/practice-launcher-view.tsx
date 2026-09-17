"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill, MetaPill } from "@/components/ui/pill";
import { Eyebrow } from "@/components/ui/eyebrow";
import { generatePracticeSessionAction } from "@/server/actions";
import { type SelectionResult } from "@/server/practice-question-intelligence";

interface PracticeLauncherViewProps {
  initialSelection: SelectionResult;
  topicId?: string;
  subjectCode?: string;
  planItemId?: string;
  precreatedTestId?: string;
}

export function PracticeLauncherView({
  initialSelection,
  topicId,
  subjectCode,
  planItemId,
  precreatedTestId,
}: PracticeLauncherViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selection = initialSelection;
  const isAvailable =
    !selection.emptyState && selection.selectedQuestions.length > 0;

  const handleStartPractice = () => {
    if (precreatedTestId) {
      router.push(`/tests/${precreatedTestId}`);
      return;
    }

    startTransition(async () => {
      try {
        setErrorMsg(null);
        const res = await generatePracticeSessionAction({
          topicId: topicId || selection.topicId || undefined,
          subjectCode: subjectCode || selection.subjectCode || undefined,
          objective: selection.objective,
          questionCount: selection.selectedQuestions.length,
          planItemId,
        });

        if (res.testId) {
          router.push(`/tests/${res.testId}`);
        } else if (res.emptyState) {
          setErrorMsg(res.emptyState.message);
        }
      } catch (err: unknown) {
        console.error("Failed to start practice session:", err);
        setErrorMsg(err instanceof Error ? err.message : "Failed to initialize practice test.");
      }
    });
  };

  const getDifficultyLabel = (diff: string) => {
    switch (diff) {
      case "easy":
        return "Foundational (Easy)";
      case "medium":
        return "Core Concept (Medium)";
      case "hard":
        return "Challenge (Hard)";
      default:
        return "Standard Practice";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-label-xs font-mono text-text-muted">
          <Link href="/dashboard" className="hover:text-text-primary transition-colors">
            Dashboard
          </Link>
          <span className="text-border">/</span>
          <Link href="/planner" className="hover:text-text-primary transition-colors">
            Planner
          </Link>
          <span className="text-border">/</span>
          <span className="text-text-primary">Practice Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          <MetaPill>Practice OS</MetaPill>
          <MetaPill>Deterministic</MetaPill>
        </div>
      </div>

      {/* Main Container */}
      {!isAvailable ? (
        /* Empty / Unavailable State */
        <div className="rounded-2xl border border-border bg-surface-lowest p-8 text-center space-y-6">
          <div className="w-12 h-12 rounded-full bg-surface-high border border-border flex items-center justify-center text-text-primary mx-auto">
            <span className="material-symbols-outlined text-[24px]">search_off</span>
          </div>
          <div>
            <h1 className="text-headline-sm font-bold text-text-primary">
              No Practice Questions Available
            </h1>
            <p className="text-body-sm text-text-secondary mt-2 max-w-md mx-auto leading-relaxed">
              {selection.emptyState?.message ||
                "No verified questions currently exist in the question bank for this topic. You can explore standard curriculum tests."}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/planner"
              className="px-4 py-2 rounded-buttons border border-border bg-surface-high hover:border-neutral-border text-body-sm font-medium text-text-primary transition-colors"
            >
              Back to Planner
            </Link>
            <Link
              href="/tests"
              className="px-4 py-2 rounded-buttons bg-text-primary hover:bg-neutral-light text-body-sm font-medium text-void-black transition-colors"
            >
              Browse Assessments
            </Link>
          </div>
        </div>
      ) : (
        /* Active Practice Launcher */
        <div className="space-y-6">
          {/* Top Focus Banner */}
          <div className="rounded-2xl border border-border bg-surface-lowest p-6 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Pill variant="neutral">
                  {selection.objective}
                </Pill>
                <span className="font-mono text-label-xs text-text-muted uppercase">
                  {selection.subjectCode || "CS"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-label-xs font-mono text-text-muted">
                <span>{selection.selectedQuestions.length} Questions</span>
                <span>•</span>
                <span>~{Math.round(selection.selectedQuestions.length * 2.5)} min</span>
              </div>
            </div>

            <div>
              <Eyebrow category="Practice Session" className="mb-1" />
              <h1 className="text-headline-md font-bold text-text-primary tracking-tight">
                {selection.subjectCode ? `${selection.subjectCode} — ` : ""}
                {selection.topicName || "Targeted Practice"}
              </h1>
            </div>

            {/* Evidence Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-border bg-surface-middle space-y-1">
                <div className="text-label-xs font-mono text-text-muted uppercase">
                  Recent Accuracy
                </div>
                <div className="text-title-md font-bold font-mono text-text-primary">
                  {selection.evidence.recentAccuracy !== null
                    ? `${selection.evidence.recentAccuracy}%`
                    : "No attempts"}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-middle space-y-1">
                <div className="text-label-xs font-mono text-text-muted uppercase">
                  History
                </div>
                <div className="text-title-md font-bold font-mono text-text-primary">
                  {selection.evidence.attemptCount > 0
                    ? `${selection.evidence.attemptCount} attempt${selection.evidence.attemptCount > 1 ? "s" : ""}`
                    : "First drill"}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-middle space-y-1">
                <div className="text-label-xs font-mono text-text-muted uppercase">
                  Mistake Pattern
                </div>
                <div className="text-title-md font-bold font-mono text-text-primary truncate">
                  {selection.evidence.hasRepeatedMistakes ? (
                    <span className="text-amber-400">Repeated Gaps</span>
                  ) : (
                    <span className="text-text-muted">Normal</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-middle space-y-1">
                <div className="text-label-xs font-mono text-text-muted uppercase">
                  Target Alignment
                </div>
                <div className="text-title-md font-bold font-mono text-text-primary truncate">
                  {selection.selectedQuestions[0]?.targetRelevance ? "Required" : "Core"}
                </div>
              </div>
            </div>

            {/* Start Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-border/60">
              <div className="text-body-xs text-text-muted">
                {selection.requestedCount > selection.availableCount && (
                  <span>
                    Note: {selection.availableCount} verified questions available (requested {selection.requestedCount}).
                  </span>
                )}
              </div>

              <button
                onClick={handleStartPractice}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-buttons bg-text-primary hover:bg-neutral-light disabled:opacity-50 text-void-black text-body-sm font-semibold transition-all shadow-sm"
              >
                {isPending ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>Initializing Session...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    <span>Start Practice Session</span>
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-body-xs text-red-400">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Why These Questions? Explanation Card */}
          <div className="rounded-2xl border border-border bg-surface-lowest p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-text-muted">
                help_outline
              </span>
              <h2 className="text-title-sm font-bold text-text-primary">
                Why These Questions?
              </h2>
            </div>

            <p className="text-body-sm text-text-secondary leading-relaxed">
              {selection.explanation.rationale}
            </p>

            {selection.explanation.targetAlignmentNote && (
              <div className="p-3 rounded-xl border border-border bg-surface-middle/50 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-text-muted">
                  adjust
                </span>
                <span className="text-body-xs text-text-secondary">
                  {selection.explanation.targetAlignmentNote}
                </span>
              </div>
            )}

            {selection.evidence.repeatedMistakeNote && (
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-amber-400">
                  history_toggle_off
                </span>
                <span className="text-body-xs text-amber-200">
                  {selection.evidence.repeatedMistakeNote}
                </span>
              </div>
            )}
          </div>

          {/* Question Set Sequence Preview */}
          <div className="rounded-2xl border border-border bg-surface-lowest p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-text-muted">
                  format_list_numbered
                </span>
                <h2 className="text-title-sm font-bold text-text-primary">
                  Question Set Sequence
                </h2>
              </div>
              <span className="text-label-xs font-mono text-text-muted">
                {selection.selectedQuestions.length} Items
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {selection.selectedQuestions.map((q) => (
                <div
                  key={q.questionId}
                  className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-surface-middle border border-border flex items-center justify-center text-label-xs font-mono text-text-muted shrink-0">
                      {q.sequenceOrder}
                    </span>
                    <div className="min-w-0">
                      <div className="text-body-sm text-text-primary truncate">
                        {q.questionText}
                      </div>
                      <div className="text-label-xs text-text-muted mt-0.5">
                        {q.selectionReason}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Pill variant="neutral" className="text-[11px] font-mono">
                      {getDifficultyLabel(q.difficulty)}
                    </Pill>
                    <span className="text-label-xs font-mono text-text-muted">
                      {q.marks}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
