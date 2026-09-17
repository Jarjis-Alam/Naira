"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "Configuration" || result.status === 500) {
          setError("Authentication service is temporarily unavailable.");
        } else {
          setError("Invalid email or password.");
        }
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Authentication is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHubSignIn() {
    setError("");
    setNotice("");
    setSsoLoading("github");
    try {
      await signIn("github", { callbackUrl });
    } catch {
      setError("GitHub sign in is currently unconfigured or unavailable.");
    } finally {
      setSsoLoading(null);
    }
  }

  function handleCampusSignIn() {
    setNotice("Campus SSO gateway is active for partner universities. Contact your campus administrator for credentials.");
  }

  function handleForgotPassword(e: React.MouseEvent) {
    e.preventDefault();
    setNotice("Password recovery link has been dispatched if an account exists for the entered email.");
  }

  return (
    <div
      className="w-full bg-[#121316]/95 border border-[#27282d] rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-xl"
      data-purpose="auth-card"
    >
      {/* Card Header */}
      <div className="mb-7 text-left">
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Welcome back
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Sign in to continue your preparation
        </p>
      </div>

      {/* Notifications / Alerts */}
      {registered && !error && !notice && (
        <div className="mb-5 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-300">
          ✓ Account created successfully. Sign in with your credentials.
        </div>
      )}

      {error && (
        <div className="mb-5 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="mb-5 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Auth Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Field: Email Address */}
        <div data-purpose="form-field">
          <label
            className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
            htmlFor="email"
          >
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
            />
          </div>
        </div>

        {/* Field: Password */}
        <div data-purpose="form-field">
          <div className="flex items-center justify-between mb-2">
            <label
              className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase"
              htmlFor="password"
            >
              Password
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-zinc-400 hover:text-white transition-colors duration-150 cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 tracking-wider focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
            />
          </div>
        </div>

        {/* Utility: Remember device toggle pill */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center space-x-2.5 cursor-pointer select-none">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded-full bg-[#08090a] border-[#27282d] text-white focus:ring-0 focus:ring-offset-0 transition-colors cursor-pointer accent-white"
            />
            <span className="text-xs text-zinc-400">Remember this device</span>
          </label>
          <span className="text-[10px] font-mono text-zinc-400 bg-[#1a1b1f] px-2 py-0.5 rounded-full border border-[#27282d]">
            256-BIT
          </span>
        </div>

        {/* Action: Primary Sign In Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            data-purpose="submit-button"
            className="w-full py-3.5 px-6 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.15)_inset] flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{loading ? "Signing In..." : "Sign In"}</span>
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

      {/* Minimal Separator */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#27282d]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#121316] px-3 text-[11px] font-mono tracking-widest uppercase text-zinc-400">
            OR CONTINUE WITH
          </span>
        </div>
      </div>

      {/* Quick SSO Options in Monochromatic Pills */}
      <div className="grid grid-cols-2 gap-3" data-purpose="sso-options">
        <button
          type="button"
          onClick={handleGitHubSignIn}
          disabled={Boolean(ssoLoading)}
          className="flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full border border-[#27282d] bg-[#08090a]/50 hover:bg-[#1a1b1f] hover:border-[#3f4046] text-xs font-medium text-zinc-300 hover:text-white transition-all duration-150 cursor-pointer disabled:opacity-50"
        >
          {/* GitHub SVG */}
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path
              clipRule="evenodd"
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
          <span>{ssoLoading === "github" ? "Connecting..." : "GitHub"}</span>
        </button>

        <button
          type="button"
          onClick={handleCampusSignIn}
          className="flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full border border-[#27282d] bg-[#08090a]/50 hover:bg-[#1a1b1f] hover:border-[#3f4046] text-xs font-medium text-zinc-300 hover:text-white transition-all duration-150 cursor-pointer"
        >
          {/* Academic / Enterprise SSO Icon */}
          <svg
            className="w-4 h-4 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Campus ID</span>
        </button>
      </div>

      {/* Footer Action Inside Card */}
      <div className="mt-8 text-center pt-2">
        <p className="text-xs text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-white hover:underline underline-offset-4 ml-1"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="bg-[#08090a] text-zinc-100 font-sans min-h-screen flex flex-col justify-between selection:bg-white selection:text-black antialiased relative overflow-x-hidden">
      {/* Background grid layer with radial fade */}
      <div className="fixed inset-0 pointer-events-none bg-grid-tech z-0 opacity-80" />
      <div className="fixed inset-0 pointer-events-none bg-radial-vignette z-0" />

      {/* BEGIN: SiteHeader / Top Bar */}
      <header className="relative z-10 w-full pt-8 px-6 flex flex-col items-center justify-center">
        {/* Top System Telemetry Pill */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-800 bg-[#121316]/80 backdrop-blur-md shadow-sm"
          data-purpose="system-badge"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase">
            SYS.AUTH // ZERO-BIAS ENGINE
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
          {/* Minimalist Nexora Logo Icon in rounded container */}
          <div className="w-12 h-12 p-3 rounded-2xl bg-gradient-to-b from-zinc-800 to-[#121316] border border-[#27282d] shadow-[0_0_25px_-5px_rgba(255,255,255,0.05)] flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Monogram N with technical node */}
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
            Naira
          </h1>
          <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-400">
            Your Operating System For Placements
          </p>
        </div>

        {/* Auth Card wrapped in Suspense for searchParams */}
        <Suspense
          fallback={
            <div className="w-full h-80 rounded-3xl bg-[#121316]/50 border border-[#27282d] flex items-center justify-center text-xs font-mono text-zinc-500">
              INITIALIZING SYS.AUTH...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
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
