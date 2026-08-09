"use client";

import { useEffect } from "react";

const RECOVERY_KEY = "ignite:chunk-load-recovered";
const RECOVERY_WINDOW_MS = 60_000;

function isChunkLoadFailure(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return /failed to load chunk|loading chunk|chunkloaderror|_next\/static\/chunks/i.test(message);
}

function recoverFromStaleChunk(reason: unknown) {
  if (!isChunkLoadFailure(reason)) return;
  const lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY) ?? 0);
  if (lastRecovery && Date.now() - lastRecovery < RECOVERY_WINDOW_MS) return;

  sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  window.location.reload();
}

export default function ChunkLoadRecovery() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => recoverFromStaleChunk(event.error ?? event.message);
    const handleRejection = (event: PromiseRejectionEvent) => recoverFromStaleChunk(event.reason);

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
