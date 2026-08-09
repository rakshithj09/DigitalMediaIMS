jest.mock("@/lib/firebase/server-auth", () => ({
  createFirebaseServerAuthClient: jest.fn(),
}));

jest.mock("@/lib/firebase/admin-client", () => ({
  getFirebaseAdminDb: jest.fn(),
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
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;

const ACTIVE_CHECKOUT = {
  student_id: "student-1",
  checked_in_at: null,
};

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockAuth(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function makeWhereChain(docs: unknown[]) {
  const chain = {
    where: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    get: jest.fn(async () => ({ docs })),
  };
  return chain;
}

function mockDb(options: {
  checkout?: Record<string, unknown> | null;
  ownedStudentId?: string | null;
} = {}) {
  const checkoutSet = jest.fn();
  const studentDocs = options.ownedStudentId
    ? [{ id: options.ownedStudentId }]
    : [];
  const studentChain = makeWhereChain(studentDocs);

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "checkouts") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: options.checkout !== null,
              data: () => options.checkout ?? ACTIVE_CHECKOUT,
            })),
            set: checkoutSet,
          })),
        };
      }

      if (name === "students") {
        return { where: studentChain.where };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  mockGetDb.mockReturnValue(db as never);
  return { checkoutSet };
}

describe("POST /api/checkouts/check-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb();
  });

  it("returns 401 when no user is signed in", async () => {
    mockAuth(null);
    const res = await POST(makeRequest({ checkoutId: "co-1" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/signed in/i);
  });

  it("returns 400 when checkoutId is missing", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/checkoutId/i);
  });

  it("returns 404 when the checkout does not exist", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    mockDb({ checkout: null });

    const res = await POST(makeRequest({ checkoutId: "co-missing" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it("returns 404 when the checkout is already checked in", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    mockDb({ checkout: { ...ACTIVE_CHECKOUT, checked_in_at: "2024-01-05T10:00:00Z" } });

    const res = await POST(makeRequest({ checkoutId: "co-1" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when a student checks in another student's item", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Student" } });
    mockDb({ ownedStudentId: "student-other" });

    const res = await POST(makeRequest({ checkoutId: "co-1" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/you can only/i);
  });

  it("updates an active checkout for a teacher", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    const { checkoutSet } = mockDb();

    const res = await POST(makeRequest({ checkoutId: "co-1", returnNotes: "Minor scratch" }));
    expect(res.status).toBe(200);
    expect(checkoutSet).toHaveBeenCalledWith(expect.objectContaining({
      checked_in_at: expect.any(String),
      return_notes: "Minor scratch",
    }), { merge: true });
  });

  it("updates an active checkout for the owning student", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Student" } });
    const { checkoutSet } = mockDb({ ownedStudentId: "student-1" });

    const res = await POST(makeRequest({ checkoutId: "co-1" }));
    expect(res.status).toBe(200);
    expect(checkoutSet).toHaveBeenCalled();
  });
});
