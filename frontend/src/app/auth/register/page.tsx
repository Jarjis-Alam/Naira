"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    college: "",
    branch: "",
    graduationYear: new Date().getFullYear() + 1,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: formData.email.toLowerCase().trim(),
          graduationYear: formData.graduationYear ? Number(formData.graduationYear) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Auto sign in
      const signInResult = await signIn("credentials", {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push("/auth/login?registered=true");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#08090a] text-zinc-100 font-sans min-h-screen flex flex-col justify-between selection:bg-white selection:text-black antialiased relative overflow-x-hidden">
      {/* Background grid layer with radial fade */}
      <div className="fixed inset-0 pointer-events-none bg-grid-tech z-0 opacity-80" />
      <div className="fixed inset-0 pointer-events-none bg-radial-vignette z-0" />

      {/* BEGIN: SiteHeader / Top Bar */}
      <header className="relative z-10 w-full pt-8 px-6 flex flex-col items-center justify-center">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-800 bg-[#121316]/80 backdrop-blur-md shadow-sm"
          data-purpose="system-badge"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase">
            SYS.REG // PLACEMENT CANDIDATE ENROLLMENT
          </span>
        </div>
      </header>
      {/* END: SiteHeader / Top Bar */}

      {/* BEGIN: MainContent */}
      <main className="relative z-10 w-full max-w-md mx-auto px-5 py-8 flex flex-col items-center my-auto">
        {/* Nexora Monogram & Brand Section */}
        <div
          className="flex flex-col items-center mb-8 text-center"
          data-purpose="brand-identity"
        >
          <div className="w-12 h-12 p-3 rounded-2xl bg-gradient-to-b from-zinc-800 to-[#121316] border border-[#27282d] shadow-[0_0_25px_-5px_rgba(255,255,255,0.05)] flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 19V5L15 17V5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
              <circle cx="18.5" cy="5.5" fill="currentColor" r="2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Nexora
          </h1>
          <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-400">
            Your Operating System For Placements
          </p>
        </div>

        {/* Auth Card */}
        <div
          className="w-full bg-[#121316]/95 border border-[#27282d] rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-xl"
          data-purpose="auth-card"
        >
          {/* Card Header */}
          <div className="mb-7 text-left">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              Create Account
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Get started with your personalized placement preparation
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
                htmlFor="name"
              >
                Full Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Jarjis Alam"
                className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
              />
            </div>

            <div>
              <label
                className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
                htmlFor="email"
              >
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
              />
            </div>

            <div>
              <label
                className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
                htmlFor="password"
              >
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 tracking-wider focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
                  htmlFor="college"
                >
                  College
                </label>
                <input
                  id="college"
                  name="college"
                  type="text"
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  placeholder="NIT Silchar"
                  className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
                />
              </div>

              <div>
                <label
                  className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
                  htmlFor="branch"
                >
                  Branch
                </label>
                <input
                  id="branch"
                  name="branch"
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="CSE"
                  className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
                htmlFor="graduationYear"
              >
                Graduation Year
              </label>
              <input
                id="graduationYear"
                name="graduationYear"
                type="number"
                value={formData.graduationYear}
                onChange={(e) => setFormData({ ...formData, graduationYear: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.15)_inset] flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{loading ? "Creating Account..." : "Create Account"}</span>
                <svg
                  className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>
          </form>

          <div className="mt-8 text-center pt-2">
            <p className="text-xs text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-white hover:underline underline-offset-4 ml-1"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      {/* END: MainContent */}

      {/* BEGIN: SiteFooter */}
      <footer className="relative z-10 w-full py-6 px-4 text-center">
        <div className="inline-flex items-center gap-4 text-[11px] font-mono text-zinc-500">
          <span className="hover:text-zinc-300 cursor-pointer transition-colors">
            STATUS: OPERATIONAL
          </span>
          <span>•</span>
          <span className="hover:text-zinc-300 cursor-pointer transition-colors">
            TERMINAL GATEWAY 2.4
          </span>
          <span>•</span>
          <span className="hover:text-zinc-300 cursor-pointer transition-colors">
            PRIVACY &amp; PROTOCOLS
          </span>
        </div>
      </footer>
      {/* END: SiteFooter */}
    </div>
  );
}
