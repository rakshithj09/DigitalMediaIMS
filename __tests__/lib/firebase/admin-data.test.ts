jest.mock("@/lib/firebase/admin-client", () => ({
  getFirebaseAdminAuth: jest.fn(),
  getFirebaseAdminDb: jest.fn(),
}));

import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";

const mockGetDb = getFirebaseAdminDb as jest.MockedFunction<typeof getFirebaseAdminDb>;

describe("getFirebaseAdminDataClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applies filters, ordering, and limits to Firestore queries", async () => {
    const get = jest.fn(async () => ({
      docs: [
        {
          id: "request-1",
          data: () => ({ requested_at: "2026-08-09T12:00:00.000Z" }),
        },
      ],
    }));
    const query = {
      where: jest.fn(() => query),
      orderBy: jest.fn(() => query),
      limit: jest.fn(() => query),
      get,
    };
    const collection = jest.fn(() => query);
    mockGetDb.mockReturnValue({ collection } as never);

    const result = await getFirebaseAdminDataClient()
      .from("student_approval_requests")
      .select("id, requested_at")
      .is("approved_at", null)
      .order("requested_at", { ascending: true })
      .limit(25);

    expect(result.error).toBeNull();
    expect(collection).toHaveBeenCalledWith("student_approval_requests");
    expect(query.where).toHaveBeenCalledWith("approved_at", "==", null);
    expect(query.orderBy).toHaveBeenCalledWith("requested_at", "asc");
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(result.data).toEqual([
      { id: "request-1", requested_at: "2026-08-09T12:00:00.000Z" },
    ]);
  });
});
