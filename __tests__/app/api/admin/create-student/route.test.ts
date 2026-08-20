jest.mock("@/lib/firebase/server-auth", () => ({
  createFirebaseServerAuthClient: jest.fn(),
}));

jest.mock("@/lib/firebase/admin-client", () => ({
  getFirebaseAdminAuth: jest.fn(),
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

import { POST } from "@/app/api/admin/create-student/route";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetAuth = getFirebaseAdminAuth as jest.MockedFunction<typeof getFirebaseAdminAuth>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;

const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();
const mockSetCustomClaims = jest.fn();
const mockSetStudent = jest.fn();
const mockStudentWhere = jest.fn();
const mockStudentLimit = jest.fn();
const mockStudentGet = jest.fn();
const mockReservationDocGet = jest.fn();
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
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

function mockFirebaseAdmin() {
  mockCreateUser.mockResolvedValue({ uid: "student-auth-1" });
  mockDeleteUser.mockResolvedValue(undefined);
  mockSetCustomClaims.mockResolvedValue(undefined);
  mockSetStudent.mockResolvedValue(undefined);
  mockActiveStudentDocs = [];
  mockReservationDocs = {};
  mockGetAuth.mockReturnValue({
    createUser: mockCreateUser,
    deleteUser: mockDeleteUser,
    setCustomUserClaims: mockSetCustomClaims,
  } as never);
  const studentsQuery: {
    where: jest.Mock;
    limit: jest.Mock;
    get: jest.Mock;
  } = {
    where: mockStudentWhere,
    limit: mockStudentLimit,
    get: mockStudentGet.mockImplementation(async () => ({ docs: mockActiveStudentDocs })),
  };
  mockStudentWhere.mockImplementation(() => studentsQuery);
  mockStudentLimit.mockImplementation(() => studentsQuery);
  mockTransactionGet.mockResolvedValue({ exists: false, data: () => null });
  mockReservationDocGet.mockImplementation(async function getReservation(this: { id?: string }) {
    return mockReservationDocs[this.id ?? ""] ?? { exists: false, data: () => null };
  });
  mockTransactionSet.mockImplementation(() => undefined);
  mockRunTransaction.mockImplementation(async (callback) => callback({
    get: mockTransactionGet,
    set: mockTransactionSet,
    delete: jest.fn(),
  }));
  const collection = jest.fn((name: string) => ({
    where: studentsQuery.where,
    doc: jest.fn((id?: string) => {
      const docId = id ?? "student-doc-1";
      return {
        id: docId,
        path: `${name}/${docId}`,
        set: mockSetStudent,
        get: name === "identifier_reservations" ? mockReservationDocGet : jest.fn(),
      };
    }),
  }));
  mockGetDb.mockReturnValue({
    collection,
    runTransaction: mockRunTransaction,
  } as never);
}

const validBody = {
  first_name: "Jane",
  last_name: "Student",
  student_id: "12345",
  email: "JANE@bentonvillek12.org",
  password: "password123",
  period: "AM",
};

describe("POST /api/admin/create-student", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirebaseAdmin();
  });

  it("returns 401 when no user is signed in", async () => {
    mockUser(null);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("returns 403 when the signed-in user is not a teacher", async () => {
    mockUser({ id: "u1", user_metadata: { role: "Student" } });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/teachers/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("creates a Firebase Auth user and Firestore roster row for a teacher", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "jane@bentonvillek12.org",
      emailVerified: true,
      displayName: "Jane Student",
    }));
    expect(mockSetCustomClaims).toHaveBeenCalledWith("student-auth-1", expect.objectContaining({
      role: "Student",
      period: "AM",
      student_id: "12345",
    }));
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "student-doc-1",
    }), expect.objectContaining({
      id: "student-doc-1",
      email: "jane@bentonvillek12.org",
      email_key: "jane@bentonvillek12.org",
      student_id_key: "12345",
      user_id: "student-auth-1",
      is_active: true,
    }));
  });

  it("rejects non-school student emails before creating an auth user", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });

    const res = await POST(makeRequest({
      ...validBody,
      email: "jane@example.com",
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/bentonvillek12/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate active Student IDs before creating an auth user", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockActiveStudentDocs = [
      { id: "existing-student", data: () => ({ student_id_key: "12345" }) },
    ];

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate active student emails before creating an auth user", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockReservationDocs = {
      "student_email:jane%40bentonvillek12.org": {
        exists: true,
        data: () => ({ owner_id: "existing-student", owner_collection: "students" }),
      },
    };

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/email/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
