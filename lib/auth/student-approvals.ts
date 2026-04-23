import { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isStudent(user: User) {
  return user.user_metadata?.role === "Student";
}

function confirmedAt(user: User) {
  return user.email_confirmed_at ?? user.confirmed_at ?? null;
}

export async function createStudentApprovalRequest(user: User) {
  if (!isStudent(user)) return { skipped: "not_student" as const };

  const metadata = user.user_metadata ?? {};
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Server is missing Supabase service configuration.");

  const email = clean(user.email).toLowerCase();
  const firstName = clean(metadata.first_name);
  const lastName = clean(metadata.last_name);
  const studentId = clean(metadata.student_id);
  const period = clean(metadata.period);

  if (!email || !firstName || !lastName || !studentId || (period !== "AM" && period !== "PM")) {
    throw new Error("Student account is missing required approval metadata.");
  }

  const { error } = await admin
    .from("student_approval_requests")
    .upsert({
      user_id: user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      student_id: studentId,
      period,
      email_verified_at: confirmedAt(user),
    }, { onConflict: "user_id" });

  if (!error) return { ok: true as const };
  if (error.code === "42P01") {
    throw new Error("Database update needed: run supabase/student-approval-requests.sql in Supabase, then try again.");
  }
  throw new Error(error.message);
}

export async function markStudentApprovalEmailVerified(user: User) {
  if (!isStudent(user)) return { skipped: "not_student" as const };

  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Server is missing Supabase service configuration.");

  const emailVerifiedAt = confirmedAt(user);
  if (!emailVerifiedAt) return { skipped: "unverified" as const };

  const { error } = await admin
    .from("student_approval_requests")
    .update({ email_verified_at: emailVerifiedAt })
    .eq("user_id", user.id);

  if (!error) return { ok: true as const };
  if (error.code === "42P01") {
    throw new Error("Database update needed: run supabase/student-approval-requests.sql in Supabase, then try again.");
  }
  throw new Error(error.message);
}

export async function getStudentApprovalRequestByUserId(userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Server is missing Supabase service configuration.");

  const { data, error } = await admin
    .from("student_approval_requests")
    .select("user_id, email, first_name, last_name, student_id, period, requested_at, email_verified_at, approved_at, approved_by, roster_student_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) return data;
  if (error.code === "42P01") {
    throw new Error("Database update needed: run supabase/student-approval-requests.sql in Supabase, then try again.");
  }
  throw new Error(error.message);
}
