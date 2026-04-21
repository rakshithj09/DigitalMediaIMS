"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else {
        router.replace("/");
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--brand-bg)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "var(--ignite-navy)" }}
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--ignite-mint)" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--ignite-navy)" }}>
            Ignite Digital Media
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Equipment Tracker
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--ignite-navy)" }}>
            Sign in
          </h2>

          {error && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
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
              className="btn-primary w-full justify-center py-2.5"
              style={{ marginTop: "0.25rem", fontSize: "0.9375rem" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: "var(--muted)" }}>
            New here?{" "}
            <Link
              href="/email-password?mode=signUp"
              className="font-semibold hover:underline"
              style={{ color: "var(--ignite-navy)" }}
            >
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs" style={{ color: "#94a3b8" }}>
          Requires a <code className="bg-slate-100 px-1 rounded">@bentonvillek12.org</code> email
        </p>
      </div>
    </div>
  );
}
