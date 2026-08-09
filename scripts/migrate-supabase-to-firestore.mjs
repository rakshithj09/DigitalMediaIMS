import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";

const TABLES = [
  "profiles",
  "students",
  "equipment",
  "checkouts",
  "student_approval_requests",
  "approved_teachers",
];

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
  if (value.includes("your-") || value.includes("...")) {
    throw new Error(`Environment variable ${name} still looks like a placeholder.`);
  }
  return value;
}

function firebaseCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return applicationDefault();

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (clientEmail && privateKey) {
    return cert({
      projectId: requiredEnv("FIREBASE_PROJECT_ID"),
      clientEmail,
      privateKey,
    });
  }

  throw new Error(
    "Missing Firebase Admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS, or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
  );
}

function initFirestore() {
  if (!getApps().length) {
    initializeApp({
      credential: firebaseCredential(),
      projectId: requiredEnv("FIREBASE_PROJECT_ID"),
    });
  }

  return getFirestore();
}

function encodeSupabaseFilter(value) {
  return encodeURIComponent(value).replace(/\./g, "%2E");
}

async function fetchTable(table) {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const url = `${supabaseUrl}/rest/v1/${encodeSupabaseFilter(table)}?select=*&offset=${offset}&limit=${pageSize}`;
    const response = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Failed to read ${table}: ${JSON.stringify(data)}`);
    }

    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

function documentIdFor(table, row) {
  if (row.id) return String(row.id);
  if (table === "student_approval_requests" && row.user_id) return String(row.user_id);
  if (table === "approved_teachers" && row.email) return String(row.email).toLowerCase();
  throw new Error(`Cannot choose a Firestore document ID for ${table}: ${JSON.stringify(row)}`);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function convertValue(value) {
  if (Array.isArray(value)) return value.map(convertValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, convertValue(nested)]));
  }
  if (isIsoTimestamp(value)) return Timestamp.fromDate(new Date(value));
  return value;
}

function convertRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, convertValue(value)]));
}

async function writeCollection(db, table, rows) {
  let batch = db.batch();
  let batchSize = 0;
  let written = 0;

  for (const row of rows) {
    const docId = documentIdFor(table, row);
    const ref = db.collection(table).doc(docId);
    batch.set(ref, convertRow(row), { merge: true });
    batchSize += 1;
    written += 1;

    if (batchSize === 450) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) await batch.commit();
  return written;
}

await loadEnvFile();

const dryRun = process.argv.includes("--dry-run");
const db = dryRun ? null : initFirestore();
const summary = {};

for (const table of TABLES) {
  const rows = await fetchTable(table);
  summary[table] = rows.length;
  if (!dryRun) await writeCollection(db, table, rows);
}

console.log(JSON.stringify({ dryRun, migrated: summary }, null, 2));
