import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import type { AppUser } from "@/lib/firebase/types";

type Row = Record<string, unknown>;
type QueryResult<T> = { data: T | null; error: { message: string; code?: string } | null };

function toIsoValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeRow(id: string, data: Row) {
  return Object.fromEntries(Object.entries({ id, ...data }).map(([key, value]) => [key, toIsoValue(value)]));
}

function toAppUser(user: Awaited<ReturnType<ReturnType<typeof getFirebaseAdminAuth>["getUser"]>>): AppUser {
  const claims = (user.customClaims ?? {}) as Record<string, unknown>;
  return {
    uid: user.uid,
    id: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber ?? null,
    photoURL: user.photoURL ?? null,
    providerId: "firebase",
    confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
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

class FirebaseAdminQuery implements PromiseLike<QueryResult<Row[]>> {
  private filters: Array<{ field: string; value: unknown }> = [];
  private rowLimit: number | null = null;
  private mutation:
    | { kind: "insert"; value: Row | Row[] }
    | { kind: "update"; value: Row }
    | { kind: "upsert"; value: Row | Row[] }
    | { kind: "delete" }
    | null = null;

  constructor(private readonly collectionName: string) {}

  select(_columns?: string) {
    void _columns;
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

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  order(_field?: string, _options?: { ascending?: boolean }) {
    void _field;
    void _options;
    return this;
  }

  insert(value: Row | Row[]) {
    this.mutation = { kind: "insert", value };
    return this.execute();
  }

  update(value: Row) {
    this.mutation = { kind: "update", value };
    return this;
  }

  upsert(value: Row | Row[], _options?: unknown) {
    void _options;
    this.mutation = { kind: "upsert", value };
    return this.execute();
  }

  maybeSingle(): Promise<QueryResult<Row | null>> {
    return this.execute().then((result) => ({
      data: result.data?.[0] ?? null,
      error: result.error,
    }));
  }

  single(): Promise<QueryResult<Row | null>> {
    return this.maybeSingle();
  }

  delete() {
    this.mutation = { kind: "delete" };
    return this;
  }

  then<TResult1 = QueryResult<Row[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async getMatchingDocs() {
    const db = getFirebaseAdminDb();
    let ref: FirebaseFirestore.Query = db.collection(this.collectionName);
    for (const filter of this.filters) {
      ref = ref.where(filter.field, "==", filter.value);
    }
    if (this.rowLimit !== null) ref = ref.limit(this.rowLimit);
    return ref.get();
  }

  private async execute(): Promise<QueryResult<Row[]>> {
    try {
      const db = getFirebaseAdminDb();
      const mutation = this.mutation;

      if (mutation?.kind === "insert" || mutation?.kind === "upsert") {
        const values = Array.isArray(mutation.value) ? mutation.value : [mutation.value];
        await Promise.all(values.map(async (value) => {
          const id = typeof value.id === "string" && value.id ? value.id : db.collection(this.collectionName).doc().id;
          await db.collection(this.collectionName).doc(id).set({
            ...value,
            id,
            created_at: value.created_at ?? new Date().toISOString(),
          }, { merge: mutation.kind === "upsert" });
        }));
        return { data: values, error: null };
      }

      if (mutation?.kind === "update") {
        const snap = await this.getMatchingDocs();
        await Promise.all(snap.docs.map((item) => item.ref.set(mutation.value, { merge: true })));
        return { data: snap.docs.map((item) => normalizeRow(item.id, item.data())), error: null };
      }

      if (mutation?.kind === "delete") {
        const snap = await this.getMatchingDocs();
        await Promise.all(snap.docs.map((item) => item.ref.delete()));
        return { data: snap.docs.map((item) => normalizeRow(item.id, item.data())), error: null };
      }

      const snap = await this.getMatchingDocs();
      return { data: snap.docs.map((item) => normalizeRow(item.id, item.data())), error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
  }
}

export function getFirebaseAdminDataClient() {
  return {
    from(collectionName: string) {
      return new FirebaseAdminQuery(collectionName);
    },
    auth: {
      admin: {
        async listUsers({ page = 1, perPage = 1000 }: { page?: number; perPage?: number } = {}) {
          const result = await getFirebaseAdminAuth().listUsers(perPage);
          const start = (page - 1) * perPage;
          return { data: { users: result.users.slice(start, start + perPage) }, error: null };
        },
        async getUserById(uid: string) {
          try {
            const user = await getFirebaseAdminAuth().getUser(uid);
            return { data: { user: toAppUser(user) }, error: null };
          } catch (err) {
            return { data: { user: null }, error: { message: err instanceof Error ? err.message : String(err) } };
          }
        },
        async updateUserById(uid: string, update: { email?: string; user_metadata?: Row }) {
          try {
            await getFirebaseAdminAuth().updateUser(uid, update.email ? { email: update.email } : {});
            if (update.user_metadata) await getFirebaseAdminAuth().setCustomUserClaims(uid, update.user_metadata);
            return { data: {}, error: null };
          } catch (err) {
            return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
          }
        },
        async deleteUser(uid: string, _shouldSoftDelete?: boolean) {
          void _shouldSoftDelete;
          try {
            await getFirebaseAdminAuth().deleteUser(uid);
            return { data: {}, error: null };
          } catch (err) {
            return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
          }
        },
      },
    },
  };
}
