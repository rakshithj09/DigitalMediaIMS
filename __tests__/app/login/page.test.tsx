import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

const mockReplace = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSignOut = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/lib/firebase/browser-data", () => ({
  createFirebaseDataClient: () => ({
    auth: {
      signInWithGoogle: mockSignInWithGoogle,
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signOut: mockSignOut,
    },
  }),
}));

describe("LoginPage Google sign-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, "", "/login");
  });

  it("routes approved Google users to the app", async () => {
    mockSignInWithGoogle.mockResolvedValue({
      data: {
        user: {
          email: "teacher@bentonvillek12.org",
          user_metadata: { role: "Teacher" },
        },
      },
      error: null,
    });

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("signs out Google users without app roles and routes them to signup", async () => {
    mockSignInWithGoogle.mockResolvedValue({
      data: {
        user: {
          email: "student@bentonvillek12.org",
          user_metadata: {},
        },
      },
      error: null,
    });

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/email-password?mode=signUp&email=student%40bentonvillek12.org");
  });
});
