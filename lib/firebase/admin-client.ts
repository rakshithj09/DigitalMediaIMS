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
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? process.env.GCLOUD_PROJECT?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const credential = clientEmail && privateKey
    ? cert({
        projectId: projectId ?? requiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      })
    : applicationDefault();

  return getApps()[0] ?? initializeApp({
    credential,
    projectId: projectId ?? requiredEnv("FIREBASE_PROJECT_ID"),
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
