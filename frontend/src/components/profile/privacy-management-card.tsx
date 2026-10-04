"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface PrivacyManagementCardProps {
  userId: string;
  email: string;
}

export function PrivacyManagementCard({ userId, email }: PrivacyManagementCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#121215] p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              shield_lock
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Data Sovereignty &amp; Privacy
            </h3>
            <p className="text-xs text-zinc-400">
              Candidate data footprint and administrative request guidelines
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <Link
            href="/privacy"
            className="text-zinc-400 hover:text-white underline underline-offset-4 transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-zinc-600">•</span>
          <Link
            href="/terms"
            className="text-zinc-400 hover:text-white underline underline-offset-4 transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </div>

      {/* Footprint summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-zinc-500 uppercase block text-[10px]">Data Isolation</span>
          <span className="text-white font-semibold mt-0.5 block truncate">Tenant-Isolated</span>
          <span className="text-zinc-500 text-[10px] mt-1 block">UID: {userId.slice(0, 8)}</span>
        </div>
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-zinc-500 uppercase block text-[10px]">Cookies</span>
          <span className="text-white font-semibold mt-0.5 block">Session Auth Only</span>
          <span className="text-zinc-500 text-[10px] mt-1 block">No tracking cookies</span>
        </div>
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-zinc-500 uppercase block text-[10px]">Resume Storage</span>
          <span className="text-white font-semibold mt-0.5 block">PostgreSQL (Database)</span>
          <span className="text-zinc-500 text-[10px] mt-1 block">ATS Analysis Only</span>
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-zinc-800/60">
        <div className="space-y-1 max-w-lg">
          <p className="text-xs text-zinc-300 font-medium">
            Account &amp; Data Deletion Requests
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Automated self-service account deletion is not supported. To request permanent deletion of your profile, test records, and uploaded resumes, contact your institution&apos;s placement administrator.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 rounded-full border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors shrink-0 cursor-pointer"
        >
          Deletion Instructions
        </button>
      </div>

      <ConfirmationDialog
        isOpen={isDialogOpen}
        title="Account & Data Deletion Guidelines"
        description={`Candidate data for ${email} is linked to institutional placement benchmarks. Automated self-service deletion is not supported. Please contact your campus placement cell coordinator or platform administrator to request account removal. When an administrator removes a candidate account, all associated assessment attempts, competency scores, and uploaded resume files are deleted from the database via cascade constraints.`}
        confirmLabel="Understood"
        cancelLabel="Close"
        isDestructive={false}
        isLoading={false}
        onConfirm={() => setIsDialogOpen(false)}
        onCancel={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
