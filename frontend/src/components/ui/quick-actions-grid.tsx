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

const ACCENTS = {
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
  },
  green: {
    bg: "bg-lime-pulse/10",
    border: "border-lime-pulse/20",
    text: "text-lime-pulse",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
};

export function QuickActionsGrid({ actions }: QuickActionsGridProps) {
  return (
    <div className="bg-[#191c1b] rounded-2xl p-5 border border-[#3f4a38]/40 shadow-md">
      <div className="flex items-center gap-2 mb-3.5">
        <span className="material-symbols-outlined text-[18px] text-sage-40">
          bolt
        </span>
        <h2 className="text-sm font-bold text-phosphor-white">Quick Actions</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action, idx) => {
          const accent = ACCENTS[action.accentColor || "green"];
          return (
            <Link
              key={idx}
              href={action.href}
              className="bg-[#111413] hover:bg-[#1d201f] border border-[#3f4a38]/40 p-3 rounded-xl transition-all group flex items-start gap-2.5"
            >
              <div
                className={`w-8 h-8 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center ${accent.text} shrink-0 group-hover:scale-105 transition-transform`}
              >
                <span className="material-symbols-outlined text-[17px]">
                  {action.icon}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-phosphor-white/90 block group-hover:text-phosphor-white truncate">
                  {action.title}
                </span>
                <span className="text-[10px] text-sage-40 block leading-tight mt-0.5 truncate">
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
