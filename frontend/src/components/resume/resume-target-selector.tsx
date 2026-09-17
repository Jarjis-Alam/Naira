"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CatalogOption {
  id: string;
  name: string;
}

export function ResumeTargetSelector({
  variantId,
  companies,
  roles,
  currentCompanyId,
  currentRoleId,
  currentCompanyName,
  currentRoleName,
}: {
  variantId: string;
  companies: CatalogOption[];
  roles: CatalogOption[];
  currentCompanyId: string | null;
  currentRoleId: string | null;
  currentCompanyName: string | null;
  currentRoleName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState(currentCompanyId ?? "");
  const [roleId, setRoleId] = useState(currentRoleId ?? "");
  const [companyName, setCompanyName] = useState(currentCompanyName ?? "");
  const [roleName, setRoleName] = useState(currentRoleName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (companyId) payload.companyId = companyId;
      else payload.companyName = companyName.trim() || null;
      if (roleId) payload.roleId = roleId;
      else payload.roleName = roleName.trim() || null;

      const res = await fetch(`/api/student/resume/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "The target could not be updated.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("The target could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-mono uppercase text-primary-text hover:underline"
      >
        Change target
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-primary/30 bg-surface-high/60 p-4 space-y-3">
      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[12px] text-error">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="resume-company" className="text-[10px] font-mono uppercase text-text-muted block mb-1">
            Target company
          </label>
          <select
            id="resume-company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
          >
            <option value="">Custom / not listed</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          {!companyId && (
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Company name"
              className="mt-2 w-full rounded-lg bg-surface border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
            />
          )}
        </div>
        <div>
          <label htmlFor="resume-role" className="text-[10px] font-mono uppercase text-text-muted block mb-1">
            Target role
          </label>
          <select
            id="resume-role"
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
          >
            <option value="">Custom / not listed</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {!roleId && (
            <input
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="Role title"
              className="mt-2 w-full rounded-lg bg-surface border border-border px-3 py-2 text-body-sm text-text-primary focus:border-primary focus:outline-none"
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="bg-primary text-text-inverse font-semibold text-[12px] px-4 py-2 rounded-lg hover:bg-primary-text transition-all disabled:opacity-50"
        >
          {busy ? "Updating…" : "Update target"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-mono text-text-muted hover:text-text-primary underline"
        >
          Cancel
        </button>
        <span className="text-[11px] font-mono text-text-muted">
          The analysis re-runs against the new target automatically.
        </span>
      </div>
    </div>
  );
}
