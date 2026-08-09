import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";

const COLLECTIONS = [
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

await loadEnvFile();

if (!getApps().length) {
  initializeApp({
    credential: firebaseCredential(),
    projectId: requiredEnv("FIREBASE_PROJECT_ID"),
  });
}

const db = getFirestore();
const counts = {};

for (const collection of COLLECTIONS) {
  const snapshot = await db.collection(collection).count().get();
  counts[collection] = snapshot.data().count;
}

console.log(JSON.stringify(counts, null, 2));
