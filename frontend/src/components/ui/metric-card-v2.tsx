import React from "react";
import Link from "next/link";

export type MetricAccent = "green" | "pink" | "blue" | "amber" | "purple";

interface MetricCardV2Props {
  title: string;
  value: string | number;
  subtitle?: string;
  accentColor?: MetricAccent;
  icon: string;
  progressPct?: number | null;
  footerText?: string;
  href?: string;
  onClick?: () => void;
}

const ACCENT_STYLES: Record<
  MetricAccent,
  {
    iconBg: string;
    iconBorder: string;
    iconText: string;
    barFill: string;
  }
> = {
  green: {
    iconBg: "bg-white/10",
    iconBorder: "border-white/20",
    iconText: "text-white",
    barFill: "bg-white",
  },
  pink: {
    iconBg: "bg-white/10",
    iconBorder: "border-white/20",
    iconText: "text-zinc-200",
    barFill: "bg-zinc-300",
  },
  blue: {
    iconBg: "bg-white/10",
    iconBorder: "border-white/20",
    iconText: "text-zinc-200",
    barFill: "bg-zinc-200",
  },
  amber: {
    iconBg: "bg-white/10",
    iconBorder: "border-white/20",
    iconText: "text-zinc-300",
    barFill: "bg-zinc-400",
  },
  purple: {
    iconBg: "bg-white/10",
    iconBorder: "border-white/20",
    iconText: "text-zinc-200",
    barFill: "bg-zinc-300",
  },
};

export function MetricCardV2({
  title,
  value,
  accentColor = "green",
  icon,
  progressPct,
  footerText,
  href,
  onClick,
}: MetricCardV2Props) {
  const accent = ACCENT_STYLES[accentColor] || ACCENT_STYLES.green;
  const hasProgress = typeof progressPct === "number" && !isNaN(progressPct);
  const clampedProgress = hasProgress ? Math.min(100, Math.max(0, progressPct)) : 0;

  const content = (
    <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant flex flex-col justify-between hover:border-white/40 transition-all duration-200 group h-full shadow-md">
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div
            className={`w-9 h-9 rounded-xl ${accent.iconBg} border ${accent.iconBorder} flex items-center justify-center ${accent.iconText} transition-transform group-hover:scale-105`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {icon}
            </span>
          </div>
        </div>

        <span className="text-[12px] text-text-muted font-medium block">
          {title}
        </span>
        <span className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1 block">
          {value}
        </span>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-surface-container-lowest rounded-full mt-3.5 overflow-hidden border border-outline-variant/40">
          <div
            className={`${hasProgress ? accent.barFill : "bg-zinc-800"} h-full rounded-full transition-all duration-500`}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>

      {/* Footer text + arrow */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/40 text-[11px]">
        <span className="text-text-muted truncate mr-2">
          {footerText || "View details"}
        </span>
        <span className="w-5 h-5 rounded-full bg-surface-container-high group-hover:bg-white group-hover:text-black flex items-center justify-center text-text-muted transition-colors shrink-0">
          <span className="material-symbols-outlined text-[14px]">
            arrow_forward
          </span>
        </span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full cursor-pointer">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left h-full cursor-pointer">
        {content}
      </button>
    );
  }

  return content;
}
