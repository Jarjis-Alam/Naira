"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartSimulationForm({
  defaultRoleName,
  defaultCompanyName,
  roleId,
  companyId,
}: {
  defaultRoleName: string;
  defaultCompanyName: string;
  roleId?: string;
  companyId?: string;
}) {
  const router = useRouter();
  const [roleName, setRoleName] = useState(defaultRoleName);
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/student/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName,
          roleId,
          roleName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initialize simulation");
      }

      const sim = await res.json();
      router.push(`/simulation/${sim.id}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && (
        <div className="p-3 rounded-lg bg-error/15 border border-error/30 text-error text-body-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-mono uppercase text-text-muted block mb-1.5 font-semibold">
            Target Company
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="w-full rounded-inputs bg-input-bg border border-neutral-border px-4 py-2.5 text-body-sm text-text-primary focus:border-primary-green focus:outline-hidden focus:ring-1 focus:ring-primary-green/30"
            placeholder="e.g. Microsoft, Google"
          />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase text-text-muted block mb-1.5 font-semibold">
            Target Role
          </label>
          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            required
            className="w-full rounded-inputs bg-input-bg border border-neutral-border px-4 py-2.5 text-body-sm text-text-primary focus:border-primary-green focus:outline-hidden focus:ring-1 focus:ring-primary-green/30"
            placeholder="e.g. Software Engineer"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary-green text-void-black font-semibold text-body-sm px-6 py-2.5 rounded-buttons hover:bg-bright-green transition-all inline-flex items-center gap-2 shadow-none disabled:opacity-50"
        >
          <span>{isSubmitting ? "Initializing Rounds..." : "Start Placement Simulation"}</span>
          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
        </button>
      </div>
    </form>
  );
}
