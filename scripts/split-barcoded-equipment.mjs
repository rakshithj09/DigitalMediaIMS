import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";

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

function parseBarcodes(value) {
  const seen = new Set();
  return String(value ?? "")
    .split(/[\n,]+/)
    .map((barcode) => barcode.trim())
    .filter(Boolean)
    .filter((barcode) => {
      const key = barcode.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function slugify(value) {
  return String(value ?? "ITEM")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42)
    || "ITEM";
}

function barcodeFor(name, index) {
  return `IGNITE-${slugify(name)}-${String(index).padStart(3, "0")}`;
}

function rowCreatedAt(row) {
  const value = row.created_at;
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return typeof value === "string" && value ? value : new Date(0).toISOString();
}

function sortEquipmentRows(a, b) {
  const byName = String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" });
  if (byName) return byName;
  const byCategory = String(a.category ?? "").localeCompare(String(b.category ?? ""), undefined, { sensitivity: "base" });
  if (byCategory) return byCategory;
  const byCreated = rowCreatedAt(a).localeCompare(rowCreatedAt(b));
  if (byCreated) return byCreated;
  return String(a.id).localeCompare(String(b.id));
}

function buildMigrationPlan(rows) {
  const barcodeRows = rows
    .filter((row) => row.is_active === true && BARCODE_CATEGORIES.has(row.category))
    .sort(sortEquipmentRows);
  const counters = new Map();
  const updates = [];
  const creates = [];

  for (const row of barcodeRows) {
    const quantity = Math.max(1, Number.parseInt(String(row.total_quantity ?? 1), 10) || 1);
    const existingBarcodes = parseBarcodes(row.serial_number);
    const baseKey = `${row.name}::${row.category}`.toLowerCase();
    let nextIndex = counters.get(baseKey) ?? 1;

    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      const barcode = barcodeFor(row.name, nextIndex);
      nextIndex += 1;

      const common = {
        name: row.name,
        category: row.category,
        total_quantity: 1,
        serial_number: barcode,
        condition_notes: row.condition_notes ?? null,
        is_active: true,
        created_at: row.created_at ?? new Date().toISOString(),
        barcode_source_equipment_id: row.id,
        barcode_source_label: existingBarcodes[unitIndex] ?? null,
        barcode_unit_index: nextIndex - 1,
      };

      if (unitIndex === 0) {
        updates.push({
          id: row.id,
          before: {
            total_quantity: row.total_quantity,
            serial_number: row.serial_number ?? null,
          },
          data: common,
        });
      } else {
        creates.push({
          sourceId: row.id,
          data: common,
        });
      }
    }

    counters.set(baseKey, nextIndex);
  }

  return { updates, creates };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  await loadEnvFile();

  if (!getApps().length) {
    initializeApp({
      credential: firebaseCredential(),
      projectId: requiredEnv("FIREBASE_PROJECT_ID"),
    });
  }

  const db = getFirestore();
  const equipmentSnap = await db.collection("equipment").where("is_active", "==", true).get();
  const rows = equipmentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const plan = buildMigrationPlan(rows);
  const groupedIds = new Set(plan.updates.filter((item) => Number(item.before.total_quantity ?? 1) > 1).map((item) => item.id));

  if (groupedIds.size > 0) {
    const activeCheckoutsSnap = await db.collection("checkouts").where("checked_in_at", "==", null).get();
    const blockingCheckouts = activeCheckoutsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((row) => groupedIds.has(row.equipment_id));

    if (blockingCheckouts.length > 0) {
      console.error(JSON.stringify({
        error: "Cannot split grouped barcode equipment while it has active checkouts.",
        activeCheckoutCount: blockingCheckouts.length,
        activeCheckouts: blockingCheckouts.map((row) => ({
          id: row.id,
          equipment_id: row.equipment_id,
          serial_number: row.serial_number ?? null,
        })),
      }, null, 2));
      process.exit(1);
    }
  }

  const changedUpdates = plan.updates.filter((item) =>
    Number(item.before.total_quantity ?? 1) !== 1 || item.before.serial_number !== item.data.serial_number
  );
  const summary = {
    mode: dryRun ? "dry-run" : "apply",
    activeBarcodeEquipmentRows: plan.updates.length,
    updates: changedUpdates.length,
    creates: plan.creates.length,
    finalBarcodeEquipmentRows: plan.updates.length + plan.creates.length,
    groupedRowsSplit: groupedIds.size,
    sample: [
      ...changedUpdates.slice(0, 8).map((item) => ({
        action: "update",
        id: item.id,
        name: item.data.name,
        from: item.before,
        to: {
          total_quantity: item.data.total_quantity,
          serial_number: item.data.serial_number,
        },
      })),
      ...plan.creates.slice(0, 8).map((item) => ({
        action: "create",
        sourceId: item.sourceId,
        name: item.data.name,
        total_quantity: item.data.total_quantity,
        serial_number: item.data.serial_number,
      })),
    ],
  };

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log("Dry run only. Re-run with --apply to write these changes.");
    return;
  }

  const batchSize = 400;
  const operations = [
    ...changedUpdates.map((item) => ({ kind: "update", item })),
    ...plan.creates.map((item) => ({ kind: "create", item })),
  ];

  for (let index = 0; index < operations.length; index += batchSize) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + batchSize)) {
      if (operation.kind === "update") {
        const ref = db.collection("equipment").doc(operation.item.id);
        batch.set(ref, {
          ...operation.item.data,
          barcode_migrated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        const ref = db.collection("equipment").doc();
        batch.set(ref, {
          ...operation.item.data,
          id: ref.id,
          barcode_migrated_at: FieldValue.serverTimestamp(),
        });
      }
    }
    await batch.commit();
  }

  console.log(`Applied ${operations.length} equipment document changes.`);
}

await main();
