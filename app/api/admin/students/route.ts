import { NextResponse } from "next/server";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { verifyFirebasePassword } from "@/lib/firebase/server-password";
import { Period } from "@/app/lib/types";
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

type UpdateBody = {
  id?: string;
  name?: string;
  studentId?: string | null;
  email?: string | null;
  period?: Period;
  isActive?: boolean;
  userId?: string | null;
};

type DeleteBody = {
  id?: string;
  teacherPassword?: string;
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
    return { error: "Only teachers can manage students.", status: 403 };
  }

  return { user };
}

async function verifyTeacherPassword(email: string | undefined, password: string | undefined) {
  if (!email || !password?.trim()) {
    return "Teacher password is required.";
  }

  return verifyFirebasePassword(email, password);
}

export async function PATCH(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getFirebaseAdminDataClient();
  const db = getFirebaseAdminDb();

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  if (!body.id) {
    return NextResponse.json({ error: "Student id is required." }, { status: 400 });
  }
  const studentRecordId = body.id;

  const studentRef = db.collection("students").doc(studentRecordId);
  const currentSnapshot = await studentRef.get();
  if (!currentSnapshot.exists) {
    return NextResponse.json({ error: "Student was not found." }, { status: 404 });
  }
  const currentStudent = currentSnapshot.data() ?? {};

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim().replace(/\s+/g, " ");
    if (!name) {
      return NextResponse.json({ error: "Student name is required." }, { status: 400 });
    }
    update.name = name;
  }

  if (body.studentId !== undefined) {
    const studentId = body.studentId?.trim();
    if (!getStudentIdKey(studentId)) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }
    update.student_id = studentId;
  }

  if (body.email !== undefined) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.endsWith("@bentonvillek12.org")) {
      return NextResponse.json({ error: "Student email must be a @bentonvillek12.org address." }, { status: 400 });
    }
    update.email = email;
  }

  if (body.period !== undefined) {
    if (body.period !== "AM" && body.period !== "PM") {
      return NextResponse.json({ error: "Period must be AM or PM." }, { status: 400 });
    }
    update.period = body.period;
  }

  if (typeof body.isActive === "boolean") {
    update.is_active = body.isActive;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No student changes were provided." }, { status: 400 });
  }

  const finalName = typeof update.name === "string" ? update.name : String(currentStudent.name ?? "");
  const finalStudentId =
    typeof update.student_id === "string"
      ? update.student_id
      : (typeof currentStudent.student_id === "string" ? currentStudent.student_id : null);
  const finalEmail =
    typeof update.email === "string"
      ? update.email
      : (typeof currentStudent.email === "string" ? currentStudent.email : null);
  const finalPeriod = typeof update.period === "string" ? update.period : currentStudent.period;
  const finalIsActive =
    typeof update.is_active === "boolean" ? update.is_active : currentStudent.is_active !== false;
  const previousState = {
    id: studentRecordId,
    studentId: typeof currentStudent.student_id === "string" ? currentStudent.student_id : null,
    email: typeof currentStudent.email === "string" ? currentStudent.email : null,
    isActive: currentStudent.is_active === true,
  };
  const finalState = {
    id: studentRecordId,
    studentId: finalStudentId,
    email: finalEmail,
    isActive: finalIsActive,
  };
  const validationError = validateActiveStudentIdentifiers(finalState);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (finalIsActive && finalPeriod !== "AM" && finalPeriod !== "PM") {
    return NextResponse.json({ error: "Period must be AM or PM." }, { status: 400 });
  }

  const conflict = await findActiveStudentIdentifierConflict(db, finalState);
  if (conflict) {
    return NextResponse.json({ error: conflict }, { status: 409 });
  }

  const now = new Date().toISOString();
  update.student_id_key = getStudentIdKey(finalStudentId);
  update.email_key = getStudentEmailKey(finalEmail) || null;

  try {
    await db.runTransaction(async (transaction) => {
      await syncIdentifierReservations(
        transaction,
        db,
        studentReservations(previousState),
        studentReservations(finalState),
        now
      );
      transaction.set(studentRef, update, { merge: true });
    });
  } catch (error) {
    if (error instanceof IdentifierReservationConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const student = {
    id: studentRecordId,
    ...currentStudent,
    ...update,
    name: finalName,
    student_id: finalStudentId,
    email: finalEmail,
    period: finalPeriod,
    is_active: finalIsActive,
    user_id: typeof currentStudent.user_id === "string" ? currentStudent.user_id : null,
  };

  const userId = body.userId ?? student.user_id;
  if (userId) {
    const name = String(student.name ?? "").trim();
    const [firstName = "", ...lastParts] = name.split(/\s+/);
    const lastName = lastParts.join(" ");
    const metadata: Record<string, unknown> = {
      role: "Student",
      period: student.period,
      first_name: firstName,
      last_name: lastName,
      student_id: student.student_id,
    };

    const authUpdate: { user_metadata: Record<string, unknown>; email?: string } = { user_metadata: metadata };
    if (update.email) authUpdate.email = String(update.email);

    const { error: authError } = await admin.auth.admin.updateUserById(userId, authUpdate);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, student });
}

export async function DELETE(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getFirebaseAdminDataClient();
  const db = getFirebaseAdminDb();

  const body = (await req.json().catch(() => ({}))) as DeleteBody;
  if (!body.id) {
    return NextResponse.json({ error: "Student id is required." }, { status: 400 });
  }
  const studentRecordId = body.id;

  const passwordError = await verifyTeacherPassword(auth.user.email ?? undefined, body.teacherPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 403 });
  }

  const { data: activeCheckouts, error: checkoutLookupError } = await admin
    .from("checkouts")
    .select("id")
    .eq("student_id", studentRecordId)
    .eq("checked_in_at", null)
    .limit(1);

  if (checkoutLookupError) {
    return NextResponse.json({ error: checkoutLookupError.message }, { status: 400 });
  }

  if ((activeCheckouts ?? []).length > 0) {
    return NextResponse.json({
      error: "This student still has active checkouts. Check in all equipment before deleting the student.",
    }, { status: 409 });
  }

  const { data: student, error: lookupError } = await admin
    .from("students")
    .select("id, user_id, email, student_id, is_active")
    .eq("id", studentRecordId)
    .single();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 400 });
  }
  const previousState = {
    id: studentRecordId,
    studentId: typeof student?.student_id === "string" ? student.student_id : null,
    email: typeof student?.email === "string" ? student.email : null,
    isActive: student?.is_active === true,
  };

  if (student?.user_id) {
    const { error: profileByIdError } = await admin
      .from("profiles")
      .delete()
      .eq("id", student.user_id);

    if (profileByIdError && profileByIdError.code !== "42P01") {
      return NextResponse.json({ error: profileByIdError.message }, { status: 400 });
    }
  }

  if (student?.email) {
    const { error: profileByEmailError } = await admin
      .from("profiles")
      .delete()
      .eq("email", student.email);

    if (profileByEmailError && profileByEmailError.code !== "42P01") {
      return NextResponse.json({ error: profileByEmailError.message }, { status: 400 });
    }
  }

  try {
    await db.runTransaction(async (transaction) => {
      await syncIdentifierReservations(transaction, db, studentReservations(previousState), [], new Date().toISOString());
      transaction.delete(db.collection("students").doc(studentRecordId));
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const studentAuthUserId = typeof student?.user_id === "string" ? student.user_id : null;
  if (studentAuthUserId) {
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(studentAuthUserId, false);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
