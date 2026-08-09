import { formatAuthError } from "@/lib/firebase/auth-errors";

describe("formatAuthError", () => {
  it("hides raw invalid credential Firebase errors", () => {
    expect(formatAuthError({ code: "auth/invalid-credential", message: "Firebase: Error (auth/invalid-credential)." }))
      .toBe("Incorrect email or password.");
  });

  it("parses auth codes from Firebase message text", () => {
    expect(formatAuthError("Firebase: Error (auth/email-already-in-use)."))
      .toBe("An account already exists for this email.");
  });

  it("keeps existing email verification copy", () => {
    expect(formatAuthError("Email not confirmed"))
      .toBe("Please verify your email before signing in.");
  });

  it("falls back for unknown raw Firebase errors", () => {
    expect(formatAuthError("Firebase: Error (auth/internal-error).", "Try again later."))
      .toBe("Try again later.");
  });
});
