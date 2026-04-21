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
            period: role === "Student" ? periodSel : undefined,
            studentId: role === "Student" ? studentId.trim() : undefined,
            teacherCode: role === "Teacher" ? teacherCode.trim() : undefined,
          }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          setError(String(data?.error?.message ?? data?.error ?? "Account creation failed."));
          return;
        }
        setMessage("Account created! You can now sign in.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--brand-bg)" }}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-sm text-center">
          <p className="text-sm mb-1 text-slate-500">Signed in as</p>
          <p className="font-semibold mb-6" style={{ color: "var(--navy)" }}>{user.email}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ background: "var(--navy)" }}>
              Sign out
            </button>
            <Link href="/"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ background: "#0f766e" }}>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSignUp = mode === "signUp";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--brand-bg)" }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <Image src="/ignite-logo.png" alt="Ignite logo" width={36} height={36} className="object-contain" priority />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>Digital Media</h1>
            <p className="text-sm text-slate-500 mt-0.5">Equipment Tracker</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--navy)" }}>
            {isSignUp ? "Create an account" : "Sign in"}
          </h2>

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

            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium mb-1.5 text-slate-700">
                    First name
                  </label>
                  <input id="firstName" type="text" required
                    value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className={INPUT} placeholder="First"/>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium mb-1.5 text-slate-700">
                    Last name
                  </label>
                  <input id="lastName" type="text" required
                    value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className={INPUT} placeholder="Last"/>
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="role" className="block text-sm font-medium mb-1.5 text-slate-700">Role</label>
                  <select id="role" value={role}
                    onChange={(e) => setRole(e.target.value as "Teacher" | "Student")}
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
                        onChange={(e) => setPeriodSel(e.target.value as "AM" | "PM")}
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
                        value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)}
                        placeholder="Staff code" className={INPUT}/>
                    </>
                  )}
                </div>
              </div>
            )}

            {isSignUp && role === "Student" && (
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium mb-1.5 text-slate-700">
                  Student ID
                </label>
                <input id="studentId" type="text" required maxLength={20}
                  value={studentId} onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 4000" className={INPUT}/>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-slate-700">
                Email
              </label>
              <input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="email@bentonvillek12.org" className={INPUT}/>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-slate-700">
                Password
              </label>
              <input id="password" type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className={INPUT}/>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-1
                         transition-opacity disabled:opacity-50"
              style={{ background: "var(--navy)" }}>
              {loading
                ? (isSignUp ? "Creating account…" : "Signing in…")
                : (isSignUp ? "Create account" : "Sign in")}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            {!forcedMode && (
              <button type="button"
                onClick={() => { setMode(isSignUp ? "signIn" : "signUp"); setError(null); setMessage(null); }}
                className="font-semibold hover:underline"
                style={{ color: "var(--navy)" }}>
                {isSignUp ? "Back to sign in" : "Create an account"}
              </button>
            )}
            <Link href="/login" className="text-xs hover:underline ml-auto text-slate-400">
              Back to login
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Requires a <code className="bg-slate-100 px-1 rounded text-slate-500">@bentonvillek12.org</code> email
        </p>
      </div>
    </div>
  );
}
