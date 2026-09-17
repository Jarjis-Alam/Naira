import React from "react";
import Link from "next/link";

export interface QuickActionItem {
  title: string;
  subtitle: string;
  icon: string;
  href: string;
  accentColor?: "purple" | "blue" | "green" | "amber";
}

interface QuickActionsGridProps {
  actions: QuickActionItem[];
}

export function QuickActionsGrid({ actions }: QuickActionsGridProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant shadow-md">
      <div className="flex items-center gap-2 mb-3.5">
        <span className="material-symbols-outlined text-[18px] text-text-muted">
          bolt
        </span>
        <h2 className="text-sm font-bold text-white">Quick Actions</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action, idx) => {
          return (
            <Link
              key={idx}
              href={action.href}
              className="bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 hover:border-white/40 p-3 rounded-xl transition-all group flex items-start gap-2.5"
            >
              <div
                className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {action.icon}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white/90 block group-hover:text-white truncate">
                  {action.title}
                </span>
                <span className="text-[10px] text-text-muted block leading-tight mt-0.5 truncate">
                  {action.subtitle}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
