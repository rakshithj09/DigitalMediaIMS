"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import LoginSignupFrame, { authInputClassName } from "@/components/ui/login-signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [message,  setMessage]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router   = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const reason = params.get("reason");

    if (verified === "success") {
      setTimeout(() => setMessage("Email verified. You can continue to your dashboard."), 0);
      window.history.replaceState(null, "", "/login");
    }

    if (verified === "error") {
      setTimeout(
        () =>
          setError(
            reason === "missing_token"
              ? "Verification link was missing required information. Please request a new verification email."
              : reason === "missing_user"
                ? "Verification succeeded, but we could not load your account. Please try signing in."
                : reason === "roster_setup_failed"
                  ? "Email verified, but your student roster setup could not be completed. Please contact your teacher."
              : "Verification link is invalid or expired. Please request a new verification email."
          ),
        0
      );
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
        const message = authError.message.toLowerCase().includes("email not confirmed")
          ? "Please verify your email before signing in."
          : authError.message;
        setError(message);
        setLoading(false);
      }
      else router.replace("/");
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
    <LoginSignupFrame>
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold leading-none" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
          {showReset ? "Reset password" : "Welcome back"}
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {showReset ? "Send a reset link to your school email" : "Sign in to Digital Media's Equipment Tracker"}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-400/30 bg-red-950/50 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {message && (
        <div className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      {showReset ? (
        <form onSubmit={handlePasswordReset} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reset-email" className="text-slate-700">
              Account email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="email@bentonvillek12.org"
                className={`${authInputClassName} pl-10`}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={resetLoading}
            className="mt-1 h-10 w-full rounded-lg text-white hover:opacity-90"
            style={{ background: "var(--navy)" }}
          >
            {resetLoading ? "Sending..." : "Send Reset Email"}
          </Button>
          <button
            type="button"
            onClick={() => { setShowReset(false); setError(null); setMessage(null); }}
            className="text-sm font-semibold hover:underline"
            style={{ color: "var(--navy)" }}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                autoComplete="current-password"
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

          <button
            type="button"
            onClick={() => { setShowReset(true); setResetEmail(email); setError(null); setMessage(null); }}
            className="self-start text-xs font-semibold hover:underline"
            style={{ color: "var(--navy)" }}
          >
            Forgot password?
          </button>

          <Button
            type="submit"
            disabled={loading}
            className="mt-1 h-10 w-full rounded-lg text-white hover:opacity-90"
            style={{ background: "var(--navy)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/email-password?mode=signUp" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Create an account
        </Link>
      </p>

      <p className="mt-5 text-center text-xs text-slate-400">
        Requires a <code className="rounded bg-slate-100 px-1 text-slate-500">@bentonvillek12.org</code> email
      </p>
    </LoginSignupFrame>
  );
}
