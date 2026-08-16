"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import LoginSignupFrame from "@/components/ui/login-signup";
import { Button } from "@/components/ui/button";
import { firebaseFetch } from "@/lib/firebase/auth-fetch";
import { formatAuthError } from "@/lib/firebase/auth-errors";
import { createFirebaseDataClient } from "@/lib/firebase/browser-data";

export default function PendingApprovalPage() {
  const router = useRouter();
  const firebaseClient = createFirebaseDataClient();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkApproval = async () => {
    setChecking(true);
    setError(null);
    setMessage(null);

    try {
      const { data: userResult } = await firebaseClient.auth.getUser();
      const user = userResult.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      if (user.user_metadata?.role !== "Student") {
        router.replace("/");
        return;
      }

      const syncResp = await firebaseFetch("/api/auth/student-approval-request", {
        method: "POST",
        cache: "no-store",
      });
      const syncData = await syncResp.json().catch(() => ({}));
      if (!syncResp.ok) {
        setError(String(syncData?.error?.message ?? syncData?.error ?? "Unable to sync your approval request."));
        return;
      }

      setEmailVerified(Boolean(syncData.emailVerified));

      const { data, error: studentError } = await firebaseClient
        .from<{ id?: string }>("students")
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

  const sendVerificationEmail = async () => {
    setSendingVerification(true);
    setError(null);
    setMessage(null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? window.location.origin;
    const verificationUrl = `${siteUrl}/auth/callback?next=${encodeURIComponent("/login?verified=success&reason=student_email_verified")}`;
    const { error: verificationError } = await firebaseClient.auth.sendEmailVerification({ redirectTo: verificationUrl });

    if (verificationError) {
      setError(formatAuthError(verificationError, "Unable to send verification email."));
    } else {
      setMessage("Verification email sent. Check your school inbox and spam folder.");
    }

    setSendingVerification(false);
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
          <TriangleAlert size={22} strokeWidth={2} />
        </div>

        <h1 className="page-title text-2xl leading-none">
          Waiting For Teacher Approval
        </h1>
        <p className="page-subtitle mt-3 text-sm">
          {emailVerified === false
            ? "Check your school email and verify your account. Your teacher will be able to approve you after that."
            : "Your request has been sent. A teacher still needs to approve your account before you can join the class roster."}
        </p>

        {error && (
          <div
            role="alert"
            className="status-alert status-alert-danger mt-5 text-left"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            className="status-alert status-alert-success mt-5 text-left"
          >
            {message}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {emailVerified === false && (
            <Button
              type="button"
              onClick={sendVerificationEmail}
              disabled={sendingVerification}
              className="action-button h-10 w-full text-white"
            >
              {sendingVerification ? "Sending..." : "Resend Verification Email"}
            </Button>
          )}
          <Button
            type="button"
            onClick={checkApproval}
            disabled={loading || checking}
            className="action-button h-10 w-full text-white"
          >
            {checking ? "Checking..." : "Check Approval Status"}
          </Button>

          <Button
            type="button"
            onClick={async () => {
              await firebaseClient.auth.signOut();
              router.replace("/login");
            }}
            className="quiet-button h-10 w-full text-slate-700"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </LoginSignupFrame>
  );
}
