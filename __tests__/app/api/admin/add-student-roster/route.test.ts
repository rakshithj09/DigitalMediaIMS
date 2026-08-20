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

import { POST } from "@/app/api/admin/add-student-roster/route";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;

const mockSetExisting = jest.fn();
const mockSetNew = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockGet = jest.fn();
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionDelete = jest.fn();
let mockQueryDocs: unknown[][] = [];

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function mockFirestore(queryDocs: unknown[][] = []) {
  mockQueryDocs = [...queryDocs];
  const chain: {
    where: jest.Mock;
    limit: jest.Mock;
    get: jest.Mock;
  } = {
    where: mockWhere,
    limit: mockLimit,
    get: mockGet,
  };
  mockWhere.mockImplementation(() => chain);
  mockLimit.mockImplementation(() => chain);
  mockGet.mockImplementation(async () => ({ docs: mockQueryDocs.shift() ?? [] }));
  mockTransactionGet.mockResolvedValue({ exists: false, data: () => null });
  mockTransactionSet.mockImplementation(() => undefined);
  mockTransactionDelete.mockImplementation(() => undefined);
  mockRunTransaction.mockImplementation(async (callback) => callback({
    get: mockTransactionGet,
    set: mockTransactionSet,
    delete: mockTransactionDelete,
  }));
  const collection = {
    where: mockWhere,
    doc: jest.fn((id?: string) => ({
      id: id ?? "new-student",
      path: `students/${id ?? "new-student"}`,
      set: mockSetNew,
    })),
  };
  mockGetDb.mockReturnValue({
    collection: jest.fn(() => collection),
    runTransaction: mockRunTransaction,
  } as never);
}

const validBody = {
  name: "Jane Student",
  period: "PM",
  user_id: "student-auth-1",
  email: "JANE@bentonvillek12.org",
  student_id: "12345",
};

describe("POST /api/admin/add-student-roster", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore();
  });

  it("returns 401 when no user is signed in", async () => {
    mockUser(null);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    expect(mockSetNew).not.toHaveBeenCalled();
  });

  it("returns 403 when the signed-in user is not a teacher", async () => {
    mockUser({ id: "u1", user_metadata: { role: "Student" } });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/teachers/i);
    expect(mockSetNew).not.toHaveBeenCalled();
  });

  it("creates a roster row for a teacher", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "new-student",
    }), expect.objectContaining({
      id: "new-student",
      name: "Jane Student",
      period: "PM",
      email: "jane@bentonvillek12.org",
      email_key: "jane@bentonvillek12.org",
      student_id_key: "12345",
      user_id: "student-auth-1",
      is_active: true,
    }), { merge: false });
  });

  it("updates an existing roster row for the same auth user", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    const existingDoc = {
      id: "existing-student",
      ref: { id: "existing-student", path: "students/existing-student", set: mockSetExisting },
      data: () => ({
        student_id: "12345",
        email: "jane@bentonvillek12.org",
        is_active: true,
      }),
    };
    mockFirestore([[existingDoc], [existingDoc]]);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "existing-student",
    }), expect.objectContaining({
      name: "Jane Student",
      period: "PM",
      email: "jane@bentonvillek12.org",
    }), { merge: true });
    expect(mockSetNew).not.toHaveBeenCalled();
  });

  it("rejects duplicate active Student IDs on another roster row", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockFirestore([[], [{ id: "other-student", data: () => ({ student_id_key: "12345" }) }]]);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockSetNew).not.toHaveBeenCalled();
  });

  it("rejects duplicate active student emails on another roster row", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockFirestore([[], [{ id: "other-student", data: () => ({ email_key: "jane@bentonvillek12.org" }) }]]);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/email/i);
    expect(mockSetNew).not.toHaveBeenCalled();
  });

  it("allows updating the same auth user's roster row with its current identifiers", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    const existingDoc = {
      id: "existing-student",
      ref: { id: "existing-student", path: "students/existing-student", set: mockSetExisting },
      data: () => ({
        student_id: "12345",
        email: "jane@bentonvillek12.org",
        is_active: true,
      }),
    };
    mockFirestore([[existingDoc], [existingDoc]]);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "existing-student",
    }), expect.objectContaining({
      id: "existing-student",
      student_id_key: "12345",
      email_key: "jane@bentonvillek12.org",
    }), { merge: true });
    expect(mockSetNew).not.toHaveBeenCalled();
  });

  it("rejects non-school student emails", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });

    const res = await POST(makeRequest({
      ...validBody,
      email: "jane@example.com",
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/bentonvillek12/i);
    expect(mockSetNew).not.toHaveBeenCalled();
  });

  it("rejects empty normalized Student IDs", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });

    const res = await POST(makeRequest({
      ...validBody,
      student_id: "   ",
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
