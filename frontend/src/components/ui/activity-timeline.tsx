import React from "react";
import Link from "next/link";

export interface ActivityItem {
  id: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  icon: string;
  accentColor?: "purple" | "green" | "blue" | "amber" | "rose";
  scoreBadge?: string;
  href?: string;
}

interface ActivityTimelineProps {
  title?: string;
  items: ActivityItem[];
  viewAllHref?: string;
  emptyMessage?: string;
}

const ACCENT_CLASSES = {
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
  },
  green: {
    bg: "bg-lime-pulse/10",
    border: "border-lime-pulse/30",
    text: "text-lime-pulse",
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-400",
  },
};

export function ActivityTimeline({
  title = "Recent Activity",
  items,
  viewAllHref,
  emptyMessage = "No recent activity recorded yet.",
}: ActivityTimelineProps) {
  return (
    <div className="bg-[#191c1b] rounded-2xl p-5 border border-[#3f4a38]/40 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-sage-40">
            history
          </span>
          <h2 className="text-sm font-bold text-phosphor-white">{title}</h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs text-sage-40 hover:text-lime-pulse flex items-center gap-1 transition-colors"
          >
            View All <span className="text-sm leading-none">→</span>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] text-sage-40/80 py-4 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-4 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-px before:bg-[#282b29]">
          {items.map((item) => {
            const accent = ACCENT_CLASSES[item.accentColor || "green"];
            const rowContent = (
              <div className="relative flex items-start gap-3.5 group">
                <div
                  className={`w-8 h-8 rounded-full ${accent.bg} border ${accent.border} flex items-center justify-center ${accent.text} shrink-0 z-10 bg-[#191c1b] transition-transform group-hover:scale-105`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {item.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-phosphor-white/90 truncate group-hover:text-phosphor-white">
                      {item.title}
                    </p>
                    <span className="text-[10px] text-sage-40/80 shrink-0 font-mono">
                      {item.timestamp}
                    </span>
                  </div>
                  {item.subtitle && (
                    <p className="text-[11px] text-sage-40 mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  )}
                  {item.scoreBadge && (
                    <span className="inline-block mt-1 text-[10px] font-mono text-lime-pulse bg-lime-pulse/10 border border-lime-pulse/20 px-2 py-0.5 rounded-full">
                      {item.scoreBadge}
                    </span>
                  )}
                </div>
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href} className="block">
                {rowContent}
              </Link>
            ) : (
              <div key={item.id}>{rowContent}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
