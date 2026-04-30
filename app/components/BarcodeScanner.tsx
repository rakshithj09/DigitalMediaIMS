"use client";

import { useEffect, useRef, useState } from "react";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => void;
  disabled?: boolean;
};

type DetectedBarcode = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (image: ImageBitmapSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export default function BarcodeScanner({ onDetected, disabled = false }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanning = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  useEffect(() => stopScanning, []);

  const scanFrame = async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const barcodes = await detector.detect(video);
      const rawValue = barcodes.find((barcode) => barcode.rawValue?.trim())?.rawValue?.trim();
      if (rawValue) {
        onDetected(rawValue);
        stopScanning();
        return;
      }
    } catch {
      setError("Camera started, but barcode detection failed on this device.");
      stopScanning();
      return;
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanning = async () => {
    setError(null);

    if (typeof window === "undefined" || !window.BarcodeDetector) {
      setError("Camera barcode scanning is not supported in this browser. You can still type or use a USB scanner.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access the camera. You can still type or use a USB scanner.");
      return;
    }

    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      setIsScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setError("Camera access was blocked. Allow camera access, then try again.");
      stopScanning();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={isScanning ? stopScanning : startScanning}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
          style={
            isScanning
              ? { background: "#fee2e2", color: "#b91c1c" }
              : { background: "#e8f0fe", color: "#005a78" }
          }
        >
          {isScanning ? "Stop Camera Scan" : "Scan With Camera"}
        </button>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Works with phone cameras and most USB barcode scanners.
        </p>
      </div>

      {error && (
        <div
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#c2410c" }}
        >
          {error}
        </div>
      )}

      {isScanning && (
        <div
          className="rounded-2xl p-3"
          style={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.35)" }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-xl"
            style={{ maxHeight: 280, objectFit: "cover" }}
          />
          <p className="text-xs mt-2" style={{ color: "#cbd5e1" }}>
            Center the IGNITE barcode inside the frame.
          </p>
        </div>
      )}
    </div>
  );
}
