jest.mock("@/lib/firebase/admin-client", () => ({
  getFirebaseAdminAuth: jest.fn(),
  getFirebaseAdminDb: jest.fn(),
}));

jest.mock("@/lib/auth/student-approvals", () => ({
  createStudentApprovalRequest: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/auth/create-account/route";
import { createStudentApprovalRequest } from "@/lib/auth/student-approvals";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-client";

const mockGetAuth = getFirebaseAdminAuth as jest.MockedFunction<typeof getFirebaseAdminAuth>;
const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;
const mockCreateStudentApprovalRequest = createStudentApprovalRequest as jest.MockedFunction<
  typeof createStudentApprovalRequest
>;

const mockGetUserByEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockSetCustomUserClaims = jest.fn();
const mockDeleteUser = jest.fn();
const mockApprovalSet = jest.fn();
const mockProfileSet = jest.fn();

type QueryMock = {
  where: jest.Mock;
  limit: jest.Mock;
  get: jest.Mock;
};

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function makeApprovalDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    exists: true,
    data: () => data,
  };
}

function mockFirestore(options: {
  directApproval?: ReturnType<typeof makeApprovalDoc>;
  queriedApproval?: ReturnType<typeof makeApprovalDoc>;
  activeStudentDocs?: Array<{ id: string; data: () => Record<string, unknown> }>;
} = {}) {
  const approvalQuery: QueryMock = {
    where: jest.fn(),
    limit: jest.fn(),
    get: jest.fn(async () => ({
      docs: options.queriedApproval ? [options.queriedApproval] : [],
    })),
  };
  approvalQuery.where.mockImplementation(() => approvalQuery);
  approvalQuery.limit.mockImplementation(() => approvalQuery);
  const approvedTeachers = {
    doc: jest.fn((id: string) => ({
      get: jest.fn(async () => options.directApproval ?? { id, exists: false, data: () => ({}) }),
      set: mockApprovalSet,
    })),
    where: approvalQuery.where,
  };
  const profiles = {
    doc: jest.fn(() => ({ set: mockProfileSet })),
  };
  const studentsQuery: Pick<QueryMock, "where" | "get"> = {
    where: jest.fn(),
    get: jest.fn(async () => ({ docs: options.activeStudentDocs ?? [] })),
  };
  studentsQuery.where.mockImplementation(() => studentsQuery);
  const students = {
    where: studentsQuery.where,
  };
  const collection = jest.fn((name: string) => {
    if (name === "approved_teachers") return approvedTeachers;
    if (name === "profiles") return profiles;
    if (name === "students") return students;
    return { doc: jest.fn(() => ({ set: jest.fn() })) };
  });

  mockGetDb.mockReturnValue({ collection } as never);
  return { approvalQuery, approvedTeachers, profiles };
}

const teacherBody = {
  email: "new.teacher@bentonvillek12.org",
  password: "password123",
  firstName: "New",
  lastName: "Teacher",
  role: "Teacher",
};

describe("POST /api/auth/create-account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuth.mockReturnValue({
      getUserByEmail: mockGetUserByEmail,
      createUser: mockCreateUser,
      setCustomUserClaims: mockSetCustomUserClaims,
      deleteUser: mockDeleteUser,
    } as never);
    mockGetUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
    mockCreateUser.mockResolvedValue({ uid: "new-teacher-uid" });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
    mockCreateStudentApprovalRequest.mockResolvedValue({ ok: true });
    mockApprovalSet.mockResolvedValue(undefined);
    mockProfileSet.mockResolvedValue(undefined);
  });

  it("rejects teacher signups without an approval record", async () => {
    mockFirestore();

    const res = await POST(makeRequest(teacherBody));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/not been approved/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("accepts existing approval records found by email and marks that document used", async () => {
    const legacyApproval = makeApprovalDoc("legacy-approval-id", {
      email: "new.teacher@bentonvillek12.org",
      used_at: null,
    });
    const { approvalQuery } = mockFirestore({ queriedApproval: legacyApproval });

    const res = await POST(makeRequest(teacherBody));

    expect(res.status).toBe(200);
    expect(approvalQuery.where).toHaveBeenCalledWith("email", "==", "new.teacher@bentonvillek12.org");
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "new.teacher@bentonvillek12.org",
      password: "password123",
      displayName: "New Teacher",
      emailVerified: false,
    });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("new-teacher-uid", {
      first_name: "New",
      last_name: "Teacher",
      role: "Teacher",
    });
    expect(mockApprovalSet).toHaveBeenCalledWith(expect.objectContaining({
      email: "new.teacher@bentonvillek12.org",
      approved_user_id: "new-teacher-uid",
    }), { merge: true });
    expect(mockProfileSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "new-teacher-uid",
      email: "new.teacher@bentonvillek12.org",
      role: "staff",
      is_staff: true,
    }), { merge: true });
  });

  it("rejects student signups that conflict with an active roster student", async () => {
    mockFirestore({
      activeStudentDocs: [
        { id: "existing-student", data: () => ({ student_id_key: "12345" }) },
      ],
    });

    const res = await POST(makeRequest({
      email: "new.student@bentonvillek12.org",
      password: "password123",
      firstName: "New",
      lastName: "Student",
      role: "Student",
      period: "AM",
      studentId: "12345",
    }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/student id/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
