import React from "react";
import Link from "next/link";
import type { PlacementIntelligenceSnapshot2 } from "@/server/placement-intelligence-2";

interface Props {
  intelligence: PlacementIntelligenceSnapshot2 | null;
}

export function PlacementIntelligence2Widget({ intelligence }: Props) {
  if (!intelligence) {
    return null;
  }

  const { evidenceSummary, strengths, weaknesses, trends, priorities } = intelligence;
  const hasCalibratedData = evidenceSummary.totalAssessments > 0;

  return (
    <div className="rounded-cards border border-neutral-border bg-card-standard p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
            2.0
          </span>
          <h3 className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
            PLACEMENT INTELLIGENCE
          </h3>
        </div>
        <Link
          href="/analytics"
          className="text-label-xs font-mono text-primary-green hover:underline flex items-center gap-1"
        >
          <span>Full Analysis</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>

      {hasCalibratedData ? (
        <div className="space-y-4">
          {/* Top Priority Action */}
          {priorities.length > 0 && (
            <div className="p-3.5 rounded-md bg-card-elevated border border-neutral-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono font-bold text-primary-green">
                    PRIORITY #{priorities[0].priorityNumber}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                      priorities[0].level === "CRITICAL"
                        ? "bg-error/20 text-error border border-error/30"
                        : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    }`}
                  >
                    {priorities[0].level}
                  </span>
                </div>
                <h4 className="text-body-sm font-semibold text-text-primary">
                  {priorities[0].title}
                </h4>
                <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                  {priorities[0].observation}
                </p>
              </div>

              <Link
                href={priorities[0].recommendedAction.ctaHref}
                className="px-3 py-1.5 rounded-buttons bg-primary-green text-void-black font-semibold text-label-xs font-mono hover:bg-bright-green transition-colors shrink-0 text-center"
              >
                {priorities[0].recommendedAction.ctaLabel}
              </Link>
            </div>
          )}

          {/* Quick Metrics Columns: Strengths & Deficits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Strengths */}
            <div className="p-3 rounded-md bg-card-elevated border border-neutral-border space-y-2">
              <span className="text-[10px] font-mono text-primary-green uppercase font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">verified</span>
                Verified Strengths
              </span>
              {strengths.length > 0 ? (
                <div className="space-y-1.5">
                  {strengths.slice(0, 2).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-text-primary truncate pr-2">{s.title}</span>
                      <span className="font-mono font-bold text-primary-green shrink-0">{s.score}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] font-mono text-text-muted">No high-confidence strengths yet.</p>
              )}
            </div>

            {/* Focus Areas */}
            <div className="p-3 rounded-md bg-card-elevated border border-neutral-border space-y-2">
              <span className="text-[10px] font-mono text-error uppercase font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">flag</span>
                Target Focus Areas
              </span>
              {weaknesses.length > 0 ? (
                <div className="space-y-1.5">
                  {weaknesses.slice(0, 2).map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-text-primary truncate pr-2">{w.title}</span>
                      <span className="font-mono font-bold text-error shrink-0">{w.deficitScore}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] font-mono text-text-muted">No critical deficits detected.</p>
              )}
            </div>
          </div>

          {/* Trajectory Signals */}
          {trends.length > 0 && (
            <div className="pt-2 border-t border-neutral-border/60 flex items-center justify-between text-[11px] font-mono text-text-muted">
              <span>Trajectory Signals:</span>
              <div className="flex items-center gap-3">
                {trends.slice(0, 2).map((t) => (
                  <span key={t.dimensionId} className="flex items-center gap-1">
                    <span className="text-text-secondary">{t.dimensionName}:</span>
                    <span
                      className={`font-bold uppercase ${
                        t.direction === "improving"
                          ? "text-primary-green"
                          : t.direction === "declining"
                          ? "text-error"
                          : "text-text-secondary"
                      }`}
                    >
                      {t.direction}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-6 text-center space-y-3">
          <span className="material-symbols-outlined text-[28px] text-text-muted">insights</span>
          <p className="text-body-sm text-text-secondary max-w-md mx-auto">
            Multi-dimensional placement intelligence activates once baseline performance data is recorded.
          </p>
          <Link
            href="/assessment"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-buttons bg-primary-green text-void-black font-semibold text-label-xs font-mono hover:bg-bright-green transition-colors"
          >
            <span>Start Baseline Assessment</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
      )}
    </div>
  );
}
