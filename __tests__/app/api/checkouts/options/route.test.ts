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

import { GET } from "@/app/api/checkouts/options/route";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;

type QueryChain = {
  where: jest.MockedFunction<(field: string, op: string, value: unknown) => QueryChain>;
  orderBy: jest.MockedFunction<(field: string, direction?: string) => QueryChain>;
  limit: jest.MockedFunction<(value: number) => QueryChain>;
  get: jest.MockedFunction<() => Promise<{ docs: unknown[] }>>;
};

function makeRequest(path = "https://example.test/api/checkouts/options?period=PM"): Request {
  return { url: path } as unknown as Request;
}

function mockAuth(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function makeDoc(id: string, data: Record<string, unknown>, exists = true) {
  return { id, exists, data: () => data };
}

function makeQuery(docs: unknown[]): QueryChain {
  const chain = {} as QueryChain;
  chain.where = jest.fn(() => chain);
  chain.orderBy = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.get = jest.fn(async () => ({ docs }));
  return chain;
}

function mockDb(options: {
  ownedStudent?: Record<string, unknown> | null;
  teacherStudents?: Array<Record<string, unknown>>;
  equipment?: Array<Record<string, unknown>>;
  activeCheckouts?: Array<Record<string, unknown>>;
  activeCheckoutSums?: Array<Record<string, unknown>>;
} = {}) {
  const ownedStudentDocs = options.ownedStudent
    ? [makeDoc("student-owned", options.ownedStudent)]
    : [];
  const studentsByUser = makeQuery(ownedStudentDocs);
  const studentsByPeriod = makeQuery(
    (options.teacherStudents ?? []).map((row, index) => makeDoc(`student-${index + 1}`, row))
  );
  const equipmentQuery = makeQuery(
    (options.equipment ?? []).map((row, index) => makeDoc(`equipment-${index + 1}`, row))
  );
  const activeCheckouts = makeQuery(
    (options.activeCheckouts ?? []).map((row, index) => makeDoc(`checkout-${index + 1}`, row))
  );
  const activeCheckoutSums = makeQuery(
    (options.activeCheckoutSums ?? options.activeCheckouts ?? []).map((row, index) => makeDoc(`summary-${index + 1}`, row))
  );
  const studentDocs = new Map<string, unknown>([
    ["student-owned", makeDoc("student-owned", options.ownedStudent ?? { name: "Student", student_id: "S1" })],
    ["student-1", makeDoc("student-1", options.teacherStudents?.[0] ?? { name: "Teacher Student", student_id: "T1" })],
  ]);
  const equipmentDocs = new Map<string, unknown>([
    ["equipment-1", makeDoc("equipment-1", options.equipment?.[0] ?? { name: "Camera", category: "Camera" })],
  ]);

  let checkoutQueryIndex = 0;
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "students") {
        return {
          where: jest.fn((field: string) => (field === "user_id" ? studentsByUser : studentsByPeriod)),
          doc: jest.fn((id: string) => ({ get: jest.fn(async () => studentDocs.get(id) ?? makeDoc(id, {}, false)) })),
        };
      }
      if (name === "equipment") {
        return {
          where: equipmentQuery.where,
          doc: jest.fn((id: string) => ({ get: jest.fn(async () => equipmentDocs.get(id) ?? makeDoc(id, {}, false)) })),
        };
      }
      if (name === "checkouts") {
        return {
          where: jest.fn(() => {
            const query = checkoutQueryIndex === 0 ? activeCheckouts : activeCheckoutSums;
            checkoutQueryIndex += 1;
            return query;
          }),
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  mockGetDb.mockReturnValue(db as never);
  return { studentsByUser, studentsByPeriod, equipmentQuery, activeCheckouts, activeCheckoutSums };
}

describe("GET /api/checkouts/options", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb();
  });

  it("returns 401 when no user is signed in", async () => {
    mockAuth(null);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/signed in/i);
  });

  it("returns an empty student state when a student has no roster row", async () => {
    mockAuth({ id: "student-auth-1", user_metadata: { role: "Student" } });
    const { activeCheckouts } = mockDb({ ownedStudent: null });

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.students).toEqual([]);
    expect(data.activeCheckouts).toEqual([]);
    expect(data.equipment).toEqual([]);
    expect(activeCheckouts.get).not.toHaveBeenCalled();
  });

  it("returns only the owning student's checkout data for students", async () => {
    mockAuth({ id: "student-auth-1", user_metadata: { role: "Student" } });
    const { activeCheckouts } = mockDb({
      ownedStudent: { name: "Student One", period: "PM", is_active: true, user_id: "student-auth-1" },
      equipment: [{ name: "Camera", category: "Camera", total_quantity: 1, serial_number: "CAM-001", is_active: true }],
      activeCheckouts: [{
        student_id: "student-owned",
        equipment_id: "equipment-1",
        quantity: 1,
        serial_number: "CAM-001",
        checked_out_at: "2026-08-09T12:00:00.000Z",
        checked_in_at: null,
        period: "PM",
      }],
    });

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.students).toHaveLength(1);
    expect(data.students[0]).toMatchObject({ id: "student-owned", name: "Student One" });
    expect(data.activeCheckouts).toHaveLength(1);
    expect(data.activeCheckouts[0].student_id).toBe("student-owned");
    expect(data.activeCheckouts[0].student).toMatchObject({ id: "student-owned" });
    expect(data.equipment[0]).toMatchObject({
      id: "equipment-1",
      available: 0,
      availableSerialNumbers: [],
    });
    expect(activeCheckouts.where).toHaveBeenCalledWith("student_id", "==", "student-owned");
  });

  it("excludes active checked-out barcode serials from student equipment availability", async () => {
    mockAuth({ id: "student-auth-1", user_metadata: { role: "Student" } });
    mockDb({
      ownedStudent: { name: "Student One", period: "PM", is_active: true, user_id: "student-auth-1" },
      equipment: [{ name: "Camera", category: "Camera", total_quantity: 1, serial_number: "CAM-001", is_active: true }],
      activeCheckouts: [],
      activeCheckoutSums: [{ equipment_id: "equipment-1", quantity: 1, serial_number: "CAM-001" }],
    });

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activeCheckouts).toEqual([]);
    expect(data.equipment[0]).toMatchObject({
      id: "equipment-1",
      available: 0,
      availableSerialNumbers: [],
    });
  });

  it("returns period roster, active checkouts, and availability for teachers", async () => {
    mockAuth({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockDb({
      teacherStudents: [{ name: "Student One", period: "PM", is_active: true }],
      equipment: [{ name: "Tripod", category: "Miscellaneous", total_quantity: 3, serial_number: null, is_active: true }],
      activeCheckouts: [{
        student_id: "student-1",
        equipment_id: "equipment-1",
        quantity: 1,
        checked_out_at: "2026-08-09T12:00:00.000Z",
        checked_in_at: null,
        period: "PM",
      }],
      activeCheckoutSums: [{ equipment_id: "equipment-1", quantity: 2, serial_number: null }],
    });

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.students).toHaveLength(1);
    expect(data.activeCheckouts).toHaveLength(1);
    expect(data.equipment[0]).toMatchObject({ id: "equipment-1", available: 1 });
  });
});
