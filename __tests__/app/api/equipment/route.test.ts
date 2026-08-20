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

import { PATCH, POST } from "@/app/api/equipment/route";
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

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockLimit = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionDelete = jest.fn();
let mockQueryRows: Array<Record<string, unknown>> = [];

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function mockTeacherAuth(email = "teacher@example.com") {
  mockUser({ id: "u1", email, user_metadata: { role: "Teacher" } });
}

function mockStudentAuth() {
  mockUser({ id: "u2", email: "student@example.com", user_metadata: { role: "Student" } });
}

function mockNoAuth() {
  mockUser(null);
}

function mockAdminDataClient() {
  const builder = {
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    insert: mockInsert,
    maybeSingle: mockMaybeSingle,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mockQueryRows, error: null }).then(resolve),
  };

  mockFrom.mockReturnValue(builder);
  mockGetDataClient.mockReturnValue({ from: mockFrom } as never);
}

function mockAdminDb() {
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
      doc: jest.fn((id?: string) => ({
        id: id ?? "eq-new",
        path: `${name}/${id ?? "eq-new"}`,
      })),
    })),
    runTransaction: mockRunTransaction,
  } as never);
}

describe("POST /api/equipment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminDataClient();
    mockAdminDb();
    mockQueryRows = [];
    mockInsert.mockResolvedValue({ error: null });
    mockVerifyPassword.mockResolvedValue(null);
  });

  it("returns 401 when no user is signed in", async () => {
    mockNoAuth();
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 403 when a student tries to create equipment", async () => {
    mockStudentAuth();
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/teacher/i);
  });

  it("validates required create input", async () => {
    mockTeacherAuth();
    await expect(POST(makeRequest({ category: "Camera", totalQuantity: 1 }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(makeRequest({ name: "My Cam", category: "InvalidCat", totalQuantity: 1 }))).resolves.toMatchObject({ status: 400 });
    await expect(POST(makeRequest({ name: "My Cam", category: "Camera", totalQuantity: 0 }))).resolves.toMatchObject({ status: 400 });
  });

  it("requires one barcode for serialized equipment creates", async () => {
    mockTeacherAuth();
    const res = await POST(
      makeRequest({
        name: "Camera A",
        category: "Camera",
        totalQuantity: 1,
        serialNumber: "CAM-001\nCAM-002",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/exactly one barcode/i);
  });

  it("rejects grouped barcode-tracked equipment creates", async () => {
    mockTeacherAuth();
    const res = await POST(
      makeRequest({
        name: "Camera A",
        category: "Camera",
        totalQuantity: 2,
        serialNumber: "IGNITE-CAMERA-A-001",
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/one physical item/i);
  });

  it("rejects duplicate active barcode creates case-insensitively", async () => {
    mockTeacherAuth();
    mockQueryRows = [{ id: "eq-existing", serial_number: "ignite-camera-001" }];

    const res = await POST(
      makeRequest({
        name: "Camera B",
        category: "Camera",
        totalQuantity: 1,
        serialNumber: "IGNITE-CAMERA-001",
      })
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already assigned/i);
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("barcode_key", "ignite-camera-001");
    expect(mockEq).toHaveBeenCalledWith("is_active", true);
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it("does not block creates when only inactive records share the barcode", async () => {
    mockTeacherAuth();
    mockQueryRows = [];

    const res = await POST(
      makeRequest({
        name: "Camera B",
        category: "Camera",
        totalQuantity: 1,
        serialNumber: "IGNITE-CAMERA-001",
      })
    );

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "eq-new",
    }), expect.objectContaining({
      serial_number: "IGNITE-CAMERA-001",
      barcode_key: "ignite-camera-001",
    }));
    expect(mockEq).toHaveBeenCalledWith("barcode_key", "ignite-camera-001");
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it("inserts valid equipment", async () => {
    mockTeacherAuth();
    const res = await POST(
      makeRequest({ name: "Tripod", category: "Miscellaneous", totalQuantity: 5 })
    );

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "eq-new",
    }), expect.objectContaining({
      name: "Tripod",
      total_quantity: 5,
      barcode_key: null,
      is_active: true,
    }));
  });

  it("returns 400 when the transaction fails", async () => {
    mockTeacherAuth();
    mockRunTransaction.mockRejectedValue(new Error("Constraint violation"));

    const res = await POST(
      makeRequest({ name: "Tripod", category: "Miscellaneous", totalQuantity: 1 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/constraint/i);
  });
});

describe("PATCH /api/equipment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminDataClient();
    mockAdminDb();
    mockQueryRows = [];
    mockMaybeSingle.mockResolvedValue({
      data: { id: "eq-1", total_quantity: 5, serial_number: null, category: "Miscellaneous" },
      error: null,
    });
    mockVerifyPassword.mockResolvedValue(null);
  });

  it("returns 401 when no user is signed in", async () => {
    mockNoAuth();
    const res = await PATCH(makeRequest({ id: "eq-1", name: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when a student tries to update equipment", async () => {
    mockStudentAuth();
    const res = await PATCH(makeRequest({ id: "eq-1", name: "New Name" }));
    expect(res.status).toBe(403);
  });

  it("validates required update input", async () => {
    mockTeacherAuth();
    await expect(PATCH(makeRequest({ name: "New Name" }))).resolves.toMatchObject({ status: 400 });
    await expect(PATCH(makeRequest({ id: "eq-1" }))).resolves.toMatchObject({ status: 400 });
    await expect(PATCH(makeRequest({ id: "eq-1", name: "   " }))).resolves.toMatchObject({ status: 400 });
  });

  it("returns 404 when the equipment id does not exist", async () => {
    mockTeacherAuth();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await PATCH(makeRequest({ id: "bad-id", name: "New Name" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it("verifies the teacher password before deactivating equipment", async () => {
    mockTeacherAuth();
    const res = await PATCH(makeRequest({
      id: "eq-1",
      isActive: false,
      teacherPassword: "secret",
    }));

    expect(res.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith("teacher@example.com", "secret");
  });

  it("releases barcode reservations when deactivating barcode equipment", async () => {
    mockTeacherAuth();
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "eq-1",
        total_quantity: 1,
        serial_number: "IGNITE-CAMERA-001",
        barcode_key: "ignite-camera-001",
        category: "Camera",
        is_active: true,
      },
      error: null,
    });
    mockTransactionGet.mockResolvedValue({
      exists: true,
      data: () => ({ owner_id: "eq-1", owner_collection: "equipment" }),
    });

    const res = await PATCH(makeRequest({
      id: "eq-1",
      isActive: false,
      teacherPassword: "secret",
    }));

    expect(res.status).toBe(200);
    expect(mockTransactionDelete).toHaveBeenCalled();
  });

  it("returns 403 when deactivation password verification fails", async () => {
    mockTeacherAuth();
    mockVerifyPassword.mockResolvedValue("Password was incorrect.");

    const res = await PATCH(makeRequest({
      id: "eq-1",
      isActive: false,
      teacherPassword: "wrong",
    }));
    expect(res.status).toBe(403);
  });

  it("updates valid equipment fields", async () => {
    mockTeacherAuth();
    const res = await PATCH(makeRequest({ id: "eq-1", name: "Updated Tripod" }));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "eq-1",
    }), {
      name: "Updated Tripod",
      barcode_key: null,
    }, { merge: true });
  });

  it("allows non-barcoded equipment quantities above one", async () => {
    mockTeacherAuth();
    const res = await PATCH(makeRequest({ id: "eq-1", totalQuantity: 6 }));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "eq-1",
    }), {
      total_quantity: 6,
      barcode_key: null,
    }, { merge: true });
  });

  it("rejects barcode-tracked equipment updates with quantity above one", async () => {
    mockTeacherAuth();
    mockMaybeSingle.mockResolvedValue({
      data: { id: "eq-1", total_quantity: 1, serial_number: "IGNITE-CAMERA-001", category: "Camera" },
      error: null,
    });

    const res = await PATCH(makeRequest({ id: "eq-1", totalQuantity: 2 }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/one physical item/i);
  });

  it("rejects duplicate active barcode updates on another item", async () => {
    mockTeacherAuth();
    mockMaybeSingle.mockResolvedValue({
      data: { id: "eq-1", total_quantity: 1, serial_number: "IGNITE-CAMERA-001", category: "Camera" },
      error: null,
    });
    mockQueryRows = [
      { id: "eq-2", serial_number: "ignite-camera-002" },
    ];

    const res = await PATCH(makeRequest({ id: "eq-1", serialNumber: "IGNITE-CAMERA-002" }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already assigned/i);
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("barcode_key", "ignite-camera-002");
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it("allows updating barcode equipment while keeping its current barcode", async () => {
    mockTeacherAuth();
    mockMaybeSingle.mockResolvedValue({
      data: { id: "eq-1", total_quantity: 1, serial_number: "IGNITE-CAMERA-001", category: "Camera" },
      error: null,
    });
    mockQueryRows = [
      { id: "eq-1", serial_number: "ignite-camera-001" },
    ];

    const res = await PATCH(makeRequest({
      id: "eq-1",
      name: "Updated Camera",
      serialNumber: "IGNITE-CAMERA-001",
    }));

    expect(res.status).toBe(200);
    expect(mockTransactionSet).toHaveBeenCalledWith(expect.objectContaining({
      id: "eq-1",
    }), {
      name: "Updated Camera",
      serial_number: "IGNITE-CAMERA-001",
      barcode_key: "ignite-camera-001",
    }, { merge: true });
    expect(mockEq).toHaveBeenCalledWith("barcode_key", "ignite-camera-001");
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it("rejects equipment reactivation when its retained barcode conflicts", async () => {
    mockTeacherAuth();
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "eq-1",
        total_quantity: 1,
        serial_number: "IGNITE-CAMERA-001",
        barcode_key: "ignite-camera-001",
        category: "Camera",
        is_active: false,
      },
      error: null,
    });
    mockQueryRows = [
      { id: "eq-2", serial_number: "ignite-camera-001", barcode_key: "ignite-camera-001" },
    ];

    const res = await PATCH(makeRequest({ id: "eq-1", isActive: true }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already assigned/i);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("returns 409 when the barcode reservation belongs to another item", async () => {
    mockTeacherAuth();
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "eq-1",
        total_quantity: 1,
        serial_number: "IGNITE-CAMERA-001",
        barcode_key: "ignite-camera-001",
        category: "Camera",
        is_active: false,
      },
      error: null,
    });
    mockTransactionGet.mockResolvedValue({
      exists: true,
      data: () => ({ owner_id: "eq-2", owner_collection: "equipment" }),
    });

    const res = await PATCH(makeRequest({ id: "eq-1", isActive: true }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already assigned/i);
  });
});
