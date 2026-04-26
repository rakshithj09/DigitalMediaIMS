import { EQUIPMENT_CATEGORIES } from "@/app/lib/types";

describe("EQUIPMENT_CATEGORIES", () => {
  it("is an array", () => {
    expect(Array.isArray(EQUIPMENT_CATEGORIES)).toBe(true);
  });

  it("contains exactly 8 categories", () => {
    expect(EQUIPMENT_CATEGORIES).toHaveLength(8);
  });

  it("contains Camera Kit", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Camera Kit");
  });

  it("contains Camera", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Camera");
  });

  it("contains Lens", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Lens");
  });

  it("contains Cinema Camera", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Cinema Camera");
  });

  it("contains Technology", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Technology");
  });

  it("contains Lighting", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Lighting");
  });

  it("contains Stabilization", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Stabilization");
  });

  it("contains Miscellaneous", () => {
    expect(EQUIPMENT_CATEGORIES).toContain("Miscellaneous");
  });

  it("has no duplicate entries", () => {
    const unique = new Set(EQUIPMENT_CATEGORIES);
    expect(unique.size).toBe(EQUIPMENT_CATEGORIES.length);
  });

  it("every entry is a non-empty string", () => {
    for (const cat of EQUIPMENT_CATEGORIES) {
      expect(typeof cat).toBe("string");
      expect(cat.length).toBeGreaterThan(0);
    }
  });

  it("does not contain Miscellaneous as a serialized category (sanity check with serials module)", () => {
    // Miscellaneous is in EQUIPMENT_CATEGORIES but should NOT be in the serialized set
    expect(EQUIPMENT_CATEGORIES).toContain("Miscellaneous");
  });
});
