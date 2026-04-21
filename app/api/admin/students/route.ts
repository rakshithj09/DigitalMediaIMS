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
