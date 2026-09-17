import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getOutcomeAnalytics,
  getPlacementJourney,
  CAUSALITY_DISCLAIMER,
} from "@/server/outcome-intelligence";
import { formatDateShort } from "@/lib/applications/domain";
import { Eyebrow } from "@/components/ui/eyebrow";

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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <header className="border-b border-circuit-border/60 pb-6">
        <Eyebrow system="NEXORA" category="PLACEMENT OUTCOME INTELLIGENCE">
          EMPIRICAL EVIDENCE & REFLECTION
        </Eyebrow>
        <h1 className="font-heading text-headline-lg font-semibold text-phosphor-white tracking-tight">
          Outcomes & Observations
        </h1>
        <p className="text-body-sm text-sage-60 mt-1 max-w-2xl">
          What occurred across your application pipeline — and what recorded evidence reveals about your preparation priorities.
        </p>
        <div className="mt-3.5 p-3 rounded-md bg-carbon-veil/70 border border-circuit-border/60 text-caption font-mono text-[#ffd37a] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] shrink-0 text-[#ffd37a]">info</span>
          <span>{CAUSALITY_DISCLAIMER}</span>
        </div>
      </header>

      {!hasAny ? (
        <section className="rounded-cards border border-dashed border-circuit-border bg-ground-iron/40 p-12 text-center">
          <p className="font-heading text-title-md font-semibold text-phosphor-white">
            No application outcomes recorded
          </p>
          <p className="text-body-sm text-sage-60 mt-2 max-w-md mx-auto">
            Outcome intelligence is generated once you track application progression and record outcomes in the Applications workspace.
          </p>
          <Link
            href="/applications"
            className="mt-5 inline-flex items-center gap-2 rounded-buttons bg-carbon-veil border border-circuit-border hover:border-lime-pulse px-5 py-2.5 text-body-sm font-medium text-phosphor-white transition-all shadow-none"
          >
            <span>Go to Applications</span>
            <span className="material-symbols-outlined text-[16px] text-lime-pulse">arrow_forward</span>
          </Link>
        </section>
      ) : (
        <>
          {/* Overview Stats */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Applications" value={analytics.totals.applications} />
            <Stat label="Interviews" value={analytics.totals.interviews} />
            <Stat label="Offers" value={analytics.totals.offers} highlight />
            <Stat label="Terminal Results" value={analytics.totals.rejections} />
          </section>

          {/* Stage distribution */}
          <section className="rounded-cards border border-circuit-border bg-ground-iron p-5 shadow-none">
            <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
              Stage Distribution (Recorded Outcomes)
            </h2>
            <div className="flex flex-wrap gap-2">
              {analytics.stageDistribution.map((s) => (
                <span
                  key={s.stage}
                  className="inline-flex items-center gap-2 rounded-pills border border-circuit-border bg-carbon-veil px-3 py-1 text-caption font-mono"
                >
                  <span className="text-sage-60">{s.label}</span>
                  <span className="text-phosphor-white font-bold">{s.count}</span>
                </span>
              ))}
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Historical patterns */}
            <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
              <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
                Historical Patterns (Evidence-Backed)
              </h2>
              {analytics.patterns.length === 0 ? (
                <p className="text-body-sm text-sage-40">
                  No repeated evidence-backed pattern across your recorded outcomes yet. Patterns require the same observed gap in at least two applications.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analytics.patterns.map((p) => (
                    <li key={`${p.domain}-${p.topic}`} className="rounded-md border border-circuit-border/60 bg-carbon-veil/50 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-phosphor-white">{p.topic}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills bg-ground-iron text-moss-80 border border-circuit-border/60">
                          {p.occurrences}/{p.sampleSize} occurrences
                        </span>
                      </div>
                      <p className="text-[12px] text-sage-60 mt-1.5">{p.description}</p>
                      <p className="text-[11px] font-mono text-sage-40 mt-1">
                        Sources: {p.sources.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Preparation feedback */}
            <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
              <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
                Preparation Feedback
              </h2>
              {analytics.focusCandidates.length === 0 ? (
                <p className="text-body-sm text-sage-40">
                  No evidence-backed focus candidates from recorded outcomes.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analytics.focusCandidates.slice(0, 4).map((f) => (
                    <li key={`${f.domain}-${f.topic}`} className="rounded-md border border-circuit-border/60 bg-carbon-veil/50 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-phosphor-white">
                          <span className="font-mono text-[10px] font-bold text-lime-pulse uppercase mr-1">
                            [{f.actionType}]
                          </span>{" "}
                          {f.topic}
                        </span>
                        {f.topicId ? (
                          <Link
                            href={`/practice?topicId=${f.topicId}&subjectCode=${f.domain}`}
                            className="text-caption font-mono font-semibold text-fern-link hover:text-phosphor-white underline whitespace-nowrap"
                          >
                            Practice Now →
                          </Link>
                        ) : (
                          <Link
                            href="/roadmap"
                            className="text-caption font-mono text-sage-40 hover:text-phosphor-white underline whitespace-nowrap"
                          >
                            View plan →
                          </Link>
                        )}
                      </div>
                      <p className="text-[12px] text-sage-60 mt-1.5">{f.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-caption font-mono text-sage-40 mt-4 pt-3 border-t border-circuit-border/40">
                Practice links connect to the Phase 15 execution flow — outcome intelligence analyzes evidence without creating independent tasks.
              </p>
            </section>
          </div>

          {/* Recent outcomes */}
          <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
            <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
              Recent Application Outcomes
            </h2>
            <ul className="space-y-2">
              {analytics.recentOutcomes.map((o) => (
                <li key={o.applicationId}>
                  <Link
                    href={`/applications/${o.applicationId}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-circuit-border/60 hover:border-lime-pulse/60 bg-carbon-veil/50 px-3.5 py-2.5 transition-all"
                  >
                    <span className="min-w-0">
                      <span className="text-body-sm font-medium text-phosphor-white block truncate">
                        {o.companyName} — {o.roleName}
                      </span>
                      <span className="text-caption font-mono text-sage-40">{o.label}</span>
                    </span>
                    <span className="text-caption font-mono text-sage-40 shrink-0">
                      {o.occurredAt ? formatDateShort(o.occurredAt) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Unified Placement Journey */}
      {journey.length > 0 && (
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
            Placement Journey Timeline
          </h2>
          <ol className="relative border-l border-circuit-border/60 ml-2 space-y-3 max-h-96 overflow-y-auto">
            {journey.slice(-30).reverse().map((entry, idx) => (
              <li key={`${entry.date}-${idx}`} className="ml-5">
                <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border border-void-black bg-lime-pulse" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-caption font-mono text-sage-40">{formatDateShort(entry.date)}</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills bg-carbon-veil text-moss-80 border border-circuit-border/60">
                    {entry.phase}
                  </span>
                  {entry.href ? (
                    <Link href={entry.href} className="text-body-sm font-medium text-phosphor-white hover:text-lime-pulse underline transition-colors">
                      {entry.title}
                    </Link>
                  ) : (
                    <span className="text-body-sm font-medium text-phosphor-white">{entry.title}</span>
                  )}
                </div>
                {entry.detail && <p className="text-caption text-sage-60 mt-0.5">{entry.detail}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-cards border border-circuit-border bg-ground-iron p-4 shadow-none">
      <span className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium">
        {label}
      </span>
      <p className={`text-headline-sm font-heading font-bold mt-1 ${highlight ? "text-lime-pulse" : "text-phosphor-white"}`}>
        {value}
      </p>
    </div>
  );
}
