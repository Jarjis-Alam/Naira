import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getApplicationDetail,
  EVENT_LABELS,
} from "@/server/application-intelligence";
import { describeDeadline, formatDateShort } from "@/lib/applications/domain";
import { STATUS_META } from "@/lib/applications/status-meta";
import { ApplicationActions } from "@/components/applications/application-actions";
import { getOutcomeAnalysis } from "@/server/outcome-intelligence";
import { OutcomePanel } from "@/components/applications/outcome-panel";
import { Eyebrow } from "@/components/ui/eyebrow";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    notFound();
  }

  let detail;
  try {
    detail = await getApplicationDetail(userId, (await params).id);
  } catch {
    notFound();
  }

  // Phase 20 — outcome analysis when the application carries an outcome.
  const OUTCOME_STATUSES = ["REJECTED", "WITHDRAWN", "OFFER", "CLOSED"];
  const outcomeDetail = OUTCOME_STATUSES.includes(detail.application.status)
    ? await getOutcomeAnalysis(userId, detail.application.id).catch(() => null)
    : null;

  const { application: app, readiness, gaps, checklist, timeline } = detail;
  const meta = STATUS_META[app.status];
  const deadlines = [
    describeDeadline("application", app.deadline),
    describeDeadline("assessment", app.assessmentDeadline),
    describeDeadline("interview", app.interviewDate),
    describeDeadline("offer", app.offerDeadline),
  ].filter(Boolean) as NonNullable<ReturnType<typeof describeDeadline>>[];

  const readinessCells = [
    { ...readiness.preparation, icon: "fitness_center" },
    { ...readiness.target, icon: "track_changes" },
    { ...readiness.resumeAts, icon: "description" },
    { ...readiness.interview, icon: "record_voice_over" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Breadcrumb + Header */}
      <header className="space-y-3 border-b border-circuit-border/60 pb-6">
        <Eyebrow system="NEXORA" category="APPLICATION DETAIL">
          {app.companyName}
        </Eyebrow>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-headline-lg font-semibold text-phosphor-white tracking-tight">
              {app.companyName}
            </h1>
            <p className="text-title-md text-sage-60 mt-0.5">{app.roleName}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span
                className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-pills border border-circuit-border bg-carbon-veil text-moss-80 font-medium"
              >
                {meta?.label ?? app.statusLabel}
              </span>
              {app.location && (
                <span className="text-caption font-mono text-sage-40">{app.location}</span>
              )}
              {app.employmentType && (
                <span className="text-caption font-mono text-sage-40">· {app.employmentType}</span>
              )}
              {app.packageText && (
                <span className="text-caption font-mono text-sage-40">· {app.packageText}</span>
              )}
              {!detail.targets.isTargetCompany && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills bg-carbon-veil text-sage-40 border border-circuit-border/60">
                  Off-target
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {deadlines.length > 0 ? (
              deadlines.map((d) => (
                <p key={d.kind} className="text-caption font-mono text-sage-40">
                  <span className="text-moss-70">{d.label}:</span> {formatDateShort(d.date)}
                  {d.daysRemaining !== null ? (
                    <span className="text-lime-pulse ml-1 font-medium">· {d.daysRemaining}d remaining</span>
                  ) : d.isPast ? (
                    <span className="text-sage-40 ml-1">· past</span>
                  ) : (
                    ""
                  )}
                </p>
              ))
            ) : (
              <p className="text-caption font-mono text-sage-40">No deadline scheduled</p>
            )}
          </div>
        </div>
      </header>

      {/* Readiness — four separate dimensions, never a combined score */}
      <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium">
            Application Readiness Dimensions
          </h2>
          <p className="text-caption font-mono text-sage-40">{readiness.headline}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {readinessCells.map((cell) => (
            <div key={cell.label} className="rounded-md bg-carbon-veil/70 border border-circuit-border/60 p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-lime-pulse">{cell.icon}</span>
                <span className="text-[10px] font-mono uppercase tracking-wide text-sage-40">
                  {cell.label}
                </span>
              </div>
              <p className="text-headline-sm font-mono font-bold text-phosphor-white mt-1.5">
                {cell.score !== null ? `${cell.score}%` : "—"}
              </p>
              <p className="text-[11px] text-sage-40 mt-1">{cell.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] font-mono text-sage-40 mt-4 pt-3 border-t border-circuit-border/40">
          Independent measurements from Phases 15, 16, 17, and 18 — preserved as distinct dimensions.
        </p>
      </section>

      {/* Resume association */}
      <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
        <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
          Resume Association
        </h2>
        {app.resume.variantId ? (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/resume?variantId=${app.resume.variantId}`}
              className="text-body font-semibold text-phosphor-white hover:text-lime-pulse underline transition-colors"
            >
              {app.resume.label ?? "Resume variant"}
            </Link>
            <span className="text-caption font-mono text-sage-40">
              ATS: <span className="text-phosphor-white font-bold">{app.resume.atsScore ?? "—"}</span> · Target Match: <span className="text-lime-pulse font-bold">{app.resume.matchScore !== null ? `${app.resume.matchScore}%` : "—"}</span>
            </span>
            <span className="text-[10px] font-mono text-sage-40">
              (snapshotted at attach time)
            </span>
          </div>
        ) : (
          <p className="text-body-sm text-sage-60">
            No resume variant attached. Attach a Phase 18 variant from the actions below to snapshot compatibility.
          </p>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gaps */}
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
            Application Gaps
          </h2>
          {gaps.length === 0 ? (
            <p className="text-body-sm text-sage-40">
              No gaps identified for this target.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {gaps.map((gap) => (
                <li key={`${gap.domain}-${gap.topic}`} className="rounded-md border border-circuit-border/60 bg-carbon-veil/50 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold text-phosphor-white">{gap.topic}</span>
                    {gap.priority && (
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-pills bg-[#331c1c] text-[#ff7b72] border border-[#663131]">
                        {gap.priority}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {gap.sources.map((source) => (
                      <span
                        key={source}
                        className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills bg-ground-iron text-sage-40 border border-circuit-border/40"
                      >
                        {source === "preparation"
                          ? "Preparation Gap"
                          : source === "simulation"
                            ? "Simulation Gap"
                            : "Resume Gap"}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12px] text-sage-60 mt-2">{gap.explanation}</p>
                  {gap.resumeCoverage?.evidence && (
                    <p className="text-[11px] font-mono text-sage-40 mt-1">
                      Evidence: {gap.resumeCoverage.evidence}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Checklist */}
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
            Application Checklist
          </h2>
          <ul className="space-y-2.5">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-3 p-2 rounded-md bg-carbon-veil/40 border border-circuit-border/40">
                <span
                  className={`material-symbols-outlined text-[18px] mt-0.5 ${item.state === "complete" ? "text-lime-pulse" : "text-circuit-border"}`}
                >
                  {item.state === "complete" ? "check_circle" : "radio_button_unchecked"}
                </span>
                <div>
                  <p
                    className={`text-body-sm font-medium ${item.state === "complete" ? "text-phosphor-white" : "text-sage-60"}`}
                  >
                    {item.label}
                  </p>
                  <p className="text-caption text-sage-40">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Interviews */}
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
            Interviews
          </h2>
          {detail.interviews.length === 0 ? (
            <p className="text-body-sm text-sage-40">No interviews recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {detail.interviews.map((iv) => (
                <li key={iv.id} className="rounded-md border border-circuit-border/60 bg-carbon-veil/50 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold text-phosphor-white">
                      Round {iv.roundNumber} · {iv.roundType}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills ${iv.result === "cleared" ? "bg-lime-pulse/15 text-phosphor-white border border-lime-pulse/40" : iv.result === "not_cleared" ? "bg-[#331c1c] text-[#ff7b72] border border-[#663131]" : "bg-ground-iron text-sage-40 border border-circuit-border/60"}`}
                    >
                      {iv.result}
                    </span>
                  </div>
                  <p className="text-caption font-mono text-sage-40 mt-1">
                    {iv.scheduledAt ? formatDateShort(iv.scheduledAt) : "unscheduled"}
                    {iv.completedAt ? ` · completed ${formatDateShort(iv.completedAt)}` : ""}
                  </p>
                  {iv.userNotes && <p className="text-[12px] text-sage-60 mt-1.5">{iv.userNotes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Assessments */}
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-3">
            Assessments
          </h2>
          {detail.assessments.length === 0 ? (
            <p className="text-body-sm text-sage-40">No external assessments recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {detail.assessments.map((a) => (
                <li key={a.id} className="rounded-md border border-circuit-border/60 bg-carbon-veil/50 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold text-phosphor-white">{a.name}</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills bg-ground-iron text-sage-40 border border-circuit-border/60">
                      {a.status}
                    </span>
                  </div>
                  <p className="text-caption font-mono text-sage-40 mt-1">
                    {a.deadline ? `due ${formatDateShort(a.deadline)}` : "no deadline"}
                    {a.scoreText ? ` · score: ${a.scoreText}` : ""}
                  </p>
                  {a.notes && <p className="text-[12px] text-sage-60 mt-1.5">{a.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Offers */}
      {detail.offers.length > 0 && (
        <section className="rounded-cards border border-lime-pulse/40 bg-ground-iron p-6 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-lime-pulse font-semibold mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">emoji_events</span>
            <span>Recorded Offers</span>
          </h2>
          <ul className="space-y-2">
            {detail.offers.map((o) => (
              <li key={o.id} className="rounded-md border border-circuit-border bg-carbon-veil/70 p-4">
                <p className="text-body font-semibold text-phosphor-white">
                  {o.companyName} — {o.roleName}
                </p>
                <p className="text-caption font-mono text-sage-40 mt-1">
                  {o.offerDate ? `Offered ${formatDateShort(o.offerDate)}` : "Offer date not set"}
                  {o.compensationText ? <span className="text-lime-pulse font-semibold"> · {o.compensationText}</span> : ""}
                  {o.joiningDate ? ` · joining ${formatDateShort(o.joiningDate)}` : ""}
                </p>
                {o.notes && <p className="text-[12px] text-sage-60 mt-1">{o.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
        <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-4">
          Timeline & Event Log
        </h2>
        <ol className="relative border-l border-circuit-border/60 ml-2 space-y-4">
          {timeline.map((event) => (
            <li key={event.id} className="ml-5">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border border-void-black bg-lime-pulse" />
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-body-sm font-medium text-phosphor-white">
                  {event.title ?? EVENT_LABELS[event.eventType]}
                </p>
                <span className="text-[10px] font-mono text-sage-40">
                  {formatDateShort(event.occurredAt)}
                </span>
                {event.eventType !== "STATUS_CHANGED" && event.eventType !== "APPLICATION_CREATED" && (
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-pills bg-carbon-veil text-moss-80 border border-circuit-border/60">
                    {EVENT_LABELS[event.eventType]}
                  </span>
                )}
              </div>
              {event.previousStatus && event.newStatus && event.previousStatus !== event.newStatus && (
                <p className="text-caption font-mono text-sage-40 mt-0.5">
                  {event.previousStatus} → <span className="text-phosphor-white">{event.newStatus}</span>
                </p>
              )}
              {event.metadata?.detail ? (
                <p className="text-[12px] text-sage-60 mt-1">{String(event.metadata.detail)}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Notes */}
      {detail.notes && (
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
          <h2 className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium mb-2">
            Private Notes
          </h2>
          <p className="text-body-sm text-sage-60 whitespace-pre-wrap">{detail.notes}</p>
        </section>
      )}

      {/* Outcome Intelligence (Phase 20) */}
      {outcomeDetail && <OutcomePanel detail={outcomeDetail} />}

      {/* Actions */}
      <ApplicationActions
        applicationId={app.id}
        allowedTransitions={detail.allowedTransitions}
        hasResume={Boolean(app.resume.variantId)}
      />
    </div>
  );
}
