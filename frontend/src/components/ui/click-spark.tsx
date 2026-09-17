"use client";

import React, { useEffect, useRef, useCallback } from "react";

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

interface ClickSparkProps {
  children?: React.ReactNode;
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  extraScale?: number;
}

function applyEasing(t: number, easing: ClickSparkProps["easing"]): number {
  switch (easing) {
    case "linear":      return t;
    case "ease-in":     return t * t;
    case "ease-in-out": return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case "ease-out":
    default:            return t * (2 - t);
  }
}

export function ClickSpark({
  children,
  sparkColor = "#ffffff",
  sparkSize = 10,
  sparkRadius = 20,
  sparkCount = 8,
  duration = 380,
  easing = "ease-out",
  extraScale = 1.0,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const rafRef    = useRef<number | null>(null);

  // Keep latest prop values accessible to the RAF loop without re-creating it
  const propsRef = useRef({ sparkColor, sparkSize, sparkRadius, duration, easing, extraScale });
  useEffect(() => {
    propsRef.current = { sparkColor, sparkSize, sparkRadius, duration, easing, extraScale };
  }, [sparkColor, sparkSize, sparkRadius, duration, easing, extraScale]);

  // Store the loop fn in a ref so it can call itself recursively without being
  // declared as a dependency of itself (which useCallback disallows).
  const loopRef = useRef<() => void>(() => { /* noop until mounted */ });

  useEffect(() => {
    loopRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { sparkColor: color, sparkSize: size, sparkRadius: radius, duration: dur, easing: ease, extraScale: scale } = propsRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = now - spark.startTime;
        if (elapsed >= dur) return false;

        const t          = applyEasing(elapsed / dur, ease);
        const dist       = t * radius * scale;
        const alpha      = 1 - t;
        const lineLength = size * (1 - t * 0.5);

        const x1 = spark.x + Math.cos(spark.angle) * dist;
        const y1 = spark.y + Math.sin(spark.angle) * dist;
        const x2 = spark.x + Math.cos(spark.angle) * (dist + lineLength);
        const y2 = spark.y + Math.sin(spark.angle) * (dist + lineLength);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.lineCap     = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();

        return true;
      });

      if (sparksRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(() => loopRef.current());
      } else {
        rafRef.current = null;
      }
    };
  }); // runs every render — keeps loopRef always fresh

  // ── Keep canvas sized to its wrapper ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      canvas.width  = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const now  = performance.now();
    const count = propsRef.current ? sparkCount : sparkCount;

    for (let i = 0; i < count; i++) {
      sparksRef.current.push({
        x,
        y,
        angle:     (2 * Math.PI * i) / count,
        startTime: now,
      });
    }

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => loopRef.current());
    }
  }, [sparkCount]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-full" onClick={handleClick}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[9999]"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

export default ClickSpark;
