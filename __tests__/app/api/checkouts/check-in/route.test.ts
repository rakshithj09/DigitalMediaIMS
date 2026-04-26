/**
 * Tests for POST /api/checkouts/check-in
 *
 * Strategy:
 *  - Mock `createSupabaseServerClient` for auth.
 *  - Mock `global.fetch` for Supabase REST calls
 *    (student look-up, checkout fetch, checkout PATCH).
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

import { POST } from "@/app/api/checkouts/check-in/route";
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

const ACTIVE_CHECKOUT = {
  id: "co-1",
  student_id: "student-1",
  checked_in_at: null,
};

const ALREADY_CHECKED_IN = {
  id: "co-1",
  student_id: "student-1",
  checked_in_at: "2024-01-05T10:00:00Z",
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

describe("POST /api/checkouts/check-in", () => {
  describe("authentication guard", () => {
    it("returns 401 when no user is signed in", async () => {
      mockAuth(null);
      const res = await POST(makeRequest({ checkoutId: "co-1" }));
      expect(res.status).toBe(401);
      expect((await res.json()).error).toMatch(/signed in/i);
    });
  });

  describe("input validation", () => {
    it("returns 400 when checkoutId is missing", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/checkoutId/i);
    });

    it("returns 400 when checkoutId is an empty string", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      const res = await POST(makeRequest({ checkoutId: "" }));
      expect(res.status).toBe(400);
    });
  });

  describe("checkout validation", () => {
    it("returns 404 when the checkout does not exist", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      const res = await POST(makeRequest({ checkoutId: "co-missing" }));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toMatch(/not found/i);
    });

    it("returns 404 when the checkout is already checked in", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [ALREADY_CHECKED_IN],
      });
      const res = await POST(makeRequest({ checkoutId: "co-1" }));
      expect(res.status).toBe(404);
    });
  });

  describe("authorization — Student role", () => {
    it("returns 403 when a Student tries to check in someone else's checkout", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Student" } });
      (global.fetch as jest.Mock)
        // checkout fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [ACTIVE_CHECKOUT], // student_id = "student-1"
        })
        // student roster fetch (returns a different student id)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: "student-OTHER" }],
        });

      const res = await POST(makeRequest({ checkoutId: "co-1" }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/you can only/i);
    });

    it("returns 403 when a Student has no linked roster entry", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Student" } });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [ACTIVE_CHECKOUT] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // no student

      const res = await POST(makeRequest({ checkoutId: "co-1" }));
      expect(res.status).toBe(403);
    });
  });

  describe("successful check-in", () => {
    const updatedCheckout = {
      ...ACTIVE_CHECKOUT,
      checked_in_at: new Date().toISOString(),
    };

    it("returns 200 and the updated checkout when a Teacher checks in", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [ACTIVE_CHECKOUT] })
        .mockResolvedValueOnce({ ok: true, json: async () => [updatedCheckout] });

      const res = await POST(makeRequest({ checkoutId: "co-1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.checkout).toMatchObject({ id: "co-1" });
    });

    it("returns 200 when a Student checks in their own checkout", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Student" } });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [ACTIVE_CHECKOUT] })
        // owned student id matches checkout.student_id
        .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "student-1" }] })
        .mockResolvedValueOnce({ ok: true, json: async () => [updatedCheckout] });

      const res = await POST(makeRequest({ checkoutId: "co-1" }));
      expect(res.status).toBe(200);
    });

    it("passes returnNotes to the PATCH body", async () => {
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [ACTIVE_CHECKOUT] })
        .mockResolvedValueOnce({ ok: true, json: async () => [updatedCheckout] });

      await POST(makeRequest({ checkoutId: "co-1", returnNotes: "Minor scratch" }));

      // The second fetch call should be the PATCH; verify it was called
      expect((global.fetch as jest.Mock).mock.calls[1][1].body).toContain(
        "return_notes"
      );
    });
  });

  describe("missing Supabase configuration", () => {
    it("returns 500 when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
      const saved = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });

      const res = await POST(makeRequest({ checkoutId: "co-1" }));
      expect(res.status).toBe(500);

      process.env.NEXT_PUBLIC_SUPABASE_URL = saved;
    });
  });
});
