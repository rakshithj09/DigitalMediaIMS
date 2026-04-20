"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lip/supabase/browser-client";
import { User } from "@supabase/supabase-js";

type Props = { user?: User | null };

export default function EmailPasswordDemo({ user }: Props) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        if (signInError) {
          setError(signInError.message ?? "Sign-in failed");
        } else {
          setMessage("Signed in successfully.");
          // you may want to refresh user/session or redirect
        }
      } else {
        // sign up: Supabase will send a verification email if enabled in the project
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          setError(signUpError.message ?? "Sign-up failed");
        } else {
          setMessage(
            "Verification email sent. Check your Bentonville email and follow the link to verify your account."
          );
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

  // If a user prop is provided (server-side detected), show a welcome state and sign-out option
  if (user) {
    const handleSignOut = async () => {
      await supabase.auth.signOut();
      // when signed out you may want to reload or redirect
      window.location.reload();
    };

    return (
      <div className="max-w-md mx-auto p-4">
        <h2 className="text-lg font-semibold">Welcome</h2>
        <p className="mt-2">Signed in as <strong>{user.email}</strong></p>
        <div className="mt-4">
          <button onClick={handleSignOut} className="px-3 py-1 rounded bg-red-600 text-white">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-semibold mb-2">Email / Password</h1>

      <div className="mb-4">
        <button
          onClick={() => setMode("signIn")}
          className={`px-3 py-1 mr-2 rounded ${mode === "signIn" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode("signUp")}
          className={`px-3 py-1 rounded ${mode === "signUp" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <div className="text-sm font-medium">Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border rounded px-2 py-1"
            placeholder="you@bentonvillek12.org"
            required
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border rounded px-2 py-1"
            required
          />
        </label>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            {loading ? "…" : mode === "signIn" ? "Sign in" : "Create account"}
          </button>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}
        {message && <div className="text-green-700 text-sm">{message}</div>}
      </form>

      <div className="mt-4 text-xs text-gray-500">
        Accounts must use a Bentonville email (@bentonvillek12.org). After signup you will receive
        a verification email; complete verification to finish account creation.
      </div>
    </div>
  );
}
