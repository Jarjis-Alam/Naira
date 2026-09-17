import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "standard" | "elevated" | "subtle" | "code";
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
    md: "p-6",
    lg: "p-8",
  };

  if (variant === "code") {
    return (
      <div
        className={`rounded-xl bg-ground-iron border border-circuit-border overflow-hidden ${className}`}
        {...props}
      >
        {/* Code Window Header with Traffic-Light Dots */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-circuit-border/60 bg-carbon-veil/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          {title && (
            <span className="font-mono text-[11px] text-moss-70 tracking-wider">
              {title}
            </span>
          )}
        </div>
        <div className={paddings[padding] || "p-6"}>{children}</div>
      </div>
    );
  }

  const variants = {
    // Level 1: Ground Iron #181818, 8px radius, 1px hairline #485346
    standard: "bg-ground-iron border border-circuit-border rounded-cards",
    // Level 2: Carbon Veil #212525, elevated for popouts/drawers
    elevated: "bg-carbon-veil border border-circuit-border rounded-cards",
    // Level 0: Void / subtle dark panel
    subtle: "bg-void-black/60 border border-circuit-border/60 rounded-cards",
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
