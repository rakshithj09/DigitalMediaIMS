import type { User as FirebaseUser } from "firebase/auth";

export type UserRole = "Teacher" | "Student";

export type AppUser = FirebaseUser & {
  id: string;
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: {
    role?: UserRole | string;
    first_name?: string;
    last_name?: string;
    period?: "AM" | "PM" | string;
    student_id?: string;
    [key: string]: unknown;
  };
};

export type AuthSession = {
  user: AppUser;
};

export type QueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};
