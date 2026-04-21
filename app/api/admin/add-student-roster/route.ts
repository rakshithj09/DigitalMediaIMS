import { NextResponse } from "next/server";

type Body = {
  name: string;
  period: string;
  user_id?: string;
  email?: string;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRole) {
    return null;
  }

  return { url, serviceRole };
}

function restHeaders(serviceRole: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceRole}`,
    apikey: serviceRole,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const name = body?.name?.trim();
    const period = body?.period;

    if (!name || !period) {
      return NextResponse.json({ error: "name and period are required" }, { status: 400 });
    }

    if (period !== "AM" && period !== "PM") {
      return NextResponse.json({ error: "period must be AM or PM" }, { status: 400 });
    }

    const config = getSupabaseConfig();
    if (!config) {
      return NextResponse.json({ error: "Server not configured with Supabase service role" }, { status: 500 });
    }

    const { url, serviceRole } = config;
    const studentBody: Record<string, unknown> = {
      name,
      period,
      is_active: true,
    };
    if (body.user_id) studentBody.user_id = body.user_id;
    if (body.email) studentBody.email = body.email.trim().toLowerCase();

    if (body.user_id) {
      const lookup = await fetch(
        `${url}/rest/v1/students?select=id&user_id=eq.${encodeURIComponent(body.user_id)}&limit=1`,
        { headers: restHeaders(serviceRole) }
      );
      const existing = (await lookup.json().catch(() => [])) as Array<{ id: string }>;

      if (!lookup.ok) {
        return NextResponse.json({ error: existing }, { status: lookup.status });
      }

      if (existing[0]?.id) {
        const updateRes = await fetch(`${url}/rest/v1/students?id=eq.${existing[0].id}`, {
          method: "PATCH",
          headers: {
            ...restHeaders(serviceRole),
            Prefer: "return=representation",
          },
          body: JSON.stringify(studentBody),
        });

        const updated = await updateRes.json().catch(() => null);
        if (!updateRes.ok) {
          return NextResponse.json({ error: updated }, { status: updateRes.status });
        }

        return NextResponse.json({ ok: true, student: Array.isArray(updated) ? updated[0] : updated });
      }
    }

    const res = await fetch(`${url}/rest/v1/students`, {
      method: "POST",
      headers: {
        ...restHeaders(serviceRole),
        Prefer: "return=representation",
      },
      body: JSON.stringify([studentBody]),
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }

    if (!res.ok) {
      return NextResponse.json({ error: json }, { status: res.status });
    }

    return NextResponse.json({ ok: true, student: Array.isArray(json) ? json[0] : json });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
