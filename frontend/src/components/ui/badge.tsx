import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "active" | "neutral" | "pill" | "outline" | "warn" | "error";
  hasDot?: boolean;
}

export function Badge({
  children,
  variant = "neutral",
  hasDot = false,
  className = "",
  ...props
}: BadgeProps) {
  const variants = {
    // Active LED Tag: Clean monochrome white
    active: "bg-white/15 text-white border border-white/30",
    // Primary Solid Pill
    pill: "bg-white text-black font-semibold border border-white",
    // Neutral hairline tag
    neutral: "bg-zinc-900/60 text-zinc-400 border border-zinc-800",
    // Outlined tag
    outline: "bg-transparent text-zinc-400 border border-zinc-700",
    // Warning tag (monochrome zinc)
    warn: "bg-zinc-800/80 text-zinc-200 border border-zinc-600",
    // Error / Critical tag (monochrome high-contrast)
    error: "bg-white/10 text-white border border-white/25",
  };

  const dotColors = {
    active: "bg-white animate-pulse",
    pill: "bg-black",
    neutral: "bg-zinc-500",
    outline: "bg-zinc-600",
    warn: "bg-zinc-300",
    error: "bg-white",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-mono uppercase tracking-wider ${variants[variant]} ${className}`}
      {...props}
    >
      {hasDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant] || "bg-white"}`}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
