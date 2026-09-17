import React from "react";

export interface EyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  system?: string;
  category?: string;
}

export function Eyebrow({
  children,
  system = "NEXORA",
  category,
  className = "",
  ...props
}: EyebrowProps) {
  return (
    <div
      className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-moss-70 mb-2 ${className}`}
      {...props}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse shrink-0 animate-pulse" />
      <span>{system}</span>
      {category && (
        <>
          <span className="text-circuit-border">/</span>
          <span className="text-moss-80">{category}</span>
        </>
      )}
      {children && (
        <>
          <span className="text-circuit-border">/</span>
          <span className="text-phosphor-white">{children}</span>
        </>
      )}
    </div>
  );
}
