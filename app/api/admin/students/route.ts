import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { Period } from "@/app/lib/types";

type UpdateBody = {
  id?: string;
  name?: string;
  studentId?: string | null;
  email?: string | null;
  period?: Period;
  isActive?: boolean;
  userId?: string | null;
};

type DeleteBody = {
  id?: string;
  teacherPassword?: string;
};

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

async function requireTeacher() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role === "Student") {
    return { error: "Only teachers can manage students.", status: 403 };
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

export async function PATCH(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  if (!body.id) {
    return NextResponse.json({ error: "Student id is required." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim().replace(/\s+/g, " ");
    if (!name) {
      return NextResponse.json({ error: "Student name is required." }, { status: 400 });
    }
    update.name = name;
  }

  if (body.studentId !== undefined) {
    const studentId = body.studentId?.trim();
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }
    update.student_id = studentId;
  }

  if (body.email !== undefined) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.endsWith("@bentonvillek12.org")) {
      return NextResponse.json({ error: "Student email must be a @bentonvillek12.org address." }, { status: 400 });
    }
    update.email = email;
  }

  if (body.period !== undefined) {
    if (body.period !== "AM" && body.period !== "PM") {
      return NextResponse.json({ error: "Period must be AM or PM." }, { status: 400 });
    }
    update.period = body.period;
  }

  if (typeof body.isActive === "boolean") {
    update.is_active = body.isActive;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No student changes were provided." }, { status: 400 });
  }

  const { data: student, error } = await admin
    .from("students")
    .update(update)
    .eq("id", body.id)
    .select("id, name, student_id, email, period, user_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userId = body.userId ?? student?.user_id;
  if (userId) {
    const name = String(student?.name ?? "").trim();
    const [firstName = "", ...lastParts] = name.split(/\s+/);
    const lastName = lastParts.join(" ");
    const metadata: Record<string, unknown> = {
      role: "Student",
      period: student?.period,
      first_name: firstName,
      last_name: lastName,
      student_id: student?.student_id,
    };

    const authUpdate: { user_metadata: Record<string, unknown>; email?: string } = { user_metadata: metadata };
    if (update.email) authUpdate.email = String(update.email);

    const { error: authError } = await admin.auth.admin.updateUserById(userId, authUpdate);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, student });
}

export async function DELETE(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as DeleteBody;
  if (!body.id) {
    return NextResponse.json({ error: "Student id is required." }, { status: 400 });
  }

  const passwordError = await verifyTeacherPassword(auth.user.email, body.teacherPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 403 });
  }

  const { data: student, error: lookupError } = await admin
    .from("students")
    .select("id, user_id, email")
    .eq("id", body.id)
    .single();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 400 });
  }

  if (student?.user_id) {
    const { error: profileByIdError } = await admin
      .from("profiles")
      .delete()
      .eq("id", student.user_id);

    if (profileByIdError && profileByIdError.code !== "42P01") {
      return NextResponse.json({ error: profileByIdError.message }, { status: 400 });
    }
  }

  if (student?.email) {
    const { error: profileByEmailError } = await admin
      .from("profiles")
      .delete()
      .eq("email", student.email);

    if (profileByEmailError && profileByEmailError.code !== "42P01") {
      return NextResponse.json({ error: profileByEmailError.message }, { status: 400 });
    }
  }

  const { error: deleteStudentError } = await admin
    .from("students")
    .delete()
    .eq("id", body.id);

  if (deleteStudentError) {
    return NextResponse.json({ error: deleteStudentError.message }, { status: 400 });
  }

  if (student?.user_id) {
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(student.user_id, false);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
