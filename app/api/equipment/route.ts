import { NextResponse } from "next/server";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { verifyFirebasePassword } from "@/lib/firebase/server-password";
import { EQUIPMENT_CATEGORIES } from "@/app/lib/types";
import { categorySupportsSerialNumbers, parseSerialNumbers } from "@/app/lib/serials";
import {
  IdentifierReservationConflict,
  IdentifierReservation,
  normalizeBarcodeKey,
  syncIdentifierReservations,
} from "@/app/lib/identifier-keys";

type CreateBody = {
  name?: string;
  category?: string;
  totalQuantity?: number;
  serialNumber?: string | null;
  conditionNotes?: string | null;
};

type UpdateBody = {
  id?: string;
  isActive?: boolean;
  teacherPassword?: string;
  name?: string;
  category?: string;
  totalQuantity?: number;
  serialNumber?: string | null;
  conditionNotes?: string | null;
};

type EquipmentReservationInput = {
  id: string;
  category: string;
  serialNumber: string | null | undefined;
  isActive: boolean;
  barcodeKey?: string | null;
};

function validateSerialNumbers(
  serialNumber: string | null | undefined,
  category: string | null | undefined,
  totalQuantity: number
): string | null {
  if (categorySupportsSerialNumbers(category)) {
    const serialCount = parseSerialNumbers(serialNumber).length;
    if (totalQuantity !== 1) {
      return "Barcode-labeled equipment must be stored one physical item at a time.";
    }
    if (serialCount !== 1) {
      return "Scan exactly one barcode label for this item.";
    }
  }
  if ((serialNumber ?? "").length > 1000) {
    return "Barcode labels must be 1000 characters or fewer.";
  }
  return null;
}

function getBarcodeKey(serialNumber: string | null | undefined) {
  return normalizeBarcodeKey(parseSerialNumbers(serialNumber)[0] ?? null);
}

function equipmentReservations(input: EquipmentReservationInput): IdentifierReservation[] {
  const barcodeKey = input.barcodeKey ?? getBarcodeKey(input.serialNumber);
  if (!input.isActive || !categorySupportsSerialNumbers(input.category) || !barcodeKey) {
    return [];
  }

  return [{
    kind: "equipment_barcode",
    key: barcodeKey,
    ownerCollection: "equipment",
    ownerId: input.id,
  }];
}

async function findActiveEquipmentWithBarcode(
  admin: ReturnType<typeof getFirebaseAdminDataClient>,
  barcode: string | null | undefined,
  excludeId?: string
) {
  const normalizedBarcode = parseSerialNumbers(barcode)[0];
  if (!normalizedBarcode) return null;
  const barcodeKey = normalizeBarcodeKey(normalizedBarcode);

  const { data, error } = await admin
    .from("equipment")
    .select("id, name, serial_number, barcode_key")
    .eq("is_active", true);

  if (error) {
    return { error: error.message };
  }

  const duplicate = (data ?? []).find((item) => {
    if (item.id === excludeId) return false;
    if (typeof item.barcode_key === "string" && item.barcode_key === barcodeKey) {
      return true;
    }
    return parseSerialNumbers(
      typeof item.serial_number === "string" ? item.serial_number : null
    ).some((serial) => normalizeBarcodeKey(serial) === barcodeKey);
  });

  return duplicate ? { duplicate } : null;
}

async function requireTeacher() {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role !== "Teacher") {
    return { error: "Only teachers can manage equipment.", status: 403 };
  }

  return { user };
}

async function verifyTeacherPassword(email: string | undefined, password: string | undefined) {
  if (!email || !password?.trim()) {
    return "Teacher password is required.";
  }

  return verifyFirebasePassword(email, password);
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getFirebaseAdminDataClient();

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const name = body.name?.trim() ?? "";
  const category = body.category?.trim() ?? "";
  const totalQuantity = Number(body.totalQuantity);

  if (!name) {
    return NextResponse.json({ error: "Equipment name is required." }, { status: 400 });
  }

  if (!EQUIPMENT_CATEGORIES.includes(category as (typeof EQUIPMENT_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Please select a valid equipment category." }, { status: 400 });
  }

  if (!Number.isInteger(totalQuantity) || totalQuantity < 1 || totalQuantity > 999) {
    return NextResponse.json({ error: "Quantity must be between 1 and 999." }, { status: 400 });
  }

  const serialError = validateSerialNumbers(body.serialNumber, category, totalQuantity);
  if (serialError) {
    return NextResponse.json({ error: serialError }, { status: 400 });
  }

  if (categorySupportsSerialNumbers(category)) {
    const duplicateBarcode = await findActiveEquipmentWithBarcode(admin, body.serialNumber);
    if (duplicateBarcode?.error) {
      return NextResponse.json({ error: duplicateBarcode.error }, { status: 400 });
    }
    if (duplicateBarcode?.duplicate) {
      return NextResponse.json({
        error: "That barcode is already assigned to another active equipment item.",
      }, { status: 409 });
    }
  }

  const db = getFirebaseAdminDb();
  const ref = db.collection("equipment").doc();
  const now = new Date().toISOString();
  const serialNumber = body.serialNumber?.trim() || null;
  const barcodeKey = categorySupportsSerialNumbers(category) ? getBarcodeKey(serialNumber) : null;
  const equipment = {
    id: ref.id,
    name,
    category,
    total_quantity: totalQuantity,
    serial_number: serialNumber,
    barcode_key: barcodeKey,
    condition_notes: body.conditionNotes?.trim() || null,
    is_active: true,
    created_at: now,
  };

  try {
    await db.runTransaction(async (transaction) => {
      await syncIdentifierReservations(
        transaction,
        db,
        [],
        equipmentReservations({
          id: ref.id,
          category,
          serialNumber,
          isActive: true,
          barcodeKey,
        }),
        now
      );
      transaction.set(ref, equipment);
    });
  } catch (error) {
    if (error instanceof IdentifierReservationConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getFirebaseAdminDataClient();

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  if (!body.id) {
    return NextResponse.json({ error: "Equipment id is required." }, { status: 400 });
  }
  const equipmentId = body.id;

  const { data: currentEquipment, error: currentError } = await admin
    .from("equipment")
    .select("id, total_quantity, serial_number, barcode_key, category, is_active")
    .eq("id", equipmentId)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 400 });
  }

  if (!currentEquipment) {
    return NextResponse.json({ error: "Equipment item was not found." }, { status: 404 });
  }

  const update: Record<string, unknown> = {};

  if (typeof body.isActive === "boolean") {
    if (body.isActive === false) {
      const passwordError = await verifyTeacherPassword(auth.user.email ?? undefined, body.teacherPassword);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 403 });
      }
    }
    update.is_active = body.isActive;
  }

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Equipment name is required." }, { status: 400 });
    }
    update.name = name;
  }

  if (body.category !== undefined) {
    const category = body.category.trim();
    if (!EQUIPMENT_CATEGORIES.includes(category as (typeof EQUIPMENT_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Please select a valid equipment category." }, { status: 400 });
    }
    update.category = category;
  }

  if (body.totalQuantity !== undefined) {
    const totalQuantity = Number(body.totalQuantity);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1 || totalQuantity > 999) {
      return NextResponse.json({ error: "Quantity must be between 1 and 999." }, { status: 400 });
    }
    update.total_quantity = totalQuantity;
  }

  if (body.serialNumber !== undefined) {
    update.serial_number = body.serialNumber?.trim() || null;
  }

  const nextCategory = String(update.category ?? currentEquipment.category);
  const nextQuantity = Number(update.total_quantity ?? currentEquipment.total_quantity);
  const nextSerialNumber =
    body.serialNumber === undefined
      ? (typeof currentEquipment.serial_number === "string" ? currentEquipment.serial_number : null)
      : body.serialNumber;
  const nextIsActive =
    typeof update.is_active === "boolean" ? update.is_active : currentEquipment.is_active !== false;
  const nextBarcodeKey = categorySupportsSerialNumbers(nextCategory) ? getBarcodeKey(nextSerialNumber) : null;
  const previousBarcodeKey =
    typeof currentEquipment.barcode_key === "string"
      ? currentEquipment.barcode_key
      : getBarcodeKey(typeof currentEquipment.serial_number === "string" ? currentEquipment.serial_number : null);

  if (nextIsActive && categorySupportsSerialNumbers(nextCategory)) {
    const serialError = validateSerialNumbers(nextSerialNumber, nextCategory, nextQuantity);
    if (serialError) {
      return NextResponse.json({ error: serialError }, { status: 400 });
    }

      const duplicateBarcode = await findActiveEquipmentWithBarcode(admin, nextSerialNumber, equipmentId);
    if (duplicateBarcode?.error) {
      return NextResponse.json({ error: duplicateBarcode.error }, { status: 400 });
    }
    if (duplicateBarcode?.duplicate) {
      return NextResponse.json({
        error: "That barcode is already assigned to another active equipment item.",
      }, { status: 409 });
    }
  }

  if (body.conditionNotes !== undefined) {
    update.condition_notes = body.conditionNotes?.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No equipment changes were provided." }, { status: 400 });
  }
  update.barcode_key = nextBarcodeKey;

  const db = getFirebaseAdminDb();
  const ref = db.collection("equipment").doc(equipmentId);
  const now = new Date().toISOString();

  try {
    await db.runTransaction(async (transaction) => {
      await syncIdentifierReservations(
        transaction,
        db,
        equipmentReservations({
          id: equipmentId,
          category: String(currentEquipment.category),
          serialNumber: typeof currentEquipment.serial_number === "string" ? currentEquipment.serial_number : null,
          isActive: currentEquipment.is_active !== false,
          barcodeKey: previousBarcodeKey,
        }),
        equipmentReservations({
          id: equipmentId,
          category: nextCategory,
          serialNumber: nextSerialNumber,
          isActive: nextIsActive,
          barcodeKey: nextBarcodeKey,
        }),
        now
      );
      transaction.set(ref, update, { merge: true });
    });
  } catch (error) {
    if (error instanceof IdentifierReservationConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
