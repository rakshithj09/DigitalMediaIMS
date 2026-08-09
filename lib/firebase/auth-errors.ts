type AuthErrorLike = {
  message?: string | null;
  code?: string | null;
};

function extractAuthCode(error: AuthErrorLike | string | null | undefined) {
  if (!error) return "";
  if (typeof error !== "string" && error.code) return error.code;

  const message = typeof error === "string" ? error : error.message ?? "";
  return message.match(/\((auth\/[^)]+)\)/)?.[1] ?? "";
}

export function formatAuthError(error: AuthErrorLike | string | null | undefined, fallback = "Something went wrong. Please try again.") {
  const code = extractAuthCode(error);
  const message = typeof error === "string" ? error : error?.message ?? "";
  const lowerMessage = message.toLowerCase();

  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/invalid-email":
      return "Enter a valid school email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact your teacher.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, then try again.";
    case "auth/email-already-in-use":
      return "An account already exists for this email.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/expired-action-code":
      return "This link expired. Request a new password reset email.";
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used.";
    case "auth/requires-recent-login":
      return "Please sign in again before changing your password.";
    default:
      break;
  }

  if (lowerMessage.includes("email not confirmed") || lowerMessage.includes("email not verified")) {
    return "Please verify your email before signing in.";
  }

  if (lowerMessage.includes("already exists")) {
    return "An account already exists for this email.";
  }

  if (!message || lowerMessage.startsWith("firebase: error")) {
    return fallback;
  }

  return message;
}
