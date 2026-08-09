import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing Firebase environment variable: ${name}`);
  }
  return value;
}

function getFirebaseConfig() {
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();

  return {
    apiKey: requiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requiredEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requiredEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requiredEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requiredEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
    ...(measurementId ? { measurementId } : {}),
  };
}

export function getFirebaseBrowserApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(getFirebaseConfig());
}

export function getFirebaseBrowserAuth() {
  return getAuth(getFirebaseBrowserApp());
}

export function getFirebaseBrowserDb() {
  return getFirestore(getFirebaseBrowserApp());
}
