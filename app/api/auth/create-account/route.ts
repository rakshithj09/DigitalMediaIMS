import { NextResponse } from "next/server";
import { createClient, User } from "@supabase/supabase-js";

type Body = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: "Teacher" | "Student";
  period?: "AM" | "PM";
  studentId?: string;
  teacherCode?: string;
};

const TEACHER_VERIFICATION_CODE = "2015";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://digital-media-ims.vercel.app";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

async function ensureStudentRosterRow(
  user: User,
  firstName: string,
  lastName: string,
  email: string,
  period: "AM" | "PM",
  studentId: string
) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Server is missing Supabase service configuration.");

  const studentBody = {
    name: `${firstName} ${lastName}`,
    period,
    student_id: studentId,
    email,
    user_id: user.id,
    is_active: true,
  };

  const { data: existing, error: lookupError } = await admin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `${lookupError.message}. If this mentions user_id or email, run supabase/student-account-link.sql in Supabase SQL Editor.`
    );
  }

  if (existing?.id) {
    const { error } = await admin.from("students").update(studentBody).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("students").insert(studentBody);
  if (error) throw new Error(error.message);
}

export async function POST(req: Request) {
  const admin = getSupabaseAdminClient();
  const supabase = getSupabasePublicClient();
  if (!admin || !supabase) {
    return NextResponse.json({ error: "Server is missing Supabase configuration." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const email = cleanString(body.email).toLowerCase();
  const password = cleanString(body.password);
  const firstName = cleanString(body.firstName);
  const lastName = cleanString(body.lastName);
  const role = body.role;
  const period = body.period;
  const studentId = cleanString(body.studentId);

  if (!email || !password || !firstName || !lastName || !role) {
    return NextResponse.json({ error: "Email, password, name, and role are required." }, { status: 400 });
  }

  if (!email.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  if (role === "Student" && period !== "AM" && period !== "PM") {
    return NextResponse.json({ error: "Students must select AM or PM period." }, { status: 400 });
  }

  if (role === "Student" && !studentId) {
    return NextResponse.json({ error: "Student ID is required for student accounts." }, { status: 400 });
  }

  if (studentId.length > 20) {
    return NextResponse.json({ error: "Student ID must be 20 characters or fewer." }, { status: 400 });
  }

  if (role === "Teacher" && cleanString(body.teacherCode) !== TEACHER_VERIFICATION_CODE) {
    return NextResponse.json({ error: "Invalid teacher verification code." }, { status: 403 });
  }

  const metadata: Record<string, string> = {
    first_name: firstName,
    last_name: lastName,
    role,
  };

  if (role === "Student" && period) metadata.period = period;
  if (role === "Student" && studentId) metadata.student_id = studentId;

  const { data: signUpData, error: createError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message ?? "Account creation failed." }, { status: 400 });
  }

  const user = signUpData.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Supabase did not return a usable user id for this account." }, { status: 500 });
  }

  try {
    if (role === "Student") {
      if (period !== "AM" && period !== "PM") {
        return NextResponse.json({ error: "Students must select AM or PM period." }, { status: 400 });
      }
      await ensureStudentRosterRow(user, firstName, lastName, email, period, studentId);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Account exists, but roster setup failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  if (signUpData.session) {
    await supabase.auth.signOut();
    return NextResponse.json({
      ok: true,
      warning: "Account created, but Supabase email confirmation appears to be disabled. Enable Confirm email in Supabase Authentication settings before release.",
    });
  }

  return NextResponse.json({ ok: true, requiresEmailConfirmation: true });
}
