import type { Firestore } from "firebase-admin/firestore";
import {
  IdentifierReservation,
  normalizeSchoolEmailKey,
  normalizeStudentIdKey,
} from "@/app/lib/identifier-keys";

type StudentIdentifierState = {
  id: string;
  studentId: string | null | undefined;
  email: string | null | undefined;
  isActive: boolean;
};

export function getStudentIdKey(studentId: unknown) {
  return normalizeStudentIdKey(studentId);
}

export function getStudentEmailKey(email: unknown) {
  return normalizeSchoolEmailKey(email);
}

export function validateActiveStudentIdentifiers(state: StudentIdentifierState) {
  if (!state.isActive) return null;

  const studentIdKey = getStudentIdKey(state.studentId);
  if (!studentIdKey) {
    return "Student ID is required.";
  }

  const emailKey = getStudentEmailKey(state.email);
  if (state.email && (!emailKey || !emailKey.endsWith("@bentonvillek12.org"))) {
    return "Student email must be a @bentonvillek12.org address.";
  }

  return null;
}

export function studentIdentifierKeys(state: StudentIdentifierState) {
  return {
    studentIdKey: getStudentIdKey(state.studentId),
    emailKey: getStudentEmailKey(state.email),
  };
}

export function studentReservations(state: StudentIdentifierState): IdentifierReservation[] {
  if (!state.isActive) return [];

  const { studentIdKey, emailKey } = studentIdentifierKeys(state);
  const reservations: IdentifierReservation[] = [];

  if (studentIdKey) {
    reservations.push({
      kind: "student_id",
      key: studentIdKey,
      ownerCollection: "students",
      ownerId: state.id,
    });
  }

  if (emailKey) {
    reservations.push({
      kind: "student_email",
      key: emailKey,
      ownerCollection: "students",
      ownerId: state.id,
    });
  }

  return reservations;
}

export async function findActiveStudentIdentifierConflict(
  db: Firestore,
  state: StudentIdentifierState
) {
  if (!state.isActive) return null;

  const { studentIdKey, emailKey } = studentIdentifierKeys(state);
  const snap = await db.collection("students").where("is_active", "==", true).get();

  for (const doc of snap.docs) {
    if (doc.id === state.id) continue;

    const data = doc.data();
    const existingStudentIdKey =
      typeof data.student_id_key === "string" ? data.student_id_key : getStudentIdKey(data.student_id);
    const existingEmailKey =
      typeof data.email_key === "string" ? data.email_key : getStudentEmailKey(data.email);

    if (studentIdKey && existingStudentIdKey === studentIdKey) {
      return "That Student ID is already assigned to another active student.";
    }

    if (emailKey && existingEmailKey === emailKey) {
      return "That student email is already assigned to another active student.";
    }
  }

  return null;
}
