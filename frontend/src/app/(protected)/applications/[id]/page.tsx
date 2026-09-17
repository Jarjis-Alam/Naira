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

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // Ownership is enforced inside the service; redirect anonymous users.
    notFound();
  }

  let detail;
  try {
    detail = await getApplicationDetail(userId, (await params).id);
  } catch {
    // Not found OR another owner's application — identical response, no leak.
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
      {/* Breadcrumb + header */}
      <header className="space-y-3 border-b border-border/80 pb-6">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-muted">
          <Link href="/applications" className="hover:text-text-primary">
            Applications
          </Link>
          <span>/</span>
          <span className="text-text-secondary">{app.companyName}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-headline-lg font-bold text-text-primary tracking-tight">
              {app.companyName}
            </h1>
            <p className="text-title-md text-text-secondary mt-0.5">{app.roleName}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${meta?.chip ?? ""}`}>
                {meta?.label ?? app.statusLabel}
              </span>
              {app.location && (
                <span className="text-[11px] font-mono text-text-muted">{app.location}</span>
              )}
              {app.employmentType && (
                <span className="text-[11px] font-mono text-text-muted">· {app.employmentType}</span>
              )}
              {app.packageText && (
                <span className="text-[11px] font-mono text-text-muted">· {app.packageText}</span>
              )}
              {!detail.targets.isTargetCompany && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-high text-text-muted font-bold">
                  Off-target
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {deadlines.length > 0 ? (
              deadlines.map((d) => (
                <p key={d.kind} className="text-[11px] font-mono text-text-muted">
                  {d.label}: {formatDateShort(d.date)}
                  {d.daysRemaining !== null ? ` · ${d.daysRemaining}d remaining` : d.isPast ? " · past" : ""}
                </p>
              ))
            ) : (
              <p className="text-[11px] font-mono text-text-muted">No deadline provided</p>
            )}
          </div>
        </div>
      </header>

      {/* Readiness — four separate dimensions, never a combined score */}
      <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
            Application Readiness
          </h2>
          <p className="text-[11px] text-text-muted">{readiness.headline}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {readinessCells.map((cell) => (
            <div key={cell.label} className="rounded-xl bg-surface-high/60 p-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-text-muted">{cell.icon}</span>
                <span className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold">
                  {cell.label}
                </span>
              </div>
              <p className="text-headline-md font-bold text-text-primary mt-1">
                {cell.score !== null ? `${cell.score}%` : "—"}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">{cell.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-3">
          These are four independent measurements from Phases 15, 16, 17, and 18. They are
          deliberately never combined into a single number.
        </p>
      </section>

      {/* Resume association */}
      <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
          Resume
        </h2>
        {app.resume.variantId ? (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/resume?variantId=${app.resume.variantId}`}
              className="text-body-md font-semibold text-primary-text hover:underline"
            >
              {app.resume.label ?? "Resume variant"}
            </Link>
            <span className="text-[11px] font-mono text-text-muted">
              ATS {app.resume.atsScore ?? "—"} · Target Match {app.resume.matchScore ?? "—"}
            </span>
            <span className="text-[10px] font-mono text-text-muted">
              (scores snapshotted at attach time)
            </span>
          </div>
        ) : (
          <p className="text-body-sm text-text-muted">
            No resume attached. Attach a Phase 18 variant from the actions below to track its ATS
            and target-match scores here.
          </p>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gaps */}
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
            Application Gaps
          </h2>
          {gaps.length === 0 ? (
            <p className="text-body-sm text-text-muted">
              No gaps identified for this target yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {gaps.map((gap) => (
                <li key={`${gap.domain}-${gap.topic}`} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold text-text-primary">{gap.topic}</span>
                    {gap.priority && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-bold">
                        {gap.priority}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {gap.sources.map((source) => (
                      <span
                        key={source}
                        className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-high text-text-muted font-bold"
                      >
                        {source === "preparation"
                          ? "Preparation Gap"
                          : source === "simulation"
                            ? "Simulation Gap"
                            : "Resume Gap"}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1.5">{gap.explanation}</p>
                  {gap.resumeCoverage?.evidence && (
                    <p className="text-[10px] text-text-muted mt-1">
                      Resume evidence: {gap.resumeCoverage.evidence}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Checklist */}
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
            Application Checklist
          </h2>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <span
                  className={`material-symbols-outlined text-[18px] mt-0.5 ${item.state === "complete" ? "text-emerald-500" : item.state === "not_applicable" ? "text-text-muted/40" : "text-text-muted"}`}
                >
                  {item.state === "complete" ? "check_circle" : item.state === "not_applicable" ? "circle" : "radio_button_unchecked"}
                </span>
                <div>
                  <p
                    className={`text-body-sm ${item.state === "complete" ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    {item.label}
                  </p>
                  <p className="text-[10px] text-text-muted">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Interviews */}
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
            Interviews
          </h2>
          {detail.interviews.length === 0 ? (
            <p className="text-body-sm text-text-muted">No interviews recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {detail.interviews.map((iv) => (
                <li key={iv.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold text-text-primary">
                      Round {iv.roundNumber} · {iv.roundType}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${iv.result === "cleared" ? "bg-emerald-500/10 text-emerald-500" : iv.result === "not_cleared" ? "bg-rose-500/10 text-rose-500" : "bg-surface-high text-text-muted"}`}
                    >
                      {iv.result}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-text-muted mt-1">
                    {iv.scheduledAt ? formatDateShort(iv.scheduledAt) : "unscheduled"}
                    {iv.completedAt ? ` · completed ${formatDateShort(iv.completedAt)}` : ""}
                  </p>
                  {iv.userNotes && <p className="text-[11px] text-text-secondary mt-1">{iv.userNotes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Assessments */}
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
            Assessments
          </h2>
          {detail.assessments.length === 0 ? (
            <p className="text-body-sm text-text-muted">No assessments recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {detail.assessments.map((a) => (
                <li key={a.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold text-text-primary">{a.name}</span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-high text-text-muted font-bold">
                      {a.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-text-muted mt-1">
                    {a.deadline ? `due ${formatDateShort(a.deadline)}` : "no deadline"}
                    {a.scoreText ? ` · score: ${a.scoreText}` : ""}
                  </p>
                  {a.notes && <p className="text-[11px] text-text-secondary mt-1">{a.notes}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-text-muted mt-3">
            Placement OS test attempts (Phase 5) are never overwritten — these are
            application-specific records only.
          </p>
        </section>
      </div>

      {/* Offers */}
      {detail.offers.length > 0 && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold mb-3">
            Offers
          </h2>
          <ul className="space-y-2">
            {detail.offers.map((o) => (
              <li key={o.id} className="rounded-lg border border-emerald-500/20 bg-surface/60 p-3">
                <p className="text-body-sm font-semibold text-text-primary">
                  {o.companyName} — {o.roleName}
                </p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  {o.offerDate ? `Offered ${formatDateShort(o.offerDate)}` : "Offer date not set"}
                  {o.compensationText ? ` · ${o.compensationText}` : ""}
                  {o.joiningDate ? ` · joining ${formatDateShort(o.joiningDate)}` : ""}
                </p>
                {o.notes && <p className="text-[11px] text-text-secondary mt-1">{o.notes}</p>}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-text-muted mt-3">
            All compensation details are exactly what you entered — the system never estimates
            packages.
          </p>
        </section>
      )}

      {/* Timeline */}
      <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
          Timeline
        </h2>
        <ol className="relative border-l border-border/70 ml-2 space-y-4">
          {timeline.map((event) => (
            <li key={event.id} className="ml-5">
              <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border-2 border-surface bg-primary" />
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-body-sm font-semibold text-text-primary">
                  {event.title ?? EVENT_LABELS[event.eventType]}
                </p>
                <span className="text-[10px] font-mono text-text-muted">
                  {formatDateShort(event.occurredAt)}
                </span>
                {event.eventType !== "STATUS_CHANGED" && event.eventType !== "APPLICATION_CREATED" && (
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-high text-text-muted font-bold">
                    {EVENT_LABELS[event.eventType]}
                  </span>
                )}
              </div>
              {event.previousStatus && event.newStatus && event.previousStatus !== event.newStatus && (
                <p className="text-[11px] font-mono text-text-muted mt-0.5">
                  {event.previousStatus} → {event.newStatus}
                </p>
              )}
              {event.metadata?.detail ? (
                <p className="text-[11px] text-text-secondary mt-1">{String(event.metadata.detail)}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Notes */}
      {detail.notes && (
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
            Notes (private)
          </h2>
          <p className="text-body-sm text-text-secondary whitespace-pre-wrap">{detail.notes}</p>
        </section>
      )}

      {/* JD */}
      {detail.jobDescription && (
        <section className="rounded-2xl border border-border/80 bg-surface/90 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mb-3">
            Job Description
          </h2>
          {detail.jobDescription.extraction ? (
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <SkillList title="Required Skills" items={detail.jobDescription.extraction.requiredSkills.map((s) => s.skill)} />
              <SkillList title="Preferred Skills" items={detail.jobDescription.extraction.preferredSkills.map((s) => s.skill)} />
              <SkillList title="Responsibilities" items={detail.jobDescription.extraction.responsibilities} />
              <SkillList title="Qualifications" items={detail.jobDescription.extraction.qualifications} />
            </div>
          ) : null}
          {detail.jobDescription.extraction?.warnings?.length ? (
            <ul className="mb-4 space-y-1">
              {detail.jobDescription.extraction.warnings.map((w) => (
                <li key={w} className="text-[11px] text-amber-600 dark:text-amber-400">⚠ {w}</li>
              ))}
            </ul>
          ) : null}
          <details className="text-body-sm text-text-secondary">
            <summary className="cursor-pointer text-[11px] font-mono uppercase text-text-muted">
              Raw posting ({detail.jobDescription.raw.length} chars)
            </summary>
            <pre className="whitespace-pre-wrap mt-2 text-[12px]">{detail.jobDescription.raw}</pre>
          </details>
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

function SkillList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[9px] font-mono uppercase tracking-wide text-text-muted font-bold mb-1.5">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 12).map((item) => (
          <span
            key={item}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-high text-text-secondary"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
