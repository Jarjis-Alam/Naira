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
import { PageHeader } from "@/components/ui/page-header";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/applications");

  const [board, companies, roles] = await Promise.all([
    getApplicationsBoard(session.user.id),
    searchCompanies({ limit: 100 }).catch(() => []),
    searchRoles({ limit: 100 }).catch(() => []),
  ]);
  const countsByStatus = new Map(board.pipeline.map((p) => [p.status, p.count]));

  const breadcrumbs = [
    { label: "NEXORA", href: "/dashboard" },
    { label: "CORE OS", href: "/dashboard" },
    { label: "APPLICATIONS PIPELINE" },
  ];

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ── Top Header & New Application CTA ── */}
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Applications Pipeline"
        subtitle="Where you are applying, stage tracking, deadline counters, and readiness alignment."
        actions={
          <ApplicationsNewDialog
            companies={companies}
            roles={roles}
            defaults={board.defaults}
          />
        }
      />

      {/* ── Metric Strip: 4 Semantic Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Active Applications (Green) */}
        <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 flex flex-col justify-between shadow-md hover:border-[#88957f]/60 transition-all group">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
              Active Applications
            </span>
            <div className="w-8 h-8 rounded-full bg-lime-pulse/15 border border-lime-pulse/30 flex items-center justify-center text-lime-pulse">
              <span className="material-symbols-outlined text-[18px]">work_history</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
              {board.totals.activeApplications}
            </span>
            <span className="text-[11px] font-mono text-lime-pulse">
              in flight
            </span>
          </div>
          <div className="mt-3 w-full bg-[#0c0f0e] h-1.5 rounded-full overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-lime-pulse h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, board.totals.activeApplications * 10)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Assessments / OA (Purple) */}
        <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 flex flex-col justify-between shadow-md hover:border-[#88957f]/60 transition-all group">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
              Assessments & OAs
            </span>
            <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <span className="material-symbols-outlined text-[18px]">terminal</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
              {board.totals.assessments}
            </span>
            <span className="text-[11px] font-mono text-purple-400">active rounds</span>
          </div>
          <div className="mt-3 w-full bg-[#0c0f0e] h-1.5 rounded-full overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-purple-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, board.totals.assessments * 25)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Interviews (Amber) */}
        <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 flex flex-col justify-between shadow-md hover:border-[#88957f]/60 transition-all group">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
              Interview Rounds
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-[18px]">videocam</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
              {board.totals.interviews}
            </span>
            <span className="text-[11px] font-mono text-amber-400">live stages</span>
          </div>
          <div className="mt-3 w-full bg-[#0c0f0e] h-1.5 rounded-full overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, board.totals.interviews * 25)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Offers Received (Blue) */}
        <div className="rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-5 flex flex-col justify-between shadow-md hover:border-[#88957f]/60 transition-all group">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-semibold">
              Offers Received
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-[18px]">emoji_events</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
              {board.totals.offers}
            </span>
            <span className="text-[11px] font-mono text-blue-400">secured</span>
          </div>
          <div className="mt-3 w-full bg-[#0c0f0e] h-1.5 rounded-full overflow-hidden border border-[#3f4a38]/20">
            <div
              className="bg-blue-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, board.totals.offers * 50)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Filter Navigation Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {PIPELINE_ORDER.map((status) => {
          const meta = STATUS_META[status];
          const count = countsByStatus.get(status) ?? 0;
          const hasCount = count > 0;
          return (
            <div
              key={status}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-mono transition-all shrink-0 ${
                hasCount
                  ? "border-lime-pulse/30 bg-lime-pulse/10 text-lime-pulse font-semibold"
                  : "border-[#3f4a38]/40 bg-[#191c1b] text-sage-40"
              }`}
              title={meta?.description ?? STATUS_LABELS[status]}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasCount ? "bg-lime-pulse" : "bg-sage-40/40"
                }`}
              />
              <span>{meta?.label ?? STATUS_LABELS[status]}</span>
              <span
                className={`font-bold ml-0.5 ${
                  hasCount ? "text-phosphor-white" : "text-sage-40/60"
                }`}
              >
                ({count})
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Upcoming Deadlines & Events ── */}
      {board.upcoming.length > 0 && (
        <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 shadow-md">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="material-symbols-outlined text-[18px] text-amber-400">
              schedule
            </span>
            <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold">
              Upcoming Deadlines & Interviews
            </h2>
          </div>
          <ul className="space-y-2">
            {board.upcoming.slice(0, 6).map((event) => (
              <li key={`${event.applicationId}-${event.kind}-${event.date}`}>
                <Link
                  href={`/applications/${event.applicationId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#3f4a38]/30 hover:border-lime-pulse/50 bg-[#111413] px-4 py-2.5 transition-all group"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse shrink-0 group-hover:scale-125 transition-transform" />
                    <span className="text-xs text-phosphor-white font-medium truncate">
                      {event.companyName} — {event.label}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-sage-40 shrink-0">
                    {formatDay(event.date)}
                    {event.daysRemaining !== null ? (
                      <span className="text-lime-pulse ml-2 font-semibold">
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

      {/* ── Application Pipeline Cards ── */}
      {board.cards.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#3f4a38]/60 bg-[#191c1b]/40 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#191c1b] border border-[#3f4a38]/40 flex items-center justify-center text-sage-40 mx-auto mb-3">
            <span className="material-symbols-outlined text-[24px]">send</span>
          </div>
          <p className="font-heading text-lg font-semibold text-phosphor-white">
            {board.emptyState?.title ?? "No applications recorded"}
          </p>
          <p className="text-xs text-sage-40 mt-1.5 max-w-md mx-auto leading-relaxed">
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
                className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 flex flex-col gap-3.5 hover:border-[#88957f]/70 transition-all duration-200 shadow-md group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-bold text-phosphor-white truncate group-hover:text-lime-pulse transition-colors">
                      {card.companyName}
                    </h3>
                    <p className="text-xs text-sage-40 truncate">{card.roleName}</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-medium border border-[#3f4a38]/40 bg-[#111413] text-lime-pulse shrink-0">
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
                  <p className="text-[11px] font-mono text-sage-40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse" />
                    <span>Next: {card.nextEvent.label} · {formatDay(card.nextEvent.date)}</span>
                  </p>
                )}

                <Link
                  href={`/applications/${card.id}`}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-full border border-[#3f4a38]/40 hover:border-lime-pulse bg-[#111413] text-phosphor-white px-4 py-2 text-xs font-semibold transition-all group-hover:bg-lime-pulse/10"
                >
                  <span>Open Application</span>
                  <span className="material-symbols-outlined text-[15px] text-lime-pulse">
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
    <div className="rounded-xl bg-[#111413] border border-[#3f4a38]/30 px-2 py-1.5">
      <p className="text-[9px] font-mono uppercase tracking-wide text-sage-40">{label}</p>
      <p className="text-xs font-mono font-bold text-phosphor-white mt-0.5">
        {value !== null ? (isPercent ? `${value}%` : value) : note ?? "—"}
      </p>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
