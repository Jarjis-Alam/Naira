import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getOutcomeAnalytics,
  getPlacementJourney,
  CAUSALITY_DISCLAIMER,
} from "@/server/outcome-intelligence";
import { formatDateShort } from "@/lib/applications/domain";
import { PageHeader } from "@/components/ui/page-header";
import { CompactMetricStrip } from "@/components/ui/compact-metric-strip";

export default async function OutcomesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/outcomes");
  const userId = session.user.id;

  const [analytics, journey] = await Promise.all([
    getOutcomeAnalytics(userId),
    getPlacementJourney(userId),
  ]);

  const hasAny = analytics.totals.applications > 0;

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ── Top Header ── */}
      <PageHeader
        title="Interview Outcomes"
        subtitle="Review interview results, evaluator feedback, and observed preparation gaps."
      />

      {!hasAny ? (
        <section className="rounded-xl border border-dashed border-zinc-800 bg-[#0d0d10]/40 p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#0d0d10] border border-zinc-800 flex items-center justify-center text-zinc-400 mx-auto mb-3">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
          <p className="font-heading text-lg font-semibold text-white">
            No application outcomes recorded
          </p>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            Outcome intelligence is generated once you track application progression and record outcomes in the Applications workspace.
          </p>
          <Link
            href="/applications"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 px-6 py-2.5 text-xs transition-all shadow-sm"
          >
            <span>Go to Applications</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </section>
      ) : (
        <>
          {/* ── Top Metric Summary Strip ── */}
          <CompactMetricStrip
            items={[
              {
                id: "total-apps",
                label: "Total Applications",
                value: analytics.totals.applications,
                detail: `${analytics.totals.offers} offers secured`,
                statusText: "Tracked",
                progressPct: Math.min(100, analytics.totals.applications * 15),
              },
              {
                id: "interviews",
                label: "Interview Rounds",
                value: analytics.totals.interviews,
                detail: "stages reached",
                statusText: "Evaluator Loops",
                progressPct: Math.min(100, analytics.totals.interviews * 20),
              },
              {
                id: "offers",
                label: "Offers Received",
                value: analytics.totals.offers,
                detail: "secured",
                statusText: "High Alignment",
                progressPct: Math.min(100, analytics.totals.offers * 50),
              },
              {
                id: "rejections",
                label: "Rejections",
                value: analytics.totals.rejections,
                detail: "recorded loops",
                statusText: "Feedback",
                progressPct: Math.min(100, analytics.totals.rejections * 25),
              },
            ]}
          />

          {/* ── Stage Distribution Pill Strip ── */}
          <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 shadow-md">
            <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold mb-3">
              Stage Distribution
            </h2>
            <div className="flex flex-wrap gap-2">
              {analytics.stageDistribution.map((s) => (
                <span
                  key={s.stage}
                  className="inline-flex items-center gap-2 rounded-full border border-[#3f4a38]/40 bg-[#111413] px-3.5 py-1.5 text-xs font-mono text-sage-40"
                >
                  <span>{s.label}</span>
                  <span className="text-phosphor-white font-bold">{s.count}</span>
                </span>
              ))}
            </div>
          </section>

          {/* ── Historical Patterns & Preparation Feedback ── */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Historical patterns */}
            <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md">
              <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold mb-3">
                Historical Patterns
              </h2>
              {analytics.patterns.length === 0 ? (
                <p className="text-xs text-sage-40 py-2">
                  No repeated evidence-backed pattern across your recorded outcomes yet. Patterns require the same observed gap in at least two applications.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analytics.patterns.map((p) => (
                    <li
                      key={`${p.domain}-${p.topic}`}
                      className="rounded-xl border border-[#3f4a38]/30 bg-[#111413] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-phosphor-white">
                          {p.topic}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#282b29] text-lime-pulse border border-[#3f4a38]/40">
                          {p.occurrences}/{p.sampleSize} occurrences
                        </span>
                      </div>
                      <p className="text-xs text-sage-40 mt-1.5 leading-relaxed">{p.description}</p>
                      <p className="text-[10px] font-mono text-sage-40/80 mt-1">
                        Sources: {p.sources.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Preparation feedback */}
            <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md">
              <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold mb-3">
                Preparation Feedback
              </h2>
              {analytics.focusCandidates.length === 0 ? (
                <p className="text-xs text-sage-40 py-2">
                  No evidence-backed focus candidates from recorded outcomes.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analytics.focusCandidates.slice(0, 4).map((f) => (
                    <li
                      key={`${f.domain}-${f.topic}`}
                      className="rounded-xl border border-[#3f4a38]/30 bg-[#111413] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-phosphor-white">
                          <span className="font-mono text-[10px] font-bold text-lime-pulse uppercase mr-1">
                            [{f.actionType}]
                          </span>{" "}
                          {f.topic}
                        </span>
                        {f.topicId ? (
                          <Link
                            href={`/practice?topicId=${f.topicId}&subjectCode=${f.domain}`}
                            className="text-xs font-mono font-semibold text-lime-pulse hover:text-mint-frost transition-colors whitespace-nowrap"
                          >
                            Practice Now →
                          </Link>
                        ) : (
                          <Link
                            href="/roadmap"
                            className="text-xs font-mono text-sage-40 hover:text-phosphor-white transition-colors whitespace-nowrap"
                          >
                            View plan →
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-sage-40 mt-1.5 leading-relaxed">{f.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] font-mono text-sage-40/70 mt-4 pt-3 border-t border-[#3f4a38]/30">
                Practice links connect to the Phase 15 execution flow — outcome intelligence analyzes evidence without creating independent tasks.
              </p>
            </section>
          </div>

          {/* ── Recent Application Outcomes ── */}
          <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md">
            <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold mb-3">
              Recent Application Outcomes
            </h2>
            <ul className="space-y-2">
              {analytics.recentOutcomes.map((o) => (
                <li key={o.applicationId}>
                  <Link
                    href={`/applications/${o.applicationId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#3f4a38]/30 hover:border-lime-pulse/60 bg-[#111413] px-4 py-3 transition-all group"
                  >
                    <span className="min-w-0">
                      <span className="text-xs font-semibold text-phosphor-white block truncate group-hover:text-lime-pulse transition-colors">
                        {o.companyName} — {o.roleName}
                      </span>
                      <span className="text-[11px] font-mono text-sage-40">{o.label}</span>
                    </span>
                    <span className="text-[11px] font-mono text-sage-40 shrink-0">
                      {o.occurredAt ? formatDateShort(o.occurredAt) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* ── Placement Journey Timeline ── */}
      {journey.length > 0 && (
        <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md">
          <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold mb-4">
            Placement Journey Timeline
          </h2>
          <ol className="relative border-l border-[#3f4a38]/50 ml-3 space-y-4 max-h-96 overflow-y-auto pl-6">
            {journey.slice(-30).reverse().map((entry, idx) => (
              <li key={`${entry.date}-${idx}`} className="relative">
                <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#191c1b] bg-lime-pulse" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[11px] font-mono text-sage-40">{formatDateShort(entry.date)}</span>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-[#282b29] text-lime-pulse border border-[#3f4a38]/40">
                    {entry.phase}
                  </span>
                  {entry.href ? (
                    <Link
                      href={entry.href}
                      className="text-xs font-medium text-phosphor-white hover:text-lime-pulse transition-colors"
                    >
                      {entry.title}
                    </Link>
                  ) : (
                    <span className="text-xs font-medium text-phosphor-white">{entry.title}</span>
                  )}
                </div>
                {entry.detail && <p className="text-xs text-sage-40 mt-1">{entry.detail}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Non-causal disclaimer — Phase 20 invariant */}
      <footer className="pt-4 border-t border-outline-variant/30 flex items-start gap-2.5 text-zinc-400">
        <span className="material-symbols-outlined text-[16px] text-zinc-500 shrink-0 mt-0.5">
          info
        </span>
        <p className="font-mono text-[11px] text-zinc-400 leading-relaxed">
          {CAUSALITY_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}
