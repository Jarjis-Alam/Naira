"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(Boolean(token.trim()));
  const [tokenError, setTokenError] = useState(
    token.trim() ? "" : "Missing or invalid recovery token. Please request a new password reset link."
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Verify token on mount if present
  useEffect(() => {
    if (!token.trim()) {
      return;
    }

    let isMounted = true;

    async function checkToken() {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token.trim())}`);
        const data = await res.json().catch(() => null);

        if (!isMounted) return;
        if (!res.ok) {
          setTokenError(
            data?.error || "This password reset link is invalid, expired, or has already been used."
          );
        }
      } catch {
        // Network failure; we still allow the form to submit so transient network glitches don't lock out the user
      } finally {
        if (isMounted) {
          setVerifyingToken(false);
        }
      }
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("No reset token found. Please use the link provided in your recovery email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify and retype.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Unable to reset password. The link may have expired.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Password reset service is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // State: Verifying initial token
  if (verifyingToken) {
    return (
      <div className="w-full bg-[#121316]/95 border border-[#27282d] rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        <p className="text-xs font-mono text-zinc-400">Verifying security token...</p>
      </div>
    );
  }

  // State: Token invalid / expired / missing
  if (tokenError) {
    return (
      <div
        className="w-full bg-[#121316]/95 border border-[#27282d] rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-xl"
        data-purpose="token-error-card"
      >
        <div className="mb-6 text-left">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[20px] text-red-400">link_off</span>
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Invalid Recovery Link
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            {tokenError}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/auth/login"
            className="w-full py-3.5 px-6 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Return to Sign In</span>
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
          </Link>
        </div>
      </div>
    );
  }

  // State: Reset Successful
  if (success) {
    return (
      <div
        className="w-full bg-[#121316]/95 border border-[#27282d] rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-xl text-left"
        data-purpose="reset-success-card"
      >
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[20px] text-emerald-400">check_circle</span>
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Password Updated
        </h2>
        <p className="text-sm text-zinc-400 mt-2 mb-6 leading-relaxed">
          Your credentials have been securely updated. You can now access your account using your new password.
        </p>

        <Link
          href="/auth/login"
          className="w-full py-3.5 px-6 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 group cursor-pointer"
        >
          <span>Sign In With New Password</span>
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
        </Link>
      </div>
    );
  }

  // State: Standard Reset Password Form
  return (
    <div
      className="w-full bg-[#121316]/95 border border-[#27282d] rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-xl"
      data-purpose="auth-card"
    >
      {/* Card Header */}
      <div className="mb-7 text-left">
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Choose New Password
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Set a secure password for your NAIRA account
        </p>
      </div>

      {/* Error alert banner */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reset Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Field: New Password */}
        <div data-purpose="form-field">
          <label
            className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
            htmlFor="new-password"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-4 pr-11 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 tracking-wider focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        {/* Field: Confirm Password */}
        <div data-purpose="form-field">
          <label
            className="block text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 text-left"
            htmlFor="confirm-password"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-4 pr-11 py-3 rounded-full bg-[#08090a]/70 border border-[#27282d] text-white text-sm placeholder-zinc-500 tracking-wider focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              aria-pressed={showConfirmPassword}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showConfirmPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        {/* Password Requirements Pill */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-mono text-zinc-500">
            MINIMUM 6 CHARACTERS
          </span>
          <span className="text-[10px] font-mono text-zinc-400 bg-[#1a1b1f] px-2 py-0.5 rounded-full border border-[#27282d]">
            SHA-256 HASHED TOKEN
          </span>
        </div>

        {/* Action Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            data-purpose="submit-button"
            className="w-full py-3.5 px-6 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.15)_inset] flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{loading ? "Updating Password..." : "Update Password"}</span>
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

      {/* Footer link back to login */}
      <div className="mt-8 text-center pt-2">
        <p className="text-xs text-zinc-400">
          Remember your password?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-white hover:underline underline-offset-4 ml-1"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="bg-[#08090a] text-zinc-100 font-sans min-h-screen flex flex-col justify-between selection:bg-white selection:text-black antialiased relative overflow-x-hidden">
      {/* Background grid layer */}
      <div className="fixed inset-0 pointer-events-none bg-grid-tech z-0 opacity-80" />
      <div className="fixed inset-0 pointer-events-none bg-radial-vignette z-0" />

      {/* Header */}
      <header className="relative z-10 w-full pt-8 px-6 flex flex-col items-center justify-center">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-800 bg-[#121316]/80 backdrop-blur-md shadow-sm"
          data-purpose="system-badge"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase">
            Account Recovery
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-md mx-auto px-5 py-8 flex flex-col items-center my-auto">
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
            Naira
          </h1>
          <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-400">
            Placement Operating System
          </p>
        </div>

        <Suspense
          fallback={
            <div className="w-full h-80 rounded-3xl bg-[#121316]/50 border border-[#27282d] flex items-center justify-center text-xs font-mono text-zinc-500">
              Loading...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 px-4 text-center">
        <div className="inline-flex items-center gap-4 text-[11px] font-mono text-zinc-500">
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors underline-offset-4 hover:underline">
            PRIVACY PROTOCOL
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-zinc-300 transition-colors underline-offset-4 hover:underline">
            TERMS OF SERVICE
          </Link>
          <span>•</span>
          <span className="text-zinc-600">
            GATEWAY 2.4
          </span>
        </div>
      </footer>
    </div>
  );
}
