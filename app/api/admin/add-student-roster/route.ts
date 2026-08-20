import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import {
  IdentifierReservationConflict,
  syncIdentifierReservations,
} from "@/app/lib/identifier-keys";
import {
  findActiveStudentIdentifierConflict,
  getStudentEmailKey,
  getStudentIdKey,
  studentReservations,
  validateActiveStudentIdentifiers,
} from "@/app/lib/student-identifiers";

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
    const studentId = body.student_id?.trim() ?? "";
    const normalizedEmail = body.email?.trim().toLowerCase() || null;

    if (!name || !period) {
      return NextResponse.json({ error: "name and period are required" }, { status: 400 });
    }

    if (period !== "AM" && period !== "PM") {
      return NextResponse.json({ error: "period must be AM or PM" }, { status: 400 });
    }

    if (!getStudentIdKey(studentId)) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
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

    const ref = existingDoc?.ref ?? db.collection("students").doc();
    const studentIdKey = getStudentIdKey(studentId);
    const emailKey = getStudentEmailKey(normalizedEmail);
    const finalState = {
      id: ref.id,
      studentId,
      email: normalizedEmail,
      isActive: true,
    };
    const validationError = validateActiveStudentIdentifiers(finalState);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const conflict = await findActiveStudentIdentifierConflict(db, finalState);
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }

    const previousData = existingDoc?.data() ?? null;
    const previousState = {
      id: ref.id,
      studentId: typeof previousData?.student_id === "string" ? previousData.student_id : null,
      email: typeof previousData?.email === "string" ? previousData.email : null,
      isActive: previousData?.is_active === true,
    };
    const now = new Date().toISOString();
    const studentBody: Record<string, unknown> = {
      name,
      period,
      student_id: studentId,
      student_id_key: studentIdKey,
      email_key: emailKey || null,
      is_active: true,
      updated_at: now,
    };
    if (body.user_id) studentBody.user_id = body.user_id;
    if (normalizedEmail) studentBody.email = normalizedEmail;

    const student = {
      id: ref.id,
      created_at: previousData?.created_at ?? now,
      ...studentBody,
    };

    try {
      await db.runTransaction(async (transaction) => {
        await syncIdentifierReservations(
          transaction,
          db,
          studentReservations(previousState),
          studentReservations(finalState),
          now
        );
        transaction.set(ref, student, { merge: Boolean(existingDoc) });
      });
    } catch (error) {
      if (error instanceof IdentifierReservationConflict) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, student });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
