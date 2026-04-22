import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
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
  name?: string;
  category?: string;
  totalQuantity?: number;
  serialNumber?: string | null;
  conditionNotes?: string | null;
};

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function validateSerialNumbers(
  serialNumber: string | null | undefined,
  category: string | null | undefined,
  totalQuantity: number
): string | null {
  if (categorySupportsSerialNumbers(category)) {
    const serialCount = parseSerialNumbers(serialNumber).length;
    if (serialCount < totalQuantity) {
      return "Each item must have a serial number.";
    }
    if (serialCount > totalQuantity) {
      return "Serial tags cannot be more than the quantity.";
    }
  }
  if ((serialNumber ?? "").length > 1000) {
    return "Serial/asset tags must be 1000 characters or fewer.";
  }
  return null;
}

async function requireTeacher() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role === "Student") {
    return { error: "Only teachers can manage equipment.", status: 403 };
  }

  return { user };
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

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

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

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
      body.serialNumber === undefined ? currentEquipment.serial_number : body.serialNumber;
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
