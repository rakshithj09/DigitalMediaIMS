import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

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

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(redirectUrl(safeNext, { verified: "success" }));
}
