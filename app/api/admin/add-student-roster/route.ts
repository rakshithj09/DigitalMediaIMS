import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

type Body = {
  name: string;
  period: string;
  user_id?: string;
  email?: string;
  student_id?: string;
};

async function requireTeacher() {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role !== "Teacher") {
    return { error: "Only teachers can add students to the roster.", status: 403 };
  }

  return { user };
}

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json({ error: teacher.error }, { status: teacher.status });
  }

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
