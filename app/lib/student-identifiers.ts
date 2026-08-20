import type { Firestore, QuerySnapshot } from "firebase-admin/firestore";
import {
  IDENTIFIER_RESERVATIONS_COLLECTION,
  IdentifierReservation,
  normalizeSchoolEmailKey,
  normalizeStudentIdKey,
  reservationId,
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

  const reservationChecks = [
    studentIdKey ? { kind: "student_id" as const, key: studentIdKey } : null,
    emailKey ? { kind: "student_email" as const, key: emailKey } : null,
  ].filter((check): check is { kind: "student_id" | "student_email"; key: string } => Boolean(check));

  const reservationSnapshots = await Promise.all(
    reservationChecks.map((check) =>
      db.collection(IDENTIFIER_RESERVATIONS_COLLECTION).doc(reservationId(check.kind, check.key)).get()
    )
  );

  for (let index = 0; index < reservationChecks.length; index += 1) {
    const check = reservationChecks[index];
    const data = reservationSnapshots[index].exists ? reservationSnapshots[index].data() : null;
    const ownerId = typeof data?.owner_id === "string" ? data.owner_id : null;
    const ownerCollection = typeof data?.owner_collection === "string" ? data.owner_collection : null;

    if (ownerId && (ownerId !== state.id || ownerCollection !== "students")) {
      return check.kind === "student_id"
        ? "That Student ID is already assigned to another active student."
        : "That student email is already assigned to another active student.";
    }
  }

  const fallbackQueries = [
    studentIdKey
      ? {
          kind: "student_id" as const,
          query: db.collection("students")
            .where("is_active", "==", true)
            .where("student_id_key", "==", studentIdKey)
            .limit(2)
            .get(),
        }
      : null,
    emailKey
      ? {
          kind: "student_email" as const,
          query: db.collection("students")
            .where("is_active", "==", true)
            .where("email_key", "==", emailKey)
            .limit(2)
            .get(),
        }
      : null,
  ].filter((check): check is {
    kind: "student_id" | "student_email";
    query: Promise<QuerySnapshot>;
  } => Boolean(check));

  const fallbackSnapshots = await Promise.all(fallbackQueries.map((check) => check.query));

  for (let index = 0; index < fallbackQueries.length; index += 1) {
    const check = fallbackQueries[index];
    const hasOtherOwner = fallbackSnapshots[index].docs.some((doc) => doc.id !== state.id);

    if (hasOtherOwner) {
      return check.kind === "student_id"
        ? "That Student ID is already assigned to another active student."
        : "That student email is already assigned to another active student.";
    }
  }

  return null;
}
