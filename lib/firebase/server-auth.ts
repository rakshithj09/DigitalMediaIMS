import { headers } from "next/headers";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-client";
import type { AppUser } from "@/lib/firebase/types";

function toAppUser(user: Awaited<ReturnType<ReturnType<typeof getFirebaseAdminAuth>["getUser"]>>): AppUser {
  const claims = (user.customClaims ?? {}) as Record<string, unknown>;
  return {
    uid: user.uid,
    id: user.uid,
    displayName: user.displayName ?? null,
    confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber ?? null,
    photoURL: user.photoURL ?? null,
    providerId: "firebase",
    isAnonymous: false,
    metadata: {
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
    },
    providerData: [],
    refreshToken: "",
    tenantId: user.tenantId ?? null,
    delete: async () => undefined,
    getIdToken: async () => "",
    getIdTokenResult: async () => {
      throw new Error("getIdTokenResult is not available on server AppUser objects.");
    },
    reload: async () => undefined,
    toJSON: () => ({ uid: user.uid, email: user.email }),
    user_metadata: {
      role: typeof claims.role === "string" ? claims.role : undefined,
      first_name: typeof claims.first_name === "string" ? claims.first_name : undefined,
      last_name: typeof claims.last_name === "string" ? claims.last_name : undefined,
      period: typeof claims.period === "string" ? claims.period : undefined,
      student_id: typeof claims.student_id === "string" ? claims.student_id : undefined,
    },
  } as AppUser;
}

export async function createFirebaseServerAuthClient() {
  return {
    auth: {
      async getUser() {
        const headerStore = await headers();
        const authorization = headerStore.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
        if (!token) return { data: { user: null }, error: null };

        try {
          const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
          const user = await getFirebaseAdminAuth().getUser(decoded.uid);
          return { data: { user: toAppUser(user) }, error: null };
        } catch (err) {
          return {
            data: { user: null },
            error: { message: err instanceof Error ? err.message : String(err) },
          };
        }
      },
    },
  };
}
