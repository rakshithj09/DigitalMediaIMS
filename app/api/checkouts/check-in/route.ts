import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type Body = {
  checkoutId?: string;
  returnNotes?: string | null;
};

type CheckoutRow = {
  id: string;
  student_id: string;
  checked_in_at: string | null;
};

const restUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function headers() {
  const key = serviceKey();
  if (!key) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

async function getOwnedStudentId(userId: string): Promise<string | null> {
  const url = restUrl();
  const h = headers();
  if (!url || !h) throw new Error("Server is missing Supabase service configuration.");

  const res = await fetch(
    `${url}/rest/v1/students?select=id&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&limit=1`,
    { headers: h }
  );
  const data = (await res.json().catch(() => [])) as Array<{ id: string }>;
  if (!res.ok) throw new Error("Unable to find linked student roster entry.");
  return data[0]?.id ?? null;
}

export async function POST(req: Request) {
  const url = restUrl();
  const h = headers();
  if (!url || !h) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to check in equipment." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.checkoutId) {
    return NextResponse.json({ error: "checkoutId is required." }, { status: 400 });
  }

  try {
    const checkoutRes = await fetch(
      `${url}/rest/v1/checkouts?select=id,student_id,checked_in_at&id=eq.${encodeURIComponent(body.checkoutId)}&limit=1`,
      { headers: h }
    );
    const checkoutData = (await checkoutRes.json().catch(() => [])) as CheckoutRow[];

    if (!checkoutRes.ok) {
      return NextResponse.json({ error: checkoutData }, { status: checkoutRes.status });
    }

    const checkout = checkoutData[0];
    if (!checkout || checkout.checked_in_at) {
      return NextResponse.json({ error: "Active checkout was not found." }, { status: 404 });
    }

    if (user.user_metadata?.role === "Student") {
      const ownedStudentId = await getOwnedStudentId(user.id);
      if (!ownedStudentId || checkout.student_id !== ownedStudentId) {
        return NextResponse.json({ error: "You can only check in equipment you checked out." }, { status: 403 });
      }
    }

    const updateRes = await fetch(`${url}/rest/v1/checkouts?id=eq.${encodeURIComponent(body.checkoutId)}`, {
      method: "PATCH",
      headers: {
        ...h,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        checked_in_at: new Date().toISOString(),
        return_notes: body.returnNotes?.trim() || null,
      }),
    });

    const updated = await updateRes.json().catch(() => null);
    if (!updateRes.ok) {
      return NextResponse.json({ error: updated ?? "Check-in failed." }, { status: updateRes.status });
    }

    return NextResponse.json({ checkout: Array.isArray(updated) ? updated[0] : updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
