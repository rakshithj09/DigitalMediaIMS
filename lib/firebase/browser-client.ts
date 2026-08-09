import { FirebaseApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function getFirebaseConfig(): FirebaseOptions | undefined {
  const apiKey = envValue("NEXT_PUBLIC_FIREBASE_API_KEY");
  const authDomain = envValue("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  const projectId = envValue("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const storageBucket = envValue("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = envValue("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  const appId = envValue("NEXT_PUBLIC_FIREBASE_APP_ID");
  const measurementId = envValue("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID");

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return undefined;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(measurementId ? { measurementId } : {}),
  };
}

export function getFirebaseBrowserApp(): FirebaseApp {
  const config = getFirebaseConfig();
  return getApps()[0] ?? (config ? initializeApp(config) : initializeApp());
}

export function getFirebaseBrowserAuth() {
  return getAuth(getFirebaseBrowserApp());
}

export function getFirebaseBrowserDb() {
  return getFirestore(getFirebaseBrowserApp());
}
