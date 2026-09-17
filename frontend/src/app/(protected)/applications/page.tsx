import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getApplicationsBoard,
  PIPELINE_ORDER,
  STATUS_LABELS,
} from "@/server/application-intelligence";
import { searchCompanies, searchRoles } from "@/server/company-role-intelligence";
import { ApplicationsNewDialog } from "@/components/applications/applications-new-dialog";
import { STATUS_META } from "@/lib/applications/status-meta";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/applications");

  const [board, companies, roles] = await Promise.all([
    getApplicationsBoard(session.user.id),
    searchCompanies({ limit: 100 }).catch(() => []),
    searchRoles({ limit: 100 }).catch(() => []),
  ]);
  const countsByStatus = new Map(board.pipeline.map((p) => [p.status, p.count]));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-label-xs font-mono uppercase tracking-widest text-primary mb-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>NEXORA</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-secondary">PLACEMENT APPLICATION OS</span>
          </div>
          <h1 className="text-headline-lg font-bold text-text-primary tracking-tight">Applications</h1>
          <p className="text-body-sm text-text-secondary mt-1">
            Where you are applying, what stage each application is in, and what to do next.
          </p>
        </div>
        <ApplicationsNewDialog companies={companies} roles={roles} defaults={board.defaults} />
      </header>

      {/* Totals */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active Applications" value={board.totals.activeApplications} icon="work" />
        <Stat label="Assessments" value={board.totals.assessments} icon="fact_check" />
        <Stat label="Interviews" value={board.totals.interviews} icon="record_voice_over" />
        <Stat label="Offers" value={board.totals.offers} icon="emoji_events" />
      </section>

      {/* Pipeline */}
      <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-4">
          Application Pipeline
        </h2>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const count = countsByStatus.get(status) ?? 0;
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] font-mono"
                title={meta?.description ?? STATUS_LABELS[status]}
              >
                <span className={`w-2 h-2 rounded-full ${meta?.dot ?? "bg-text-muted"}`} />
                <span className="text-text-secondary">{meta?.label ?? STATUS_LABELS[status]}</span>
                <span className="text-text-primary font-bold">{count}</span>
              </span>
            );
          })}
        </div>
      </section>

      {/* Upcoming */}
      {board.upcoming.length > 0 && (
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-4">
            Upcoming
          </h2>
          <ul className="space-y-2">
            {board.upcoming.slice(0, 6).map((event) => (
              <li key={`${event.applicationId}-${event.kind}-${event.date}`}>
                <Link
                  href={`/applications/${event.applicationId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 hover:border-primary/40 px-3 py-2 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-body-sm text-text-primary truncate">
                      {event.companyName} — {event.label}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-text-muted shrink-0">
                    {formatDay(event.date)}
                    {event.daysRemaining !== null ? ` · ${event.daysRemaining}d` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cards */}
      {board.cards.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
          <p className="text-title-md font-semibold text-text-primary">
            {board.emptyState?.title ?? "No applications yet"}
          </p>
          <p className="text-body-sm text-text-secondary mt-2 max-w-md mx-auto">
            {board.emptyState?.message ??
              "Create your first application — it defaults to your Phase 16 target company and role."}
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.cards.map((card) => {
            const meta = STATUS_META[card.status];
            return (
              <article
                key={card.id}
                className="rounded-2xl border border-border/80 bg-surface/90 p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-title-md font-bold text-text-primary truncate">{card.companyName}</h3>
                    <p className="text-body-sm text-text-secondary truncate">{card.roleName}</p>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold shrink-0 ${meta?.chip ?? "bg-surface-high text-text-muted"}`}
                  >
                    {meta?.label ?? card.statusLabel}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Resume ATS" value={card.resume.atsScore} />
                  <Metric label="Target Match" value={card.resume.matchScore} />
                  <Metric
                    label="Interview"
                    value={null}
                    note={card.nextEvent ? "next" : "—"}
                  />
                </div>

                {card.nextEvent && (
                  <p className="text-[11px] font-mono text-text-muted">
                    Next: {card.nextEvent.label} · {formatDay(card.nextEvent.date)}
                  </p>
                )}

                <Link
                  href={`/applications/${card.id}`}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 text-primary-text hover:bg-primary/10 px-3 py-2 text-body-sm font-semibold transition-colors"
                >
                  Open Application
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface/90 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">{label}</span>
        <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>
      </div>
      <p className="text-headline-md font-bold text-text-primary mt-1">{value}</p>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div className="rounded-lg bg-surface-high/60 px-2 py-1.5">
      <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">{label}</p>
      <p className="text-body-md font-bold text-text-primary">
        {value !== null ? value : note ?? "—"}
      </p>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
