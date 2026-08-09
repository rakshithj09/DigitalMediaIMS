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

import { POST } from "@/app/api/checkouts/route";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;

const FUTURE = "2099-04-27T08:00:00-05:00";
const PAST = new Date(Date.now() - 86_400_000).toISOString();

const STUDENT_ROW = {
  id: "student-1",
  name: "Alice",
  period: "AM",
  is_active: true,
};

const EQUIPMENT_ROW = {
  id: "eq-1",
  category: "Miscellaneous",
  total_quantity: 5,
  serial_number: null,
  is_active: true,
};

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockAuth(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function makeDoc(id: string, data: Record<string, unknown>, exists = true) {
  return {
    id,
    exists,
    data: () => data,
  };
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
  student?: Record<string, unknown> | null;
  ownedStudent?: Record<string, unknown> | null;
  equipment?: Record<string, unknown> | null;
  activeCheckouts?: Array<Record<string, unknown>>;
} = {}) {
  const checkoutSet = jest.fn();
  const checkoutRef = { id: "checkout-1", set: checkoutSet };
  const studentsByUser = makeWhereChain(
    options.ownedStudent ? [makeDoc("student-owned", options.ownedStudent)] : []
  );
  const activeCheckouts = makeWhereChain(
    (options.activeCheckouts ?? []).map((row, index) => makeDoc(`checkout-${index}`, row))
  );

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "students") {
        return {
          where: studentsByUser.where,
          doc: jest.fn(() => ({
            get: jest.fn(async () =>
              options.student === null
                ? makeDoc("student-1", {}, false)
                : makeDoc("student-1", options.student ?? STUDENT_ROW)
            ),
          })),
        };
      }

      if (name === "equipment") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () =>
              options.equipment === null
                ? makeDoc("eq-1", {}, false)
                : makeDoc("eq-1", options.equipment ?? EQUIPMENT_ROW)
            ),
          })),
        };
      }

      if (name === "checkouts") {
        return {
          where: activeCheckouts.where,
          doc: jest.fn(() => checkoutRef),
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  mockGetDb.mockReturnValue(db as never);
  return { checkoutSet };
}

describe("POST /api/checkouts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb();
  });

  it("returns 401 when no user is signed in", async () => {
    mockAuth(null);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/signed in/i);
  });

  it("returns 400 when required input is invalid", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    await expect(POST(makeRequest({ quantity: 1, returnBy: FUTURE }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(makeRequest({ equipmentId: "eq-1", quantity: 0, returnBy: FUTURE }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: PAST }))).resolves.toMatchObject({ status: 400 });
  });

  it("returns 403 when a student account has no linked roster entry", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Student" } });
    mockDb({ ownedStudent: null });

    const res = await POST(makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: FUTURE }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/not linked/i);
  });

  it("returns 400 when a teacher provides an unknown student", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    mockDb({ student: null });

    const res = await POST(
      makeRequest({ equipmentId: "eq-1", quantity: 1, returnBy: FUTURE, studentId: "bad-id" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when requested quantity exceeds available stock", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    mockDb({
      activeCheckouts: [
        { quantity: 2, serial_number: null },
        { quantity: 2, serial_number: null },
      ],
    });

    const res = await POST(
      makeRequest({ studentId: "student-1", equipmentId: "eq-1", quantity: 2, returnBy: FUTURE })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/available/i);
  });

  it("returns 409 when a serialized unit is already checked out", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    mockDb({
      equipment: { ...EQUIPMENT_ROW, category: "Camera", serial_number: "CAM-001", total_quantity: 1 },
      activeCheckouts: [{ quantity: 1, serial_number: "CAM-001" }],
    });

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

  it("creates a checkout for valid teacher input", async () => {
    mockAuth({ id: "u1", user_metadata: { role: "Teacher" } });
    const { checkoutSet } = mockDb();

    const res = await POST(
      makeRequest({ studentId: "student-1", equipmentId: "eq-1", quantity: 1, returnBy: FUTURE })
    );
    expect(res.status).toBe(200);
    expect(checkoutSet).toHaveBeenCalledWith(expect.objectContaining({
      equipment_id: "eq-1",
      student_id: "student-1",
      quantity: 1,
    }));
  });
});
