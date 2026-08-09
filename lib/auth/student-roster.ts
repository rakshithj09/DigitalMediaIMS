import type { AppUser as User } from "@/lib/firebase/types";
import { getFirebaseAdminDataClient } from "@/lib/firebase/admin-data";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function ensureVerifiedStudentRosterRow(user: User) {
  const metadata = user.user_metadata ?? {};
  if (metadata.role !== "Student") return { skipped: "not_student" as const };

  const confirmedAt = user.email_confirmed_at ?? user.confirmed_at;
  if (!confirmedAt) return { skipped: "unverified" as const };

  const email = clean(user.email).toLowerCase();
  const firstName = clean(metadata.first_name);
  const lastName = clean(metadata.last_name);
  const period = clean(metadata.period);
  const studentId = clean(metadata.student_id);

  if (!email || !firstName || !lastName || !studentId || (period !== "AM" && period !== "PM")) {
    throw new Error("Verified student account is missing required roster metadata.");
  }

  const admin = getFirebaseAdminDataClient();

  const studentBody = {
    name: `${firstName} ${lastName}`,
    period,
    student_id: studentId,
    email,
    user_id: user.id,
    is_active: true,
  };

  const { data: existing, error: lookupError } = await admin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing?.id) {
    const { error } = await admin.from("students").update(studentBody).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, action: "updated" as const };
  }

  const { error } = await admin.from("students").insert(studentBody);
  if (error) throw new Error(error.message);

  return { ok: true as const, action: "inserted" as const };
}
