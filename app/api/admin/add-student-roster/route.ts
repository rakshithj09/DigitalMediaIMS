import { NextResponse } from "next/server";

type Body = {
  name: string;
  period: string;
  user_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.name || !body?.period) {
      return NextResponse.json({ error: "name and period are required" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json({ error: "Server not configured with Supabase service role" }, { status: 500 });
    }

    const insertBody: Record<string, unknown> = {
      name: body.name.trim(),
      period: body.period,
    };
    if (body.user_id) insertBody.user_id = body.user_id;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        Prefer: "return=representation",
      },
      body: JSON.stringify([insertBody]),
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

    return NextResponse.json({ ok: true, inserted: json });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
