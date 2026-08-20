import type { Firestore, Transaction } from "firebase-admin/firestore";

export const IDENTIFIER_RESERVATIONS_COLLECTION = "identifier_reservations";

export type IdentifierReservationKind = "student_id" | "student_email" | "equipment_barcode";

export type IdentifierReservation = {
  kind: IdentifierReservationKind;
  key: string;
  ownerCollection: "students" | "equipment";
  ownerId: string;
};

export class IdentifierReservationConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentifierReservationConflict";
  }
}

export function normalizeStudentIdKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeSchoolEmailKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeBarcodeKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function reservationId(kind: IdentifierReservationKind, key: string) {
  return `${kind}:${encodeURIComponent(key)}`;
}

function reservationConflictMessage(kind: IdentifierReservationKind) {
  if (kind === "student_id") {
    return "That Student ID is already assigned to another active student.";
  }
  if (kind === "student_email") {
    return "That student email is already assigned to another active student.";
  }
  return "That barcode is already assigned to another active equipment item.";
}

function reservationRef(db: Firestore, reservation: Pick<IdentifierReservation, "kind" | "key">) {
  return db
    .collection(IDENTIFIER_RESERVATIONS_COLLECTION)
    .doc(reservationId(reservation.kind, reservation.key));
}

function reservationKey(reservation: Pick<IdentifierReservation, "kind" | "key">) {
  return `${reservation.kind}:${reservation.key}`;
}

export async function syncIdentifierReservations(
  transaction: Transaction,
  db: Firestore,
  previousReservations: IdentifierReservation[],
  nextReservations: IdentifierReservation[],
  timestamp: string
) {
  const reservationsByKey = new Map<string, IdentifierReservation>();
  [...previousReservations, ...nextReservations].forEach((reservation) => {
    reservationsByKey.set(reservationKey(reservation), reservation);
  });

  const reservations = Array.from(reservationsByKey.values());
  const snapshots = await Promise.all(
    reservations.map((reservation) => transaction.get(reservationRef(db, reservation)))
  );
  const snapshotByKey = new Map(
    reservations.map((reservation, index) => [reservationKey(reservation), snapshots[index]])
  );
  const nextKeys = new Set(nextReservations.map(reservationKey));

  for (const reservation of nextReservations) {
    const snapshot = snapshotByKey.get(reservationKey(reservation));
    const data = snapshot?.exists ? snapshot.data() : null;
    const reservedOwnerId = typeof data?.owner_id === "string" ? data.owner_id : null;
    const reservedOwnerCollection =
      typeof data?.owner_collection === "string" ? data.owner_collection : null;

    if (
      reservedOwnerId
      && (reservedOwnerId !== reservation.ownerId || reservedOwnerCollection !== reservation.ownerCollection)
    ) {
      throw new IdentifierReservationConflict(reservationConflictMessage(reservation.kind));
    }
  }

  for (const reservation of previousReservations) {
    if (nextKeys.has(reservationKey(reservation))) continue;

    const snapshot = snapshotByKey.get(reservationKey(reservation));
    const data = snapshot?.exists ? snapshot.data() : null;
    if (data?.owner_id === reservation.ownerId && data?.owner_collection === reservation.ownerCollection) {
      transaction.delete(reservationRef(db, reservation));
    }
  }

  for (const reservation of nextReservations) {
    transaction.set(reservationRef(db, reservation), {
      id: reservationId(reservation.kind, reservation.key),
      kind: reservation.kind,
      key: reservation.key,
      owner_collection: reservation.ownerCollection,
      owner_id: reservation.ownerId,
      updated_at: timestamp,
    });
  }
}
