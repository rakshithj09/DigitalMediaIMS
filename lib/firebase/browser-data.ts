import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import {
  browserLocalPersistence,
  confirmPasswordReset,
  getIdToken,
  getIdTokenResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User as FirebaseUser,
} from "firebase/auth";
import { getFirebaseBrowserAuth, getFirebaseBrowserDb } from "@/lib/firebase/browser-client";
import type { AppUser, AuthSession, QueryResult } from "@/lib/firebase/types";

type Filter = {
  field: string;
  value: unknown;
};

type Order = {
  field: string;
  ascending: boolean;
};

type Row = Record<string, unknown>;

function toIsoValue(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return value;
}

function normalizeRow(id: string, data: Row) {
  return Object.fromEntries(Object.entries({ id, ...data }).map(([key, value]) => [key, toIsoValue(value)]));
}

async function toAppUser(user: FirebaseUser | null): Promise<AppUser | null> {
  if (!user) return null;
  const token = await getIdTokenResult(user, true).catch(() => null);
  const claims = (token?.claims ?? {}) as Record<string, unknown>;
  return Object.assign(user, {
    id: user.uid,
    confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    user_metadata: {
      role: typeof claims.role === "string" ? claims.role : undefined,
      first_name: typeof claims.first_name === "string" ? claims.first_name : undefined,
      last_name: typeof claims.last_name === "string" ? claims.last_name : undefined,
      period: typeof claims.period === "string" ? claims.period : undefined,
      student_id: typeof claims.student_id === "string" ? claims.student_id : undefined,
    },
  }) as AppUser;
}

async function enrichCheckouts<T extends Row>(rows: T[], selectValue: string) {
  const shouldLoadStudent = selectValue.includes("student:students");
  const shouldLoadEquipment = selectValue.includes("equipment:equipment");
  if (!shouldLoadStudent && !shouldLoadEquipment) return rows;

  const db = getFirebaseBrowserDb();
  const studentIds = Array.from(new Set(rows.map((row) => String(row.student_id ?? "")).filter(Boolean)));
  const equipmentIds = Array.from(new Set(rows.map((row) => String(row.equipment_id ?? "")).filter(Boolean)));
  const students = new Map<string, Row>();
  const equipment = new Map<string, Row>();

  await Promise.all([
    shouldLoadStudent
      ? Promise.all(studentIds.map(async (id) => {
          const snap = await getDoc(doc(db, "students", id));
          if (snap.exists()) students.set(id, normalizeRow(snap.id, snap.data()));
        }))
      : Promise.resolve(),
    shouldLoadEquipment
      ? Promise.all(equipmentIds.map(async (id) => {
          const snap = await getDoc(doc(db, "equipment", id));
          if (snap.exists()) equipment.set(id, normalizeRow(snap.id, snap.data()));
        }))
      : Promise.resolve(),
  ]);

  return rows.map((row) => ({
    ...row,
    ...(shouldLoadStudent ? { student: students.get(String(row.student_id)) ?? null } : {}),
    ...(shouldLoadEquipment ? { equipment: equipment.get(String(row.equipment_id)) ?? null } : {}),
  }));
}

class FirebaseQuery<T = Row> implements PromiseLike<QueryResult<T[]>> {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private rowLimit: number | null = null;
  private selectValue = "*";

  constructor(private readonly collectionName: string) {}

  select(value: string) {
    this.selectValue = value;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, value });
    return this;
  }

  is(field: string, value: unknown) {
    this.filters.push({ field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orders.push({ field, ascending: options?.ascending ?? true });
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  maybeSingle(): Promise<QueryResult<T | null>> {
    return this.execute().then((result) => ({
      data: result.data?.[0] ?? null,
      error: result.error,
    }));
  }

  then<TResult1 = QueryResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<T[]>> {
    try {
      const db = getFirebaseBrowserDb();
      const constraints: QueryConstraint[] = [
        ...this.filters.map((filter) => where(filter.field, "==", filter.value)),
        ...this.orders.map((order) => orderBy(order.field, order.ascending ? "asc" : "desc")),
      ];
      if (this.rowLimit !== null) constraints.push(limitQuery(this.rowLimit));

      const snapshot = await getDocs(query(collection(db, this.collectionName), ...constraints));
      let rows = snapshot.docs.map((item) => normalizeRow(item.id, item.data()) as T);
      if (this.collectionName === "checkouts") {
        rows = await enrichCheckouts(rows as Row[], this.selectValue) as T[];
      }
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
  }
}

type AuthResponse<T> = Promise<{ data: T; error: { message: string } | null }>;

type FirebaseDataClient = {
  auth: {
    getUser(): AuthResponse<{ user: AppUser | null }>;
    getSession(): AuthResponse<{ session: AuthSession | null }>;
    getIdToken(): Promise<string | null>;
    signInWithPassword(credentials: { email: string; password: string }): AuthResponse<Record<string, never> | null>;
    resetPasswordForEmail(email: string, options?: { redirectTo?: string }): AuthResponse<Record<string, never> | null>;
    updateUser(update: { password?: string }): AuthResponse<Record<string, never> | null>;
    confirmPasswordReset(code: string, password: string): AuthResponse<Record<string, never> | null>;
    signOut(): Promise<{ error: null }>;
    onAuthStateChange(callback: (_event: string, session: AuthSession | null) => void): {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
  from<T = Row>(collectionName: string): FirebaseQuery<T>;
};

let client: FirebaseDataClient | null = null;

export function createFirebaseDataClient(): FirebaseDataClient {
  if (client) return client;

  const auth = getFirebaseBrowserAuth();
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);

  client = {
    auth: {
      async getUser() {
        const user = auth.currentUser ?? await new Promise<FirebaseUser | null>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            unsubscribe();
            resolve(nextUser);
          });
        });
        return { data: { user: await toAppUser(user) }, error: null };
      },
      async getSession() {
        const { data } = await this.getUser();
        return { data: { session: data.user ? { user: data.user } as AuthSession : null }, error: null };
      },
      async getIdToken() {
        return auth.currentUser ? getIdToken(auth.currentUser, true) : null;
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          return { data: {}, error: null };
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
      async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
        try {
          await sendPasswordResetEmail(auth, email, options?.redirectTo ? { url: options.redirectTo } : undefined);
          return { data: {}, error: null };
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
      async updateUser({ password }: { password?: string }) {
        try {
          if (!auth.currentUser || !password) throw new Error("You must be signed in to update your password.");
          await updatePassword(auth.currentUser, password);
          return { data: {}, error: null };
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
      async confirmPasswordReset(code: string, password: string) {
        try {
          await confirmPasswordReset(auth, code, password);
          return { data: {}, error: null };
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
      async signOut() {
        await signOut(auth);
        return { error: null };
      },
      onAuthStateChange(callback: (_event: string, session: AuthSession | null) => void) {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          const appUser = await toAppUser(user);
          callback(appUser ? "SIGNED_IN" : "SIGNED_OUT", appUser ? { user: appUser } : null);
        });
        return { data: { subscription: { unsubscribe } } };
      },
    },
    from<T = Row>(collectionName: string) {
      return new FirebaseQuery<T>(collectionName);
    },
  };

  return client;
}
