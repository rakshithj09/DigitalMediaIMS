import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type CheckoutBody = {
  studentId?: string;
  equipmentId?: string;
  quantity?: number;
  notes?: string | null;
  period?: string;
};

type StudentRow = {
  id: string;
  name: string;
  period: "AM" | "PM";
  is_active: boolean;
};

type EquipmentRow = {
  id: string;
  total_quantity: number;
  is_active: boolean;
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

async function getOwnedStudent(userId: string): Promise<StudentRow | null> {
  const url = restUrl();
  const h = headers();
  if (!url || !h) throw new Error("Server is missing Supabase service configuration.");

  const res = await fetch(
    `${url}/rest/v1/students?select=id,name,period,is_active&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&limit=1`,
    { headers: h }
  );
  const data = (await res.json().catch(() => [])) as StudentRow[];
  if (!res.ok) throw new Error("Unable to find linked student roster entry.");
  return data[0] ?? null;
}

async function getStudent(studentId: string): Promise<StudentRow | null> {
  const url = restUrl();
  const h = headers();
  if (!url || !h) throw new Error("Server is missing Supabase service configuration.");

  const res = await fetch(
    `${url}/rest/v1/students?select=id,name,period,is_active&id=eq.${encodeURIComponent(studentId)}&is_active=eq.true&limit=1`,
    { headers: h }
  );
  const data = (await res.json().catch(() => [])) as StudentRow[];
  if (!res.ok) throw new Error("Unable to validate student roster entry.");
  return data[0] ?? null;
}

async function getAvailableQuantity(equipmentId: string): Promise<number> {
  const url = restUrl();
  const h = headers();
  if (!url || !h) throw new Error("Server is missing Supabase service configuration.");

  const equipmentRes = await fetch(
    `${url}/rest/v1/equipment?select=id,total_quantity,is_active&id=eq.${encodeURIComponent(equipmentId)}&is_active=eq.true&limit=1`,
    { headers: h }
  );
  const equipment = (await equipmentRes.json().catch(() => [])) as EquipmentRow[];
  if (!equipmentRes.ok || !equipment[0]) throw new Error("Selected equipment is not available.");

  const checkoutsRes = await fetch(
    `${url}/rest/v1/checkouts?select=quantity&equipment_id=eq.${encodeURIComponent(equipmentId)}&checked_in_at=is.null`,
    { headers: h }
  );
  const checkouts = (await checkoutsRes.json().catch(() => [])) as Array<{ quantity: number }>;
  if (!checkoutsRes.ok) throw new Error("Unable to validate equipment availability.");

  const checkedOut = checkouts.reduce((sum, row) => sum + row.quantity, 0);
  return equipment[0].total_quantity - checkedOut;
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
    return NextResponse.json({ error: "You must be signed in to check out equipment." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as CheckoutBody;
  const role = user.user_metadata?.role;
  const requestedQuantity = Number(body.quantity);

  if (!body.equipmentId || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
    return NextResponse.json({ error: "Equipment and a valid quantity are required." }, { status: 400 });
  }

  try {
    let student: StudentRow | null = null;

    if (role === "Student") {
      student = await getOwnedStudent(user.id);
      if (!student) {
        return NextResponse.json({ error: "Your account is not linked to a student roster entry yet." }, { status: 403 });
      }
    } else if (body.studentId) {
      student = await getStudent(body.studentId);
    }

    if (!student) {
      return NextResponse.json({ error: "Please select a valid student." }, { status: 400 });
    }

    const available = await getAvailableQuantity(body.equipmentId);
    if (requestedQuantity > available) {
      return NextResponse.json({ error: `Only ${available} unit(s) available.` }, { status: 409 });
    }

    const insertRes = await fetch(`${url}/rest/v1/checkouts`, {
      method: "POST",
      headers: {
        ...h,
        Prefer: "return=representation",
      },
      body: JSON.stringify([
        {
          student_id: student.id,
          equipment_id: body.equipmentId,
          quantity: requestedQuantity,
          notes: body.notes?.trim() || null,
          period: student.period,
        },
      ]),
    });

    const data = await insertRes.json().catch(() => null);
    if (!insertRes.ok) {
      return NextResponse.json({ error: data ?? "Checkout failed." }, { status: insertRes.status });
    }

    return NextResponse.json({ checkout: Array.isArray(data) ? data[0] : data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
