import { NextResponse } from "next/server";

type Body = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: "Teacher" | "Student";
  period?: "AM" | "PM";
  teacherCode?: string;
};

const TEACHER_VERIFICATION_CODE = "2015";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRole) return null;
  return { url, serviceRole };
}

function restHeaders(serviceRole: string) {
  return {
    "Content-Type": "application/json",
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const email = cleanString(body.email).toLowerCase();
  const password = cleanString(body.password);
  const firstName = cleanString(body.firstName);
  const lastName = cleanString(body.lastName);
  const role = body.role;
  const period = body.period;

  if (!email || !password || !firstName || !lastName || !role) {
    return NextResponse.json({ error: "Email, password, name, and role are required." }, { status: 400 });
  }

  if (!email.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  if (role === "Student" && period !== "AM" && period !== "PM") {
    return NextResponse.json({ error: "Students must select AM or PM period." }, { status: 400 });
  }

  if (role === "Teacher" && cleanString(body.teacherCode) !== TEACHER_VERIFICATION_CODE) {
    return NextResponse.json({ error: "Invalid teacher verification code." }, { status: 403 });
  }

  const { url, serviceRole } = config;
  const headers = restHeaders(serviceRole);
  const metadata: Record<string, string> = {
    first_name: firstName,
    last_name: lastName,
    role,
  };

  if (role === "Student" && period) metadata.period = period;

  const userResp = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });

  const userData = await userResp.json().catch(() => null);
  if (!userResp.ok) {
    const message = userData?.message ?? userData?.error_description ?? userData?.error ?? "Account creation failed.";
    return NextResponse.json({ error: message }, { status: userResp.status });
  }

  if (role === "Student") {
    const studentBody = {
      name: `${firstName} ${lastName}`,
      period,
      email,
      user_id: userData.id,
      is_active: true,
    };

    const lookup = await fetch(
      `${url}/rest/v1/students?select=id&user_id=eq.${encodeURIComponent(userData.id)}&limit=1`,
      { headers }
    );
    const existing = (await lookup.json().catch(() => [])) as Array<{ id: string }>;

    if (!lookup.ok) {
      return NextResponse.json({ error: "Account created, but roster lookup failed." }, { status: lookup.status });
    }

    const studentResp = existing[0]?.id
      ? await fetch(`${url}/rest/v1/students?id=eq.${existing[0].id}`, {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=representation",
          },
          body: JSON.stringify(studentBody),
        })
      : await fetch(`${url}/rest/v1/students`, {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=representation",
          },
          body: JSON.stringify([studentBody]),
        });

    const studentData = await studentResp.json().catch(() => null);
    if (!studentResp.ok) {
      return NextResponse.json(
        { error: studentData?.message ?? studentData ?? "Account created, but roster setup failed." },
        { status: studentResp.status }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
