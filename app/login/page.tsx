"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const router   = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); setLoading(false); }
      else router.replace("/");
    } catch {
      setError("Unable to reach the server. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--brand-bg)" }}>
      <div className="w-full max-w-sm">

        {/* Logo mark */}
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
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--navy)" }}>Sign in</h2>

          {error && (
            <div role="alert" className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-slate-700">
                Email
              </label>
              <input id="email" type="email" autoComplete="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@bentonvillek12.org"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400
                           border border-slate-200 focus:outline-none focus:border-[#002c51] focus:ring-2 focus:ring-[#002c51]/10"/>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-slate-700">
                Password
              </label>
              <input id="password" type="password" autoComplete="current-password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400
                           border border-slate-200 focus:outline-none focus:border-[#002c51] focus:ring-2 focus:ring-[#002c51]/10"/>
            </div>

            {/* Button uses inline style so it's never invisible */}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-1
                         transition-opacity disabled:opacity-50"
              style={{ background: "var(--navy)" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-sm text-center text-slate-500">
            New here?{" "}
            <Link href="/email-password?mode=signUp"
              className="font-semibold hover:underline"
              style={{ color: "var(--navy)" }}>
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-5 text-xs text-center text-slate-400">
          Requires a <code className="bg-slate-100 px-1 rounded text-slate-500">@bentonvillek12.org</code> email
        </p>
      </div>
    </div>
  );
}
