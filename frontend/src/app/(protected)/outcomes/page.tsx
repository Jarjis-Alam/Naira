import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getOutcomeAnalytics,
  getPlacementJourney,
  CAUSALITY_DISCLAIMER,
} from "@/server/outcome-intelligence";
import { formatDateShort } from "@/lib/applications/domain";

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
      <header className="border-b border-border/80 pb-6">
        <div className="flex items-center gap-2 text-label-xs font-mono uppercase tracking-widest text-primary mb-1">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>NEXORA</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-secondary">PLACEMENT OUTCOME INTELLIGENCE</span>
        </div>
        <h1 className="text-headline-lg font-bold text-text-primary tracking-tight">Outcomes</h1>
        <p className="text-body-sm text-text-secondary mt-1">
          What actually happened across your applications — and what the recorded evidence says
          about your preparation.
        </p>
        <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400 mt-2">
          ⚠ {CAUSALITY_DISCLAIMER}
        </p>
      </header>

      {!hasAny ? (
        <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
          <p className="text-title-md font-semibold text-text-primary">No applications yet</p>
          <p className="text-body-sm text-text-secondary mt-2 max-w-md mx-auto">
            Outcome intelligence appears once you track applications and record outcomes in the
            Applications workspace.
          </p>
          <Link
            href="/applications"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-text-inverse hover:bg-primary-text"
          >
            Go to Applications
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </section>
      ) : (
        <>
          {/* Overview */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Applications" value={analytics.totals.applications} />
            <Stat label="Interviews" value={analytics.totals.interviews} />
            <Stat label="Offers" value={analytics.totals.offers} />
            <Stat label="Rejections" value={analytics.totals.rejections} />
          </section>

          {/* Stage distribution */}
          <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-4">
              Stage Distribution (outcomes recorded)
            </h2>
            <div className="flex flex-wrap gap-2">
              {analytics.stageDistribution.map((s) => (
                <span
                  key={s.stage}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] font-mono"
                >
                  <span className="text-text-secondary">{s.label}</span>
                  <span className="text-text-primary font-bold">{s.count}</span>
                </span>
              ))}
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Historical patterns */}
            <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
              <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
                Historical Patterns (evidence-backed)
              </h2>
              {analytics.patterns.length === 0 ? (
                <p className="text-body-sm text-text-muted">
                  No repeated evidence-backed pattern across your recorded outcomes yet. Patterns
                  require the same observed gap in at least two applications.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analytics.patterns.map((p) => (
                    <li key={`${p.domain}-${p.topic}`} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-text-primary">{p.topic}</span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-high text-text-muted font-bold">
                          {p.occurrences}/{p.sampleSize}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-1.5">{p.description}</p>
                      <p className="text-[10px] font-mono text-text-muted mt-1">
                        Sources: {p.sources.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Preparation feedback */}
            <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
              <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
                Preparation Feedback
              </h2>
              {analytics.focusCandidates.length === 0 ? (
                <p className="text-body-sm text-text-muted">
                  No evidence-backed focus candidates from recorded outcomes.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analytics.focusCandidates.slice(0, 4).map((f) => (
                    <li key={`${f.domain}-${f.topic}`} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-text-primary">
                          <span className="font-mono text-[10px] font-bold text-primary">{f.actionType}</span>{" "}
                          {f.topic}
                        </span>
                        {f.topicId ? (
                          <Link
                            href={`/practice?topicId=${f.topicId}&subjectCode=${f.domain}`}
                            className="text-[11px] font-mono font-semibold text-primary-text hover:underline whitespace-nowrap"
                          >
                            Practice Now →
                          </Link>
                        ) : (
                          <Link
                            href="/roadmap"
                            className="text-[11px] font-mono text-text-muted hover:underline whitespace-nowrap"
                          >
                            View plan →
                          </Link>
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary mt-1.5">{f.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-text-muted mt-3">
                Practice links open the existing Phase 15 execution flow — outcome intelligence
                never creates tasks of its own.
              </p>
            </section>
          </div>

          {/* Recent outcomes */}
          <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
              Recent Outcomes
            </h2>
            <ul className="space-y-2">
              {analytics.recentOutcomes.map((o) => (
                <li key={o.applicationId}>
                  <Link
                    href={`/applications/${o.applicationId}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 hover:border-primary/40 px-3 py-2 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="text-body-sm text-text-primary block truncate">
                        {o.companyName} — {o.roleName}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">{o.label}</span>
                    </span>
                    <span className="text-[11px] font-mono text-text-muted shrink-0">
                      {o.occurredAt ? formatDateShort(o.occurredAt) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Unified journey — every entry from persisted data */}
      {journey.length > 0 && (
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
            Placement Journey
          </h2>
          <ol className="relative border-l border-border/70 ml-2 space-y-3 max-h-96 overflow-y-auto">
            {journey.slice(-30).reverse().map((entry, idx) => (
              <li key={`${entry.date}-${idx}`} className="ml-5">
                <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border-2 border-surface bg-primary" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[10px] font-mono text-text-muted">{formatDateShort(entry.date)}</span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-high text-text-muted font-bold">
                    {entry.phase}
                  </span>
                  {entry.href ? (
                    <Link href={entry.href} className="text-body-sm text-text-primary hover:underline">
                      {entry.title}
                    </Link>
                  ) : (
                    <span className="text-body-sm text-text-primary">{entry.title}</span>
                  )}
                </div>
                {entry.detail && <p className="text-[10px] text-text-muted mt-0.5">{entry.detail}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface/90 p-4">
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">{label}</span>
      <p className="text-headline-md font-bold text-text-primary mt-1">{value}</p>
    </div>
  );
}
