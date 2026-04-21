"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthChangeEvent } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    (async () => {
      const result = await supabase.auth.getSession();
      if (result.data.session) setReady(true);
      else setError("Open this page from the password reset email link.");
    })();

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Password updated. Redirecting to sign in…");
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/login"), 900);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--brand-bg)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <Image src="/ignite-logo.png" alt="Ignite logo" width={36} height={36} className="object-contain" priority />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>Reset Password</h1>
            <p className="text-sm text-slate-500 mt-0.5">Digital Media Equipment Tracker</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--navy)" }}>Choose a new password</h2>

          {error && (
            <div role="alert" className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
              {error}
            </div>
          )}

          {message && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium mb-1.5 text-slate-700">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                disabled={!ready || loading}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5 text-slate-700">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                disabled={!ready || loading}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="form-input"
              />
            </div>
            <button
              type="submit"
              disabled={!ready || loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-1 transition-opacity disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>

          <p className="mt-5 text-sm text-center text-slate-500">
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
