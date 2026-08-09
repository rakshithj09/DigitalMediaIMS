import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { categorySupportsSerialNumbers, normalizeSerialNumber, parseSerialNumbers } from "@/app/lib/serials";
import { isPeriodValue } from "@/app/lib/return-windows";
import type { Checkout, Equipment, Student } from "@/app/lib/types";

type Row = Record<string, unknown>;
type CheckoutRow = Checkout & {
  student?: Pick<Student, "id" | "name" | "student_id" | "email"> | null;
  equipment?: Pick<Equipment, "id" | "name" | "category"> | null;
};
type EquipmentWithAvailability = Equipment & {
  available: number;
  allSerialNumbers: string[];
  availableSerialNumbers: string[];
};

function toIsoValue(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return value;
}

function normalizeDoc<T>(id: string, data: Row): T {
  return Object.fromEntries(Object.entries({ id, ...data }).map(([key, value]) => [key, toIsoValue(value)])) as T;
}

async function getOwnedStudent(userId: string) {
  const snap = await getFirebaseAdminDb()
    .collection("students")
    .where("user_id", "==", userId)
    .where("is_active", "==", true)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? normalizeDoc<Student>(doc.id, doc.data()) : null;
}

async function getStudentsForPeriod(period: "AM" | "PM") {
  const snap = await getFirebaseAdminDb()
    .collection("students")
    .where("period", "==", period)
    .where("is_active", "==", true)
    .orderBy("name", "asc")
    .get();
  return snap.docs.map((doc) => normalizeDoc<Student>(doc.id, doc.data()));
}

async function getActiveEquipment() {
  const snap = await getFirebaseAdminDb()
    .collection("equipment")
    .where("is_active", "==", true)
    .orderBy("name", "asc")
    .get();
  return snap.docs.map((doc) => normalizeDoc<Equipment>(doc.id, doc.data()));
}

async function getActiveCheckouts(period: "AM" | "PM", studentId?: string) {
  let query = getFirebaseAdminDb()
    .collection("checkouts")
    .where("checked_in_at", "==", null)
    .where("period", "==", period);

  if (studentId) {
    query = query.where("student_id", "==", studentId);
  }

  const snap = await query.orderBy("checked_out_at", "desc").get();
  return snap.docs.map((doc) => normalizeDoc<CheckoutRow>(doc.id, doc.data()));
}

async function getAllActiveCheckoutSummaries() {
  const snap = await getFirebaseAdminDb()
    .collection("checkouts")
    .where("checked_in_at", "==", null)
    .get();
  return snap.docs.map((doc) => normalizeDoc<Pick<Checkout, "equipment_id" | "quantity" | "serial_number">>(doc.id, doc.data()));
}

async function enrichCheckouts(rows: CheckoutRow[]) {
  const db = getFirebaseAdminDb();
  const studentIds = Array.from(new Set(rows.map((row) => row.student_id).filter(Boolean)));
  const equipmentIds = Array.from(new Set(rows.map((row) => row.equipment_id).filter(Boolean)));
  const students = new Map<string, Pick<Student, "id" | "name" | "student_id" | "email">>();
  const equipment = new Map<string, Pick<Equipment, "id" | "name" | "category">>();

  await Promise.all([
    Promise.all(studentIds.map(async (id) => {
      const snap = await db.collection("students").doc(id).get();
      if (snap.exists) students.set(id, normalizeDoc<Student>(snap.id, snap.data() ?? {}));
    })),
    Promise.all(equipmentIds.map(async (id) => {
      const snap = await db.collection("equipment").doc(id).get();
      if (snap.exists) equipment.set(id, normalizeDoc<Equipment>(snap.id, snap.data() ?? {}));
    })),
  ]);

  return rows.map((row) => ({
    ...row,
    student: students.get(row.student_id) ?? null,
    equipment: equipment.get(row.equipment_id) ?? null,
  }));
}

function attachAvailability(equipment: Equipment[], checkoutSums: Pick<Checkout, "equipment_id" | "quantity" | "serial_number">[]) {
  const checkedOutMap = new Map<string, number>();
  const checkedOutSerials = new Map<string, Set<string>>();

  checkoutSums.forEach((checkout) => {
    checkedOutMap.set(checkout.equipment_id, (checkedOutMap.get(checkout.equipment_id) ?? 0) + Number(checkout.quantity ?? 0));
    const serial = normalizeSerialNumber(checkout.serial_number);
    if (serial) {
      const serials = checkedOutSerials.get(checkout.equipment_id) ?? new Set<string>();
      serials.add(serial.toLowerCase());
      checkedOutSerials.set(checkout.equipment_id, serials);
    }
  });

  return equipment.map<EquipmentWithAvailability>((item) => {
    const allSerialNumbers = categorySupportsSerialNumbers(item.category) ? parseSerialNumbers(item.serial_number) : [];
    const unavailableSerials = checkedOutSerials.get(item.id) ?? new Set<string>();
    return {
      ...item,
      available: Math.max(0, Number(item.total_quantity ?? 0) - (checkedOutMap.get(item.id) ?? 0)),
      allSerialNumbers,
      availableSerialNumbers: allSerialNumbers.filter((serial) => !unavailableSerials.has(serial.toLowerCase())),
    };
  });
}

export async function GET(req: Request) {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to load checkout data." }, { status: 401 });
  }

  const requestedPeriod = new URL(req.url).searchParams.get("period");
  const role = user.user_metadata?.role;

  try {
    if (role === "Student") {
      const student = await getOwnedStudent(user.id);
      if (!student) {
        return NextResponse.json({
          role,
          period: null,
          students: [],
          equipment: [],
          activeCheckouts: [],
        });
      }

      const studentPeriod = student.period === "PM" ? "PM" : "AM";
      const [equipment, activeCheckouts, checkoutSums] = await Promise.all([
        getActiveEquipment(),
        getActiveCheckouts(studentPeriod, student.id),
        getAllActiveCheckoutSummaries(),
      ]);

      return NextResponse.json({
        role,
        period: studentPeriod,
        students: [student],
        equipment: attachAvailability(equipment, checkoutSums),
        activeCheckouts: await enrichCheckouts(activeCheckouts),
      });
    }

    if (role !== "Teacher") {
      return NextResponse.json({ error: "Only approved accounts can load checkout data." }, { status: 403 });
    }

    const period = requestedPeriod && isPeriodValue(requestedPeriod) ? requestedPeriod : "AM";
    const [students, equipment, activeCheckouts, checkoutSums] = await Promise.all([
      getStudentsForPeriod(period),
      getActiveEquipment(),
      getActiveCheckouts(period),
      getAllActiveCheckoutSummaries(),
    ]);

    return NextResponse.json({
      role,
      period,
      students,
      equipment: attachAvailability(equipment, checkoutSums),
      activeCheckouts: await enrichCheckouts(activeCheckouts),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
