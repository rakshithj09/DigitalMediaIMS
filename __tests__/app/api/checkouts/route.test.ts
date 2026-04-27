/**
 * Tests for POST /api/checkouts
 *
 * Strategy:
 *  - Mock `createSupabaseServerClient` to control auth state.
 *  - Mock `global.fetch` to simulate Supabase REST responses
 *    (student look-up, equipment availability, checkout insert).
 *  - Mock `next/server` so `NextResponse.json` returns a plain object
 *    with `.status` and async `.json()`.
 */

jest.mock("@/lib/supabase/server-client", () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/checkouts/route";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const mockCreateClient = createSupabaseServerClient as jest.MockedFunction<
  typeof createSupabaseServerClient
>;

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockAuth(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

const FUTURE = "2099-04-27T08:00:00-05:00"; // Monday 8:00 AM in America/Chicago
const PAST = new Date(Date.now() - 86_400_000).toISOString(); // -1 day

type TestStudentRow = {
  id: string;
  name: string;
  period: "AM" | "PM";
  is_active: boolean;
};

type TestEquipmentRow = {
  id: string;
  category: string;
  total_quantity: number;
  serial_number: string | null;
  is_active: boolean;
};

const STUDENT_ROW: TestStudentRow = {
  id: "student-1",
  name: "Alice",
  period: "AM",
  is_active: true,
};

const EQUIPMENT_ROW: TestEquipmentRow = {
  id: "eq-1",
  category: "Miscellaneous",
  total_quantity: 5,
  serial_number: null,
  is_active: true,
};

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/checkouts", () => {
  describe("authentication guard", () => {
    it("returns 401 when no user is signed in", async () => {
      mockAuth(null);
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(401);
      expect((await res.json()).error).toMatch(/signed in/i);
    });
  });

  describe("input validation", () => {
    beforeEach(() => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    });

    it("returns 400 when equipmentId is missing", async () => {
      const res = await POST(
        makeRequest({ quantity: 1, returnBy: FUTURE })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/equipment/i);
    });

    it("returns 400 when quantity is 0", async () => {
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 0, returnBy: FUTURE })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when quantity is negative", async () => {
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: -1, returnBy: FUTURE })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when quantity is a non-integer float", async () => {
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1.5, returnBy: FUTURE })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when returnBy is in the past", async () => {
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: PAST })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/return date/i);
    });

    it("returns 400 when returnBy is missing", async () => {
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1 })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when returnBy is an invalid date string", async () => {
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: "not-a-date" })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("student resolution — Student role", () => {
    it("returns 403 when Student has no linked roster entry", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Student" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: FUTURE })
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/not linked/i);
    });
  });

  describe("student resolution — Teacher role", () => {
    it("returns 400 when Teacher provides no studentId", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: FUTURE })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/valid student/i);
    });

    it("returns 400 when the provided studentId does not exist", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: FUTURE, studentId: "bad-id" })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("availability validation", () => {
    beforeEach(() => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    });

    function mockStudentAndEquipment(
      equipmentOverrides: Partial<typeof EQUIPMENT_ROW> = {},
      checkedOutRows: Array<{ quantity: number; serial_number: string | null }> = []
    ) {
      const eq = { ...EQUIPMENT_ROW, ...equipmentOverrides };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [STUDENT_ROW] })
        .mockResolvedValueOnce({ ok: true, json: async () => [eq] })
        .mockResolvedValueOnce({ ok: true, json: async () => checkedOutRows });
    }

    it("returns 409 when requested quantity exceeds available stock", async () => {
      // total=5, 4 already checked out → only 1 available
      mockStudentAndEquipment({}, [
        { quantity: 2, serial_number: null },
        { quantity: 2, serial_number: null },
      ]);
      const res = await POST(
        makeRequest({ studentId: "student-1", equipmentId: "eq-1", quantity: 2, returnBy: FUTURE })
      );
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/available/i);
    });

    it("returns 409 when a serialized unit is already checked out", async () => {
      mockStudentAndEquipment(
        { category: "Camera", serial_number: "CAM-001", total_quantity: 1 },
        [{ quantity: 1, serial_number: "CAM-001" }]
      );
      const res = await POST(
        makeRequest({
          studentId: "student-1",
          equipmentId: "eq-1",
          quantity: 1,
          serialNumber: "CAM-001",
          returnBy: FUTURE,
        })
      );
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/already checked out/i);
    });

    it("returns 400 when a serialized checkout has no serial number provided", async () => {
      mockStudentAndEquipment(
        { category: "Camera", serial_number: "CAM-001", total_quantity: 1 },
        []
      );
      const res = await POST(
        makeRequest({
          studentId: "student-1",
          equipmentId: "eq-1",
          quantity: 1,
          returnBy: FUTURE,
          // no serialNumber
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/serial/i);
    });

    it("returns 400 when quantity > 1 is requested for a serialized item", async () => {
      mockStudentAndEquipment(
        { category: "Camera", serial_number: "CAM-001\nCAM-002", total_quantity: 2 },
        []
      );
      const res = await POST(
        makeRequest({
          studentId: "student-1",
          equipmentId: "eq-1",
          quantity: 2,
          serialNumber: "CAM-001",
          returnBy: FUTURE,
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/one/i);
    });

    it("returns 400 when the provided serial is not in the equipment's serial list", async () => {
      mockStudentAndEquipment(
        { category: "Camera", serial_number: "CAM-001", total_quantity: 1 },
        []
      );
      const res = await POST(
        makeRequest({
          studentId: "student-1",
          equipmentId: "eq-1",
          quantity: 1,
          serialNumber: "CAM-FAKE",
          returnBy: FUTURE,
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/valid serial/i);
    });
  });

  describe("successful checkout", () => {
    const newCheckout = {
      id: "co-1",
      student_id: "student-1",
      equipment_id: "eq-1",
      quantity: 1,
    };

    it("returns 200 and the checkout object for a Teacher checkout", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [STUDENT_ROW] })
        .mockResolvedValueOnce({ ok: true, json: async () => [EQUIPMENT_ROW] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [newCheckout] });

      const res = await POST(
        makeRequest({
          studentId: "student-1",
          equipmentId: "eq-1",
          quantity: 1,
          returnBy: FUTURE,
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.checkout).toEqual(newCheckout);
    });

    it("returns 200 and the checkout object for a Student checkout", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Student" } });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [STUDENT_ROW] })
        .mockResolvedValueOnce({ ok: true, json: async () => [EQUIPMENT_ROW] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [newCheckout] });

      const res = await POST(
        makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: FUTURE })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.checkout).toEqual(newCheckout);
    });
  });
});
