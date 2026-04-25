import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { categorySupportsSerialNumbers, normalizeSerialNumber, parseSerialNumbers } from "@/app/lib/serials";

type CheckoutBody = {
  studentId?: string;
  equipmentId?: string;
  quantity?: number;
  serialNumber?: string | null;
  notes?: string | null;
  period?: string;
  returnBy?: string;
};

type StudentRow = {
  id: string;
  name: string;
  period: "AM" | "PM";
  is_active: boolean;
};

type EquipmentRow = {
  id: string;
  category: string;
  total_quantity: number;
  serial_number: string | null;
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

async function getEquipmentAvailability(equipmentId: string): Promise<{
  available: number;
  serials: string[];
  activeSerials: Set<string>;
}> {
  const url = restUrl();
  const h = headers();
  if (!url || !h) throw new Error("Server is missing Supabase service configuration.");

  const equipmentRes = await fetch(
    `${url}/rest/v1/equipment?select=id,category,total_quantity,serial_number,is_active&id=eq.${encodeURIComponent(equipmentId)}&is_active=eq.true&limit=1`,
    { headers: h }
  );
  const equipment = (await equipmentRes.json().catch(() => [])) as EquipmentRow[];
  if (!equipmentRes.ok || !equipment[0]) throw new Error("Selected equipment is not available.");

  const checkoutsRes = await fetch(
    `${url}/rest/v1/checkouts?select=quantity,serial_number&equipment_id=eq.${encodeURIComponent(equipmentId)}&checked_in_at=is.null`,
    { headers: h }
  );
  const checkouts = (await checkoutsRes.json().catch(() => [])) as Array<{ quantity: number; serial_number: string | null }>;
  if (!checkoutsRes.ok) throw new Error("Unable to validate equipment availability.");

  const checkedOut = checkouts.reduce((sum, row) => sum + row.quantity, 0);
  const activeSerials = new Set(
    checkouts
      .map((row) => normalizeSerialNumber(row.serial_number))
      .filter((serial): serial is string => Boolean(serial))
      .map((serial) => serial.toLowerCase())
  );

  return {
    available: equipment[0].total_quantity - checkedOut,
    serials: categorySupportsSerialNumbers(equipment[0].category) ? parseSerialNumbers(equipment[0].serial_number) : [],
    activeSerials,
  };
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
    return NextResponse.json({ error: "You must be signed in to checkout equipment." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as CheckoutBody;
  const role = user.user_metadata?.role;
  const requestedQuantity = Number(body.quantity);
  const selectedSerial = normalizeSerialNumber(body.serialNumber);
  const dueAt = body.returnBy ? new Date(body.returnBy) : null;

  if (!body.equipmentId || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
    return NextResponse.json({ error: "Equipment and a valid quantity are required." }, { status: 400 });
  }

  if (!dueAt || Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "A valid future return date and time is required." }, { status: 400 });
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

    const availability = await getEquipmentAvailability(body.equipmentId);
    const requiresSerial = availability.serials.length > 0;
    if (requiresSerial) {
      if (requestedQuantity !== 1) {
        return NextResponse.json({ error: "Checkout one serialized unit at a time." }, { status: 400 });
      }
      if (!selectedSerial) {
        return NextResponse.json({ error: "Please select a serial/asset tag for this checkout." }, { status: 400 });
      }

      const validSerial = availability.serials.some((serial) => serial.toLowerCase() === selectedSerial.toLowerCase());
      if (!validSerial) {
        return NextResponse.json({ error: "Please select a valid serial/asset tag for this equipment." }, { status: 400 });
      }

      if (availability.activeSerials.has(selectedSerial.toLowerCase())) {
        return NextResponse.json({ error: "That serial/asset tag is already checked out." }, { status: 409 });
      }
    }

    const checkoutSerial = selectedSerial ?? (availability.serials.length === 1 ? availability.serials[0] : null);
    const available = availability.available;
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
          serial_number: checkoutSerial,
          notes: body.notes?.trim() || null,
          period: student.period,
          due_at: dueAt.toISOString(),
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
