const SERIALIZED_CATEGORIES = new Set([
  "Camera Kit",
  "Camera",
  "Lens",
  "Cinema Camera",
  "Technology",
  "Lighting",
  "Stabilization",
]);

export function parseSerialNumbers(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  return (value ?? "")
    .split(/[\n,]+/)
    .map((serial) => serial.trim())
    .filter(Boolean)
    .filter((serial) => {
      const key = serial.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeSerialNumber(value: string | null | undefined): string | null {
  const serial = value?.trim();
  return serial ? serial : null;
}

export function categorySupportsSerialNumbers(category: string | null | undefined): boolean {
  return SERIALIZED_CATEGORIES.has(category ?? "");
}
