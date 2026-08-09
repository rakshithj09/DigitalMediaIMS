import { NextResponse } from "next/server";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";
import { verifyFirebasePassword } from "@/lib/firebase/server-password";

type Body = {
  email?: string;
  teacherPassword?: string;
};

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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
    return { error: "Only teachers can approve teacher accounts.", status: 403 };
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

  const body = (await req.json().catch(() => ({}))) as Body;
  const email = cleanEmail(body.email);

  const passwordError = await verifyTeacherPassword(auth.user.email ?? undefined, body.teacherPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 403 });
  }

  if (!email) {
    return NextResponse.json({ error: "Teacher email is required." }, { status: 400 });
  }

  if (!email.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Teacher email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  const { error } = await admin
    .from("approved_teachers")
    .upsert(
      {
        email,
        invited_by: auth.user.id,
        used_at: null,
        approved_user_id: null,
      },
      { onConflict: "email" },
    );

  if (error) {
    const message = error.code === "42P01"
      ? "Firestore collection missing: approved_teachers."
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email });
}
