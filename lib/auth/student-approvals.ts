import type { AppUser as User } from "@/lib/firebase/types";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";

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
  const admin = getFirebaseAdminDataClient();

  const email = clean(user.email).toLowerCase();
  const firstName = clean(metadata.first_name);
  const lastName = clean(metadata.last_name);
  const studentId = clean(metadata.student_id);
  const period = clean(metadata.period);

  if (!email || !firstName || !lastName || !studentId || (period !== "AM" && period !== "PM")) {
    throw new Error("Student account is missing required approval metadata.");
  }

  const requestBody = {
    user_id: user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    student_id: studentId,
    period,
    email_verified_at: confirmedAt(user),
  };

  const { data: existing, error: lookupError } = await admin
    .from("student_approval_requests")
    .select("id, requested_at, email_verified_at")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    if (lookupError.code === "42P01") {
      throw new Error("Firestore collection missing: student_approval_requests.");
    }
    throw new Error(lookupError.message);
  }

  const existingId = typeof existing?.id === "string" ? existing.id : null;
  const existingRequestedAt = typeof existing?.requested_at === "string" ? existing.requested_at : null;
  const existingEmailVerifiedAt = typeof existing?.email_verified_at === "string" ? existing.email_verified_at : null;

  const { error } = existingId
    ? await admin
        .from("student_approval_requests")
        .update({
          ...requestBody,
          requested_at: existingRequestedAt ?? new Date().toISOString(),
          email_verified_at: requestBody.email_verified_at ?? existingEmailVerifiedAt,
        })
        .eq("id", existingId)
    : await admin
        .from("student_approval_requests")
        .insert({
      id: user.id,
      user_id: user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      student_id: studentId,
      period,
      requested_at: new Date().toISOString(),
      email_verified_at: confirmedAt(user),
      approved_at: null,
      approved_by: null,
      roster_student_id: null,
    });

  if (!error) return { ok: true as const };
  if (error.code === "42P01") {
    throw new Error("Firestore collection missing: student_approval_requests.");
  }
  throw new Error(error.message);
}

export async function markStudentApprovalEmailVerified(user: User) {
  if (!isStudent(user)) return { skipped: "not_student" as const };

  const admin = getFirebaseAdminDataClient();

  const emailVerifiedAt = confirmedAt(user);
  if (!emailVerifiedAt) return { skipped: "unverified" as const };

  const { error } = await admin
    .from("student_approval_requests")
    .update({ email_verified_at: emailVerifiedAt })
    .eq("user_id", user.id);

  if (!error) return { ok: true as const };
  if (error.code === "42P01") {
    throw new Error("Firestore collection missing: student_approval_requests.");
  }
  throw new Error(error.message);
}

export async function getStudentApprovalRequestByUserId(userId: string) {
  const admin = getFirebaseAdminDataClient();

  const { data, error } = await admin
    .from("student_approval_requests")
    .select("user_id, email, first_name, last_name, student_id, period, requested_at, email_verified_at, approved_at, approved_by, roster_student_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) return data;
  if (error.code === "42P01") {
    throw new Error("Firestore collection missing: student_approval_requests.");
  }
  throw new Error(error.message);
}
