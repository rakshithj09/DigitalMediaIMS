import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing Firebase Admin environment variable: ${name}`);
  }
  return value;
}

export function getFirebaseAdminApp() {
  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
    ? applicationDefault()
    : cert({
        projectId: requiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      });

  return getApps()[0] ?? initializeApp({
    credential,
    projectId: requiredEnv("FIREBASE_PROJECT_ID"),
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
