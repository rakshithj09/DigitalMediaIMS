import {
  parseSerialNumbers,
  normalizeSerialNumber,
  categorySupportsSerialNumbers,
} from "@/app/lib/serials";

// ─── parseSerialNumbers ────────────────────────────────────────────────────

describe("parseSerialNumbers", () => {
  it("returns [] for null", () => {
    expect(parseSerialNumbers(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(parseSerialNumbers(undefined)).toEqual([]);
  });

  it("returns [] for an empty string", () => {
    expect(parseSerialNumbers("")).toEqual([]);
  });

  it("returns [] for a whitespace-only string", () => {
    expect(parseSerialNumbers("   ")).toEqual([]);
  });

  it("parses a single serial number", () => {
    expect(parseSerialNumbers("SN001")).toEqual(["SN001"]);
  });

  it("parses newline-separated serial numbers", () => {
    expect(parseSerialNumbers("SN001\nSN002\nSN003")).toEqual([
      "SN001",
      "SN002",
      "SN003",
    ]);
  });

  it("parses comma-separated serial numbers", () => {
    expect(parseSerialNumbers("SN001,SN002,SN003")).toEqual([
      "SN001",
      "SN002",
      "SN003",
    ]);
  });

  it("parses a mix of newline and comma separators", () => {
    expect(parseSerialNumbers("SN001\nSN002,SN003")).toEqual([
      "SN001",
      "SN002",
      "SN003",
    ]);
  });

  it("trims leading and trailing whitespace from each entry", () => {
    expect(parseSerialNumbers("  SN001  \n  SN002  ")).toEqual([
      "SN001",
      "SN002",
    ]);
  });

  it("deduplicates serial numbers case-insensitively", () => {
    expect(parseSerialNumbers("SN001\nsn001\nSN001")).toEqual(["SN001"]);
  });

  it("preserves the case of the first occurrence when deduplicating", () => {
    const result = parseSerialNumbers("CAM-A1\ncam-a1");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("CAM-A1");
  });

  it("filters out empty entries produced by consecutive delimiters", () => {
    expect(parseSerialNumbers("SN001,,SN002")).toEqual(["SN001", "SN002"]);
  });

  it("filters out entries that are whitespace after trimming", () => {
    expect(parseSerialNumbers("SN001\n   \nSN002")).toEqual(["SN001", "SN002"]);
  });

  it("handles a realistic multi-line asset tag list with a duplicate", () => {
    const input = "CAM-001\nCAM-002\nCAM-003\nCAM-002";
    expect(parseSerialNumbers(input)).toEqual(["CAM-001", "CAM-002", "CAM-003"]);
  });

  it("handles multiple consecutive newlines", () => {
    expect(parseSerialNumbers("SN001\n\n\nSN002")).toEqual(["SN001", "SN002"]);
  });
});

// ─── normalizeSerialNumber ─────────────────────────────────────────────────

describe("normalizeSerialNumber", () => {
  it("returns null for null", () => {
    expect(normalizeSerialNumber(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeSerialNumber(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(normalizeSerialNumber("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(normalizeSerialNumber("   ")).toBeNull();
  });

  it("returns the trimmed string for a valid serial number", () => {
    expect(normalizeSerialNumber("  SN001  ")).toBe("SN001");
  });

  it("returns the string unchanged when no trimming is needed", () => {
    expect(normalizeSerialNumber("SN001")).toBe("SN001");
  });

  it("preserves internal spaces after trimming outer whitespace", () => {
    expect(normalizeSerialNumber("  SN 001  ")).toBe("SN 001");
  });
});

// ─── categorySupportsSerialNumbers ────────────────────────────────────────

describe("categorySupportsSerialNumbers", () => {
  it("returns false for null", () => {
    expect(categorySupportsSerialNumbers(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(categorySupportsSerialNumbers(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(categorySupportsSerialNumbers("")).toBe(false);
  });

  it("returns false for Miscellaneous (non-serialized category)", () => {
    expect(categorySupportsSerialNumbers("Miscellaneous")).toBe(false);
  });

  it("returns false for an unrecognized category", () => {
    expect(categorySupportsSerialNumbers("Unknown Category")).toBe(false);
  });

  it("returns true for Camera", () => {
    expect(categorySupportsSerialNumbers("Camera")).toBe(true);
  });

  it("returns true for Camera Kit", () => {
    expect(categorySupportsSerialNumbers("Camera Kit")).toBe(true);
  });

  it("returns true for Lens", () => {
    expect(categorySupportsSerialNumbers("Lens")).toBe(true);
  });

  it("returns true for Cinema Camera", () => {
    expect(categorySupportsSerialNumbers("Cinema Camera")).toBe(true);
  });

  it("returns true for Technology", () => {
    expect(categorySupportsSerialNumbers("Technology")).toBe(true);
  });

  it("returns true for Lighting", () => {
    expect(categorySupportsSerialNumbers("Lighting")).toBe(true);
  });

  it("returns true for Stabilization", () => {
    expect(categorySupportsSerialNumbers("Stabilization")).toBe(true);
  });

  it("is case-sensitive — lowercase 'camera' returns false", () => {
    expect(categorySupportsSerialNumbers("camera")).toBe(false);
  });

  it("is case-sensitive — 'CAMERA' returns false", () => {
    expect(categorySupportsSerialNumbers("CAMERA")).toBe(false);
  });
});
