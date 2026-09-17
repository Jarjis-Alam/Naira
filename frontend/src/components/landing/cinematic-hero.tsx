"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { NexoraLogo } from "@/components/ui/nexora-logo";

interface CinematicHeroProps {
  isAuthenticated: boolean;
}

export function CinematicHero({ isAuthenticated }: CinematicHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
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
        // Safe fallback if browser autoplay policy blocks unprompted playback
      });
    }
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      setMobileMenuOpen(false);
      const targetId = href.replace("#", "");
      if (!targetId) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", href);
      }
    }
  };

  return (
    <section className="relative w-screen h-screen min-h-screen overflow-hidden bg-black text-white select-none">
      {/* 1. Full-screen Cinematic Video Background (Edge-to-Edge) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-[center_35%] z-0 pointer-events-none motion-reduce:hidden"
      >
        {/* Cosmic hero background video */}
        <source src="/video/cosmic-hero.mp4" type="video/mp4" />
      </video>

      {/* 2. Reduced-Motion Fallback Backdrop */}
      <div
        aria-hidden="true"
        className="hidden motion-reduce:block absolute inset-0 z-0 bg-[#05070d] bg-[radial-gradient(circle_at_center,_#0b101c_0%,_#020408_100%)]"
      />

      {/* 3. Subtle Readability Overlays (No heavy borders or full-screen opaque gradients) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 via-black/15 to-transparent z-[1]"
      />
      {/* Bottom atmospheric gradient — cinematic fade rising from the bottom edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1]"
        style={{
          height: "48vh",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.62) 16%, rgba(0,0,0,0.32) 36%, rgba(0,0,0,0.12) 58%, transparent 100%)",
        }}
      />

      {/* 4. Minimal Floating Navbar Layered Over Video */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 sm:px-10 lg:px-14 py-6 sm:py-8">
        {/* Left: NAIRA Logo & Brandmark */}
        <Link href="/" className="flex items-center space-x-3 group">
          <NexoraLogo size={26} priority className="transition-opacity group-hover:opacity-80" />
          <span className="font-heading font-medium tracking-[0.22em] text-xs sm:text-sm text-white uppercase">
            NAIRA
          </span>
        </Link>

        {/* Center / Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center space-x-8 lg:space-x-10 text-xs sm:text-sm font-sans tracking-wide text-neutral-300">
          <a
            href="#"
            onClick={(e) => handleNavClick(e, "#")}
            className="hover:text-white transition-colors"
          >
            Home
          </a>
          <a
            href="#features"
            onClick={(e) => handleNavClick(e, "#features")}
            className="hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => handleNavClick(e, "#how-it-works")}
            className="hover:text-white transition-colors"
          >
            How it Works
          </a>
          <a
            href="#about"
            onClick={(e) => handleNavClick(e, "#about")}
            className="hover:text-white transition-colors"
          >
            About
          </a>
        </nav>

        {/* Right: Actions & Authentication */}
        <div className="hidden sm:flex items-center space-x-4 sm:space-x-5">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white hover:text-black text-white text-xs sm:text-sm font-medium tracking-wide transition-all"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-xs sm:text-sm text-neutral-300 hover:text-white transition-colors tracking-wide px-2 py-1"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-1.5 rounded-full border border-white/25 bg-white/5 hover:bg-white hover:text-black text-white text-xs sm:text-sm font-medium tracking-wide transition-all"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Navigation Toggle */}
        <div className="flex items-center space-x-3 sm:hidden">
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:text-neutral-300 transition-colors"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden absolute top-20 inset-x-6 z-40 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in">
          <nav className="flex flex-col space-y-4 text-body font-sans text-neutral-300">
            <a
              href="#"
              onClick={(e) => handleNavClick(e, "#")}
              className="hover:text-white transition-colors"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={(e) => handleNavClick(e, "#features")}
              className="hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, "#how-it-works")}
              className="hover:text-white transition-colors"
            >
              How it Works
            </a>
            <a
              href="#about"
              onClick={(e) => handleNavClick(e, "#about")}
              className="hover:text-white transition-colors"
            >
              About
            </a>

            <div className="pt-4 border-t border-white/10 flex flex-col space-y-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-full bg-white text-black font-medium text-sm transition-all"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 text-neutral-300 hover:text-white text-sm"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-full border border-white/20 bg-white/5 hover:bg-white hover:text-black text-white font-medium text-sm transition-all"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* 5. Brand Name "Naira" + Description + Start Assessment CTA — Bottom Left */}
      <div className="absolute left-[4vw] sm:left-[5vw] bottom-[4vh] sm:bottom-[5vh] z-20 select-none flex flex-col items-start">
        {/* Naira title — reduced ~17% from previous sizes */}
        <h1 className="font-mileast italic font-normal text-white text-[54px] sm:text-[80px] md:text-[110px] lg:text-[140px] xl:text-[170px] leading-[0.85] tracking-[-0.02em] drop-shadow-[0_8px_36px_rgba(0,0,0,0.6)] pointer-events-none">
          Naira
        </h1>

        {/* One-line description */}
        <p className="mt-2 sm:mt-3 font-sans font-normal text-white text-sm sm:text-base md:text-lg leading-snug pointer-events-none" style={{ color: '#ffffff' }}>
          Your intelligent companion for placement preparation.
        </p>

        {/* Start Assessment CTA — pill-shaped, beneath description */}
        <Link
          href="/assessment"
          className="
            mt-4 sm:mt-5
            inline-flex items-center
            px-5 sm:px-6 py-2 sm:py-2.5
            rounded-full
            bg-white/90 hover:bg-white
            text-black
            text-sm sm:text-base font-medium tracking-wide
            shadow-[0_2px_16px_rgba(0,0,0,0.35)]
            transition-all duration-200
            hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)]
            hover:scale-[1.03]
            active:scale-[0.98]
            pointer-events-auto
          "
        >
          Start Assessment
        </Link>
      </div>

      {/* 6. Subtle Optional Explore Cue at Bottom Right */}
      <div className="hidden sm:flex absolute right-[4vw] sm:right-[5vw] bottom-[4vh] sm:bottom-[5vh] z-20 items-center">
        <a
          href="#features"
          onClick={(e) => handleNavClick(e, "#features")}
          className="inline-flex items-center gap-2 text-[11px] font-mono tracking-widest text-neutral-400 hover:text-white transition-colors pointer-events-auto uppercase"
        >
          <span>Explore</span>
          <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
        </a>
      </div>
    </section>
  );
}
