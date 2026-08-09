import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-client";

type Body = {
  email?: string;
};

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const email = cleanEmail(body.email);

  if (!email.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  try {
    await getFirebaseAdminAuth().getUserByEmail(email);
    return NextResponse.json({ exists: true });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (code === "auth/user-not-found") {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check account." },
      { status: 500 },
    );
  }
}
