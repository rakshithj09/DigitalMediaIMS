import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

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

  try {
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminDb();
    const normalizedEmail = String(email).trim().toLowerCase();
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
      student_id,
    });

    const ref = db.collection("students").doc();
    const student = {
      id: ref.id,
      name: `${first_name} ${last_name}`,
      student_id,
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
