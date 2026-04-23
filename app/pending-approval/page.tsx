"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginSignupFrame from "@/components/ui/login-signup";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function PendingApprovalPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkApproval = async () => {
    setChecking(true);
    setError(null);

    try {
      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      if (user.user_metadata?.role !== "Student") {
        router.replace("/");
        return;
      }

      const { data, error: studentError } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (studentError) {
        setError(studentError.message ?? "Unable to check approval status.");
        return;
      }

      if (data?.id) {
        router.replace("/checkout");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => checkApproval());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LoginSignupFrame>
      <div className="text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "#fff7ed", color: "#c2410c" }}
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 3 21 19H3L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 9v4" strokeLinecap="round" />
            <path d="M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold leading-none" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
          Waiting For Teacher Approval
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          Your email is verified, but a teacher still needs to approve your account before you can join the class roster.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-400/30 bg-red-950/50 px-4 py-3 text-sm text-red-200 text-left"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            onClick={checkApproval}
            disabled={loading || checking}
            className="h-10 w-full rounded-lg text-white hover:opacity-90"
            style={{ background: "var(--navy)" }}
          >
            {checking ? "Checking..." : "Check Approval Status"}
          </Button>

          <Button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </LoginSignupFrame>
  );
}
