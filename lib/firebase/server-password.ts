export async function verifyFirebasePassword(email: string | undefined, password: string | undefined) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) return "Server is missing Firebase web API key configuration.";
  if (!email || !password?.trim()) return "Password is required.";

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  if (response.ok) return null;

  return "Password was incorrect.";
}
