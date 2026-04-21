import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { first_name, last_name, student_id, email, password, period } = body ?? {};

  if (!first_name || !last_name || !student_id || !email || !password) {
    return NextResponse.json({ error: "Missing required fields: first_name, last_name, student_id, email, password" }, { status: 400 });
  }

  try {
    // 1) Create the auth user via Supabase Admin REST endpoint
    const userResp = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { first_name, last_name, role: "Student", period },
      }),
    });

    const userData = await userResp.json().catch(() => null);
    if (!userResp.ok) {
      return NextResponse.json({ error: userData ?? "Failed to create auth user" }, { status: 400 });
    }

    // 2) Insert into students table using PostgREST (service key bypasses RLS)
    const name = `${first_name} ${last_name}`;
    const studentResp = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify([{ name, student_id, period, email, is_active: true }]),
    });

    const studentData = await studentResp.json().catch(() => null);
    if (![200, 201].includes(studentResp.status)) {
      // If student insert fails, attempt to rollback created user? For now, return an error.
      return NextResponse.json({ error: studentData ?? "Failed to insert student row", user: userData }, { status: 400 });
    }

    return NextResponse.json({ user: userData, student: Array.isArray(studentData) ? studentData[0] : studentData });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
