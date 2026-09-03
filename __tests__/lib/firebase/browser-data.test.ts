const mockAuth = {};

jest.mock("firebase/auth", () => ({
  __mockSetCustomParameters: jest.fn(),
  browserLocalPersistence: "local",
  confirmPasswordReset: jest.fn(),
  getIdToken: jest.fn(),
  getIdTokenResult: jest.fn(),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    setCustomParameters: jest.requireMock("firebase/auth").__mockSetCustomParameters,
  })),
  onAuthStateChanged: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  setPersistence: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  updatePassword: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

jest.mock("@/lib/firebase/browser-client", () => ({
  getFirebaseBrowserAuth: jest.fn(() => mockAuth),
  getFirebaseBrowserDb: jest.fn(() => ({})),
}));

import { createFirebaseDataClient } from "@/lib/firebase/browser-data";
import { getIdTokenResult, setPersistence, signInWithPopup } from "firebase/auth";

const mockAuthModule = jest.requireMock("firebase/auth") as {
  __mockSetCustomParameters: jest.Mock;
};
const mockSetCustomParameters = mockAuthModule.__mockSetCustomParameters;
const mockSignInWithPopup = signInWithPopup as jest.MockedFunction<typeof signInWithPopup>;
const mockGetIdTokenResult = getIdTokenResult as jest.MockedFunction<typeof getIdTokenResult>;
const mockSetPersistence = setPersistence as jest.MockedFunction<typeof setPersistence>;

describe("createFirebaseDataClient auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetPersistence.mockResolvedValue(undefined);
  });

  it("signs in with Google and returns an app user with role claims", async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: {
        uid: "google-user-1",
        email: "teacher@bentonvillek12.org",
        emailVerified: true,
      },
    });
    mockGetIdTokenResult.mockResolvedValue({
      claims: {
        role: "Teacher",
        first_name: "Teacher",
        last_name: "One",
      },
    });

    const result = await createFirebaseDataClient().auth.signInWithGoogle();

    expect(result.error).toBeNull();
    expect(mockSetCustomParameters).toHaveBeenCalledWith({ hd: "bentonvillek12.org" });
    expect(mockSignInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
    expect(result.data?.user).toMatchObject({
      id: "google-user-1",
      email: "teacher@bentonvillek12.org",
      user_metadata: {
        role: "Teacher",
        first_name: "Teacher",
        last_name: "One",
      },
    });
  });

  it("returns a formatted error object when Google popup sign-in fails", async () => {
    mockSignInWithPopup.mockRejectedValue(Object.assign(new Error("Firebase: Error (auth/popup-closed-by-user)."), {
      code: "auth/popup-closed-by-user",
    }));

    const result = await createFirebaseDataClient().auth.signInWithGoogle();

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: "auth/popup-closed-by-user",
      message: "Firebase: Error (auth/popup-closed-by-user).",
    });
  });
});
