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
  /** Tone for monochrome rendering on light surfaces */
  tone?: "dark" | "light" | "auto";
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
  tone = "dark",
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
          aria-hidden="true"
        >
          {/* NAIRA Falcon Brand Mark (R5-A Profile) */}
          <path
            d="M 231.9,117.9 L 249.0,118.4 L 260.3,119.9 L 274.4,123.3 L 289.6,129.2 L 303.7,137.0 L 316.4,146.2 L 330.3,159.7 L 340.1,171.4 L 355.7,194.8 L 367.4,216.3 L 379.6,241.7 L 406.5,304.2 L 436.5,381.1 L 251.2,381.3 L 242.4,352.5 L 234.1,334.5 L 226.8,321.8 L 216.6,307.1 L 205.3,293.9 L 191.9,281.0 L 177.5,270.0 L 215.1,269.5 L 153.3,238.0 L 151.6,235.4 L 137.9,192.9 L 136.7,191.2 L 127.0,191.7 L 114.0,194.3 L 115.5,182.1 L 117.9,174.8 L 122.3,166.5 L 133.3,153.6 L 146.5,143.3 L 165.5,133.1 L 186.5,125.2 L 210.4,119.9 L 231.9,117.9 L 227.5,170.7 L 216.8,174.1 L 209.0,179.9 L 206.3,183.1 L 202.4,189.9 L 200.4,196.8 L 200.4,207.5 L 201.9,212.9 L 205.3,219.7 L 212.4,227.3 L 217.8,230.7 L 227.1,233.6 L 236.3,233.6 L 243.7,231.7 L 252.0,226.8 L 257.6,220.7 L 261.0,214.8 L 263.4,206.5 L 263.4,197.8 L 261.0,189.5 L 256.6,182.1 L 252.0,177.5 L 243.7,172.6 L 236.3,170.7 L 227.5,170.7 L 130.9,200.0 L 132.1,201.7 L 145.3,243.2 L 180.9,261.2 L 136.2,262.0 L 121.1,265.4 L 105.0,273.2 L 95.0,282.2 L 90.1,289.1 L 86.7,295.9 L 82.8,310.5 L 82.5,330.3 L 75.4,319.3 L 70.6,309.6 L 65.7,296.4 L 63.7,288.1 L 62.7,280.8 L 62.7,266.6 L 64.2,257.3 L 67.1,247.6 L 72.0,237.3 L 77.4,229.5 L 88.4,218.0 L 93.3,214.1 L 102.5,208.3 L 111.3,204.3 L 121.1,201.4 L 130.9,200.0 Z"
            fill="currentColor"
            fillRule="evenodd"
          />
        </svg>
      </div>
    ) : (
      <div
        className={`relative shrink-0 rounded-[22%] overflow-hidden border border-white/15 bg-black flex items-center justify-center shadow-sm transition-all ${className}`}
        style={{ width: pixelSize, height: pixelSize }}
      >
        <Image
          src={tone === "light" ? "/logo-mono-black.png" : "/logo.png"}
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
