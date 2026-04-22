import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";

type Body = {
  email?: string;
};

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function requireTeacher() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role === "Student") {
    return { error: "Only teachers can approve teacher accounts.", status: 403 };
  }

  return { user };
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const email = cleanEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: "Teacher email is required." }, { status: 400 });
  }

  if (!email.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Teacher email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  const { error } = await admin
    .from("approved_teachers")
    .upsert(
      {
        email,
        invited_by: auth.user.id,
        used_at: null,
        approved_user_id: null,
      },
      { onConflict: "email" },
    );

  if (error) {
    const message = error.code === "42P01"
      ? "Database update needed: run supabase/approved-teachers.sql in Supabase, then try again."
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email });
}
