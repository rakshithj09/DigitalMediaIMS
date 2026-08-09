jest.mock("@/lib/firebase/admin-client", () => ({
  getFirebaseAdminAuth: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/auth/account-exists/route";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-client";

const mockGetFirebaseAdminAuth = getFirebaseAdminAuth as jest.MockedFunction<typeof getFirebaseAdminAuth>;
const mockGetUserByEmail = jest.fn();

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

describe("POST /api/auth/account-exists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirebaseAdminAuth.mockReturnValue({ getUserByEmail: mockGetUserByEmail } as never);
  });

  it("rejects non-school emails", async () => {
    const res = await POST(makeRequest({ email: "person@example.com" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Email must be a @bentonvillek12.org address." });
  });

  it("returns true when the Firebase Auth user exists", async () => {
    mockGetUserByEmail.mockResolvedValue({ uid: "user-1" });

    const res = await POST(makeRequest({ email: "student@bentonvillek12.org" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: true });
    expect(mockGetUserByEmail).toHaveBeenCalledWith("student@bentonvillek12.org");
  });

  it("returns false when the Firebase Auth user does not exist", async () => {
    mockGetUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });

    const res = await POST(makeRequest({ email: "newstudent@bentonvillek12.org" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: false });
  });
});
