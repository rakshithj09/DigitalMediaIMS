import { NextResponse } from "next/server";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";
import { verifyFirebasePassword } from "@/lib/firebase/server-password";
import { EQUIPMENT_CATEGORIES } from "@/app/lib/types";
import { categorySupportsSerialNumbers, parseSerialNumbers } from "@/app/lib/serials";

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

async function requireTeacher() {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role === "Student") {
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

  const { error } = await admin.from("equipment").insert({
    name,
    category,
    total_quantity: totalQuantity,
    serial_number: body.serialNumber?.trim() || null,
    condition_notes: body.conditionNotes?.trim() || null,
    is_active: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
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

  const { data: currentEquipment, error: currentError } = await admin
    .from("equipment")
    .select("total_quantity, serial_number, category")
    .eq("id", body.id)
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

  if (body.totalQuantity !== undefined || body.serialNumber !== undefined || body.category !== undefined) {
    const nextCategory = String(update.category ?? currentEquipment.category);
    const nextQuantity = Number(update.total_quantity ?? currentEquipment.total_quantity);
    const nextSerialNumber =
      body.serialNumber === undefined
        ? (typeof currentEquipment.serial_number === "string" ? currentEquipment.serial_number : null)
        : body.serialNumber;
    const serialError = validateSerialNumbers(nextSerialNumber, nextCategory, nextQuantity);
    if (serialError) {
      return NextResponse.json({ error: serialError }, { status: 400 });
    }
  }

  if (body.conditionNotes !== undefined) {
    update.condition_notes = body.conditionNotes?.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No equipment changes were provided." }, { status: 400 });
  }

  const { error } = await admin
    .from("equipment")
    .update(update)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
