"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { User } from "@supabase/supabase-js";

type Props = { user?: User | null };

const INPUT = "form-input";

export default function EmailPasswordDemo({ user }: Props) {
  const searchParams = useSearchParams();
  const forcedMode   = (searchParams?.get("mode") ?? "").toLowerCase() === "signup";
  const [mode,        setMode]        = useState<"signIn" | "signUp">(forcedMode ? "signUp" : "signIn");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [studentId,   setStudentId]   = useState("");
  const [role,        setRole]        = useState<"Teacher" | "Student">("Student");
  const [periodSel,   setPeriodSel]   = useState<"AM" | "PM">("AM");
  const [teacherCode, setTeacherCode] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [message,     setMessage]     = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();
  const TEACHER_VERIFICATION_CODE = "2015";

  const domainAllowed = (e: string) => e.toLowerCase().endsWith("@bentonvillek12.org");

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !password) { setError("Please provide both email and password."); return; }

    if (mode === "signUp") {
      if (!firstName || !lastName) { setError("Please provide your first and last name."); return; }
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
        const resp = await fetch("/api/auth/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email, password, firstName, lastName, role,
            period:      role === "Student" ? periodSel            : undefined,
            studentId:   role === "Student" ? studentId.trim()     : undefined,
            teacherCode: role === "Teacher" ? teacherCode.trim()   : undefined,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setError(String(data?.error?.message ?? data?.error ?? "Account creation failed."));
          return;
        }
        if (data?.warning) {
          setError(String(data.warning));
          return;
        }
        setMessage("Account created. Check your email and verify your account before signing in.");
        setMode("signIn");
        setPassword("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Already signed in ──────────────────────────────────────── */
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--brand-bg)" }}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-sm text-center">
          <p className="text-sm mb-1 text-slate-500">Signed in as</p>
          <p className="font-semibold mb-6" style={{ color: "var(--navy)" }}>{user.email}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--navy)" }}>
              Sign out
            </button>
            <Link href="/"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#0f766e" }}>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSignUp = mode === "signUp";

  /* ── Left-panel copy varies by mode ──────────────────────────── */
  const panelHeading = isSignUp ? "Join the program" : "Welcome back";
  const panelSub     = isSignUp
    ? "Create your account to start checking out equipment for the Digital Media program."
    : "Sign in to manage equipment checkouts for the Digital Media program.";
  const features = isSignUp
    ? ["Set up your account in minutes", "Choose your role — student or teacher", "Start checking out gear right away"]
    : ["Real-time checkout tracking", "Student & teacher accounts", "Full history & overdue alerts"];

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ─────────────────────────────────────── */}
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
              {panelHeading}
            </h1>
            <p className="mt-4 text-sm leading-relaxed max-w-xs"
              style={{ color: "rgba(255,255,255,0.52)" }}>
              {panelSub}
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            {features.map((item) => (
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
          Bentonville West High School &middot; Bentonville High School
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto"
        style={{ background: "#f8fafc" }}
      >
        <div className="w-full max-w-[420px]">

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
            <h2 className="text-2xl font-bold" style={{ color: "var(--navy)" }}>
              {isSignUp ? "Create an account" : "Sign in"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isSignUp
                ? "Fill in your details to get started"
                : "Sign in to your account to continue"}
            </p>
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Name row */}
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium mb-1.5 text-slate-700">
                    First name
                  </label>
                  <input id="firstName" type="text" required
                    value={firstName} onChange={e => setFirstName(e.target.value)}
                    className={INPUT} placeholder="First" />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium mb-1.5 text-slate-700">
                    Last name
                  </label>
                  <input id="lastName" type="text" required
                    value={lastName} onChange={e => setLastName(e.target.value)}
                    className={INPUT} placeholder="Last" />
                </div>
              </div>
            )}

            {/* Role / Period or Teacher code */}
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="role" className="block text-sm font-medium mb-1.5 text-slate-700">
                    Role
                  </label>
                  <select id="role" value={role}
                    onChange={e => setRole(e.target.value as "Teacher" | "Student")}
                    className={INPUT}>
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                  </select>
                </div>
                <div>
                  {role === "Student" ? (
                    <>
                      <label htmlFor="period" className="block text-sm font-medium mb-1.5 text-slate-700">
                        Class period
                      </label>
                      <select id="period" value={periodSel}
                        onChange={e => setPeriodSel(e.target.value as "AM" | "PM")}
                        className={INPUT}>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <label htmlFor="teacherCode" className="block text-sm font-medium mb-1.5 text-slate-700">
                        Verification code
                      </label>
                      <input id="teacherCode" type="text"
                        value={teacherCode} onChange={e => setTeacherCode(e.target.value)}
                        placeholder="Staff code" className={INPUT} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Student ID */}
            {isSignUp && role === "Student" && (
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium mb-1.5 text-slate-700">
                  Student ID
                </label>
                <input id="studentId" type="text" required maxLength={20}
                  value={studentId} onChange={e => setStudentId(e.target.value)}
                  placeholder="e.g. 4000" className={INPUT} />
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-slate-700">
                Email
              </label>
              <input id="email" type="email" autoComplete="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@bentonvillek12.org" className={INPUT} />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-slate-700">
                Password
              </label>
              <input id="password" type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className={INPUT} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-1 transition-opacity disabled:opacity-50"
              style={{ background: "var(--navy)" }}>
              {loading
                ? (isSignUp ? "Creating account…" : "Signing in…")
                : (isSignUp ? "Create account"    : "Sign in")}
            </button>
          </form>

          {/* Mode switcher */}
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
                  Sign in
                </Link>
              </>
            ) : (
              !forcedMode && (
                <>
                  Don&apos;t have an account?{" "}
                  <button type="button"
                    onClick={() => { setMode("signUp"); setError(null); setMessage(null); }}
                    className="font-semibold hover:underline"
                    style={{ color: "var(--navy)" }}>
                    Create one
                  </button>
                </>
              )
            )}
          </div>

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
