import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "standard" | "elevated" | "subtle" | "code" | "flat" | "ghost";
  title?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  children,
  variant = "standard",
  title,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6 sm:p-8",
  };

  if (variant === "code") {
    return (
      <div
        className={`rounded-lg bg-ground-iron border border-circuit-border overflow-hidden ${className}`}
        {...props}
      >
        {/* Code Window Header with Traffic-Light Dots */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-circuit-border/60 bg-carbon-veil/50">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          {title && (
            <span className="font-mono text-[11px] text-zinc-400 tracking-wider">
              {title}
            </span>
          )}
        </div>
        <div className={paddings[padding] || "p-5"}>{children}</div>
      </div>
    );
  }

  const variants = {
    // Level 3: Ground Iron, 8px radius, subtle hairline
    standard: "bg-ground-iron border border-circuit-border/80 rounded-cards",
    // Level 3: Carbon Veil, elevated for popouts/drawers
    elevated: "bg-carbon-veil border border-circuit-border/80 rounded-cards",
    // Level 1: Void / subtle dark panel with delicate separation
    subtle: "bg-zinc-950/40 border border-circuit-border/50 rounded-cards",
    // Level 0: Flat unbordered section container
    flat: "bg-transparent border-0 rounded-none",
    // Ghost: Transparent with subtle bottom border divider
    ghost: "bg-transparent border-b border-circuit-border/50 rounded-none",
  };

  return (
    <div
      className={`${variants[variant] || variants.standard} ${paddings[padding]} transition-colors duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
