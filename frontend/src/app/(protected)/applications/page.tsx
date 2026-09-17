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
import { Eyebrow } from "@/components/ui/eyebrow";

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
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-circuit-border/60 pb-6">
        <div>
          <Eyebrow system="NEXORA" category="APPLICATION OS">
            PIPELINE & TRACKING
          </Eyebrow>
          <h1 className="font-heading text-headline-lg font-semibold text-phosphor-white tracking-tight">
            Applications
          </h1>
          <p className="text-body-sm text-sage-60 mt-1 max-w-2xl">
            Where you are applying, stage tracking, deadline counters, and readiness alignment.
          </p>
        </div>
        <ApplicationsNewDialog companies={companies} roles={roles} defaults={board.defaults} />
      </header>

      {/* Totals Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active Applications" value={board.totals.activeApplications} icon="work" />
        <Stat label="Assessments" value={board.totals.assessments} icon="fact_check" />
        <Stat label="Interviews" value={board.totals.interviews} icon="record_voice_over" />
        <Stat label="Offers" value={board.totals.offers} icon="emoji_events" highlight />
      </section>

      {/* Pipeline Status Strip */}
      <section className="rounded-cards border border-circuit-border bg-ground-iron p-5 shadow-none">
        <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
          Pipeline Progression
        </h2>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const count = countsByStatus.get(status) ?? 0;
            const hasCount = count > 0;
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-pills border px-3 py-1 text-caption font-mono transition-colors ${
                  hasCount
                    ? "border-circuit-border bg-carbon-veil text-phosphor-white"
                    : "border-circuit-border/40 bg-transparent text-sage-40"
                }`}
                title={meta?.description ?? STATUS_LABELS[status]}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hasCount ? "bg-lime-pulse" : "bg-circuit-border"
                  }`}
                />
                <span className="text-sage-60">{meta?.label ?? STATUS_LABELS[status]}</span>
                <span className={`font-bold font-mono ${hasCount ? "text-phosphor-white" : "text-sage-40"}`}>
                  {count}
                </span>
              </span>
            );
          })}
        </div>
      </section>

      {/* Upcoming Events */}
      {board.upcoming.length > 0 && (
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-5 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
            Upcoming Deadlines & Interviews
          </h2>
          <ul className="space-y-2">
            {board.upcoming.slice(0, 6).map((event) => (
              <li key={`${event.applicationId}-${event.kind}-${event.date}`}>
                <Link
                  href={`/applications/${event.applicationId}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-circuit-border/60 hover:border-lime-pulse/60 bg-carbon-veil/50 px-3.5 py-2.5 transition-all"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse shrink-0" />
                    <span className="text-body-sm text-phosphor-white font-medium truncate">
                      {event.companyName} — {event.label}
                    </span>
                  </span>
                  <span className="text-caption font-mono text-sage-40 shrink-0">
                    {formatDay(event.date)}
                    {event.daysRemaining !== null ? (
                      <span className="text-lime-pulse ml-1.5 font-semibold">
                        · {event.daysRemaining}d remaining
                      </span>
                    ) : (
                      ""
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Application Cards / Empty State */}
      {board.cards.length === 0 ? (
        <section className="rounded-cards border border-dashed border-circuit-border bg-ground-iron/40 p-12 text-center">
          <p className="font-heading text-title-md font-semibold text-phosphor-white">
            {board.emptyState?.title ?? "No applications recorded"}
          </p>
          <p className="text-body-sm text-sage-60 mt-2 max-w-md mx-auto">
            {board.emptyState?.message ??
              "Track your first application — it automatically inherits your target company and role preferences."}
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.cards.map((card) => {
            const meta = STATUS_META[card.status];
            return (
              <article
                key={card.id}
                className="rounded-cards border border-circuit-border bg-ground-iron p-5 flex flex-col gap-3 hover:border-lime-pulse/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-heading text-title-md font-semibold text-phosphor-white truncate">
                      {card.companyName}
                    </h3>
                    <p className="text-body-sm text-sage-60 truncate">{card.roleName}</p>
                  </div>
                  <span
                    className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills font-medium border border-circuit-border bg-carbon-veil text-moss-80 shrink-0"
                  >
                    {meta?.label ?? card.statusLabel}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Resume ATS" value={card.resume.atsScore} />
                  <Metric label="Target Match" value={card.resume.matchScore} isPercent />
                  <Metric
                    label="Interview"
                    value={null}
                    note={card.nextEvent ? "Scheduled" : "—"}
                  />
                </div>

                {card.nextEvent && (
                  <p className="text-caption font-mono text-sage-40 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-lime-pulse" />
                    <span>Next: {card.nextEvent.label} · {formatDay(card.nextEvent.date)}</span>
                  </p>
                )}

                <Link
                  href={`/applications/${card.id}`}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-buttons border border-circuit-border hover:border-lime-pulse bg-carbon-veil text-phosphor-white px-4 py-2 text-body-sm font-medium transition-all"
                >
                  <span>Open Application</span>
                  <span className="material-symbols-outlined text-[16px] text-lime-pulse">
                    arrow_forward
                  </span>
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-cards border border-circuit-border bg-ground-iron p-4 shadow-none">
      <div className="flex items-center justify-between">
        <span className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium">
          {label}
        </span>
        <span className={`material-symbols-outlined text-[18px] ${highlight ? "text-lime-pulse" : "text-sage-40"}`}>
          {icon}
        </span>
      </div>
      <p className={`text-headline-sm font-heading font-bold mt-1 ${highlight ? "text-lime-pulse" : "text-phosphor-white"}`}>
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  isPercent = false,
}: {
  label: string;
  value: number | null;
  note?: string;
  isPercent?: boolean;
}) {
  return (
    <div className="rounded-md bg-carbon-veil/70 border border-circuit-border/40 px-2 py-1.5">
      <p className="text-[10px] font-mono uppercase tracking-wide text-sage-40">{label}</p>
      <p className="text-body font-mono font-bold text-phosphor-white mt-0.5">
        {value !== null ? (isPercent ? `${value}%` : value) : note ?? "—"}
      </p>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
