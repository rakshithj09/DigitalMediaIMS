jest.mock("@/lib/firebase/server-auth", () => ({
  createFirebaseServerAuthClient: jest.fn(),
}));

jest.mock("@/lib/firebase/admin-data", () => ({
  getFirebaseAdminDataClient: jest.fn(),
}));

jest.mock("@/lib/firebase/admin-client", () => ({
  getFirebaseAdminDb: jest.fn(),
}));

jest.mock("@/lib/firebase/server-password", () => ({
  verifyFirebasePassword: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { DELETE, PATCH } from "@/app/api/admin/students/route";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { verifyFirebasePassword } from "@/lib/firebase/server-password";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetDataClient = getFirebaseAdminDataClient as jest.MockedFunction<
  typeof getFirebaseAdminDataClient
>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;
const mockVerifyPassword = verifyFirebasePassword as jest.MockedFunction<
  typeof verifyFirebasePassword
>;

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const queryResults: QueryResult[] = [];
const mockFrom = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();
const mockAuthUpdate = jest.fn();
const mockAuthDelete = jest.fn();
const mockStudentDocGet = jest.fn();
const mockStudentWhere = jest.fn();
const mockStudentLimit = jest.fn();
const mockStudentGet = jest.fn();
const mockReservationDocGet = jest.fn();
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionDelete = jest.fn();
let mockCurrentStudent: Record<string, unknown> | null = null;
let mockActiveStudentDocs: unknown[] = [];
let mockReservationDocs: Record<string, { exists: boolean; data: () => Record<string, unknown> | null }> = {};

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function nextQueryResult(): QueryResult {
  return queryResults.shift() ?? { data: [], error: null };
}

function mockAdminDataClient() {
  mockFrom.mockImplementation(() => {
    const builder = {
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      limit: mockLimit.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      delete: mockDelete.mockReturnThis(),
      single: mockSingle.mockImplementation(async () => nextQueryResult()),
      then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(nextQueryResult()).then(resolve),
    };
    return builder;
  });

  mockGetDataClient.mockReturnValue({
    from: mockFrom,
    auth: {
      admin: {
        updateUserById: mockAuthUpdate,
        deleteUser: mockAuthDelete,
      },
    },
  } as never);
}

function mockAdminDb() {
  mockCurrentStudent = {
    id: "student-1",
    name: "Jane Student",
    student_id: "12345",
    student_id_key: "12345",
    email: "jane@bentonvillek12.org",
    email_key: "jane@bentonvillek12.org",
    period: "AM",
    is_active: true,
    user_id: null,
  };
  mockActiveStudentDocs = [];
  mockStudentDocGet.mockImplementation(async () => ({
    exists: Boolean(mockCurrentStudent),
    data: () => mockCurrentStudent,
  }));
  const whereChain = {
    where: mockStudentWhere,
    limit: mockStudentLimit,
    get: mockStudentGet,
  };
  mockStudentWhere.mockImplementation(() => whereChain);
  mockStudentLimit.mockImplementation(() => whereChain);
  mockStudentGet.mockImplementation(async () => ({ docs: mockActiveStudentDocs }));
  mockReservationDocGet.mockImplementation(async function getReservation(this: { id?: string }) {
    return mockReservationDocs[this.id ?? ""] ?? { exists: false, data: () => null };
  });
  mockTransactionGet.mockResolvedValue({ exists: false, data: () => null });
  mockTransactionSet.mockImplementation(() => undefined);
  mockTransactionDelete.mockImplementation(() => undefined);
  mockRunTransaction.mockImplementation(async (callback) => callback({
    get: mockTransactionGet,
    set: mockTransactionSet,
    delete: mockTransactionDelete,
  }));

  mockGetDb.mockReturnValue({
    collection: jest.fn((name: string) => ({
      doc: jest.fn((id?: string) => {
        const docId = id ?? "student-1";
        return {
          id: docId,
          path: `${name}/${docId}`,
          get: name === "identifier_reservations" ? mockReservationDocGet : mockStudentDocGet,
        };
      }),
      where: mockStudentWhere,
    })),
    runTransaction: mockRunTransaction,
  } as never);
}

describe("admin students route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults.length = 0;
    mockReservationDocs = {};
    mockAdminDataClient();
    mockAdminDb();
    mockVerifyPassword.mockResolvedValue(null);
    mockAuthUpdate.mockResolvedValue({ error: null });
    mockAuthDelete.mockResolvedValue({ error: null });
  });

  it("rejects student edits that duplicate another active Student ID", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    mockActiveStudentDocs = [
      { id: "student-2", data: () => ({ student_id_key: "12345" }) },
    ];

    const res = await PATCH(makeRequest({ id: "student-1", studentId: "12345" }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockStudentWhere).toHaveBeenCalledWith("student_id_key", "==", "12345");
    expect(mockStudentLimit).toHaveBeenCalledWith(2);
  });

  it("rejects student edits that duplicate another active email", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    mockReservationDocs = {
      "student_email:other%40bentonvillek12.org": {
        exists: true,
        data: () => ({ owner_id: "student-2", owner_collection: "students" }),
      },
    };

    const res = await PATCH(makeRequest({
      id: "student-1",
      email: "other@bentonvillek12.org",
    }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/email/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows student edits when the matching active identifier belongs to the same row", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    mockActiveStudentDocs = [
      { id: "student-1", data: () => ({ student_id_key: "12345" }) },
    ];

    const res = await PATCH(makeRequest({ id: "student-1", studentId: "12345" }));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "student-1",
    }), expect.objectContaining({
      student_id: "12345",
      student_id_key: "12345",
    }), { merge: true });
  });

  it("rejects reactivating a student when retained identifiers conflict", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    mockCurrentStudent = {
      id: "student-1",
      name: "Jane Student",
      student_id: "12345",
      email: "jane@bentonvillek12.org",
      period: "AM",
      is_active: false,
    };
    mockActiveStudentDocs = [
      { id: "student-2", data: () => ({ student_id_key: "12345" }) },
    ];

    const res = await PATCH(makeRequest({ id: "student-1", isActive: true }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("returns 409 when a student identifier reservation belongs to another row", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    mockCurrentStudent = {
      id: "student-1",
      name: "Jane Student",
      student_id: "12345",
      email: "jane@bentonvillek12.org",
      period: "AM",
      is_active: false,
    };
    mockReservationDocs = {
      "student_id:12345": {
        exists: true,
        data: () => ({ owner_id: "student-2", owner_collection: "students" }),
      },
    };
    mockTransactionGet.mockResolvedValue({
      exists: true,
      data: () => ({ owner_id: "student-2", owner_collection: "students" }),
    });

    const res = await PATCH(makeRequest({ id: "student-1", isActive: true }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already assigned/i);
  });

  it("allows student edits when identifier reservations belong to the same row", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    mockReservationDocs = {
      "student_id:12345": {
        exists: true,
        data: () => ({ owner_id: "student-1", owner_collection: "students" }),
      },
      "student_email:jane%40bentonvillek12.org": {
        exists: true,
        data: () => ({ owner_id: "student-1", owner_collection: "students" }),
      },
    };
    mockActiveStudentDocs = [
      { id: "student-1", data: () => ({ student_id_key: "12345", email_key: "jane@bentonvillek12.org" }) },
    ];

    const res = await PATCH(makeRequest({ id: "student-1", studentId: "12345" }));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalled();
  });

  it("releases student identifier reservations when deactivating a student", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    mockTransactionGet.mockResolvedValue({
      exists: true,
      data: () => ({ owner_id: "student-1", owner_collection: "students" }),
    });

    const res = await PATCH(makeRequest({ id: "student-1", isActive: false }));

    expect(res.status).toBe(200);
    expect(mockTransactionDelete).toHaveBeenCalled();
  });

  it("rejects empty normalized Student IDs", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });

    const res = await PATCH(makeRequest({ id: "student-1", studentId: "   " }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("rejects deleting a student with active checkouts", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    queryResults.push({ data: [{ id: "checkout-1" }], error: null });

    const res = await DELETE(makeRequest({
      id: "student-1",
      teacherPassword: "secret",
    }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/active checkouts/i);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when deleting a missing student", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    queryResults.push(
      { data: [], error: null },
      { data: null, error: null },
    );

    const res = await DELETE(makeRequest({
      id: "missing-student",
      teacherPassword: "secret",
    }));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
    expect(mockTransactionDelete).not.toHaveBeenCalled();
    expect(mockAuthDelete).not.toHaveBeenCalled();
  });
});
