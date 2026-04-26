import { cn } from "@/lib/utils";

describe("cn", () => {
  it("returns empty string with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("joins multiple classes with a space", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores false", () => {
    expect(cn("foo", false, "bar")).toBe("foo bar");
  });

  it("ignores null", () => {
    expect(cn("foo", null, "bar")).toBe("foo bar");
  });

  it("ignores undefined", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar");
  });

  it("ignores empty strings", () => {
    expect(cn("foo", "", "bar")).toBe("foo bar");
  });

  it("handles conditional object syntax — true condition includes class", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });

  it("handles conditional object syntax — false condition excludes class", () => {
    expect(cn({ foo: false })).toBe("");
  });

  it("handles array inputs", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("merges conflicting Tailwind padding classes (last wins)", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });

  it("merges conflicting Tailwind text color classes (last wins)", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("preserves non-conflicting Tailwind classes", () => {
    const result = cn("p-4", "m-4");
    expect(result).toContain("p-4");
    expect(result).toContain("m-4");
  });

  it("handles a mix of strings, objects, and arrays", () => {
    const result = cn("base", { active: true, disabled: false }, ["extra"]);
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).toContain("extra");
    expect(result).not.toContain("disabled");
  });

  it("deduplicates identical classes via tailwind-merge", () => {
    const result = cn("flex", "flex");
    expect(result).toBe("flex");
  });
});
