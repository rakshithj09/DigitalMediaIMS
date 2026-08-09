import { findEquipmentByBarcode } from "@/app/lib/barcodes";

const CAMERA = {
  id: "eq-camera",
  name: "Canon R50",
  barcodes: ["IGNITE-CAM-001", "IGNITE-CAM-002"],
  availableBarcodes: ["IGNITE-CAM-002"],
};

const MIC = {
  id: "eq-mic",
  name: "Rode Wireless GO",
  barcodes: ["IGNITE-AUDIO-001"],
  availableBarcodes: ["IGNITE-AUDIO-001"],
};

describe("findEquipmentByBarcode", () => {
  it("returns missing for blank input", () => {
    expect(findEquipmentByBarcode([CAMERA], "   ")).toEqual({ status: "missing" });
  });

  it("returns not_found when no item has the barcode", () => {
    expect(findEquipmentByBarcode([CAMERA], "IGNITE-UNKNOWN-001")).toEqual({
      status: "not_found",
      barcode: "IGNITE-UNKNOWN-001",
    });
  });

  it("matches available barcodes case-insensitively", () => {
    expect(findEquipmentByBarcode([CAMERA], "ignite-cam-002")).toEqual({
      status: "available",
      barcode: "IGNITE-CAM-002",
      match: CAMERA,
    });
  });

  it("returns unavailable when the barcode belongs to a checked-out item", () => {
    expect(findEquipmentByBarcode([CAMERA], "IGNITE-CAM-001")).toEqual({
      status: "unavailable",
      barcode: "IGNITE-CAM-001",
      match: CAMERA,
    });
  });

  it("returns duplicate when the same barcode exists on multiple items", () => {
    const duplicateMic = {
      ...MIC,
      barcodes: ["IGNITE-CAM-002"],
      availableBarcodes: ["IGNITE-CAM-002"],
    };

    expect(findEquipmentByBarcode([CAMERA, duplicateMic], "IGNITE-CAM-002")).toEqual({
      status: "duplicate",
      barcode: "IGNITE-CAM-002",
      matches: [CAMERA, duplicateMic],
    });
  });
});
