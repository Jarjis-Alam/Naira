import React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  badge?: {
    label: string;
    variant?: "green" | "blue" | "amber" | "rose" | "neutral";
    ping?: boolean;
  };
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const BADGE_VARIANTS = {
  green: "bg-white/15 text-white border-white/30 font-semibold",
  blue: "bg-white/10 text-zinc-200 border-white/20 font-medium",
  amber: "bg-white/10 text-zinc-300 border-white/20 font-medium",
  rose: "bg-zinc-800 text-zinc-400 border-zinc-700 font-medium",
  neutral: "bg-white/5 text-zinc-400 border-white/10",
};

export function PageHeader({
  breadcrumbs,
  badge,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  const badgeStyle = badge ? BADGE_VARIANTS[badge.variant || "green"] : "";

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div className="flex flex-col gap-1.5">
        {/* Breadcrumbs & Badge */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-sage-40 flex-wrap">
          {breadcrumbs?.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-[#3f4a38]">/</span>}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-phosphor-white transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-phosphor-white/80">{item.label}</span>
              )}
            </React.Fragment>
          ))}

          {badge && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${badgeStyle} ml-1`}
            >
              {badge.ping && (
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
              )}
              {badge.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[13px] text-sage-40 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action Buttons or Filter Pills */}
      {actions && (
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
