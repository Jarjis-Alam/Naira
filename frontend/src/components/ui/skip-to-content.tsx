import React from "react";

/**
 * SkipToContent Component
 *
 * Provides a keyboard-accessible shortcut (WCAG 2.1 Level A 2.4.1 Bypass Blocks)
 * that allows keyboard and screen reader users to skip repeated navigation
 * elements and jump directly to the primary page content.
 */
export function SkipToContent({
  targetId = "main-content",
  label = "Skip to main content",
}: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-[#0d0d10] px-4 py-2 text-xs font-mono font-medium uppercase tracking-wider text-white shadow-xl hover:border-white hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-150"
    >
      <span className="material-symbols-outlined text-[16px] text-zinc-400">
        south
      </span>
      <span>{label}</span>
    </a>
  );
}
