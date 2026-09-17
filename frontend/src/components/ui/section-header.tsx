import * as React from "react";
import Link from "next/link";

// ============================================================
// SectionHeader — Reusable section heading with eyebrow + title + optional CTA
// ============================================================
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaIcon?: string;
  className?: string;
  titleSize?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaIcon = "chevron_right",
  className = "",
  titleSize = "md",
  children,
}: SectionHeaderProps) {
  const titleClasses = {
    sm: "text-[18px] font-semibold",
    md: "text-[20px] sm:text-[22px] font-semibold",
    lg: "text-[24px] sm:text-[28px] font-semibold",
  };

  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1 h-1 rounded-full bg-lime-pulse flex-shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-moss-70 font-medium">
              {eyebrow}
            </span>
          </div>
        )}
        <h2
          className={`font-heading text-phosphor-white leading-tight tracking-tight ${titleClasses[titleSize]}`}
        >
          {title}
        </h2>
        {description && (
          <p className="text-[13px] text-sage-60 mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 self-start">
        {children}
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-0.5 font-mono text-[11px] text-lime-pulse hover:text-phosphor-white transition-colors font-medium"
          >
            <span>{ctaLabel}</span>
            <span className="material-symbols-outlined text-[15px]">{ctaIcon}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PageHeader — Large page-level header with greeting
// ============================================================
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, eyebrow, children, className = "" }: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-circuit-border ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse animate-pulse flex-shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-moss-70 font-semibold">
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="text-[24px] sm:text-[28px] lg:text-[32px] font-heading font-semibold text-phosphor-white tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] sm:text-[14px] text-sage-60 mt-1.5 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 self-start flex-shrink-0">
          {children}
        </div>
      )}
    </header>
  );
}
