/**
 * Tests for POST /api/equipment (create) and PATCH /api/equipment (update).
 *
 * Strategy:
 *  - Mock `createSupabaseServerClient` for the auth/role check inside `requireTeacher()`.
 *  - Mock `@supabase/supabase-js` `createClient` to return a chainable mock
 *    admin client so database calls never hit the network.
 *  - Mock `next/server` so responses are plain objects.
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

// Build a re-usable chainable builder that Jest controls per-test.
const mockMaybySingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdateEq = jest.fn(); // resolves when awaited (the update chain end)

const mockBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockImplementation(function (this: unknown) {
    // For the update chain, awaiting `.eq()` directly triggers this then()
    return mockBuilder;
  }),
  update: jest.fn().mockReturnThis(),
  maybySingle: mockMaybySingle,
  maybeSingle: mockMaybySingle,
  insert: mockInsert,
  // Make the builder itself awaitable so `await admin.from().update().eq()` works
  then: jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(resolve)
  ),
};

const mockFrom = jest.fn(() => mockBuilder);

const mockAuthClient = {
  signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
  signOut: jest.fn().mockResolvedValue({}),
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    auth: mockAuthClient,
  })),
}));

import { POST, PATCH } from "@/app/api/equipment/route";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const mockCreateClient = createSupabaseServerClient as jest.MockedFunction<
  typeof createSupabaseServerClient
>;

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockTeacherAuth(email = "teacher@example.com") {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: "u1", email, user_metadata: { role: "Teacher" } } },
      }),
    },
  } as never);
}

function mockStudentAuth() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: "u2", email: "student@example.com", user_metadata: { role: "Student" } } },
      }),
    },
  } as never);
}

function mockNoAuth() {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null } }) },
  } as never);
}

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
});

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  mockBuilder.select.mockReturnThis();
  mockBuilder.eq.mockReturnThis();
  mockBuilder.update.mockReturnThis();
  mockBuilder.then.mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(resolve)
  );
  mockFrom.mockReturnValue(mockBuilder);
});

// ─── POST /api/equipment ───────────────────────────────────────────────────

describe("POST /api/equipment", () => {
  describe("auth / role guard", () => {
    it("returns 401 when no user is signed in", async () => {
      mockNoAuth();
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(401);
    });

    it("returns 403 when a Student tries to create equipment", async () => {
      mockStudentAuth();
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/teacher/i);
    });
  });

  describe("input validation", () => {
    beforeEach(() => mockTeacherAuth());

    it("returns 400 when name is missing", async () => {
      mockInsert.mockResolvedValue({ error: null });
      const res = await POST(
        makeRequest({ category: "Camera", totalQuantity: 1 })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/name/i);
    });

    it("returns 400 when name is whitespace-only", async () => {
      const res = await POST(
        makeRequest({ name: "   ", category: "Camera", totalQuantity: 1 })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when category is invalid", async () => {
      const res = await POST(
        makeRequest({ name: "My Cam", category: "InvalidCat", totalQuantity: 1 })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/category/i);
    });

    it("returns 400 when category is missing", async () => {
      const res = await POST(
        makeRequest({ name: "My Cam", totalQuantity: 1 })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when totalQuantity is 0", async () => {
      const res = await POST(
        makeRequest({ name: "My Cam", category: "Camera", totalQuantity: 0 })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/quantity/i);
    });

    it("returns 400 when totalQuantity is negative", async () => {
      const res = await POST(
        makeRequest({ name: "My Cam", category: "Camera", totalQuantity: -1 })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when totalQuantity exceeds 999", async () => {
      const res = await POST(
        makeRequest({ name: "My Cam", category: "Camera", totalQuantity: 1000 })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when serial count is less than totalQuantity for a serialized category", async () => {
      const res = await POST(
        makeRequest({
          name: "My Cam",
          category: "Camera",
          totalQuantity: 3,
          serialNumber: "CAM-001\nCAM-002", // only 2 serials for qty 3
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/serial/i);
    });

    it("returns 400 when serial count exceeds totalQuantity", async () => {
      const res = await POST(
        makeRequest({
          name: "My Cam",
          category: "Camera",
          totalQuantity: 1,
          serialNumber: "CAM-001\nCAM-002", // 2 serials for qty 1
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/serial/i);
    });
  });

  describe("successful creation", () => {
    it("returns 200 when all inputs are valid (non-serialized category)", async () => {
      mockTeacherAuth();
      mockInsert.mockResolvedValue({ error: null });
      const res = await POST(
        makeRequest({ name: "Tripod", category: "Miscellaneous", totalQuantity: 5 })
      );
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    it("returns 200 when serial count matches totalQuantity for a serialized category", async () => {
      mockTeacherAuth();
      mockInsert.mockResolvedValue({ error: null });
      const res = await POST(
        makeRequest({
          name: "Camera A",
          category: "Camera",
          totalQuantity: 2,
          serialNumber: "CAM-001\nCAM-002",
        })
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 when the DB insert fails", async () => {
      mockTeacherAuth();
      mockInsert.mockResolvedValue({ error: { message: "DB constraint violation" } });
      const res = await POST(
        makeRequest({ name: "Tripod", category: "Miscellaneous", totalQuantity: 1 })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/constraint/i);
    });
  });
});

// ─── PATCH /api/equipment ──────────────────────────────────────────────────

describe("PATCH /api/equipment", () => {
  describe("auth / role guard", () => {
    it("returns 401 when no user is signed in", async () => {
      mockNoAuth();
      const res = await PATCH(makeRequest({ id: "eq-1", name: "New Name" }));
      expect(res.status).toBe(401);
    });

    it("returns 403 when a Student tries to update equipment", async () => {
      mockStudentAuth();
      const res = await PATCH(makeRequest({ id: "eq-1", name: "New Name" }));
      expect(res.status).toBe(403);
    });
  });

  describe("input validation", () => {
    beforeEach(() => mockTeacherAuth());

    it("returns 400 when id is missing", async () => {
      const res = await PATCH(makeRequest({ name: "New Name" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/id/i);
    });

    it("returns 400 when no updatable fields are provided", async () => {
      mockMaybySingle.mockResolvedValue({
        data: { id: "eq-1", total_quantity: 5, serial_number: null, category: "Miscellaneous" },
        error: null,
      });
      const res = await PATCH(makeRequest({ id: "eq-1" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/no equipment changes/i);
    });

    it("returns 400 when name update is empty string", async () => {
      mockMaybySingle.mockResolvedValue({
        data: { id: "eq-1", total_quantity: 5, serial_number: null, category: "Miscellaneous" },
        error: null,
      });
      const res = await PATCH(makeRequest({ id: "eq-1", name: "   " }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/name/i);
    });

    it("returns 400 when updating to an invalid category", async () => {
      mockMaybySingle.mockResolvedValue({
        data: { id: "eq-1", total_quantity: 5, serial_number: null, category: "Miscellaneous" },
        error: null,
      });
      const res = await PATCH(makeRequest({ id: "eq-1", category: "InvalidCat" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/category/i);
    });

    it("returns 400 when totalQuantity update is out of range", async () => {
      mockMaybySingle.mockResolvedValue({
        data: { id: "eq-1", total_quantity: 5, serial_number: null, category: "Miscellaneous" },
        error: null,
      });
      const res = await PATCH(makeRequest({ id: "eq-1", totalQuantity: 0 }));
      expect(res.status).toBe(400);
    });

    it("returns 404 when the equipment id does not exist", async () => {
      mockMaybySingle.mockResolvedValue({ data: null, error: null });
      const res = await PATCH(makeRequest({ id: "bad-id", name: "New Name" }));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toMatch(/not found/i);
    });
  });

  describe("successful update", () => {
    it("returns 200 when renaming equipment", async () => {
      mockTeacherAuth();
      mockMaybySingle.mockResolvedValue({
        data: { id: "eq-1", total_quantity: 5, serial_number: null, category: "Miscellaneous" },
        error: null,
      });
      const res = await PATCH(makeRequest({ id: "eq-1", name: "Updated Tripod" }));
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    it("returns 200 when updating conditionNotes", async () => {
      mockTeacherAuth();
      mockMaybySingle.mockResolvedValue({
        data: { id: "eq-1", total_quantity: 5, serial_number: null, category: "Miscellaneous" },
        error: null,
      });
      const res = await PATCH(
        makeRequest({ id: "eq-1", conditionNotes: "Small scratch on body" })
      );
      expect(res.status).toBe(200);
    });
  });
});
