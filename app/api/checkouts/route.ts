import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { categorySupportsSerialNumbers, normalizeSerialNumber, parseSerialNumbers } from "@/app/lib/serials";
import { getChicagoTimeValue, getChicagoWeekday, isPeriodValue, isTimeWithinReturnWindow } from "@/app/lib/return-windows";

type CheckoutBody = {
  studentId?: string;
  equipmentId?: string;
  quantity?: number;
  serialNumber?: string | null;
  notes?: string | null;
  returnBy?: string;
};

type StudentRow = {
  id: string;
  name?: string;
  period: "AM" | "PM";
  is_active: boolean;
};

type EquipmentRow = {
  id: string;
  category: string;
  total_quantity: number;
  serial_number?: string | null;
  is_active: boolean;
};

async function getOwnedStudent(userId: string): Promise<StudentRow | null> {
  const snap = await getFirebaseAdminDb()
    .collection("students")
    .where("user_id", "==", userId)
    .where("is_active", "==", true)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as StudentRow) : null;
}

async function getStudent(studentId: string): Promise<StudentRow | null> {
  const doc = await getFirebaseAdminDb().collection("students").doc(studentId).get();
  if (!doc.exists) return null;
  const student = { id: doc.id, ...doc.data() } as StudentRow;
  return student.is_active ? student : null;
}

async function getEquipmentAvailability(equipmentId: string) {
  const db = getFirebaseAdminDb();
  const equipmentDoc = await db.collection("equipment").doc(equipmentId).get();
  if (!equipmentDoc.exists) throw new Error("Selected equipment is not available.");
  const equipment = { id: equipmentDoc.id, ...equipmentDoc.data() } as EquipmentRow;
  if (!equipment.is_active) throw new Error("Selected equipment is not available.");

  const checkoutsSnap = await db
    .collection("checkouts")
    .where("equipment_id", "==", equipmentId)
    .where("checked_in_at", "==", null)
    .get();

  const checkouts = checkoutsSnap.docs.map((item) => item.data() as { quantity: number; serial_number?: string | null });
  const checkedOut = checkouts.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const activeSerials = new Set(
    checkouts
      .map((row) => normalizeSerialNumber(row.serial_number))
      .filter((serial): serial is string => Boolean(serial))
      .map((serial) => serial.toLowerCase())
  );

  return {
    available: equipment.total_quantity - checkedOut,
    serials: categorySupportsSerialNumbers(equipment.category) ? parseSerialNumbers(equipment.serial_number) : [],
    activeSerials,
  };
}

export async function POST(req: Request) {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

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

    if (!isPeriodValue(student.period)) {
      return NextResponse.json({ error: "Student is missing a valid class period." }, { status: 400 });
    }

    const dueWeekdayInChicago = getChicagoWeekday(dueAt);
    if (dueWeekdayInChicago === "Sat" || dueWeekdayInChicago === "Sun") {
      return NextResponse.json({
        error: "Return date must be on a weekday (Monday through Friday) in America/Chicago.",
      }, { status: 400 });
    }

    const dueTimeInChicago = getChicagoTimeValue(dueAt);
    if (!isTimeWithinReturnWindow(student.period, dueTimeInChicago)) {
      const allowedWindow = student.period === "AM" ? "7:45 AM to 10:00 AM" : "11:45 AM to 3:00 PM";
      return NextResponse.json({
        error: `Return time for ${student.period} students must be between ${allowedWindow} (America/Chicago).`,
      }, { status: 400 });
    }

    const availability = await getEquipmentAvailability(body.equipmentId);
    if (availability.serials.length > 0) {
      if (requestedQuantity !== 1) {
        return NextResponse.json({ error: "Checkout one barcode-labeled unit at a time." }, { status: 400 });
      }
      if (!selectedSerial) {
        return NextResponse.json({ error: "Scan the item's barcode to check it out." }, { status: 400 });
      }
      if (!availability.serials.some((serial) => serial.toLowerCase() === selectedSerial.toLowerCase())) {
        return NextResponse.json({ error: "Please select a valid barcode label for this equipment." }, { status: 400 });
      }
      if (availability.activeSerials.has(selectedSerial.toLowerCase())) {
        return NextResponse.json({ error: "That barcode label is already checked out." }, { status: 409 });
      }
    }

    if (requestedQuantity > availability.available) {
      return NextResponse.json({ error: `Only ${availability.available} unit(s) available.` }, { status: 409 });
    }

    const checkoutSerial = selectedSerial ?? (availability.serials.length === 1 ? availability.serials[0] : null);
    const checkoutRef = getFirebaseAdminDb().collection("checkouts").doc();
    const checkout = {
      id: checkoutRef.id,
      student_id: student.id,
      equipment_id: body.equipmentId,
      quantity: requestedQuantity,
      serial_number: checkoutSerial,
      notes: body.notes?.trim() || null,
      return_notes: null,
      checked_out_at: new Date().toISOString(),
      checked_in_at: null,
      period: student.period,
      due_at: dueAt.toISOString(),
      created_at: new Date().toISOString(),
    };
    await checkoutRef.set(checkout);

    return NextResponse.json({ checkout });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
