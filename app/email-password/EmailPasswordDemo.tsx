"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { User } from "@supabase/supabase-js";

type Props = { user?: User | null };

export default function EmailPasswordDemo({ user }: Props) {
  const searchParams = useSearchParams();
  const forcedMode = (searchParams?.get("mode") ?? "").toLowerCase() === "signup";
  const [mode, setMode] = useState<"signIn" | "signUp">(forcedMode ? "signUp" : "signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState<"Teacher" | "Student">("Student");
  const [periodSel, setPeriodSel] = useState<"AM" | "PM">("AM");
  const [teacherCode, setTeacherCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const domainAllowed = (e: string) => e.toLowerCase().endsWith("@bentonvillek12.org");
  const TEACHER_VERIFICATION_CODE = "2015";

  const handleSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !password) { setError("Please provide both email and password."); return; }

    if (mode === "signUp") {
      if (!firstName || !lastName) { setError("Please provide your first and last name."); return; }
      if (!role) { setError("Please select whether you are a Teacher or Student."); return; }
      if (role === "Student" && !studentId.trim()) { setError("Please provide your student ID."); return; }
      if (role === "Teacher") {
        if (!teacherCode.trim()) { setError("Please provide your teacher verification code."); return; }
        if (teacherCode.trim() !== TEACHER_VERIFICATION_CODE) { setError("Invalid teacher verification code."); return; }
      }
    }

    if (!domainAllowed(email)) { setError("Email must be a @bentonvillek12.org address."); return; }

    setLoading(true);
    try {
      if (mode === "signIn") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) setError(signInError.message ?? "Sign-in failed");
        else setMessage("Signed in successfully.");
      } else {
        const accountResp = await fetch("/api/auth/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            firstName,
            lastName,
            role,
            period: role === "Student" ? periodSel : undefined,
            studentId: role === "Student" ? studentId.trim() : undefined,
            teacherCode: role === "Teacher" ? teacherCode.trim() : undefined,
          }),
        });

        if (!accountResp.ok) {
          const data = await accountResp.json().catch(() => ({}));
          const msg = (data && (data.error?.message ?? data.error)) ?? "Account creation failed.";
          setError(String(msg));
          return;
        }

        setMessage("Account created! You can sign in now.");
      }
    } catch (err: unknown) {
      let msg = "An error occurred";
      if (err && typeof err === "object") {
        const maybeMsg = (err as { message?: unknown }).message;
        msg = typeof maybeMsg === "string" ? maybeMsg : String(err);
      } else {
        msg = String(err);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    const handleSignOut = async () => {
      await supabase.auth.signOut();
      window.location.reload();
    };

    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--brand-bg)" }}>
        <div className="card max-w-sm w-full text-center py-10 px-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--ignite-mint)" }}
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--ignite-navy)" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-1" style={{ color: "var(--ignite-navy)" }}>
            You&apos;re signed in
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Signed in as <strong className="font-medium text-gray-700">{user.email}</strong>
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={handleSignOut} className="btn-primary">Sign out</button>
            <Link href="/" className="btn-primary" style={{ background: "var(--ignite-teal)" }}>
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSignUp = mode === "signUp";

  return (
    <div className="min-h-screen flex" style={{ background: "var(--brand-bg)" }}>
      {/* Left brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10"
        style={{ background: "linear-gradient(160deg, var(--ignite-navy) 0%, var(--ignite-deep) 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--ignite-mint)" }}
          >
            <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--ignite-navy)" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Ignite Digital Media</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Equipment Tracker</p>
          </div>
        </div>

        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: "var(--ignite-mint-dim)", color: "var(--ignite-mint)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--ignite-mint)" }} />
            Bentonville West High School
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            {isSignUp ? "Join the\nIgnite team." : "Track every\npiece of gear."}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9375rem", lineHeight: 1.65 }}>
            {isSignUp
              ? "Create your account to start checking equipment in and out for your class period."
              : "Check equipment in and out in seconds. Full audit history, real-time availability, and period-based rostering."}
          </p>
        </div>

        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          Accounts require a <code style={{ color: "rgba(255,255,255,0.55)" }}>@bentonvillek12.org</code> email
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--ignite-navy)" }}
            >
              <svg width="19" height="19" fill="none" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--ignite-mint)" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--ignite-navy)" }}>Ignite Digital Media</p>
              <p className="text-xs text-gray-500">Equipment Tracker</p>
            </div>
          </div>

          <div className="mb-7">
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}
            >
              {isSignUp ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              {isSignUp ? "Fill in the details below to get started." : "Sign in with your school account."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
            >
              <svg className="mt-0.5 shrink-0" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {message && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}
            >
              <svg className="mt-0.5 shrink-0" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
              </svg>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row — only shown in sign-up */}
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                    First name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="form-input"
                    placeholder="First"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="form-input"
                    placeholder="Last"
                  />
                </div>
              </div>
            )}

            {/* Role & period/code — only shown in sign-up */}
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="role" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                    Role
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "Teacher" | "Student")}
                    className="form-input"
                  >
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                  </select>
                </div>
                <div>
                  {role === "Student" ? (
                    <>
                      <label htmlFor="period" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                        Class period
                      </label>
                      <select
                        id="period"
                        value={periodSel}
                        onChange={(e) => setPeriodSel(e.target.value as "AM" | "PM")}
                        className="form-input"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <label htmlFor="teacherCode" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                        Verification code
                      </label>
                      <input
                        id="teacherCode"
                        type="text"
                        value={teacherCode}
                        onChange={(e) => setTeacherCode(e.target.value)}
                        placeholder="Staff code"
                        className="form-input"
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Student ID — only shown when signing up as Student */}
            {isSignUp && role === "Student" && (
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                  Student ID
                </label>
                <input
                  id="studentId"
                  type="text"
                  required
                  maxLength={20}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="form-input"
                  placeholder="e.g. 40001"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@bentonvillek12.org"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-1"
              style={{ fontSize: "0.9375rem" }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  {isSignUp ? "Creating account…" : "Signing in…"}
                </>
              ) : isSignUp ? "Create account" : "Sign in"}
            </button>

            <div className="flex items-center justify-between text-sm pt-1">
              {!forcedMode && (
                <button
                  type="button"
                  onClick={() => { setMode(isSignUp ? "signIn" : "signUp"); setError(null); setMessage(null); }}
                  className="font-semibold hover:underline"
                  style={{ color: "var(--ignite-navy)" }}
                >
                  {isSignUp ? "Have an account? Sign in" : "Create an account"}
                </button>
              )}
              <Link href="/login" className="text-gray-400 hover:text-gray-600 text-xs ml-auto">
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
