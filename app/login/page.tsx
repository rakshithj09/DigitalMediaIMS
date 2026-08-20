"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import LoginSignupFrame, { authInputClassName } from "@/components/ui/login-signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuthError } from "@/lib/firebase/auth-errors";
import { createFirebaseDataClient } from "@/lib/firebase/browser-data";

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const router   = useRouter();
  const firebaseClient = createFirebaseDataClient();

  const redirectToSignup = (emailValue: string) => {
    const trimmedEmail = emailValue.trim().toLowerCase();
    const params = new URLSearchParams({ mode: "signUp" });
    if (trimmedEmail) params.set("email", trimmedEmail);
    router.replace(`/email-password?${params.toString()}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const reason = params.get("reason");

    if (verified === "success") {
      setTimeout(
        () =>
          setMessage(
            reason === "student_email_verified"
              ? "Email verified. Student accounts still need teacher approval before they join the class roster."
              : "Email verified. You can continue to your dashboard."
          ),
        0
      );
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
                : reason === "approval_setup_failed"
                  ? "Email verified, but your student approval request could not be updated. Please contact your teacher."
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
      const { error: authError } = await firebaseClient.auth.signInWithPassword({ email, password });
      if (authError) {
        const emailToCheck = email.trim().toLowerCase();
        if (emailToCheck.endsWith("@bentonvillek12.org")) {
          const existsResp = await fetch("/api/auth/account-exists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailToCheck }),
          });
          const existsData = await existsResp.json().catch(() => ({}));
          if (existsResp.ok && existsData.exists === false) {
            redirectToSignup(emailToCheck);
            return;
          }
        }

        setError(formatAuthError(authError, "Unable to sign in. Please try again."));
        setLoading(false);
      }
      else router.replace("/");
    } catch {
      setError("Unable to reach the server. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setGoogleLoading(true);

    const { data, error: googleError } = await firebaseClient.auth.signInWithGoogle();
    if (googleError) {
      setError(formatAuthError(googleError, "Unable to sign in with Google. Please try again."));
      setGoogleLoading(false);
      return;
    }

    const googleUser = data?.user ?? null;
    const googleEmail = googleUser?.email?.trim().toLowerCase() ?? "";
    if (!googleEmail.endsWith("@bentonvillek12.org")) {
      await firebaseClient.auth.signOut();
      setError("Use your @bentonvillek12.org Google account.");
      setGoogleLoading(false);
      return;
    }

    const role = googleUser?.user_metadata?.role;
    if (role === "Teacher" || role === "Student") {
      router.replace("/");
      return;
    }

    await firebaseClient.auth.signOut();
    const params = new URLSearchParams({ mode: "signUp", email: googleEmail });
    router.replace(`/email-password?${params.toString()}`);
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
    const { error: resetError } = await firebaseClient.auth.resetPasswordForEmail(emailToReset, { redirectTo });

    if (resetError) {
      setError(formatAuthError(resetError, "Unable to send password reset email."));
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
        <>
          <Button
            type="button"
            disabled={loading || googleLoading}
            onClick={handleGoogleSignIn}
            className="mb-4 h-11 w-full rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md disabled:opacity-60"
          >
            <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                <path fill="#4285F4" d="M21.8 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h5.5c-.2 1.2-.9 2.3-2 3v2.5h3.3c1.9-1.8 3-4.4 3-7.6z" />
                <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3v2.6C4.7 19.8 8.1 22 12 22z" />
                <path fill="#FBBC05" d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H3C2.4 8.8 2 10.4 2 12s.4 3.2 1 4.5l3.4-2.6z" />
                <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 3 14.7 2 12 2 8.1 2 4.7 4.2 3 7.5l3.4 2.6C7.2 7.8 9.4 6 12 6z" />
              </svg>
            </span>
            {googleLoading ? "Opening Google..." : "Continue with Google"}
          </Button>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

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
              disabled={loading || googleLoading}
              className="mt-1 h-10 w-full rounded-lg text-white hover:opacity-90"
              style={{ background: "var(--navy)" }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href={`/email-password?mode=signUp${email.trim() ? `&email=${encodeURIComponent(email.trim().toLowerCase())}` : ""}`} className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Create an account
        </Link>
      </p>

      <p className="mt-5 text-center text-xs text-slate-400">
        Requires a <code className="rounded bg-slate-100 px-1 text-slate-500">@bentonvillek12.org</code> email
        {" · "}
        <Link href="/privacy" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Privacy
        </Link>
      </p>
    </LoginSignupFrame>
  );
}
