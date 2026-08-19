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

import { POST } from "@/app/api/admin/teacher-approvals/route";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { verifyFirebasePassword } from "@/lib/firebase/server-password";

const mockCreateClient = createFirebaseServerAuthClient as jest.MockedFunction<
  typeof createFirebaseServerAuthClient
>;
const mockGetAdminData = getFirebaseAdminDataClient as jest.MockedFunction<
  typeof getFirebaseAdminDataClient
>;
const mockVerifyPassword = verifyFirebasePassword as jest.MockedFunction<typeof verifyFirebasePassword>;

const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

describe("POST /api/admin/teacher-approvals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminData.mockReturnValue({ from: mockFrom } as never);
    mockVerifyPassword.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("returns 403 when the signed-in user is not a teacher", async () => {
    mockUser({ id: "u1", email: "student@bentonvillek12.org", user_metadata: { role: "Student" } });

    const res = await POST(makeRequest({
      email: "teacher@bentonvillek12.org",
      teacherPassword: "secret",
    }));

    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("stores approved teachers by normalized email document id", async () => {
    mockUser({ id: "teacher-1", email: "admin@bentonvillek12.org", user_metadata: { role: "Teacher" } });

    const res = await POST(makeRequest({
      email: " New.Teacher@BentonvilleK12.org ",
      teacherPassword: "secret",
    }));

    expect(res.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith("admin@bentonvillek12.org", "secret");
    expect(mockFrom).toHaveBeenCalledWith("approved_teachers");
    expect(mockUpsert).toHaveBeenCalledWith({
      id: "new.teacher@bentonvillek12.org",
      email: "new.teacher@bentonvillek12.org",
      invited_by: "teacher-1",
      used_at: null,
      approved_user_id: null,
    }, { onConflict: "email" });
  });
});
