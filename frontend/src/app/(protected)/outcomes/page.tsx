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

export default async function OutcomesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/outcomes");
  const userId = session.user.id;

  const [analytics, journey] = await Promise.all([
    getOutcomeAnalytics(userId),
    getPlacementJourney(userId),
  ]);

  const hasAny = analytics.totals.applications > 0;

  const breadcrumbs = [
    { label: "NEXORA", href: "/dashboard" },
    { label: "PREPARATION", href: "/tests" },
    { label: "POST-INTERVIEW INTELLIGENCE" },
  ];

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ── Top Header ── */}
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Interview Outcomes & Gate Debriefs"
        subtitle="Empirical diagnostic breakdown of completed interview loops, evaluator signal capture, and precision syllabus recalibration."
        badge={{
          label: "TELEMETRY SYNC: ACTIVE",
          variant: "green",
          ping: true,
        }}
      />

      {/* Non-causal disclaimer — Phase 20 invariant */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#191c1b] border border-white/20 shadow-md">
        <span className="material-symbols-outlined text-[18px] text-zinc-400 flex-shrink-0 mt-0.5">
          info
        </span>
        <span className="font-mono text-xs text-zinc-300 leading-relaxed">
          {CAUSALITY_DISCLAIMER}
        </span>
      </div>

      {!hasAny ? (
        <section className="rounded-2xl border border-dashed border-[#3f4a38]/60 bg-[#191c1b]/40 p-12 text-center shadow-md">
          <div className="w-12 h-12 rounded-full bg-[#191c1b] border border-[#3f4a38]/40 flex items-center justify-center text-sage-40 mx-auto mb-3">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
          <p className="font-heading text-lg font-semibold text-phosphor-white">
            No application outcomes recorded
          </p>
          <p className="text-xs text-sage-40 mt-1.5 max-w-md mx-auto leading-relaxed">
            Outcome intelligence is generated once you track application progression and record outcomes in the Applications workspace.
          </p>
          <Link
            href="/applications"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-lime-pulse text-void-black font-semibold hover:bg-mint-frost px-6 py-2.5 text-xs transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)]"
          >
            <span>Go to Applications</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </section>
      ) : (
        <>
          {/* ── Top Metric Summary Strip ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Applications */}
            <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 shadow-md flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
                  TOTAL APPLICATIONS
                </span>
                <div className="w-8 h-8 rounded-full bg-lime-pulse/15 border border-lime-pulse/30 flex items-center justify-center text-lime-pulse">
                  <span className="material-symbols-outlined text-[18px]">rule</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-heading text-phosphor-white">
                    {analytics.totals.applications}
                  </span>
                  <span className="text-[11px] font-mono text-lime-pulse">Tracked</span>
                </div>
                <p className="text-[11px] text-sage-40 mt-1">
                  {analytics.totals.offers} Offers • {analytics.totals.interviews} Advanced
                </p>
              </div>
              <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-3.5 overflow-hidden border border-[#3f4a38]/20">
                <div
                  className="bg-lime-pulse h-full rounded-full"
                  style={{ width: `${Math.min(100, analytics.totals.applications * 15)}%` }}
                />
              </div>
            </div>

            {/* Card 2: Interviews */}
            <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 shadow-md flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
                  INTERVIEW ROUNDS
                </span>
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">insights</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-heading text-phosphor-white">
                    {analytics.totals.interviews}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-300">Stages reached</span>
                </div>
                <p className="text-[11px] text-sage-40 mt-1">
                  Evaluator signal across recorded loops
                </p>
              </div>
              <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-3.5 overflow-hidden border border-[#3f4a38]/20">
                <div
                  className="bg-white h-full rounded-full"
                  style={{ width: `${Math.min(100, analytics.totals.interviews * 20)}%` }}
                />
              </div>
            </div>

            {/* Card 3: Offers Received */}
            <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 shadow-md flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
                  OFFERS EXTENDED
                </span>
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">emoji_events</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-heading text-lime-pulse">
                    {analytics.totals.offers}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-300">Offers secured</span>
                </div>
                <p className="text-[11px] text-sage-40 mt-1">
                  High-alignment company offers
                </p>
              </div>
              <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-3.5 overflow-hidden border border-[#3f4a38]/20">
                <div
                  className="bg-zinc-300 h-full rounded-full"
                  style={{ width: `${Math.min(100, analytics.totals.offers * 50)}%` }}
                />
              </div>
            </div>

            {/* Card 4: Terminal Results */}
            <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 shadow-md flex flex-col justify-between group hover:border-[#88957f]/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
                  TERMINAL RESULTS
                </span>
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">update</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-heading text-zinc-400">
                    {analytics.totals.rejections}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">Post-mortems</span>
                </div>
                <p className="text-[11px] text-sage-40 mt-1">
                  Provides empirical feedback for recalibration
                </p>
              </div>
              <div className="w-full bg-[#0c0f0e] h-1.5 rounded-full mt-3.5 overflow-hidden border border-[#3f4a38]/20">
                <div
                  className="bg-zinc-400 h-full rounded-full"
                  style={{ width: `${Math.min(100, analytics.totals.rejections * 25)}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Stage Distribution Pill Strip ── */}
          <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 shadow-md">
            <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold mb-3">
              Stage Distribution (Recorded Outcomes)
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
                Historical Patterns (Evidence-Backed)
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
    </div>
  );
}
