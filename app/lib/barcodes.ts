import { normalizeSerialNumber } from "@/app/lib/serials";

export type BarcodeInventoryItem = {
  id: string;
  name: string;
  barcodes: string[];
  availableBarcodes: string[];
};

export type BarcodeMatchResult =
  | { status: "missing" }
  | { status: "not_found"; barcode: string }
  | { status: "duplicate"; barcode: string; matches: BarcodeInventoryItem[] }
  | { status: "unavailable"; barcode: string; match: BarcodeInventoryItem }
  | { status: "available"; barcode: string; match: BarcodeInventoryItem };

export function findEquipmentByBarcode(
  items: BarcodeInventoryItem[],
  rawBarcode: string | null | undefined
): BarcodeMatchResult {
  const barcode = normalizeSerialNumber(rawBarcode);
  if (!barcode) {
    return { status: "missing" };
  }

  const lowerBarcode = barcode.toLowerCase();
  const matches = items.filter((item) =>
    item.barcodes.some((itemBarcode) => itemBarcode.toLowerCase() === lowerBarcode)
  );

  if (matches.length === 0) {
    return { status: "not_found", barcode };
  }

  if (matches.length > 1) {
    return { status: "duplicate", barcode, matches };
  }

  const match = matches[0];
  const matchedBarcode =
    match.barcodes.find((itemBarcode) => itemBarcode.toLowerCase() === lowerBarcode) ?? barcode;
  const isAvailable = match.availableBarcodes.some(
    (itemBarcode) => itemBarcode.toLowerCase() === lowerBarcode
  );

  return isAvailable
    ? { status: "available", barcode: matchedBarcode, match }
    : { status: "unavailable", barcode: matchedBarcode, match };
}
