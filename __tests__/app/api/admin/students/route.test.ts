jest.mock("@/lib/firebase/server-auth", () => ({
  createFirebaseServerAuthClient: jest.fn(),
}));

jest.mock("@/lib/firebase/admin-data", () => ({
  getFirebaseAdminDataClient: jest.fn(),
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
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { verifyFirebasePassword } from "@/lib/firebase/server-password";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetDataClient = getFirebaseAdminDataClient as jest.MockedFunction<
  typeof getFirebaseAdminDataClient
>;
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

describe("admin students route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults.length = 0;
    mockAdminDataClient();
    mockVerifyPassword.mockResolvedValue(null);
    mockAuthUpdate.mockResolvedValue({ error: null });
    mockAuthDelete.mockResolvedValue({ error: null });
  });

  it("rejects student edits that duplicate another active Student ID", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    queryResults.push({ data: [{ id: "student-2" }], error: null });

    const res = await PATCH(makeRequest({ id: "student-1", studentId: "12345" }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects student edits that duplicate another active email", async () => {
    mockUser({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "Teacher" } });
    queryResults.push({ data: [{ id: "student-2" }], error: null });

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
    queryResults.push(
      { data: [{ id: "student-1" }], error: null },
      {
        data: {
          id: "student-1",
          name: "Jane Student",
          student_id: "12345",
          email: "jane@bentonvillek12.org",
          period: "AM",
          user_id: null,
        },
        error: null,
      },
    );

    const res = await PATCH(makeRequest({ id: "student-1", studentId: "12345" }));

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ student_id: "12345" });
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
});
