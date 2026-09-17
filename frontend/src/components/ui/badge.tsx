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
    // Active LED Tag: Lime Pulse fill or tint
    active: "bg-lime-pulse/15 text-phosphor-white border border-lime-pulse/40",
    // Primary Solid Pill (rationed)
    pill: "bg-lime-pulse text-void-black font-semibold border border-lime-pulse",
    // Neutral hairline tag
    neutral: "bg-carbon-veil/50 text-sage-60 border border-circuit-border",
    // Outlined tag
    outline: "bg-transparent text-sage-60 border border-circuit-border/70",
    // Warning tag
    warn: "bg-[#332b1a] text-[#ffd37a] border border-[#665426]",
    // Error tag
    error: "bg-[#331c1c] text-[#ff7b72] border border-[#663131]",
  };

  const dotColors = {
    active: "bg-lime-pulse animate-pulse",
    pill: "bg-void-black",
    neutral: "bg-sage-40",
    outline: "bg-circuit-border",
    warn: "bg-[#ffd37a]",
    error: "bg-[#ff7b72]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pills text-caption font-mono uppercase tracking-wider ${variants[variant]} ${className}`}
      {...props}
    >
      {hasDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant] || "bg-lime-pulse"}`}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
