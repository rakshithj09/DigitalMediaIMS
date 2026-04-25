"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, IdCard, Lock, Mail, UserRound } from "lucide-react";
import LoginSignupFrame, {
  authInputClassName,
} from "@/components/ui/login-signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SelectMenu from "@/components/ui/select-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { User } from "@supabase/supabase-js";

type Props = { user?: User | null };

export default function EmailPasswordDemo({ user }: Props) {
  const searchParams = useSearchParams();
  const forcedMode = (searchParams?.get("mode") ?? "").toLowerCase() === "signup";
  const [mode, setMode] = useState<"signIn" | "signUp">(forcedMode ? "signUp" : "signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState<"Teacher" | "Student">("Student");
  const [periodSel, setPeriodSel] = useState<"AM" | "PM">("AM");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const supabase = createSupabaseBrowserClient();

  const domainAllowed = (e: string) => e.toLowerCase().endsWith("@bentonvillek12.org");

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !password) { setError("Please provide both email and password."); return; }

    if (mode === "signUp") {
      if (!firstName || !lastName) { setError("Please provide your first and last name."); return; }
      if (role === "Student" && !studentId.trim()) { setError("Please provide your student ID."); return; }
      if (!confirmPassword) { setError("Please confirm your password."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
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
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setError(String(data?.error?.message ?? data?.error ?? "Account creation failed."));
          return;
        }
        setMessage("Account created. Check your email and verify your account before signing in.");
        setMode("signIn");
        setPassword("");
        setConfirmPassword("");
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
      <LoginSignupFrame>
        <div className="text-center">
          <p className="mb-1 text-sm text-slate-500">Signed in as</p>
          <p className="mb-6 font-semibold" style={{ color: "var(--ignite-navy)" }}>{user.email}</p>
          <div className="flex justify-center gap-3">
            <Button
              onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
              className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </Button>
            <Button
              asChild
              className="rounded-lg text-white hover:opacity-90"
              style={{ background: "var(--navy)" }}
            >
              <Link href="/">Dashboard</Link>
            </Button>
          </div>
        </div>
      </LoginSignupFrame>
    );
  }

  const isSignUp = mode === "signUp";
  const accountExistsError = error?.toLowerCase().includes("already exists");

  return (
    <LoginSignupFrame cardClassName={isSignUp ? "max-w-md" : undefined}>
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold leading-none" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
          {isSignUp ? "Create an account" : "Welcome back"}
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {isSignUp ? "Use your school details to request access" : "Sign in with your school account"}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-400/30 bg-red-950/50 px-4 py-3 text-sm text-red-200"
        >
          <span>{error}</span>
          {accountExistsError && (
            <Link href="/login" className="ml-1 font-semibold underline">
              Sign in
            </Link>
          )}
        </div>
      )}

      {message && (
        <div className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName" className="text-slate-700">
                First name
              </Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`${authInputClassName} pl-10`}
                  placeholder="First"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName" className="text-slate-700">
                Last name
              </Label>
              <Input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={authInputClassName}
                placeholder="Last"
              />
            </div>
          </div>
        )}

        {isSignUp && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="role" className="text-slate-700">
                Role
              </Label>
              <SelectMenu
                id="role"
                value={role}
                onChange={(nextValue) => setRole(nextValue as "Teacher" | "Student")}
                options={[
                  { label: "Student", value: "Student" },
                  { label: "Teacher", value: "Teacher" },
                ]}
                triggerClassName="h-10 rounded-lg"
              />
            </div>
            {role === "Student" && (
              <div className="grid gap-2">
                  <Label htmlFor="period" className="text-slate-700">
                    Class period
                  </Label>
                  <SelectMenu
                    id="period"
                    value={periodSel}
                    onChange={(nextValue) => setPeriodSel(nextValue as "AM" | "PM")}
                    options={[
                      { label: "AM", value: "AM" },
                      { label: "PM", value: "PM" },
                    ]}
                    triggerClassName="h-10 rounded-lg"
                  />
              </div>
            )}
          </div>
        )}

        {isSignUp && role === "Student" && (
          <div className="grid gap-2">
            <Label htmlFor="studentId" className="text-slate-700">
              Student ID
            </Label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="studentId"
                type="text"
                required
                maxLength={20}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 4000"
                className={`${authInputClassName} pl-10`}
              />
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="email" className="text-slate-700">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@bentonvillek12.org"
              className={`${authInputClassName} pl-10`}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password" className="text-slate-700">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={`${authInputClassName} pl-10 pr-10`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-slate-700"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {isSignUp && (
          <div className="grid gap-2">
            <Label htmlFor="confirm-password" className="text-slate-700">
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className={`${authInputClassName} pl-10 pr-10`}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-slate-700"
                onClick={() => setShowConfirmPassword((value) => !value)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-10 w-full rounded-lg text-white hover:opacity-90"
          style={{ background: "var(--navy)" }}
        >
          {loading
            ? (isSignUp ? "Creating account..." : "Signing in...")
            : (isSignUp ? "Create account" : "Sign in")}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        {!forcedMode && (
          <button
            type="button"
            onClick={() => { setMode(isSignUp ? "signIn" : "signUp"); setError(null); setMessage(null); setConfirmPassword(""); }}
            className="font-semibold hover:underline"
            style={{ color: "var(--navy)" }}
          >
            {isSignUp ? "Back to sign in" : "Create an account"}
          </button>
        )}
        <Link href="/login" className="ml-auto text-xs text-slate-400 hover:text-slate-600 hover:underline">
          Back to login
        </Link>
      </div>

      <p className="mt-5 text-center text-xs text-slate-400">
        Requires a <code className="rounded bg-slate-100 px-1 text-slate-500">@bentonvillek12.org</code> email
      </p>
    </LoginSignupFrame>
  );
}
