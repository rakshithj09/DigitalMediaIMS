"use client";

import { useState, FormEvent } from "react";
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

  const handleSubmit = async (e: FormEvent) => {
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
    } catch (err) {
      console.error("Supabase sign-in request failed", err);
      setError("Unable to reach Supabase. Check that the project URL is correct and the project is active.");
      setLoading(false);
    }
  };

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
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--ignite-mint)" }}
            />
            Bentonville West High School
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Track every<br />piece of gear.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9375rem", lineHeight: 1.65 }}>
            Check equipment in and out in seconds. Full audit history, real-time availability, and period-based rostering.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {[
            { icon: "⚡", text: "Under 2 minutes per class period" },
            { icon: "📋", text: "Complete audit trail" },
            { icon: "🔒", text: "Role-based access for teachers & students" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <span className="text-base">{item.icon}</span>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
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

          <div className="mb-8">
            <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">Sign in with your school account</p>
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
              className="btn-primary w-full justify-center py-2.5 mt-1"
              style={{ fontSize: "0.9375rem" }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Signing in…
                </>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            New here?{" "}
            <Link href="/email-password?mode=signUp" className="font-semibold hover:underline" style={{ color: "var(--ignite-navy)" }}>
              Create an account
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-400">
            Must use a <code className="bg-gray-100 px-1 rounded">@bentonvillek12.org</code> address
          </p>
        </div>
      </div>
    </div>
  );
}
