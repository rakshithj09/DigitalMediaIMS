import type { AppUser as User } from "@/lib/firebase/types";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
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

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function ensureVerifiedStudentRosterRow(user: User) {
  const metadata = user.user_metadata ?? {};
  if (metadata.role !== "Student") return { skipped: "not_student" as const };

  const confirmedAt = user.email_confirmed_at ?? user.confirmed_at;
  if (!confirmedAt) return { skipped: "unverified" as const };

  const email = clean(user.email).toLowerCase();
  const firstName = clean(metadata.first_name);
  const lastName = clean(metadata.last_name);
  const period = clean(metadata.period);
  const studentId = clean(metadata.student_id);

  if (!email || !firstName || !lastName || !getStudentIdKey(studentId) || (period !== "AM" && period !== "PM")) {
    throw new Error("Verified student account is missing required roster metadata.");
  }

  if (!email.endsWith("@bentonvillek12.org")) {
    throw new Error("Student email must be a @bentonvillek12.org address.");
  }

  const db = getFirebaseAdminDb();

  const existingSnap = await db.collection("students").where("user_id", "==", user.id).limit(1).get();
  const existingDoc = existingSnap.docs[0] ?? null;
  const ref = existingDoc?.ref ?? db.collection("students").doc();
  const previousData = existingDoc?.data() ?? null;
  const finalState = {
    id: ref.id,
    studentId,
    email,
    isActive: true,
  };
  const validationError = validateActiveStudentIdentifiers(finalState);
  if (validationError) throw new Error(validationError);

  const conflict = await findActiveStudentIdentifierConflict(db, finalState);
  if (conflict) throw new IdentifierReservationConflict(conflict);

  const previousState = {
    id: ref.id,
    studentId: typeof previousData?.student_id === "string" ? previousData.student_id : null,
    email: typeof previousData?.email === "string" ? previousData.email : null,
    isActive: previousData?.is_active === true,
  };

  const now = new Date().toISOString();
  const studentBody = {
    id: ref.id,
    name: `${firstName} ${lastName}`,
    period,
    student_id: studentId,
    student_id_key: getStudentIdKey(studentId),
    email,
    email_key: getStudentEmailKey(email),
    user_id: user.id,
    is_active: true,
    created_at: previousData?.created_at ?? now,
  };

  await db.runTransaction(async (transaction) => {
    await syncIdentifierReservations(
      transaction,
      db,
      studentReservations(previousState),
      studentReservations(finalState),
      now
    );
    transaction.set(ref, studentBody, { merge: Boolean(existingDoc) });
  });

  if (existingDoc) {
    return { ok: true as const, action: "updated" as const };
  }

  return { ok: true as const, action: "inserted" as const };
}
