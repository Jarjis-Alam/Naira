"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client-side error telemetry without exposing secrets
    console.error("[protected-route] Uncaught rendering fault:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="max-w-md w-full rounded-2xl border border-border/80 bg-surface/90 p-8 shadow-2xl backdrop-blur-sm space-y-6">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mx-auto flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px]">warning</span>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold block">
            PLACEMENT WORKSPACE FAULT
          </span>
          <h2 className="text-title-lg font-bold text-text-primary tracking-tight">
            Workspace Temporarily Unavailable
          </h2>
          <p className="text-body-sm text-text-secondary leading-relaxed">
            An unexpected error occurred while rendering this placement view. Your stored assessment and application data remains safe.
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono text-text-muted mt-2">
              Fault Digest: <code className="bg-surface-high px-1.5 py-0.5 rounded text-text-secondary">{error.digest}</code>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-text hover:bg-primary-hover transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-high/50 px-5 py-2.5 text-body-sm font-semibold text-text-primary hover:bg-surface-high transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
