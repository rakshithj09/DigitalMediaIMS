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
const mockSetCustomClaims = jest.fn();
const mockSetStudent = jest.fn();
const mockStudentWhere = jest.fn();
const mockStudentLimit = jest.fn();
const mockStudentGet = jest.fn();
let mockStudentConflictDocs: unknown[][] = [];

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
  mockSetCustomClaims.mockResolvedValue(undefined);
  mockSetStudent.mockResolvedValue(undefined);
  mockStudentConflictDocs = [];
  mockGetAuth.mockReturnValue({
    createUser: mockCreateUser,
    setCustomUserClaims: mockSetCustomClaims,
  } as never);
  const studentsQuery: {
    where: jest.Mock;
    limit: jest.Mock;
    get: jest.Mock;
  } = {
    where: mockStudentWhere,
    limit: mockStudentLimit,
    get: mockStudentGet.mockImplementation(async () => ({ docs: mockStudentConflictDocs.shift() ?? [] })),
  };
  mockStudentWhere.mockImplementation(() => studentsQuery);
  mockStudentLimit.mockImplementation(() => studentsQuery);
  mockGetDb.mockReturnValue({
    collection: jest.fn(() => ({
      where: studentsQuery.where,
      doc: jest.fn(() => ({
        id: "student-doc-1",
        set: mockSetStudent,
      })),
    })),
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
    expect(mockSetStudent).toHaveBeenCalledWith(expect.objectContaining({
      id: "student-doc-1",
      email: "jane@bentonvillek12.org",
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
    mockStudentConflictDocs = [[{ id: "existing-student" }]];

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate active student emails before creating an auth user", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockStudentConflictDocs = [[], [{ id: "existing-student" }]];

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/email/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
