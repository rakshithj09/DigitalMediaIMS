"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lip/supabase/browser-client";
import { User } from "@supabase/supabase-js";

type Props = { user?: User | null };

export default function EmailPasswordDemo({ user }: Props) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const domainAllowed = (e: string) => e.toLowerCase().endsWith("@bentonvillek12.org");

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
        // Include first/last name as user metadata at signup. Supabase will store this
        // in user_metadata if the SDK/environment supports it.
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });
        if (signUpError) setError(signUpError.message ?? "Sign-up failed");
        else setMessage("Verification email sent. Check your Bentonville email and verify the link.");
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <h2 className="text-xl font-semibold">Welcome</h2>
            <p className="mt-2 text-sm text-gray-600">Signed in as <strong>{user.email}</strong></p>
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={handleSignOut} className="px-4 py-2 rounded bg-red-600 text-white">Sign out</button>
              <Link href="/" className="px-4 py-2 rounded bg-blue-600 text-white">Go to Dashboard</Link>
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
          <h1 className="text-3xl font-bold text-blue-700">Ignite IMS</h1>
          <p className="text-gray-500 mt-1 text-sm">Digital Media Equipment Tracker</p>
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
            {/* First / Last name inputs appear only when creating an account */}
            {mode === "signUp" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Last name"
                  />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@bentonvillek12.org"
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
                <button
                  type="button"
                  onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
                  className="text-blue-600 hover:underline mr-3"
                >
                  {mode === "signIn" ? "Create an account" : "Have an account? Sign in"}
                </button>
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
