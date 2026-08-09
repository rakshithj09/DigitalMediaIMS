import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createStudentApprovalRequest } from "@/lib/auth/student-approvals";

type Body = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: "Teacher" | "Student";
  period?: "AM" | "PM";
  studentId?: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function authUserExists(email: string) {
  try {
    await getFirebaseAdminAuth().getUserByEmail(email);
    return true;
  } catch {
    return false;
  }
}

async function getTeacherApproval(email: string) {
  const doc = await getFirebaseAdminDb().collection("approved_teachers").doc(email).get();
  return doc.exists ? doc.data() as { email: string; used_at?: string | null } : null;
}

async function markTeacherApprovalUsed(email: string, userId: string) {
  await getFirebaseAdminDb().collection("approved_teachers").doc(email).set({
    email,
    approved_user_id: userId,
    used_at: new Date().toISOString(),
  }, { merge: true });
}

async function syncTeacherProfile(userId: string, email: string, firstName: string, lastName: string) {
  await getFirebaseAdminDb().collection("profiles").doc(userId).set({
    id: userId,
    email,
    first_name: firstName,
    last_name: lastName,
    role: "staff",
    is_staff: true,
    created_at: new Date().toISOString(),
  }, { merge: true });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const email = cleanString(body.email).toLowerCase();
  const password = cleanString(body.password);
  const firstName = cleanString(body.firstName);
  const lastName = cleanString(body.lastName);
  const role = body.role;
  const period = body.period;
  const studentId = cleanString(body.studentId);

  if (!email || !password || !firstName || !lastName || !role) {
    return NextResponse.json({ error: "Email, password, name, and role are required." }, { status: 400 });
  }

  if (!email.endsWith("@bentonvillek12.org")) {
    return NextResponse.json({ error: "Email must be a @bentonvillek12.org address." }, { status: 400 });
  }

  if (role === "Student" && period !== "AM" && period !== "PM") {
    return NextResponse.json({ error: "Students must select AM or PM period." }, { status: 400 });
  }

  if (role === "Student" && !studentId) {
    return NextResponse.json({ error: "Student ID is required for student accounts." }, { status: 400 });
  }

  if (studentId.length > 20) {
    return NextResponse.json({ error: "Student ID must be 20 characters or fewer." }, { status: 400 });
  }

  try {
    if (await authUserExists(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 },
      );
    }

    if (role === "Teacher") {
      const approval = await getTeacherApproval(email);
      if (!approval) {
        return NextResponse.json({
          error: "This teacher email has not been approved yet. Ask an existing teacher to approve it first.",
        }, { status: 403 });
      }
      if (approval.used_at) {
        return NextResponse.json({ error: "This teacher approval has already been used." }, { status: 403 });
      }
    }

    const claims: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      role,
    };
    if (role === "Student" && period) claims.period = period;
    if (role === "Student" && studentId) claims.student_id = studentId;

    const user = await getFirebaseAdminAuth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: false,
    });
    await getFirebaseAdminAuth().setCustomUserClaims(user.uid, claims);

    try {
      if (role === "Student") {
        await createStudentApprovalRequest({
          id: user.uid,
          uid: user.uid,
          email,
          emailVerified: false,
          confirmed_at: null,
          email_confirmed_at: null,
          user_metadata: claims,
        } as never);
      } else {
        await markTeacherApprovalUsed(email, user.uid);
        await syncTeacherProfile(user.uid, email, firstName, lastName);
      }
    } catch (writeError) {
      await getFirebaseAdminAuth().deleteUser(user.uid);
      throw writeError;
    }

    return NextResponse.json({ ok: true, requiresEmailConfirmation: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
