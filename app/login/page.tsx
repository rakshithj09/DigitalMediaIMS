"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function LoginPage() {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [message,      setMessage]      = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [showReset,    setShowReset]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const router   = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const reason   = params.get("reason");

    if (verified === "success") {
      setTimeout(() => setMessage("Email verified. You can continue to your dashboard."), 0);
      window.history.replaceState(null, "", "/login");
    }
    if (verified === "error") {
      setTimeout(() =>
        setError(
          reason === "missing_token"
            ? "Verification link was missing required information. Please request a new verification email."
            : "Verification link is invalid or expired. Please request a new verification email."
        ), 0);
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message.toLowerCase().includes("email not confirmed")
          ? "Please verify your email before signing in."
          : authError.message);
        setLoading(false);
      } else {
        router.replace("/");
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const emailToReset = resetEmail.trim().toLowerCase();
    if (!emailToReset.endsWith("@bentonvillek12.org")) {
      setError("Enter your @bentonvillek12.org email.");
      return;
    }
    setResetLoading(true);
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailToReset, { redirectTo });
    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("Password reset email sent. Check your inbox.");
      setShowReset(false);
      setResetEmail("");
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ───────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #002c51 0%, #071828 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-28 -right-28 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "rgba(7,236,203,0.10)" }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "rgba(7,236,203,0.05)" }} />
        <div className="absolute top-1/2 right-8 w-1 h-32 rounded-full pointer-events-none"
          style={{ background: "rgba(7,236,203,0.2)" }} />

        {/* Wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <Image src="/ignite-logo.png" alt="Ignite" width={26} height={26} className="object-contain" priority />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">Ignite Professional Studies</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: "var(--mint)" }}>
              Digital Media Program
            </p>
            <h1 className="text-[2.75rem] font-bold text-white leading-tight">
              Equipment<br />Tracker
            </h1>
            <p className="mt-4 text-sm leading-relaxed max-w-xs"
              style={{ color: "rgba(255,255,255,0.52)" }}>
              Check out cameras, lights, and gear in seconds. Know where every piece of
              equipment is at all times.
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            {[
              "Real-time checkout tracking",
              "Student & teacher accounts",
              "Full history & overdue alerts",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(7,236,203,0.18)" }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#07eccb" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.68)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
          Bentonville School District
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto"
        style={{ background: "#f8fafc" }}
      >
        <div className="w-full max-w-[400px]">

          {/* Mobile-only logo */}
          <div className="flex flex-col items-center mb-8 gap-2 lg:hidden">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              <Image src="/ignite-logo.png" alt="Ignite logo" width={34} height={34} className="object-contain" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold" style={{ color: "var(--navy)" }}>Digital Media</p>
              <p className="text-xs text-slate-500">Equipment Tracker</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            {showReset ? (
              <>
                <h2 className="text-2xl font-bold" style={{ color: "var(--navy)" }}>Reset password</h2>
                <p className="text-sm text-slate-500 mt-1">We&apos;ll send a reset link to your email</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold" style={{ color: "var(--navy)" }}>Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
              </>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div role="alert" className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
              {error}
            </div>
          )}
          {message && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
              {message}
            </div>
          )}

          {/* Password-reset form */}
          {showReset ? (
            <form onSubmit={handlePasswordReset} className="flex flex-col gap-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium mb-1.5 text-slate-700">
                  Account email
                </label>
                <input id="reset-email" type="email" autoComplete="email" required
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="email@bentonvillek12.org"
                  className="form-input" />
              </div>
              <button type="submit" disabled={resetLoading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: "var(--navy)" }}>
                {resetLoading ? "Sending…" : "Send Reset Email"}
              </button>
              <button type="button"
                onClick={() => { setShowReset(false); setError(null); setMessage(null); }}
                className="text-sm font-semibold text-center hover:underline"
                style={{ color: "var(--navy)" }}>
                Back to sign in
              </button>
            </form>
          ) : (
            /* Sign-in form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-slate-700">
                  Email
                </label>
                <input id="email" type="email" autoComplete="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@bentonvillek12.org"
                  className="form-input" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button type="button"
                    onClick={() => { setShowReset(true); setResetEmail(email); setError(null); setMessage(null); }}
                    className="text-xs font-semibold hover:underline"
                    style={{ color: "var(--navy)" }}>
                    Forgot password?
                  </button>
                </div>
                <input id="password" type="password" autoComplete="current-password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-1 transition-opacity disabled:opacity-50"
                style={{ background: "var(--navy)" }}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}

          <p className="mt-6 text-sm text-center text-slate-500">
            New here?{" "}
            <Link href="/email-password?mode=signUp"
              className="font-semibold hover:underline"
              style={{ color: "var(--navy)" }}>
              Create an account
            </Link>
          </p>

          <p className="mt-4 text-xs text-center text-slate-400">
            Requires a{" "}
            <code className="bg-slate-100 px-1 rounded text-slate-500">@bentonvillek12.org</code>{" "}
            email
          </p>
        </div>
      </div>
    </div>
  );
}
