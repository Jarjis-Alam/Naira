"use client";

import React, { useState } from "react";

interface DisclosurePanelProps {
  title: string;
  subtitle?: string;
  countBadge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DisclosurePanel({
  title,
  subtitle,
  countBadge,
  defaultOpen = false,
  children,
  className = "",
}: DisclosurePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-[#0d0d10] overflow-hidden transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-900/50 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold tracking-wide text-zinc-200 truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-zinc-500 hidden sm:inline truncate">
              {subtitle}
            </span>
          )}
          {countBadge !== undefined && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/60">
              {countBadge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono shrink-0">
          <span className="text-[11px] hidden sm:inline text-zinc-500">
            {isOpen ? "Collapse" : "Expand"}
          </span>
          <span
            className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800/80">
          {children}
        </div>
      )}
    </div>
  );
}
