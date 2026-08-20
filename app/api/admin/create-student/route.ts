import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-client";
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

async function requireTeacher() {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role !== "Teacher") {
    return { error: "Only teachers can create student accounts.", status: 403 };
  }

  return { user };
}

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json({ error: teacher.error }, { status: teacher.status });
  }

  const body = await req.json().catch(() => ({}));
  const { first_name, last_name, student_id, email, password, period } = body ?? {};

  if (!first_name || !last_name || !student_id || !email || !password) {
    return NextResponse.json({ error: "Missing required fields: first_name, last_name, student_id, email, password" }, { status: 400 });
  }

  if (period !== "AM" && period !== "PM") {
    return NextResponse.json({ error: "period must be AM or PM" }, { status: 400 });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedStudentId = String(student_id).trim();

  if (!getStudentIdKey(normalizedStudentId)) {
    return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
  }

  if (!normalizedEmail.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Student email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  try {
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminDb();
    const ref = db.collection("students").doc();
    const finalState = {
      id: ref.id,
      studentId: normalizedStudentId,
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

    const user = await auth.createUser({
      email: normalizedEmail,
      password,
      emailVerified: true,
      displayName: `${first_name} ${last_name}`,
    });
    await auth.setCustomUserClaims(user.uid, {
      first_name,
      last_name,
      role: "Student",
      period,
      student_id: normalizedStudentId,
    });

    const now = new Date().toISOString();
    const student = {
      id: ref.id,
      name: `${first_name} ${last_name}`,
      student_id: normalizedStudentId,
      student_id_key: getStudentIdKey(normalizedStudentId),
      period,
      email: normalizedEmail,
      email_key: getStudentEmailKey(normalizedEmail),
      user_id: user.uid,
      is_active: true,
      created_at: now,
    };
    try {
      await db.runTransaction(async (transaction) => {
        await syncIdentifierReservations(transaction, db, [], studentReservations(finalState), now);
        transaction.set(ref, student);
      });
    } catch (writeError) {
      await auth.deleteUser(user.uid);
      throw writeError;
    }

    return NextResponse.json({ user, student });
  } catch (err) {
    const status = err instanceof IdentifierReservationConflict ? 409 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
