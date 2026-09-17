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
    iconBg: "bg-[rgba(127,238,100,0.1)]",
    iconBorder: "border-lime-pulse/30",
    iconText: "text-lime-pulse",
    barFill: "bg-lime-pulse",
  },
  pink: {
    iconBg: "bg-rose-500/10",
    iconBorder: "border-rose-500/30",
    iconText: "text-rose-400",
    barFill: "bg-rose-400",
  },
  blue: {
    iconBg: "bg-blue-500/10",
    iconBorder: "border-blue-500/30",
    iconText: "text-blue-400",
    barFill: "bg-blue-400",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconBorder: "border-amber-500/30",
    iconText: "text-amber-400",
    barFill: "bg-amber-400",
  },
  purple: {
    iconBg: "bg-purple-500/10",
    iconBorder: "border-purple-500/30",
    iconText: "text-purple-400",
    barFill: "bg-purple-400",
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
    <div className="bg-[#191c1b] rounded-2xl p-5 border border-[#3f4a38]/40 flex flex-col justify-between hover:border-[#88957f]/70 transition-all duration-200 group h-full shadow-md">
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

        <span className="text-[12px] text-sage-40 font-medium block">
          {title}
        </span>
        <span className="text-2xl sm:text-3xl font-bold font-heading text-phosphor-white mt-1 block">
          {value}
        </span>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-[#0c0f0e] rounded-full mt-3.5 overflow-hidden border border-[#3f4a38]/20">
          <div
            className={`${hasProgress ? accent.barFill : "bg-[#282b29]"} h-full rounded-full transition-all duration-500`}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>

      {/* Footer text + arrow */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#3f4a38]/30 text-[11px]">
        <span className="text-sage-40/80 truncate mr-2">
          {footerText || "View details"}
        </span>
        <span className="w-5 h-5 rounded-full bg-[#282b29] group-hover:bg-lime-pulse/20 group-hover:text-lime-pulse flex items-center justify-center text-sage-40 transition-colors flex-shrink-0">
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
