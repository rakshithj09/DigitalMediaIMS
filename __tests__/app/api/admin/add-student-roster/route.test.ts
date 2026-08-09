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

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function makeWhereChain(existingDoc: unknown | null) {
  const chain = {
    where: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    get: jest.fn(async () => ({ docs: existingDoc ? [existingDoc] : [] })),
  };
  return chain;
}

function mockFirestore(existing = false) {
  const existingDoc = existing ? { id: "existing-student", ref: { set: mockSetExisting } } : null;
  const chain = makeWhereChain(existingDoc);
  const collection = {
    where: chain.where,
    doc: jest.fn(() => ({
      id: "new-student",
      set: mockSetNew,
    })),
  };
  mockGetDb.mockReturnValue({
    collection: jest.fn(() => collection),
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
    expect(mockSetNew).toHaveBeenCalledWith(expect.objectContaining({
      id: "new-student",
      name: "Jane Student",
      period: "PM",
      email: "jane@bentonvillek12.org",
      user_id: "student-auth-1",
      is_active: true,
    }));
  });

  it("updates an existing roster row for the same auth user", async () => {
    mockUser({ id: "teacher-1", user_metadata: { role: "Teacher" } });
    mockFirestore(true);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(mockSetExisting).toHaveBeenCalledWith(expect.objectContaining({
      name: "Jane Student",
      period: "PM",
      email: "jane@bentonvillek12.org",
    }), { merge: true });
    expect(mockSetNew).not.toHaveBeenCalled();
  });
});
