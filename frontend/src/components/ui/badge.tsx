import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "active" | "neutral" | "pill" | "outline" | "warn" | "error" | "inline";
  shape?: "rounded" | "pill";
  hasDot?: boolean;
}

export function Badge({
  children,
  variant = "neutral",
  shape = "rounded",
  hasDot = false,
  className = "",
  ...props
}: BadgeProps) {
  const isInline = variant === "inline";

  const variants = {
    // Active LED Tag: Clean monochrome white
    active: "bg-white/12 text-white border border-white/25",
    // Primary Solid Tag: high contrast white
    pill: "bg-white text-black font-semibold border border-white",
    // Neutral hairline tag
    neutral: "bg-zinc-900/70 text-zinc-400 border border-zinc-800/80",
    // Outlined tag
    outline: "bg-transparent text-zinc-400 border border-zinc-700/80",
    // Warning tag (monochrome zinc)
    warn: "bg-zinc-800/80 text-zinc-200 border border-zinc-600/80",
    // Error / Critical tag (monochrome high-contrast)
    error: "bg-white/10 text-white border border-white/25",
    // Inline typography metadata
    inline: "bg-transparent text-zinc-400 border-transparent p-0 tracking-normal normal-case font-sans",
  };

  const dotColors = {
    active: "bg-white animate-pulse",
    pill: "bg-black",
    neutral: "bg-zinc-500",
    outline: "bg-zinc-600",
    warn: "bg-zinc-300",
    error: "bg-white",
    inline: "bg-zinc-500",
  };

  const radiusClass = isInline
    ? ""
    : shape === "pill"
    ? "rounded-full"
    : "rounded-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 ${radiusClass} text-caption font-mono uppercase tracking-[0.03em] ${variants[variant]} ${className}`}
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
