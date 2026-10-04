import React from "react";
import Link from "next/link";

export interface CompactMetricItem {
  id: string;
  label: string;
  value: string | number;
  detail?: string;
  progressPct?: number | null;
  href?: string;
  statusText?: string;
}

interface CompactMetricStripProps {
  items: CompactMetricItem[];
  className?: string;
}

export function CompactMetricStrip({ items, className = "" }: CompactMetricStripProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-[#0d0d10] divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80 grid grid-cols-2 lg:grid-cols-4 shadow-sm ${className}`}
    >
      {items.map((item) => {
        const hasProgress = typeof item.progressPct === "number" && !isNaN(item.progressPct);
        const clamped = hasProgress ? Math.min(100, Math.max(0, item.progressPct!)) : 0;

        const cellContent = (
          <div className="p-4 sm:p-5 flex flex-col justify-between h-full group hover:bg-zinc-900/40 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">
                {item.label}
              </span>
              {item.statusText && (
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  {item.statusText}
                </span>
              )}
            </div>

            <div className="my-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white">
                {item.value}
              </span>
              {item.detail && (
                <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[140px] text-right">
                  {item.detail}
                </span>
              )}
            </div>

            {hasProgress ? (
              <div className="w-full h-1 bg-zinc-800/80 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-white transition-all duration-500 rounded-full"
                  style={{ width: `${clamped}%` }}
                />
              </div>
            ) : (
              <div className="w-full h-1 bg-transparent" />
            )}
          </div>
        );

        if (item.href) {
          return (
            <Link key={item.id} href={item.href} className="block cursor-pointer focus:outline-none">
              {cellContent}
            </Link>
          );
        }

        return <div key={item.id}>{cellContent}</div>;
      })}
    </div>
  );
}
