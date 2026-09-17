import * as React from "react";

// ============================================================
// Pill — Core reusable pill component (Monochrome Pill System)
// ============================================================

type PillVariant =
  | "green" | "blue" | "purple" | "amber" | "rose" | "neutral" | "ghost";

type PillSize = "sm" | "md" | "lg";

type PillType =
  | "status"    // with live dot indicator, e.g. [ ● ACTIVE ]
  | "category"  // e.g. [ REINFORCE ] [ REVIEW ]
  | "meta"      // e.g. [ 10 QUESTIONS ] [ ~25 MIN ]
  | "tab"       // navigation tab
  | "action"    // interactive CTA
  | "label";    // plain label

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  size?: PillSize;
  type?: PillType;
  active?: boolean;
  dot?: boolean;       // show a status dot
  pulse?: boolean;     // animate the dot
  icon?: React.ReactNode;
  as?: React.ElementType;
  href?: string;
}

const variantClasses: Record<PillVariant, string> = {
  green:   "bg-white/15 text-white border-white/30",
  blue:    "bg-white/10 text-zinc-200 border-white/20",
  purple:  "bg-white/10 text-zinc-300 border-white/20",
  amber:   "bg-zinc-800/80 text-zinc-300 border-zinc-700",
  rose:    "bg-zinc-800/80 text-zinc-300 border-zinc-700",
  neutral: "bg-zinc-900/80 text-zinc-400 border-zinc-800",
  ghost:   "bg-transparent text-zinc-500 border-zinc-800",
};

const sizeClasses: Record<PillSize, string> = {
  sm: "text-[10px] px-2 py-[3px] gap-[3px]",
  md: "text-[11px] px-2.5 py-1 gap-1",
  lg: "text-[12px] px-3 py-[5px] gap-1.5",
};

const dotColorMap: Record<PillVariant, string> = {
  green:   "bg-white",
  blue:    "bg-zinc-300",
  purple:  "bg-zinc-300",
  amber:   "bg-zinc-400",
  rose:    "bg-zinc-400",
  neutral: "bg-zinc-500",
  ghost:   "bg-zinc-600",
};

export function Pill({
  variant = "neutral",
  size = "md",
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
  const base =
    "inline-flex items-center border rounded-full font-mono uppercase tracking-[0.08em] leading-none whitespace-nowrap select-none font-medium";

  const typeClass =
    type === "status" ? "gap-[5px]" :
    type === "action" ? "cursor-pointer font-sans normal-case tracking-[-0.01em] font-[500] transition-all" :
    type === "tab"    ? "cursor-pointer font-sans normal-case tracking-[-0.01em] font-[500] transition-all" :
    "";

  const activeClass =
    type === "tab" && active
      ? "bg-white text-black font-semibold border-white"
      : type === "tab"
      ? "bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-white"
      : "";

  return (
    <Tag
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${typeClass} ${activeClass} ${className}`}
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
interface StatusPillProps extends Omit<PillProps, "variant" | "dot" | "type"> {
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
// ============================================================
export function MetaPill({ children, className = "", ...props }: PillProps) {
  return (
    <Pill variant="neutral" size="sm" type="label" className={`font-mono ${className}`} {...props}>
      {children}
    </Pill>
  );
}

// ============================================================
// PillTabBar — Container for tab pills
// ============================================================
export function PillTabBar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex gap-1 p-1 bg-void-black border border-outline-variant rounded-full w-fit ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

// ============================================================
// PillTab — Individual tab item
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
        inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full
        font-sans font-medium text-[13px] tracking-[-0.01em] leading-none
        border transition-all duration-200 cursor-pointer
        ${active
          ? "bg-white text-black font-semibold border-white"
          : "bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-white"
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
