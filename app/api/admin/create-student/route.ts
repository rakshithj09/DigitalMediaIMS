import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

type StudentConflictCheck = {
  studentId: string;
  email: string;
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
    return { error: "Only teachers can create student accounts.", status: 403 };
  }

  return { user };
}

async function findActiveStudentConflict(
  db: ReturnType<typeof getFirebaseAdminDb>,
  { studentId, email }: StudentConflictCheck
) {
  const checks: Array<{ field: "student_id" | "email"; value: string; message: string }> = [
    {
      field: "student_id",
      value: studentId,
      message: "That Student ID is already assigned to another active student.",
    },
    {
      field: "email",
      value: email,
      message: "That student email is already assigned to another active student.",
    },
  ];

  for (const check of checks) {
    const snap = await db
      .collection("students")
      .where(check.field, "==", check.value)
      .where("is_active", "==", true)
      .limit(1)
      .get();

    if (snap.docs.length > 0) return check.message;
  }

  return null;
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

  if (!normalizedEmail.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Student email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  try {
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminDb();
    const conflict = await findActiveStudentConflict(db, {
      studentId: normalizedStudentId,
      email: normalizedEmail,
    });
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

    const ref = db.collection("students").doc();
    const student = {
      id: ref.id,
      name: `${first_name} ${last_name}`,
      student_id: normalizedStudentId,
      period,
      email: normalizedEmail,
      user_id: user.uid,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    await ref.set(student);

    return NextResponse.json({ user, student });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
