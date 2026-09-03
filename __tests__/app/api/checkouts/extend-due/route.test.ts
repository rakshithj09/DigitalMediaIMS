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

import { POST } from "@/app/api/checkouts/extend-due/route";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;

const ACTIVE_CHECKOUT = {
  student_id: "student-1",
  checked_in_at: null,
  due_at: "2099-04-27T08:00:00-05:00",
  period: "AM",
};

const EXTENDED_DUE = "2099-04-28T08:00:00-05:00";
const PAST_DUE = new Date(Date.now() - 86_400_000).toISOString();

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockAuth(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function mockDb(options: {
  checkout?: Record<string, unknown> | null;
} = {}) {
  const checkoutSet = jest.fn();
  const checkoutGet = jest.fn(async () => ({
      exists: options.checkout !== null,
      data: () => options.checkout ?? ACTIVE_CHECKOUT,
  }));
  const checkoutRef = { id: "co-1", path: "checkouts/co-1" };
  const runTransaction = jest.fn(async (callback) => callback({
    get: checkoutGet,
    set: checkoutSet,
  }));

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "checkouts") {
        return {
          doc: jest.fn(() => checkoutRef),
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }),
    runTransaction,
  };

  mockGetDb.mockReturnValue(db as never);
  return { checkoutGet, checkoutSet, runTransaction };
}

describe("POST /api/checkouts/extend-due", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb();
  });

  it("returns 401 when no user is signed in", async () => {
    mockAuth(null);

    const res = await POST(makeRequest({ checkoutId: "co-1", returnBy: EXTENDED_DUE }));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/signed in/i);
  });

  it("returns 403 when a student tries to extend a checkout", async () => {
    mockAuth({ id: "student-user", user_metadata: { role: "Student" } });

    const res = await POST(makeRequest({ checkoutId: "co-1", returnBy: EXTENDED_DUE }));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/teachers/i);
  });

  it("returns 400 when required input is missing or invalid", async () => {
    mockAuth({ id: "teacher-1", user_metadata: { role: "Teacher" } });

    await expect(POST(makeRequest({ returnBy: EXTENDED_DUE }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(makeRequest({ checkoutId: "co-1", returnBy: "not-a-date" }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(makeRequest({ checkoutId: "co-1", returnBy: PAST_DUE }))).resolves.toMatchObject({ status: 400 });
  });

  it("returns 404 when checkout does not exist or is already checked in", async () => {
    mockAuth({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    const missingDb = mockDb({ checkout: null });

    await expect(POST(makeRequest({ checkoutId: "co-missing", returnBy: EXTENDED_DUE }))).resolves.toMatchObject({ status: 404 });
    expect(missingDb.runTransaction).toHaveBeenCalled();
    expect(missingDb.checkoutSet).not.toHaveBeenCalled();

    const checkedInDb = mockDb({ checkout: { ...ACTIVE_CHECKOUT, checked_in_at: "2099-04-27T09:00:00-05:00" } });

    await expect(POST(makeRequest({ checkoutId: "co-1", returnBy: EXTENDED_DUE }))).resolves.toMatchObject({ status: 404 });
    expect(checkedInDb.runTransaction).toHaveBeenCalled();
    expect(checkedInDb.checkoutSet).not.toHaveBeenCalled();
  });

  it("returns 400 when the new due date is not later than the current due date", async () => {
    mockAuth({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockDb({ checkout: { ...ACTIVE_CHECKOUT, due_at: EXTENDED_DUE } });

    const res = await POST(makeRequest({ checkoutId: "co-1", returnBy: EXTENDED_DUE }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/later/i);
  });

  it("returns 400 for weekend or outside-period return times", async () => {
    mockAuth({ id: "teacher-1", user_metadata: { role: "Teacher" } });

    await expect(POST(makeRequest({ checkoutId: "co-1", returnBy: "2099-04-25T08:00:00-05:00" }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(makeRequest({ checkoutId: "co-1", returnBy: "2099-04-28T12:00:00-05:00" }))).resolves.toMatchObject({ status: 400 });
  });

  it("extends an active checkout for a teacher", async () => {
    mockAuth({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    const { checkoutGet, checkoutSet, runTransaction } = mockDb();

    const res = await POST(makeRequest({ checkoutId: "co-1", returnBy: EXTENDED_DUE }));
    const data = await res.json();
    const update = checkoutSet.mock.calls[0][1] as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(checkoutGet).toHaveBeenCalledWith({ id: "co-1", path: "checkouts/co-1" });
    expect(Object.keys(update).sort()).toEqual(["due_at", "due_extended_at", "due_extended_by"].sort());
    expect(update).toMatchObject({
      due_at: new Date(EXTENDED_DUE).toISOString(),
      due_extended_at: expect.any(String),
      due_extended_by: "teacher-1",
    });
    expect(checkoutSet).toHaveBeenCalledWith({ id: "co-1", path: "checkouts/co-1" }, update, { merge: true });
    expect(data.checkout).toMatchObject({
      id: "co-1",
      due_at: new Date(EXTENDED_DUE).toISOString(),
      due_extended_by: "teacher-1",
    });
  });
});
