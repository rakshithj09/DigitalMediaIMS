import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";

type Body = {
  name: string;
  period: string;
  user_id?: string;
  email?: string;
  student_id?: string;
};

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

    const db = getFirebaseAdminDb();
    const studentBody: Record<string, unknown> = {
      name,
      period,
      student_id: body.student_id ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (body.user_id) studentBody.user_id = body.user_id;
    if (body.email) studentBody.email = body.email.trim().toLowerCase();

    if (body.user_id) {
      const existing = await db.collection("students").where("user_id", "==", body.user_id).limit(1).get();
      const existingDoc = existing.docs[0];
      if (existingDoc) {
        await existingDoc.ref.set(studentBody, { merge: true });
        return NextResponse.json({ ok: true, student: { id: existingDoc.id, ...studentBody } });
      }
    }

    const ref = db.collection("students").doc();
    const student = {
      id: ref.id,
      created_at: new Date().toISOString(),
      ...studentBody,
    };
    await ref.set(student);

    return NextResponse.json({ ok: true, student });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
