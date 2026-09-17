"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { NexoraLogo } from "@/components/ui/nexora-logo";
import { LandingNav } from "@/components/layout/landing-nav";
import { DevButton } from "@/components/layout/dev-modal";
import { GooeyNavItem } from "@/components/ui/gooey-nav";

interface CinematicHeroProps {
  isAuthenticated: boolean;
  navItems: GooeyNavItem[];
}

export function CinematicHero({ isAuthenticated, navItems }: CinematicHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Attempt programmatic play to satisfy strict browser autoplay policies
    const video = videoRef.current;
    if (!video) return;

    // Respect user preference for reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented playback; remains muted & safe
      });
    }
  }, []);

  return (
    <section className="relative w-full min-h-screen flex flex-col justify-between overflow-hidden bg-black text-white selection:bg-white/20 selection:text-white">
      {/* 1. Full-screen Video Hero Background */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-75 sm:opacity-80 motion-reduce:hidden transition-opacity duration-1000"
      >
        {/* Primary source: exact file located in video/ directory */}
        <source
          src="/video/Character_animation_with_cosmic_…_20260917193547_gwr_video_mvp.mp4"
          type="video/mp4"
        />
        {/* Alias fallback source for browsers that normalize Unicode ellipsis */}
        <source src="/video/cosmic-hero.mp4" type="video/mp4" />
      </video>

      {/* 2. Reduced-Motion Fallback Backdrop */}
      <div
        aria-hidden="true"
        className="hidden motion-reduce:block absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-black to-black"
      />

      {/* 3. Dark Cinematic Vignettes & Overlays */}
      {/* Top navigation gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-[1]"
      />
      {/* Radial vignette for cinematic depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.35)_65%,rgba(0,0,0,0.85)_100%)] z-[1]"
      />
      {/* Bottom transition gradient for wordmark and content transition */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-black via-black/80 to-transparent z-[1]"
      />

      {/* 4. Minimal Navigation Layered Over the Video */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="container-fluid h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <NexoraLogo size={32} priority className="group-hover:border-white transition-colors" />
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-semibold text-title-md text-white tracking-tight">
                Nexora
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </Link>

          <LandingNav items={navItems} />

          <div className="flex items-center space-x-3 sm:space-x-4">
            <DevButton variant="nav" />

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="bg-white text-black font-semibold text-body-sm px-5 py-2 rounded-full hover:bg-neutral-200 transition-all flex items-center gap-1.5 shadow-none"
              >
                <span>Dashboard</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-body-sm text-neutral-300 hover:text-white transition-colors px-3 py-1.5 font-medium"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-white text-black font-semibold text-body-sm px-5 py-2 rounded-full hover:bg-neutral-200 transition-all shadow-none"
                >
                  Start Assessment
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 5. NAIRA Wordmark at Bottom-Left & Cinematic Hero Presentation */}
      <div className="relative z-20 flex-1 flex flex-col justify-end container-fluid pb-12 sm:pb-16 lg:pb-20 pt-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-3xl space-y-4">
            {/* Status eyebrow pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-md text-caption font-mono text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>CAMPUS PLACEMENT OPERATING SYSTEM • 7 DOMAINS • DETERMINISTIC READINESS</span>
            </div>

            {/* Massive NAIRA Wordmark */}
            <div className="space-y-1">
              <h1 className="font-heading font-black tracking-[-0.05em] text-6xl sm:text-8xl lg:text-9xl text-white leading-none select-none drop-shadow-2xl">
                NAIRA
              </h1>
              <p className="font-heading text-xl sm:text-2xl lg:text-3xl font-semibold text-neutral-200 tracking-tight">
                The Operating System for Campus Placements
              </p>
            </div>

            {/* Value Proposition */}
            <p className="text-body-sm sm:text-body text-neutral-300/90 max-w-xl leading-relaxed">
              Assess engineering readiness across 7 core subjects, identify conceptual weaknesses, calibrate target benchmarks, generate daily prioritized roadmaps, and train with the AI Interview Coach.
            </p>

            {/* Bottom-left Action CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                href={isAuthenticated ? "/dashboard" : "/auth/register"}
                className="bg-white text-black font-semibold text-body px-7 py-3.5 rounded-full hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10"
              >
                <span>{isAuthenticated ? "Enter Dashboard" : "Start Baseline Assessment"}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <a
                href="#loop"
                className="bg-black/50 backdrop-blur-md border border-white/20 text-white font-medium text-body px-7 py-3.5 rounded-full hover:bg-white/10 hover:border-white/40 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Explore Architecture</span>
                <span className="material-symbols-outlined text-[16px] text-neutral-400">expand_more</span>
              </a>
            </div>
          </div>

          {/* Bottom-right Diagnostic Indicator & Scroll Cue */}
          <div className="hidden lg:flex flex-col items-end gap-3 pb-2 text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-black/50 backdrop-blur-md text-[11px] font-mono text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>DIAGNOSTIC ENGINE: OPTIMAL</span>
            </div>
            <a
              href="#readiness"
              className="group inline-flex items-center gap-2 text-[12px] font-mono text-neutral-400 hover:text-white transition-colors"
            >
              <span>EXPLORE READINESS MODEL</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-y-0.5 transition-transform">
                arrow_downward
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
