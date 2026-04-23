import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";

type Body = {
  email?: string;
  teacherPassword?: string;
};

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE?.trim();

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

async function verifyTeacherPassword(email: string | undefined, password: string | undefined) {
  if (!email || !password?.trim()) {
    return "Teacher password is required.";
  }

  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return "Server is missing Supabase public auth configuration.";
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  await supabase.auth.signOut();

  if (error) {
    return "Teacher password was incorrect.";
  }

  return null;
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

  const passwordError = await verifyTeacherPassword(auth.user.email, body.teacherPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 403 });
  }

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
