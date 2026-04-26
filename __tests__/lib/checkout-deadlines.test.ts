import {
  getCheckoutDeadlineMeta,
  formatDateTime,
  formatRemainingTime,
} from "@/lib/checkout-deadlines";

// ─── getCheckoutDeadlineMeta ───────────────────────────────────────────────

describe("getCheckoutDeadlineMeta", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null when checkedOutAt is null", () => {
    expect(getCheckoutDeadlineMeta(null, "2024-01-10T12:00:00Z")).toBeNull();
  });

  it("returns null when dueAt is null", () => {
    expect(getCheckoutDeadlineMeta("2024-01-01T12:00:00Z", null)).toBeNull();
  });

  it("returns null when both args are undefined", () => {
    expect(getCheckoutDeadlineMeta(undefined, undefined)).toBeNull();
  });

  it("returns null when checkedOutAt is an invalid date string", () => {
    expect(getCheckoutDeadlineMeta("not-a-date", "2024-01-10T12:00:00Z")).toBeNull();
  });

  it("returns null when dueAt is an invalid date string", () => {
    expect(getCheckoutDeadlineMeta("2024-01-01T12:00:00Z", "not-a-date")).toBeNull();
  });

  it("returns null when dueAt is before checkedOutAt (totalMs <= 0)", () => {
    expect(
      getCheckoutDeadlineMeta("2024-01-10T00:00:00Z", "2024-01-01T00:00:00Z")
    ).toBeNull();
  });

  it("returns null when dueAt equals checkedOutAt", () => {
    const ts = "2024-01-01T00:00:00Z";
    expect(getCheckoutDeadlineMeta(ts, ts)).toBeNull();
  });

  it("returns healthy state when less than 50% elapsed", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-11T00:00:00Z"; // 10 days total
    jest.setSystemTime(new Date("2024-01-03T00:00:00Z")); // 20% elapsed

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("healthy");
  });

  it("returns warning state when 50–75% elapsed", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-11T00:00:00Z"; // 10 days total
    jest.setSystemTime(new Date("2024-01-07T00:00:00Z")); // 60% elapsed

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("warning");
  });

  it("returns danger state when >= 75% elapsed and not yet overdue", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-11T00:00:00Z"; // 10 days total
    jest.setSystemTime(new Date("2024-01-09T00:00:00Z")); // 80% elapsed

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("danger");
  });

  it("returns overdue state when current time is past due date", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-05T00:00:00Z";
    jest.setSystemTime(new Date("2024-01-10T00:00:00Z")); // past due

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("overdue");
    expect(result!.remainingMs).toBeLessThan(0);
  });

  it("calculates totalMs correctly", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-11T00:00:00Z"; // 10 days = 864_000_000 ms
    jest.setSystemTime(new Date("2024-01-03T00:00:00Z"));

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result!.totalMs).toBe(10 * 24 * 60 * 60 * 1000);
  });

  it("clamps progress to a maximum of 1 when far past due", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-11T00:00:00Z";
    jest.setSystemTime(new Date("2025-01-01T00:00:00Z")); // way past due

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result!.progress).toBe(1);
  });

  it("clamps progress to a minimum of 0 (checked out in the future edge case)", () => {
    // If now is before checkedOutAt (e.g. clock skew), elapsedMs < 0 → progress clamps to 0
    const checkedOutAt = "2024-01-10T00:00:00Z";
    const dueAt = "2024-01-20T00:00:00Z";
    jest.setSystemTime(new Date("2024-01-05T00:00:00Z")); // before checkout

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result!.progress).toBe(0);
    expect(result!.state).toBe("healthy");
  });

  it("returns correct Date objects for checkedOutDate and dueDate", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-11T00:00:00Z";
    jest.setSystemTime(new Date("2024-01-03T00:00:00Z"));

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result!.checkedOutDate).toEqual(new Date(checkedOutAt));
    expect(result!.dueDate).toEqual(new Date(dueAt));
  });

  it("elapsedMs + remainingMs equals totalMs (before due date)", () => {
    const checkedOutAt = "2024-01-01T00:00:00Z";
    const dueAt = "2024-01-11T00:00:00Z";
    jest.setSystemTime(new Date("2024-01-06T00:00:00Z"));

    const result = getCheckoutDeadlineMeta(checkedOutAt, dueAt);
    expect(result!.elapsedMs + result!.remainingMs).toBe(result!.totalMs);
  });
});

// ─── formatDateTime ────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("returns — for null", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("returns — for empty string", () => {
    expect(formatDateTime("")).toBe("—");
  });

  it("returns the raw value for an unparseable string", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });

  it("returns a non-empty localized string for a valid ISO date", () => {
    const result = formatDateTime("2024-09-25T14:30:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Should NOT return the raw ISO string
    expect(result).not.toBe("2024-09-25T14:30:00Z");
  });

  it("includes the month abbreviation in the output", () => {
    const result = formatDateTime("2024-09-25T14:30:00Z");
    expect(result).toMatch(/Sep/);
  });

  it("includes the day number in the output", () => {
    const result = formatDateTime("2024-09-25T14:30:00Z");
    expect(result).toMatch(/25/);
  });
});

// ─── formatRemainingTime ───────────────────────────────────────────────────

describe("formatRemainingTime", () => {
  it("returns at least 1m for zero milliseconds", () => {
    expect(formatRemainingTime(0)).toBe("1m");
  });

  it("returns 1m for values shorter than one minute", () => {
    expect(formatRemainingTime(30_000)).toBe("1m"); // 30 seconds
  });

  it("returns minutes only for values under one hour", () => {
    expect(formatRemainingTime(45 * 60_000)).toBe("45m");
  });

  it("returns hours only when there are no leftover minutes (days=0)", () => {
    expect(formatRemainingTime(2 * 3_600_000)).toBe("2h");
  });

  it("returns hours and minutes for sub-day values with both", () => {
    const ms = 2 * 3_600_000 + 30 * 60_000; // 2h 30m
    expect(formatRemainingTime(ms)).toBe("2h 30m");
  });

  it("returns days only when hours are zero", () => {
    expect(formatRemainingTime(3 * 86_400_000)).toBe("3d");
  });

  it("returns days and hours for multi-day values", () => {
    const ms = (2 * 24 + 5) * 3_600_000; // 2d 5h
    expect(formatRemainingTime(ms)).toBe("2d 5h");
  });

  it("omits minutes for multi-day values (only up to 2 parts)", () => {
    const ms = (2 * 24 + 5) * 3_600_000 + 30 * 60_000; // 2d 5h 30m
    const result = formatRemainingTime(ms);
    expect(result).toBe("2d 5h"); // minutes dropped — only 2 parts kept
  });

  it("handles negative (overdue) values using absolute value", () => {
    const negativeMs = -(2 * 3_600_000); // -2h
    expect(formatRemainingTime(negativeMs)).toBe("2h");
  });

  it("returns at most 2 space-separated parts", () => {
    const ms = (3 * 24 + 5) * 3_600_000 + 30 * 60_000;
    const parts = formatRemainingTime(ms).split(" ");
    expect(parts.length).toBeLessThanOrEqual(2);
  });
});
