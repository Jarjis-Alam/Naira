"use client";

import React, { useState, useEffect } from "react";

/**
 * BackToTop Floating Button
 *
 * Lightweight, unobtrusive scroll-to-top button visible only after scrolling past
 * 400px. Provides smooth scrolling back to the page top without cluttering the screen.
 */
export function BackToTop({ threshold = 400 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Check initial position in case of page reload with scroll
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top of page"
      className="no-print fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full border border-zinc-800 bg-[#0d0d10]/90 backdrop-blur-md text-zinc-400 hover:text-white hover:border-zinc-600 shadow-xl transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2 focus:outline-none focus:ring-2 focus:ring-white"
    >
      <span className="material-symbols-outlined text-[20px]">
        arrow_upward
      </span>
      <span className="sr-only">Back to top</span>
    </button>
  );
}
