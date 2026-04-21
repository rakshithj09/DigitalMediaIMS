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
  const [role, setRole] = useState<"Teacher" | "Student">("Student");
  const [periodSel, setPeriodSel] = useState<"AM" | "PM">("AM");
  const [teacherCode, setTeacherCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const domainAllowed = (e: string) => e.toLowerCase().endsWith("@bentonvillek12.org");
  // Short-term client-side teacher verification code. Server-side validation
  // is recommended for production—this is a convenience per request.
  const TEACHER_VERIFICATION_CODE = "2015";
  // Map known Supabase/signup error messages to friendlier UI messages.
  const SIGNUP_ERROR_MAP: Record<string, string> = {
    // Supabase sometimes returns this raw message when too many verification emails
    // have been requested in a short period. Map it to a clearer instruction.
    "email rate limit exceeded":
      "Too many verification emails were sent. Please wait a few minutes before trying again, or contact an administrator.",
  };

  const getFriendlySignupMessage = (err: unknown) => {
    if (!err) return "Sign-up failed";
    // Supabase error objects usually have a `message` property.
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") {
      const lower = msg.toLowerCase();
      // Exact-match map first, then fallback to substring checks.
      if (SIGNUP_ERROR_MAP[lower]) return SIGNUP_ERROR_MAP[lower];
      if (lower.includes("rate limit"))
        return "Too many requests. Please wait a few minutes before trying again.";
      return msg;
    }
    return String(err);
  };

  

  const handleSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    if (mode === "signUp") {
      if (!firstName || !lastName) {
        setError("Please provide your first and last name.");
        return;
      }
      if (!role) {
        setError("Please select whether you are a Teacher or Student.");
        return;
      }
      if (role === "Teacher") {
        if (!teacherCode.trim()) {
          setError("Please provide your teacher verification code.");
          return;
        }
        if (teacherCode.trim() !== TEACHER_VERIFICATION_CODE) {
          setError("Invalid teacher verification code.");
          return;
        }
      }
    }

    if (!domainAllowed(email)) {
      setError("Email must be a @bentonvillek12.org address.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signIn") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) setError(signInError.message ?? "Sign-in failed");
        else setMessage("Signed in successfully.");
      } else {
        // Include first/last name and role-specific metadata at signup.
        const metadata: Record<string, unknown> = {
          first_name: firstName,
          last_name: lastName,
          role,
        };
        if (role === "Student") metadata.period = periodSel;
        if (role === "Teacher") metadata.teacher_code = teacherCode.trim();

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
          },
        });
  if (signUpError) setError(getFriendlySignupMessage(signUpError));
        else setMessage("Verification email sent. Check your Bentonville email and verify the link.");

        // If the user is a student, attempt to also create a students roster entry so
        // their name appears in the class roster automatically. This uses the anon
        // key and will succeed only if your Supabase table allows inserts from the
        // client (or if you have server-side logic to reconcile post-confirmation).
        try {
          if (role === "Student") {
            const studentName = `${firstName.trim()} ${lastName.trim()}`;
            await createSupabaseBrowserClient()
              .from("students")
              .insert({ name: studentName, period: periodSel });
          }
        } catch (err) {
          // Non-fatal; we'll surface signup success above. Admins can reconcile students later.
          console.error("Failed to insert student roster entry:", err);
        }
      }
    } catch (err: unknown) {
      let msg = "An error occurred";
      if (err && typeof err === "object") {
        const maybeMsg = (err as { message?: unknown }).message;
        if (typeof maybeMsg === "string") msg = maybeMsg;
        else msg = String(err);
      } else {
        msg = String(err);
      }
      setError(msg ?? "An error occurred");
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
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(180deg, var(--brand-bg), #f7fbfb)' }}>
        <div className="w-full max-w-md">
          <div className="card text-center">
            <h2 className="page-title">Welcome</h2>
            <p className="kicker mt-2">Signed in as <strong>{user.email}</strong></p>
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={handleSignOut} className="btn-primary">Sign out</button>
              <Link href="/" className="btn-primary" style={{ background: 'linear-gradient(180deg,var(--ignite-gold), #f0a800)' }}>Go to Dashboard</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Ignite Digital Media</h1>
          <p className="text-gray-500 mt-1 text-sm">Equipment Tracker</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {mode === "signIn" ? "Sign in to your account" : "Create an account"}
          </h2>

          {error && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First / Last name inputs (preserve layout so sign-in and sign-up look identical) */}
            <div className={`grid grid-cols-2 gap-3`} style={{ minHeight: 88 }}>
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  id="firstName"
                  type="text"
                  required={mode === "signUp"}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="First name"
                  style={{ display: mode === "signUp" ? undefined : "none" }}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  id="lastName"
                  type="text"
                  required={mode === "signUp"}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Last name"
                  style={{ display: mode === "signUp" ? undefined : "none" }}
                />
              </div>
            </div>

            {/* Role & Period selection for new accounts (only visible when signing up) */}
            <div className="mt-3 grid grid-cols-2 gap-3" style={{ minHeight: 56, display: mode === "signUp" ? undefined : "none" }}>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "Teacher" | "Student")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="Student">Student</option>
                  <option value="Teacher">Teacher</option>
                </select>
              </div>
              <div>
                {role === "Student" ? (
                  <>
                    <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">Class period</label>
                    <select
                      id="period"
                      value={periodSel}
                      onChange={(e) => setPeriodSel(e.target.value as "AM" | "PM")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </>
                ) : (
                  <>
                    <label htmlFor="teacherCode" className="block text-sm font-medium text-gray-700 mb-1">Teacher verification code</label>
                    <input
                      id="teacherCode"
                      type="text"
                      value={teacherCode}
                      onChange={(e) => setTeacherCode(e.target.value)}
                      placeholder="Enter verification code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Provide your staff verification code to confirm teacher access.</p>
                  </>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input w-full text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--ignite-teal)]"
                placeholder="email@bentonvillek12.org"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? (mode === "signIn" ? "Signing in…" : "Creating…") : mode === "signIn" ? "Sign in" : "Create account"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <div>
                {/* If mode was forced via query param, don't show the toggle back to sign in */}
                {!forcedMode && (
                  <button
                    type="button"
                    onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
                    className="text-blue-600 hover:underline mr-3"
                  >
                    {mode === "signIn" ? "Create an account" : "Have an account? Sign in"}
                  </button>
                )}
              </div>
              <div>
                <Link href="/login" className="text-gray-500 hover:underline">Back to login</Link>
              </div>
            </div>
          </form>

          {message && <div className="mt-4 text-sm text-green-700">{message}</div>}

          <div className="mt-4 text-xs text-gray-500">
            Accounts must use a Bentonville email (<kbd>@bentonvillek12.org</kbd>). After signup you will receive a verification email; verify to finish account creation.
          </div>
        </div>
      </div>
    </div>
  );
}
