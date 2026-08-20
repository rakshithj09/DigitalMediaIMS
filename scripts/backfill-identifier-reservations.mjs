import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";

const IDENTIFIER_RESERVATIONS_COLLECTION = "identifier_reservations";
const BARCODE_CATEGORIES = new Set([
  "Camera Kit",
  "Camera",
  "Lens",
  "Cinema Camera",
  "Technology",
  "Lighting",
  "Stabilization",
]);

async function loadEnvFile(path = ".env.local") {
  try {
    const text = await readFile(path, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function firebaseCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return applicationDefault();

  return cert({
    projectId: requiredEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  });
}

function normalizeKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function reservationId(kind, key) {
  return `${kind}:${encodeURIComponent(key)}`;
}

function parseSerialNumbers(value) {
  const seen = new Set();
  return String(value ?? "")
    .split(/[\n,]+/)
    .map((serial) => serial.trim())
    .filter(Boolean)
    .filter((serial) => {
      const key = normalizeKey(serial);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function addUniqueReservation(reservations, reservation) {
  const id = reservationId(reservation.kind, reservation.key);
  if (!reservations.has(id)) {
    reservations.set(id, {
      id,
      ...reservation,
    });
  }
}

function trackDuplicate(ownersByKey, kind, key, owner) {
  if (!key) return;
  const mapKey = `${kind}:${key}`;
  const owners = ownersByKey.get(mapKey) ?? [];
  owners.push(owner);
  ownersByKey.set(mapKey, owners);
}

function duplicateEntries(ownersByKey) {
  return Array.from(ownersByKey.entries())
    .filter(([, owners]) => owners.length > 1)
    .map(([key, owners]) => ({ key, owners }));
}

async function buildStudentPlan(db) {
  const snap = await db.collection("students").where("is_active", "==", true).get();
  const updates = [];
  const reservations = new Map();
  const ownersByKey = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    const studentIdKey = normalizeKey(data.student_id);
    const emailKey = normalizeKey(data.email);

    if (!studentIdKey) {
      throw new Error(`Active student ${doc.id} is missing a usable student_id.`);
    }

    trackDuplicate(ownersByKey, "student_id", studentIdKey, { collection: "students", id: doc.id });
    if (emailKey) {
      trackDuplicate(ownersByKey, "student_email", emailKey, { collection: "students", id: doc.id });
    }

    const update = {};
    if (data.student_id_key !== studentIdKey) update.student_id_key = studentIdKey;
    if ((data.email_key ?? null) !== (emailKey || null)) update.email_key = emailKey || null;
    if (Object.keys(update).length > 0) updates.push({ ref: doc.ref, id: doc.id, update });

    addUniqueReservation(reservations, {
      kind: "student_id",
      key: studentIdKey,
      owner_collection: "students",
      owner_id: doc.id,
    });
    if (emailKey) {
      addUniqueReservation(reservations, {
        kind: "student_email",
        key: emailKey,
        owner_collection: "students",
        owner_id: doc.id,
      });
    }
  }

  return { updates, reservations, duplicates: duplicateEntries(ownersByKey) };
}

async function buildEquipmentPlan(db) {
  const snap = await db.collection("equipment").where("is_active", "==", true).get();
  const updates = [];
  const reservations = new Map();
  const ownersByKey = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!BARCODE_CATEGORIES.has(data.category)) continue;

    const serials = parseSerialNumbers(data.serial_number);
    if (serials.length !== 1) {
      throw new Error(`Active barcode-tracked equipment ${doc.id} must have exactly one barcode.`);
    }

    const barcodeKey = normalizeKey(serials[0]);
    trackDuplicate(ownersByKey, "equipment_barcode", barcodeKey, { collection: "equipment", id: doc.id });

    if (data.barcode_key !== barcodeKey) {
      updates.push({ ref: doc.ref, id: doc.id, update: { barcode_key: barcodeKey } });
    }

    addUniqueReservation(reservations, {
      kind: "equipment_barcode",
      key: barcodeKey,
      owner_collection: "equipment",
      owner_id: doc.id,
    });
  }

  return { updates, reservations, duplicates: duplicateEntries(ownersByKey) };
}

async function existingReservationConflicts(db, reservations) {
  const conflicts = [];
  const snaps = await Promise.all(
    Array.from(reservations.values()).map((reservation) =>
      db.collection(IDENTIFIER_RESERVATIONS_COLLECTION).doc(reservation.id).get()
    )
  );

  Array.from(reservations.values()).forEach((reservation, index) => {
    const snap = snaps[index];
    if (!snap.exists) return;
    const data = snap.data();
    if (
      data?.owner_id !== reservation.owner_id
      || data?.owner_collection !== reservation.owner_collection
    ) {
      conflicts.push({
        id: reservation.id,
        expectedOwner: `${reservation.owner_collection}/${reservation.owner_id}`,
        actualOwner: `${data?.owner_collection ?? "unknown"}/${data?.owner_id ?? "unknown"}`,
      });
    }
  });

  return conflicts;
}

async function commitBatches(db, operations) {
  const batchSize = 400;
  for (let index = 0; index < operations.length; index += batchSize) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + batchSize)) {
      if (operation.kind === "update") {
        batch.set(operation.ref, {
          ...operation.update,
          identifiers_backfilled_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        batch.set(operation.ref, {
          ...operation.data,
          updated_at: new Date().toISOString(),
        }, { merge: true });
      }
    }
    await batch.commit();
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  await loadEnvFile();

  if (!getApps().length) {
    initializeApp({
      credential: firebaseCredential(),
      projectId: requiredEnv("FIREBASE_PROJECT_ID"),
    });
  }

  const db = getFirestore();
  const [students, equipment] = await Promise.all([
    buildStudentPlan(db),
    buildEquipmentPlan(db),
  ]);
  const reservations = new Map([...students.reservations, ...equipment.reservations]);
  const duplicates = [...students.duplicates, ...equipment.duplicates];
  const reservationConflicts = await existingReservationConflicts(db, reservations);

  const summary = {
    mode: apply ? "apply" : "dry-run",
    studentKeyUpdates: students.updates.length,
    equipmentKeyUpdates: equipment.updates.length,
    reservationUpserts: reservations.size,
    duplicates,
    reservationConflicts,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (duplicates.length > 0 || reservationConflicts.length > 0) {
    console.error("Identifier backfill blocked by duplicate identifiers or conflicting reservations.");
    process.exit(1);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write key fields and reservations.");
    return;
  }

  const operations = [
    ...students.updates.map((item) => ({ kind: "update", ...item })),
    ...equipment.updates.map((item) => ({ kind: "update", ...item })),
    ...Array.from(reservations.values()).map((reservation) => ({
      kind: "reservation",
      ref: db.collection(IDENTIFIER_RESERVATIONS_COLLECTION).doc(reservation.id),
      data: reservation,
    })),
  ];

  await commitBatches(db, operations);
  console.log(`Applied ${operations.length} identifier backfill operations.`);
}

await main();
