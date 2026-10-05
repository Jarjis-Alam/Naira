import * as React from "react";

// ============================================================
// Pill — Core reusable pill/tag component (Restrained Monochrome System)
// Level 2 / Level 4 shape hierarchy:
// - Default: restrained geometry (rounded-sm / rounded-md)
// - shape="pill": rounded-full (strictly for avatars, status dots, circular chips)
// ============================================================

export type PillVariant =
  | "green" | "blue" | "purple" | "amber" | "rose" | "neutral" | "ghost" | "inline" | "plain";

export type PillSize = "sm" | "md" | "lg";

export type PillShape = "rounded" | "pill" | "square";

export type PillType =
  | "status"    // with live dot indicator, e.g. [ ● ACTIVE ]
  | "category"  // e.g. [ REINFORCE ] [ REVIEW ]
  | "meta"      // e.g. [ 10 QUESTIONS ] [ ~25 MIN ]
  | "tab"       // navigation tab
  | "action"    // interactive CTA
  | "label";    // plain label

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  size?: PillSize;
  shape?: PillShape;
  type?: PillType;
  active?: boolean;
  dot?: boolean;       // show a status dot
  pulse?: boolean;     // animate the dot
  icon?: React.ReactNode;
  as?: React.ElementType;
  href?: string;
}

const variantClasses: Record<PillVariant, string> = {
  green:   "bg-white/12 text-white border-white/25",
  blue:    "bg-white/10 text-zinc-200 border-white/20",
  purple:  "bg-white/10 text-zinc-300 border-white/20",
  amber:   "bg-zinc-800/80 text-zinc-300 border-zinc-700/80",
  rose:    "bg-zinc-800/80 text-zinc-300 border-zinc-700/80",
  neutral: "bg-zinc-900/80 text-zinc-400 border-zinc-800",
  ghost:   "bg-transparent text-zinc-400 border-zinc-800",
  inline:  "bg-transparent text-zinc-400 border-transparent p-0 tracking-normal normal-case font-sans",
  plain:   "bg-transparent text-zinc-400 border-zinc-800/60 font-sans normal-case",
};

const sizeClasses: Record<PillSize, string> = {
  sm: "text-[10px] px-2 py-[2px] gap-[3px]",
  md: "text-[11px] px-2.5 py-[3px] gap-1",
  lg: "text-[12px] px-3 py-1 gap-1.5",
};

const shapeClasses: Record<PillShape, Record<PillSize, string>> = {
  rounded: {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-md",
  },
  pill: {
    sm: "rounded-full",
    md: "rounded-full",
    lg: "rounded-full",
  },
  square: {
    sm: "rounded-none",
    md: "rounded-none",
    lg: "rounded-none",
  },
};

const dotColorMap: Record<PillVariant, string> = {
  green:   "bg-white",
  blue:    "bg-zinc-300",
  purple:  "bg-zinc-300",
  amber:   "bg-zinc-400",
  rose:    "bg-zinc-400",
  neutral: "bg-zinc-500",
  ghost:   "bg-zinc-600",
  inline:  "bg-zinc-500",
  plain:   "bg-zinc-500",
};

export function Pill({
  variant = "neutral",
  size = "md",
  shape = "rounded",
  type = "label",
  active = false,
  dot = false,
  pulse = false,
  icon,
  as: Tag = "span",
  className = "",
  children,
  ...props
}: PillProps) {
  const isInline = variant === "inline";
  const base = isInline
    ? "inline-flex items-center text-xs leading-normal select-none"
    : `inline-flex items-center border font-mono uppercase tracking-[0.04em] leading-none whitespace-nowrap select-none font-medium ${shapeClasses[shape][size]}`;

  const typeClass =
    type === "status" ? "gap-[5px]" :
    type === "action" ? "cursor-pointer font-sans normal-case tracking-[-0.01em] font-[500] transition-all" :
    type === "tab"    ? "cursor-pointer font-sans normal-case tracking-[-0.01em] font-[500] transition-all" :
    "";

  const activeClass =
    type === "tab" && active
      ? "bg-white text-black font-semibold border-white shadow-xs"
      : type === "tab"
      ? "bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-white"
      : "";

  const appliedVariant = type === "tab" ? "" : variantClasses[variant];

  return (
    <Tag
      className={`${base} ${appliedVariant} ${isInline ? "" : sizeClasses[size]} ${typeClass} ${activeClass} ${className}`}
      {...props}
    >
      {(dot || type === "status") && (
        <span
          className={`inline-block w-[5px] h-[5px] rounded-full flex-shrink-0 ${dotColorMap[variant]} ${pulse ? "animate-pulse" : ""}`}
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </Tag>
  );
}

// ============================================================
// StatusPill — Semantic shortcuts for common states
// ============================================================
export interface StatusPillProps extends Omit<PillProps, "variant" | "dot" | "type"> {
  status:
    | "active" | "completed" | "in-progress" | "pending"
    | "applied" | "interview" | "offer" | "rejected"
    | "reinforce" | "review" | "maintain" | "fix"
    | "success" | "warning" | "error" | "info"
    | "intelligence" | "insight";
}

const statusMap: Record<string, { variant: PillVariant; label?: string }> = {
  active:       { variant: "green" },
  completed:    { variant: "green" },
  success:      { variant: "green" },
  "in-progress":{ variant: "amber" },
  maintain:     { variant: "amber" },
  warning:      { variant: "amber" },
  pending:      { variant: "neutral" },
  applied:      { variant: "blue" },
  info:         { variant: "blue" },
  interview:    { variant: "purple" },
  intelligence: { variant: "purple" },
  insight:      { variant: "purple" },
  offer:        { variant: "green" },
  rejected:     { variant: "rose" },
  error:        { variant: "rose" },
  reinforce:    { variant: "amber", label: "REINFORCE" },
  review:       { variant: "blue",  label: "REVIEW" },
  fix:          { variant: "rose",  label: "FIX" },
};

export function StatusPill({ status, children, ...props }: StatusPillProps) {
  const config = statusMap[status] ?? { variant: "neutral" as PillVariant };
  return (
    <Pill
      variant={config.variant}
      type="status"
      dot
      {...props}
    >
      {children ?? config.label ?? status.toUpperCase()}
    </Pill>
  );
}

// ============================================================
// MetaPill — For metadata like "10 QUESTIONS" "~25 MIN" "DSA"
// Supports inline typography mode or restrained badge mode
// ============================================================
export interface MetaPillProps extends PillProps {
  inline?: boolean;
}

export function MetaPill({ inline = false, children, className = "", ...props }: MetaPillProps) {
  if (inline) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-zinc-400 font-mono ${className}`}>
        {children}
      </span>
    );
  }
  return (
    <Pill
      variant="neutral"
      size="sm"
      shape="rounded"
      type="label"
      className={`font-mono text-zinc-400 bg-zinc-900/60 border-zinc-800/80 ${className}`}
      {...props}
    >
      {children}
    </Pill>
  );
}

// ============================================================
// PillTabBar — Container for tabs (now restrained Level 2 surface)
// ============================================================
export function PillTabBar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex gap-1 p-1 bg-void-black border border-circuit-border rounded-lg w-fit ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

// ============================================================
// PillTab — Individual tab item (restrained Level 2 geometry)
// ============================================================
export interface PillTabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function PillTab({ active = false, children, className = "", ...props }: PillTabProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md
        font-sans font-medium text-[13px] tracking-[-0.01em] leading-none
        border transition-all duration-200 cursor-pointer
        ${active
          ? "bg-white text-black font-semibold border-white"
          : "bg-transparent text-zinc-400 border-transparent hover:bg-zinc-850 hover:text-white"
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
