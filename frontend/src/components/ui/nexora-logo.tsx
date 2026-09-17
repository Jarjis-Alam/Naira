import React from "react";
import Image from "next/image";

export interface NexoraLogoProps {
  /** Size preset or custom numeric dimension in pixels */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Custom className for the container */
  className?: string;
  /** Image className */
  imageClassName?: string;
  /** Whether to render "Nexora" text brand alongside the emblem */
  withText?: boolean;
  /** Optional subtitle below the text (e.g. "Placement OS") */
  subtitle?: string;
  /** High-priority image loading */
  priority?: boolean;
  /** Whether to render as vector glyph instead of raster badge */
  variant?: "badge" | "glyph";
}

const SIZE_MAP = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 56,
  xl: 80,
} as const;

export function NexoraLogo({
  size = "sm",
  className = "",
  imageClassName = "",
  withText = false,
  subtitle,
  priority = false,
  variant = "badge",
}: NexoraLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 28;

  const emblem =
    variant === "glyph" ? (
      <div
        className={`relative shrink-0 flex items-center justify-center text-white ${className}`}
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg
          viewBox="0 0 500 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Left Shape */}
          <path d="M100 100 L240 240 V400 H100 Z" fill="currentColor" />
          {/* Center Connector */}
          <polygon points="240,210 270,240 270,290 240,260" fill="currentColor" />
          {/* Right Shape */}
          <path d="M270 100 H400 V260 L270 390 Z" fill="currentColor" />
          {/* Satellite Orb */}
          <circle cx="400" cy="100" r="30" fill="currentColor" />
        </svg>
      </div>
    ) : (
      <div
        className={`relative shrink-0 rounded-[22%] overflow-hidden border border-white/15 bg-black flex items-center justify-center shadow-sm transition-all ${className}`}
        style={{ width: pixelSize, height: pixelSize }}
      >
        <Image
          src="/logo.png"
          alt="Naira"
          width={pixelSize * 2}
          height={pixelSize * 2}
          priority={priority}
          className={`w-full h-full object-cover select-none ${imageClassName}`}
        />
      </div>
    );

  if (!withText) {
    return emblem;
  }

  return (
    <div className="flex items-center gap-2.5">
      {emblem}
      <div className="flex flex-col">
        <span className="font-heading font-semibold text-[15px] text-white leading-none tracking-tight">
          Naira
        </span>
        {subtitle && (
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default NexoraLogo;
