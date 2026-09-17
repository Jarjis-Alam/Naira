import * as React from "react";

// ============================================================
// ProgressBar — Semantic color progress bars
// ============================================================
interface ProgressBarProps {
  value: number;        // 0-100
  max?: number;
  color?: "green" | "blue" | "purple" | "amber" | "rose" | "white";
  size?: "xs" | "sm" | "md";
  animated?: boolean;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const colorMap = {
  green:  "bg-lime-pulse",
  blue:   "bg-accent-blue",
  purple: "bg-accent-purple",
  amber:  "bg-accent-amber",
  rose:   "bg-accent-rose",
  white:  "bg-phosphor-white",
};

const sizeMap = {
  xs: "h-0.5",
  sm: "h-1",
  md: "h-1.5",
};

export function ProgressBar({
  value,
  max = 100,
  color = "green",
  size = "sm",
  animated = false,
  showLabel = false,
  label,
  className = "",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="font-mono text-[10px] text-sage-40 uppercase tracking-wider">{label}</span>}
          {showLabel && (
            <span className="font-mono text-[11px] text-phosphor-white font-semibold">{Math.round(pct)}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-carbon-veil rounded-full overflow-hidden ${sizeMap[size]}`}>
        <div
          className={`h-full rounded-full ${colorMap[color]} ${animated ? "transition-all duration-700 ease-out" : ""}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}

// ============================================================
// MetricCard — Large number display with label + progress
// ============================================================
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subLabel?: string;
  progress?: number;
  progressColor?: "green" | "blue" | "purple" | "amber" | "rose";
  accentColor?: "green" | "blue" | "purple" | "amber" | "rose";
  icon?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  className?: string;
  children?: React.ReactNode;
}

const accentMap = {
  green:  { text: "text-lime-pulse",   bg: "bg-[rgba(127,238,100,0.10)]", border: "border-[rgba(127,238,100,0.25)]" },
  blue:   { text: "text-accent-blue",   bg: "bg-[rgba(96,165,250,0.10)]",  border: "border-[rgba(96,165,250,0.25)]" },
  purple: { text: "text-accent-purple", bg: "bg-[rgba(167,139,250,0.10)]", border: "border-[rgba(167,139,250,0.25)]" },
  amber:  { text: "text-accent-amber",  bg: "bg-[rgba(251,191,36,0.10)]",  border: "border-[rgba(251,191,36,0.25)]" },
  rose:   { text: "text-accent-rose",   bg: "bg-[rgba(251,113,133,0.10)]", border: "border-[rgba(251,113,133,0.25)]" },
};

export function MetricCard({
  label,
  value,
  unit,
  subLabel,
  progress,
  progressColor = "green",
  accentColor = "green",
  icon,
  trend,
  trendValue,
  className = "",
  children,
}: MetricCardProps) {
  const accent = accentMap[accentColor];

  return (
    <div
      className={`
        bg-ground-iron border border-circuit-border rounded-cards p-5
        hover:border-circuit-border/80 transition-colors
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-moss-70 font-medium">
          {label}
        </span>
        {icon && (
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${accent.bg} border ${accent.border}`}>
            <span className={`material-symbols-outlined text-[16px] ${accent.text}`}>{icon}</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1 mb-1">
        <span className={`text-[28px] font-heading font-semibold leading-none tracking-tight ${accent.text}`}>
          {value}
        </span>
        {unit && (
          <span className="text-[13px] text-sage-40 font-mono">{unit}</span>
        )}
      </div>

      {subLabel && (
        <p className="text-[12px] text-sage-60 leading-snug mb-2">{subLabel}</p>
      )}

      {trend && (
        <div className="flex items-center gap-1 mt-1 mb-2">
          <span className={`material-symbols-outlined text-[14px] ${
            trend === "up" ? "text-lime-pulse" : trend === "down" ? "text-accent-rose" : "text-sage-40"
          }`}>
            {trend === "up" ? "trending_up" : trend === "down" ? "trending_down" : "trending_flat"}
          </span>
          {trendValue && (
            <span className={`font-mono text-[11px] ${
              trend === "up" ? "text-lime-pulse" : trend === "down" ? "text-accent-rose" : "text-sage-40"
            }`}>
              {trendValue}
            </span>
          )}
        </div>
      )}

      {progress !== undefined && (
        <ProgressBar value={progress} color={progressColor} size="xs" className="mt-2" />
      )}

      {children}
    </div>
  );
}
