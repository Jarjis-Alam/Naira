"use client";

import React, { useState } from "react";
import Link from "next/link";
import type {
  PlacementIntelligenceSnapshot2,
  IntelligenceDimensionId,
  EvidenceState,
} from "@/server/placement-intelligence-2";

interface Props {
  intelligence: PlacementIntelligenceSnapshot2;
}

export function PlacementIntelligence2View({ intelligence }: Props) {
  const [selectedDimensionId, setSelectedDimensionId] = useState<IntelligenceDimensionId | null>(null);

  const {
    evidenceSummary,
    dimensions,
    trends,
    strengths,
    weaknesses,
    targetAlignment,
    crossSourceCorroborations,
    priorities,
    actionableInsights,
  } = intelligence;

  const selectedDimension = selectedDimensionId
    ? dimensions.find((d) => d.id === selectedDimensionId)
    : null;

  // Helper for stability pill
  const getStabilityBadge = (status: EvidenceState) => {
    switch (status) {
      case "STRONG_EVIDENCE":
        return "bg-primary-green/20 text-primary-green border-primary-green/40";
      case "STABLE":
        return "bg-primary-green/10 text-primary-green border-primary-green/30";
      case "DEVELOPING":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
      case "EMERGING":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "INCONSISTENT":
        return "bg-orange-500/10 text-orange-400 border-orange-500/30";
      case "INSUFFICIENT_EVIDENCE":
      default:
        return "bg-card-elevated text-text-muted border-neutral-border";
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "improving":
        return { icon: "trending_up", color: "text-primary-green" };
      case "declining":
        return { icon: "trending_down", color: "text-error" };
      case "stable":
        return { icon: "trending_flat", color: "text-text-secondary" };
      case "inconsistent":
        return { icon: "swap_vert", color: "text-yellow-400" };
      default:
        return { icon: "help_outline", color: "text-text-muted" };
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Overview & Multi-Source Evidence Baseline */}
      <section aria-labelledby="intel2-overview-heading" className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
              2.0
            </span>
            <h2
              id="intel2-overview-heading"
              className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary"
            >
              MULTI-DIMENSIONAL EVIDENCE BASELINE
            </h2>
          </div>
          <span className="text-label-xs font-mono text-text-muted">
            {evidenceSummary.hasBaseline ? "Empirically Calibrated" : "Calibration Incomplete"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-cards bg-card-standard border border-neutral-border">
            <span className="text-label-xs font-mono text-text-muted block uppercase">Assessments</span>
            <span className="text-2xl font-bold font-mono text-text-primary mt-1 block">
              {evidenceSummary.totalAssessments}
            </span>
            <span className="text-[10px] font-mono text-text-muted">
              {evidenceSummary.hasBaseline ? "✓ Baseline calibrated" : "Baseline pending"}
            </span>
          </div>

          <div className="p-4 rounded-cards bg-card-standard border border-neutral-border">
            <span className="text-label-xs font-mono text-text-muted block uppercase">Practice Attempts</span>
            <span className="text-2xl font-bold font-mono text-text-primary mt-1 block">
              {evidenceSummary.totalPracticeAttempts}
            </span>
            <span className="text-[10px] font-mono text-text-muted">Targeted practice</span>
          </div>

          <div className="p-4 rounded-cards bg-card-standard border border-neutral-border">
            <span className="text-label-xs font-mono text-text-muted block uppercase">Questions</span>
            <span className="text-2xl font-bold font-mono text-text-primary mt-1 block">
              {evidenceSummary.totalQuestionsAnswered}
            </span>
            <span className="text-[10px] font-mono text-text-muted">Empirical data points</span>
          </div>

          <div className="p-4 rounded-cards bg-card-standard border border-neutral-border">
            <span className="text-label-xs font-mono text-text-muted block uppercase">Simulations</span>
            <span className="text-2xl font-bold font-mono text-text-primary mt-1 block">
              {evidenceSummary.hasSimulation ? "Active" : "None"}
            </span>
            <span className="text-[10px] font-mono text-text-muted">Multi-round records</span>
          </div>

          <div className="p-4 rounded-cards bg-card-standard border border-neutral-border">
            <span className="text-label-xs font-mono text-text-muted block uppercase">ATS Resume</span>
            <span className="text-2xl font-bold font-mono text-text-primary mt-1 block">
              {evidenceSummary.hasResume ? "Analyzed" : "Pending"}
            </span>
            <span className="text-[10px] font-mono text-text-muted">Keywords & factual score</span>
          </div>

          <div className="p-4 rounded-cards bg-card-standard border border-neutral-border">
            <span className="text-label-xs font-mono text-text-muted block uppercase">Applications</span>
            <span className="text-2xl font-bold font-mono text-text-primary mt-1 block">
              {evidenceSummary.hasApplications ? "Tracked" : "None"}
            </span>
            <span className="text-[10px] font-mono text-text-muted">Pipeline records</span>
          </div>
        </div>
      </section>

      {/* 2. 14 Performance Dimensions Grid */}
      <section aria-labelledby="dimensions-heading" className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
              14
            </span>
            <h3 id="dimensions-heading" className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
              PERFORMANCE DIMENSIONS
            </h3>
          </div>
          <span className="text-label-xs font-mono text-text-muted">Zero Fabrication Guard</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {dimensions.map((dim) => {
            const hasData = dim.status !== "INSUFFICIENT_EVIDENCE" && dim.score !== null;
            const isSelected = selectedDimensionId === dim.id;

            return (
              <div
                key={dim.id}
                onClick={() => setSelectedDimensionId(isSelected ? null : dim.id)}
                className={`p-4 rounded-cards border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-card-elevated border-primary-green/80 shadow-[0_0_15px_rgba(140,255,90,0.15)]"
                    : "bg-card-standard border-neutral-border hover:border-neutral-border/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-body-sm font-semibold text-text-primary line-clamp-1">
                    {dim.name}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider shrink-0 ${getStabilityBadge(
                      dim.status
                    )}`}
                  >
                    {dim.status.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-3">
                  <div>
                    {hasData ? (
                      <span className="text-2xl font-bold font-mono text-primary-green">
                        {dim.score}%
                      </span>
                    ) : (
                      <span className="text-label-xs font-mono text-text-muted uppercase">
                        Insufficient Evidence
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-text-muted">
                    {dim.observationCount} obs
                  </span>
                </div>

                <p className="text-[11px] text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                  {dim.summary}
                </p>

                {dim.hasCorroboratingSources && (
                  <div className="mt-2.5 pt-2 border-t border-neutral-border/40 flex items-center gap-1.5 text-[10px] font-mono text-primary-green">
                    <span className="material-symbols-outlined text-[13px]">verified</span>
                    <span>Cross-source corroborated</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dimension Inspection Drawer / Drill-down */}
        {selectedDimension && (
          <div className="p-5 rounded-cards bg-card-elevated border border-primary-green/40 mt-3 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-label-xs font-mono uppercase text-primary-green block mb-1">
                  Evidence Audit Trail
                </span>
                <h4 className="text-title-sm font-bold text-text-primary">
                  {selectedDimension.name} ({selectedDimension.category.replace("_", " ")})
                </h4>
              </div>
              <button
                onClick={() => setSelectedDimensionId(null)}
                className="text-text-muted hover:text-text-primary text-label-xs font-mono"
              >
                Close ✕
              </button>
            </div>

            <div className="text-body-sm text-text-secondary leading-relaxed">
              {selectedDimension.summary}
            </div>

            {selectedDimension.evidence.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-neutral-border">
                <span className="text-[11px] font-mono text-text-muted uppercase block">
                  Recorded Empirical Observations ({selectedDimension.evidence.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedDimension.evidence.map((ev, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-md bg-card-standard border border-neutral-border text-label-xs font-mono"
                    >
                      <div className="flex justify-between items-center text-text-muted text-[10px] mb-1">
                        <span className="uppercase">{ev.source}</span>
                        <span>{ev.count} recorded</span>
                      </div>
                      <div className="text-text-primary">{ev.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-label-xs font-mono text-text-muted py-2 border-t border-neutral-border">
                No individual observations recorded yet. Dimension score is not fabricated.
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Performance Trends (Recent vs Historical) */}
      <section aria-labelledby="trends2-heading" className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
              03
            </span>
            <h3 id="trends2-heading" className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
              DETERMINISTIC PERFORMANCE TRENDS
            </h3>
          </div>
          <span className="text-label-xs font-mono text-text-muted">Recent vs. Historical</span>
        </div>

        {trends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {trends.map((t) => {
              const iconInfo = getTrendIcon(t.direction);
              return (
                <div
                  key={t.dimensionId}
                  className="p-4 rounded-cards bg-card-standard border border-neutral-border flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-body-sm font-semibold text-text-primary">
                        {t.dimensionName}
                      </span>
                      <span
                        className={`flex items-center gap-1 font-mono text-label-xs font-bold uppercase ${iconInfo.color}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{iconInfo.icon}</span>
                        {t.direction}
                      </span>
                    </div>

                    <p className="text-[12px] text-text-secondary leading-relaxed mb-3">
                      {t.observation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-border/60 flex items-center justify-between font-mono text-[11px]">
                    <div>
                      <span className="text-text-muted">Recent: </span>
                      <span className="font-bold text-primary-green">
                        {t.recentScore !== null ? `${t.recentScore}%` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted">Historical: </span>
                      <span className="font-medium text-text-secondary">
                        {t.historicalScore !== null ? `${t.historicalScore}%` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-cards bg-card-standard border border-neutral-border text-center">
            <span className="material-symbols-outlined text-text-muted text-[28px] mb-2">timeline</span>
            <p className="text-body-sm text-text-secondary">
              No performance trends detected yet. Complete practice across multiple sessions to reveal recent vs. historical performance.
            </p>
          </div>
        )}
      </section>

      {/* 4. Strengths and Focus Areas (Weaknesses 2.0) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        <section aria-labelledby="strengths2-heading" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
                +
              </span>
              <h3 id="strengths2-heading" className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
                EVIDENCE-BACKED STRENGTHS
              </h3>
            </div>
            <span className="text-label-xs font-mono text-primary-green">
              {strengths.length} Verified
            </span>
          </div>

          {strengths.length > 0 ? (
            <div className="space-y-2.5">
              {strengths.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-cards bg-card-standard border border-neutral-border flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-body-sm font-semibold text-text-primary">{s.title}</span>
                      {s.corroborated && (
                        <span className="text-[9px] font-mono text-primary-green border border-primary-green/30 px-1.5 py-0.2 rounded">
                          CORROBORATED
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-secondary leading-relaxed">
                      {s.evidenceStatement}
                    </p>
                  </div>
                  <span className="text-xl font-bold font-mono text-primary-green shrink-0">
                    {s.score}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-cards bg-card-standard border border-neutral-border text-center">
              <p className="text-body-sm text-text-secondary">
                No high-confidence strengths verified yet (&ge;75% required across 3+ observations).
              </p>
            </div>
          )}
        </section>

        {/* Focus Areas (Weaknesses 2.0) */}
        <section aria-labelledby="weaknesses2-heading" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-error/10 text-error border border-error/20">
                !
              </span>
              <h3 id="weaknesses2-heading" className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
                EVIDENCE-BACKED FOCUS AREAS
              </h3>
            </div>
            <span className="text-label-xs font-mono text-error">
              {weaknesses.length} Deficits
            </span>
          </div>

          {weaknesses.length > 0 ? (
            <div className="space-y-2.5">
              {weaknesses.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-cards bg-card-standard border border-neutral-border flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-body-sm font-semibold text-text-primary">{w.title}</span>
                      {w.targetRelevance && (
                        <span className="text-[9px] font-mono text-error border border-error/30 px-1.5 py-0.2 rounded font-bold">
                          TARGET ROLE RELEVANT
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-secondary leading-relaxed">
                      {w.evidenceStatement}
                    </p>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <span className="text-xl font-bold text-error">{w.deficitScore}%</span>
                    <span className="block text-[10px] text-text-muted">measured</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-cards bg-card-standard border border-neutral-border text-center">
              <p className="text-body-sm text-text-secondary">
                No active empirical deficits detected below competitive thresholds.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* 5. Target-Aware Alignment (Phase 16 Integration) */}
      <section aria-labelledby="target-alignment-heading" className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
              TARGET
            </span>
            <h3 id="target-alignment-heading" className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
              TARGET ROLE CURRICULUM ALIGNMENT
            </h3>
          </div>
          <span className="text-label-xs font-mono text-text-muted">
            {targetAlignment.targetConfigured
              ? `${targetAlignment.roleName || "Configured"} (${targetAlignment.companyName || "All Companies"})`
              : "No Target Configured"}
          </span>
        </div>

        {targetAlignment.targetConfigured && targetAlignment.requirements.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {targetAlignment.requirements.map((req) => {
              const isSupported = req.supportStatus === "SUPPORTED_BY_EVIDENCE";
              const isPartial = req.supportStatus === "PARTIALLY_SUPPORTED";

              return (
                <div
                  key={req.domain}
                  className="p-4 rounded-cards bg-card-standard border border-neutral-border flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-body-sm font-semibold text-text-primary">
                        {req.name}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                          isSupported
                            ? "bg-primary-green/10 text-primary-green border-primary-green/30"
                            : isPartial
                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                            : "bg-card-elevated text-text-muted border-neutral-border"
                        }`}
                      >
                        {req.supportStatus.replace("_", " ")}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-text-muted mb-2">
                      Priority Need: <span className="text-text-secondary">{req.importance}</span>
                    </div>

                    <p className="text-[12px] text-text-secondary leading-relaxed">
                      {req.evidenceText}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-border/60 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-text-muted">Measured Proficiency:</span>
                    <span
                      className={`font-bold ${
                        isSupported
                          ? "text-primary-green"
                          : isPartial
                          ? "text-yellow-400"
                          : "text-text-muted"
                      }`}
                    >
                      {req.score !== null ? `${req.score}%` : "No Evidence"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-cards bg-card-standard border border-neutral-border flex items-center justify-between">
            <div>
              <h4 className="text-body-sm font-semibold text-text-primary">
                Target Role Strategy Unconfigured
              </h4>
              <p className="text-[12px] text-text-secondary mt-1">
                Configure your target company and role in Strategy to unlock customized curriculum requirement benchmarks.
              </p>
            </div>
            <Link
              href="/target"
              className="px-4 py-2 rounded-buttons bg-card-elevated border border-neutral-border text-label-xs font-mono text-primary-green hover:bg-neutral-border/40 transition-colors shrink-0"
            >
              Configure Target →
            </Link>
          </div>
        )}
      </section>

      {/* 6. Cross-Source Corroborations (Phase 20 Safety) */}
      {crossSourceCorroborations.length > 0 && (
        <section aria-labelledby="corroborations-heading" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
                MULTI-SOURCE
              </span>
              <h3 id="corroborations-heading" className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
                CROSS-SOURCE CORROBORATED PATTERNS
              </h3>
            </div>
            <span className="text-label-xs font-mono text-text-muted">Non-Causal Evidence</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {crossSourceCorroborations.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-cards bg-card-standard border border-neutral-border space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-body-sm font-semibold text-text-primary">{c.title}</h4>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-card-elevated text-primary-green border border-neutral-border uppercase">
                    {c.nature.replace("_", " ")}
                  </span>
                </div>

                <p className="text-[12px] text-text-secondary leading-relaxed">
                  {c.observation}
                </p>

                <div className="pt-2 border-t border-neutral-border/60 flex flex-wrap gap-2">
                  {c.sources.map((s, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-card-elevated border border-neutral-border text-text-muted"
                    >
                      <strong className="text-text-secondary uppercase">{s.source}:</strong> {s.detail}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Prioritized Recommended Actions (Phase 15 Execution Integration) */}
      <section aria-labelledby="priorities2-heading" className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-green/10 text-primary-green border border-primary-green/20">
              ACTIONS
            </span>
            <h3 id="priorities2-heading" className="text-title-sm font-bold font-mono tracking-wider uppercase text-text-primary">
              PRIORITIZED NEXT ACTIONS & INSIGHTS
            </h3>
          </div>
          <span className="text-label-xs font-mono text-text-muted">Phase 15 Action Engine</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {priorities.slice(0, 3).map((p) => {
            const isCritical = p.level === "CRITICAL";
            const isHigh = p.level === "HIGH";

            return (
              <div
                key={p.id}
                className="p-5 rounded-cards bg-card-standard border border-neutral-border flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono font-bold text-primary-green">
                      #{p.priorityNumber}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        isCritical
                          ? "bg-error/20 text-error border border-error/30"
                          : isHigh
                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                          : "bg-card-elevated text-text-muted border border-neutral-border"
                      }`}
                    >
                      {p.level}
                    </span>
                  </div>

                  <h4 className="text-body-sm font-semibold text-text-primary mb-1">
                    {p.title}
                  </h4>

                  <p className="text-[12px] text-text-secondary leading-relaxed mb-3">
                    {p.observation}
                  </p>

                  <div className="space-y-1 mb-4">
                    {p.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="text-[10px] font-mono text-text-muted flex items-center gap-1.5"
                      >
                        <span className="w-1 h-1 rounded-full bg-primary-green shrink-0" />
                        <span className="line-clamp-1">{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={p.recommendedAction.ctaHref}
                  className="w-full py-2.5 px-3 rounded-buttons bg-card-elevated border border-neutral-border hover:border-primary-green text-center text-label-xs font-mono text-primary-green hover:bg-neutral-border/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>{p.recommendedAction.ctaLabel}</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
