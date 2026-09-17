import * as React from "react";
import Link from "next/link";

// ============================================================
// EmptyState — Standardized empty state
// ============================================================
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaAction?: () => void;
  accentColor?: "green" | "blue" | "purple" | "amber" | "rose" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const emptyAccentMap = {
  green:   { icon: "text-white",   dot: "bg-white",   ring: "border-white/30" },
  blue:    { icon: "text-zinc-200", dot: "bg-zinc-200", ring: "border-white/20" },
  purple:  { icon: "text-zinc-300", dot: "bg-zinc-300", ring: "border-white/20" },
  amber:   { icon: "text-zinc-400", dot: "bg-zinc-400", ring: "border-white/15" },
  rose:    { icon: "text-zinc-500", dot: "bg-zinc-500", ring: "border-white/10" },
  neutral: { icon: "text-zinc-400", dot: "bg-zinc-400", ring: "border-circuit-border" },
};

const emptySizeMap = {
  sm: { wrap: "p-6", icon: "w-10 h-10 text-[20px]", title: "text-[14px]", desc: "text-[12px]" },
  md: { wrap: "p-8", icon: "w-12 h-12 text-[24px]", title: "text-[16px]", desc: "text-[13px]" },
  lg: { wrap: "p-10", icon: "w-16 h-16 text-[28px]", title: "text-[18px]", desc: "text-[14px]" },
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaAction,
  accentColor = "neutral",
  size = "md",
  className = "",
}: EmptyStateProps) {
  const accent = emptyAccentMap[accentColor];
  const sz = emptySizeMap[size];

  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center
        bg-ground-iron border border-circuit-border rounded-cards
        ${sz.wrap} ${className}
      `}
    >
      <div
        className={`
          ${sz.icon} rounded-full bg-carbon-veil border ${accent.ring}
          flex items-center justify-center mb-3 flex-shrink-0
        `}
      >
        <span className={`material-symbols-outlined ${accent.icon}`} style={{ fontSize: "inherit" }}>
          {icon}
        </span>
      </div>

      <h3 className={`font-heading font-semibold text-phosphor-white ${sz.title} mb-1`}>
        {title}
      </h3>

      {description && (
        <p className={`text-sage-60 leading-relaxed max-w-sm ${sz.desc}`}>
          {description}
        </p>
      )}

      {(ctaLabel && ctaHref) && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center gap-2 bg-lime-pulse text-void-black font-sans font-semibold text-[13px] px-5 py-2.5 rounded-full hover:bg-mint-frost transition-colors"
        >
          {ctaLabel}
        </Link>
      )}
      {(ctaLabel && ctaAction && !ctaHref) && (
        <button
          onClick={ctaAction}
          className="mt-4 inline-flex items-center gap-2 bg-lime-pulse text-void-black font-sans font-semibold text-[13px] px-5 py-2.5 rounded-full hover:bg-mint-frost transition-colors cursor-pointer"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================
// LoadingState — Skeleton shimmer placeholders
// ============================================================
interface LoadingStateProps {
  rows?: number;
  className?: string;
  variant?: "card" | "list" | "metric";
}

export function LoadingState({ rows = 3, className = "", variant = "card" }: LoadingStateProps) {
  if (variant === "metric") {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-ground-iron border border-circuit-border rounded-cards p-5">
            <div className="skeleton h-3 w-16 rounded mb-4" />
            <div className="skeleton h-8 w-20 rounded mb-2" />
            <div className="skeleton h-1 w-full rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-ground-iron border border-circuit-border rounded-cards p-4 flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-48 rounded" />
              <div className="skeleton h-2.5 w-32 rounded" />
            </div>
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-ground-iron border border-circuit-border rounded-cards p-6 space-y-3">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="flex gap-2 pt-1">
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
