import { type NextRequest, NextResponse } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://igndigitalmedia.web.app";

export async function GET(_request?: NextRequest) {
  void _request;
  return NextResponse.redirect(new URL("/", SITE_URL));
}
