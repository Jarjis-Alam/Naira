"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_META } from "@/lib/applications/status-meta";
import type { ApplicationStatus } from "@/lib/applications/domain";

type CompanyOption = { id: string; name: string };
type RoleOption = { id: string; name: string; category?: string | null };

interface Defaults {
  configured: boolean;
  companyId: string | null;
  companyName: string | null;
  roleId: string | null;
  roleName: string | null;
}

const SOURCES = [
  { value: "company_website", label: "Company website" },
  { value: "referral", label: "Referral" },
  { value: "job_portal", label: "Job portal" },
  { value: "campus_placement", label: "Campus placement" },
  { value: "recruiter", label: "Recruiter" },
  { value: "other", label: "Other" },
] as const;

const OPEN_STATUSES: ApplicationStatus[] = [
  "INTERESTED",
  "ELIGIBLE",
  "APPLIED",
  "ASSESSMENT",
  "SHORTLISTED",
  "INTERVIEW",
];

/**
 * Phase 19 — "New Application" dialog.
 *
 * Company/role come from the existing catalog (no second company database).
 * Defaults are preselected from the student's Phase 16 targets when set.
 */
export function ApplicationsNewDialog({
  companies,
  roles,
  defaults,
}: {
  companies: CompanyOption[];
  roles: RoleOption[];
  defaults: Defaults;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — company/role default to the Phase 16 target when configured.
  const [companyId, setCompanyId] = useState(defaults.companyId ?? "");
  const [roleId, setRoleId] = useState(defaults.roleId ?? "");
  const [initialStatus, setInitialStatus] = useState<ApplicationStatus>("INTERESTED");
  const [source, setSource] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [packageText, setPackageText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        companyId: companyId || undefined,
        roleId: roleId || undefined,
        initialStatus,
      };
      if (source) payload.source = source;
      if (deadline) payload.deadline = new Date(`${deadline}T12:00:00`).toISOString();
      if (location.trim()) payload.location = location.trim();
      if (employmentType.trim()) payload.employmentType = employmentType.trim();
      if (packageText.trim()) payload.packageText = packageText.trim();
      if (jobDescription.trim()) payload.jobDescription = jobDescription;
      if (notes.trim()) payload.notes = notes.trim();

      const res = await fetch("/api/student/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to create application");
      setOpen(false);
      router.push(`/applications/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-text-inverse font-semibold text-body-sm px-6 py-2.5 rounded-lg hover:bg-primary-text transition-all inline-flex items-center gap-2 shadow-sm self-start"
      >
        <span>New Application</span>
        <span className="material-symbols-outlined text-[18px]">add_link</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-title-lg font-bold text-text-primary">New Application</h2>
                <p className="text-body-sm text-text-secondary mt-1">
                  {defaults.configured
                    ? `Defaults from your target: ${defaults.companyName} — ${defaults.roleName}.`
                    : "Select a company and role from the catalog."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="material-symbols-outlined text-text-muted hover:text-text-primary"
                aria-label="Close"
              >
                close
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Company *
                  </span>
                  <select
                    required
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  >
                    <option value="">Select company…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Role *
                  </span>
                  <select
                    required
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  >
                    <option value="">Select role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.category ? ` · ${r.category}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Starting stage
                  </span>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as ApplicationStatus)}
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  >
                    {OPEN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Source
                  </span>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  >
                    <option value="">Not specified</option>
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Application deadline
                  </span>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Location
                  </span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={255}
                    placeholder="Hyderabad, India"
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Employment type
                  </span>
                  <input
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    maxLength={60}
                    placeholder="Full-time internship"
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                    Package / CTC (as you know it)
                  </span>
                  <input
                    value={packageText}
                    onChange={(e) => setPackageText(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. 18 LPA (as posted)"
                    className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                  Job description (optional — analyzed with Phase 18)
                </span>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={5}
                  maxLength={40000}
                  placeholder="Paste the job posting here…"
                  className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                  Notes (private)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={10000}
                  className="w-full rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-body-sm text-text-primary"
                />
              </label>

              {error && (
                <p className="text-body-sm text-rose-500" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-body-sm text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2 text-body-sm font-semibold text-text-inverse hover:bg-primary-text disabled:opacity-60"
                >
                  {saving ? "Creating…" : "Create Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
