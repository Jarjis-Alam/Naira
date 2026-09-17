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

export function ActivityTimeline({
  title = "Recent Activity",
  items,
  viewAllHref,
  emptyMessage = "No recent activity recorded yet.",
}: ActivityTimelineProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-text-muted">
            history
          </span>
          <h2 className="text-sm font-bold text-white">{title}</h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs text-text-muted hover:text-white flex items-center gap-1 transition-colors font-mono"
          >
            View All <span className="text-sm leading-none">→</span>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] text-text-muted/80 py-4 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-4 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-px before:bg-outline-variant">
          {items.map((item) => {
            const rowContent = (
              <div className="relative flex items-start gap-3.5 group">
                <div
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 z-10 bg-surface-container-low transition-transform group-hover:scale-105"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {item.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white/90 truncate group-hover:text-white">
                      {item.title}
                    </p>
                    <span className="text-[10px] text-text-muted shrink-0 font-mono">
                      {item.timestamp}
                    </span>
                  </div>
                  {item.subtitle && (
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  )}
                  {item.scoreBadge && (
                    <span className="inline-block mt-1 text-[10px] font-mono text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">
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
