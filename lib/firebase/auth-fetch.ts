"use client";

import { getFirebaseBrowserAuth } from "@/lib/firebase/browser-client";

export async function firebaseFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getFirebaseBrowserAuth().currentUser?.getIdToken(true);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, {
    ...init,
    headers,
  });
}
