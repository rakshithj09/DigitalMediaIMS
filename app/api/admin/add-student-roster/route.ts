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

type StudentConflictCheck = {
  studentId?: string | null;
  email?: string | null;
  excludeId?: string | null;
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

async function findActiveStudentConflict(
  db: ReturnType<typeof getFirebaseAdminDb>,
  { studentId, email, excludeId }: StudentConflictCheck
) {
  const checks: Array<{ field: "student_id" | "email"; value: string; message: string }> = [];
  if (studentId) {
    checks.push({
      field: "student_id",
      value: studentId,
      message: "That Student ID is already assigned to another active student.",
    });
  }
  if (email) {
    checks.push({
      field: "email",
      value: email,
      message: "That student email is already assigned to another active student.",
    });
  }

  for (const check of checks) {
    const snap = await db
      .collection("students")
      .where(check.field, "==", check.value)
      .where("is_active", "==", true)
      .get();
    const conflict = snap.docs.find((doc) => doc.id !== excludeId);
    if (conflict) return check.message;
  }

  return null;
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
    const studentId = body.student_id?.trim() || null;
    const normalizedEmail = body.email?.trim().toLowerCase() || null;

    if (!name || !period) {
      return NextResponse.json({ error: "name and period are required" }, { status: 400 });
    }

    if (period !== "AM" && period !== "PM") {
      return NextResponse.json({ error: "period must be AM or PM" }, { status: 400 });
    }

    if (normalizedEmail && !normalizedEmail.endsWith("@bentonvillek12.org")) {
      return NextResponse.json({ error: "Student email must be a @bentonvillek12.org address." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    let existingDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    if (body.user_id) {
      const existing = await db.collection("students").where("user_id", "==", body.user_id).limit(1).get();
      existingDoc = existing.docs[0] ?? null;
    }

    const conflict = await findActiveStudentConflict(db, {
      studentId,
      email: normalizedEmail,
      excludeId: existingDoc?.id ?? null,
    });
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }

    const studentBody: Record<string, unknown> = {
      name,
      period,
      student_id: studentId,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (body.user_id) studentBody.user_id = body.user_id;
    if (normalizedEmail) studentBody.email = normalizedEmail;

    if (existingDoc) {
      await existingDoc.ref.set(studentBody, { merge: true });
      return NextResponse.json({ ok: true, student: { id: existingDoc.id, ...studentBody } });
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
