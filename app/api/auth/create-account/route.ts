import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";

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

async function authUserExists(admin: SupabaseClient, email: string) {
  const normalizedEmail = email.toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    if (data.users.some((user) => user.email?.toLowerCase() === normalizedEmail)) {
      return true;
    }

    if (data.users.length < perPage) return false;
  }

  throw new Error("Unable to check existing accounts because the user list is too large.");
}

async function syncTeacherProfile(
  admin: SupabaseClient,
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
) {
  const attempts: Array<Record<string, unknown>> = [
    {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      role: "staff",
      is_staff: true,
    },
    {
      id: userId,
      email,
      role: "staff",
      is_staff: true,
    },
    {
      id: userId,
      email,
      is_staff: true,
    },
    {
      id: userId,
      email,
      role: "staff",
    },
  ];

  let lastError: string | null = null;

  for (const profile of attempts) {
    const { error } = await admin
      .from("profiles")
      .upsert(profile, { onConflict: "id" });

    if (!error) return null;

    if (error.code === "42P01") {
      return null;
    }

    lastError = error.message;
  }

  return lastError;
}

export async function POST(req: Request) {
  const supabase = getSupabasePublicClient();
  const admin = getSupabaseAdminClient();
  if (!supabase || !admin) {
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

  try {
    if (await authUserExists(admin, email)) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 },
      );
    }
  } catch (lookupError) {
    return NextResponse.json(
      {
        error: `Unable to check whether this account already exists: ${
          lookupError instanceof Error ? lookupError.message : String(lookupError)
        }`,
      },
      { status: 500 },
    );
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

  if (signUpData.session) {
    await admin.auth.admin.deleteUser(user.id, false);
    await supabase.auth.signOut();
    return NextResponse.json({
      error: "Supabase email confirmation appears to be disabled. Enable Confirm email before allowing self-service account creation.",
    }, { status: 500 });
  }

  if (role === "Teacher") {
    const profileError = await syncTeacherProfile(admin, user.id, email, firstName, lastName);
    if (profileError) {
      return NextResponse.json({
        error: `Account was created, but the staff profile could not be updated: ${profileError}`,
      }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, requiresEmailConfirmation: true });
}
