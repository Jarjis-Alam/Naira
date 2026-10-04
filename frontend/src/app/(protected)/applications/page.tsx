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
import { CompactMetricStrip } from "@/components/ui/compact-metric-strip";

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
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ── Top Header & New Application CTA ── */}
      <PageHeader
        title="Applications"
        subtitle="Track active applications, interview stages, and deadlines."
        actions={
          <ApplicationsNewDialog
            companies={companies}
            roles={roles}
            defaults={board.defaults}
          />
        }
      />

      {/* ── Metric Strip: 4 Semantic Items ── */}
      <CompactMetricStrip
        items={[
          {
            id: "active",
            label: "Active Applications",
            value: board.totals.activeApplications,
            detail: "in flight",
            statusText: "Pipeline",
            progressPct: Math.min(100, board.totals.activeApplications * 10),
          },
          {
            id: "assessments",
            label: "Assessments & OAs",
            value: board.totals.assessments,
            detail: "active rounds",
            statusText: "OA Stage",
            progressPct: Math.min(100, board.totals.assessments * 25),
          },
          {
            id: "interviews",
            label: "Interview Rounds",
            value: board.totals.interviews,
            detail: "live stages",
            statusText: "Interviews",
            progressPct: Math.min(100, board.totals.interviews * 25),
          },
          {
            id: "offers",
            label: "Offers Received",
            value: board.totals.offers,
            detail: "secured",
            statusText: "Offers",
            progressPct: Math.min(100, board.totals.offers * 50),
          },
        ]}
      />

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
                  ? "border-zinc-700 bg-white/10 text-white font-semibold"
                  : "border-zinc-800 bg-[#0d0d10] text-zinc-400"
              }`}
              title={meta?.description ?? STATUS_LABELS[status]}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasCount ? "bg-white" : "bg-zinc-600"
                }`}
              />
              <span>{meta?.label ?? STATUS_LABELS[status]}</span>
              <span
                className={`font-bold ml-0.5 ${
                  hasCount ? "text-white" : "text-zinc-500"
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
        <section className="rounded-xl border border-zinc-800 bg-[#0d0d10] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="material-symbols-outlined text-[18px] text-zinc-400">
              schedule
            </span>
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Upcoming Deadlines & Interviews
            </h2>
          </div>
          <ul className="space-y-2">
            {board.upcoming.slice(0, 6).map((event) => (
              <li key={`${event.applicationId}-${event.kind}-${event.date}`}>
                <Link
                  href={`/applications/${event.applicationId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/80 hover:border-zinc-600 bg-zinc-900/60 px-4 py-2.5 transition-all group"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 group-hover:scale-125 transition-transform" />
                    <span className="text-xs text-white font-medium truncate">
                      {event.companyName} — {event.label}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                    {formatDay(event.date)}
                    {event.daysRemaining !== null ? (
                      <span className="text-white ml-2 font-semibold">
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
        <section className="rounded-xl border border-dashed border-zinc-800 bg-[#0d0d10]/40 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#0d0d10] border border-zinc-800 flex items-center justify-center text-zinc-400 mx-auto">
            <span className="material-symbols-outlined text-[24px]">send</span>
          </div>
          <div>
            <p className="font-heading text-lg font-semibold text-white">
              {board.emptyState?.title ?? "No applications recorded"}
            </p>
            <p className="text-xs text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              {board.emptyState?.message ??
                "Start tracking your applications to monitor interview stages and deadlines."}
            </p>
          </div>
          <div className="pt-2">
            <ApplicationsNewDialog
              companies={companies}
              roles={roles}
              defaults={board.defaults}
            />
          </div>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.cards.map((card) => {
            const meta = STATUS_META[card.status];
            return (
              <article
                key={card.id}
                className="rounded-xl border border-zinc-800 bg-[#0d0d10] p-5 flex flex-col gap-3.5 hover:border-zinc-700 transition-all duration-200 shadow-sm group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-bold text-white truncate group-hover:text-zinc-200 transition-colors">
                      {card.companyName}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate">{card.roleName}</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-medium border border-zinc-800 bg-zinc-900/60 text-white shrink-0">
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
                  <p className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>Next: {card.nextEvent.label} · {formatDay(card.nextEvent.date)}</span>
                  </p>
                )}

                <Link
                  href={`/applications/${card.id}`}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-full border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60 text-white px-4 py-2 text-xs font-semibold transition-all group-hover:bg-zinc-800"
                >
                  <span>Open Application</span>
                  <span className="material-symbols-outlined text-[15px] text-white">
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
    <div className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 px-2 py-1.5">
      <p className="text-[9px] font-mono uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-xs font-mono font-bold text-white mt-0.5">
        {value !== null ? (isPercent ? `${value}%` : value) : note ?? "—"}
      </p>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
