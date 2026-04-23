import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { markStudentApprovalEmailVerified } from "@/lib/auth/student-approvals";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://digital-media-ims.vercel.app";

function redirectUrl(pathname: string, params?: Record<string, string>) {
  const url = new URL(pathname, SITE_URL);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      redirectUrl("/login", {
        verified: "error",
        reason: "missing_token",
      })
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      redirectUrl("/login", {
        verified: "error",
        reason: "invalid_or_expired",
      })
    );
  }

  if (type === "signup" || type === "email") {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        redirectUrl("/login", {
          verified: "error",
          reason: "missing_user",
        })
      );
    }

    try {
      await markStudentApprovalEmailVerified(user);
    } catch (approvalError) {
      console.error("Failed to update student approval after email verification", approvalError);
      await supabase.auth.signOut();
      return NextResponse.redirect(
        redirectUrl("/login", {
          verified: "error",
          reason: "approval_setup_failed",
        })
      );
    }

    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const destination = user.user_metadata?.role === "Student" ? "/pending-approval" : safeNext;
    return NextResponse.redirect(
      redirectUrl(destination, {
        verified: "success",
        reason: user.user_metadata?.role === "Student" ? "student_email_verified" : "email_verified",
      })
    );
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(redirectUrl(safeNext, { verified: "success", reason: "success" }));
}
