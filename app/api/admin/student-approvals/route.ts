import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { ensureVerifiedStudentRosterRow } from "@/lib/auth/student-roster";
import { getStudentApprovalRequestByUserId } from "@/lib/auth/student-approvals";

type ApproveBody = {
  userId?: string;
};

async function requireTeacher() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", status: 401 };
  }

  if (user.user_metadata?.role === "Student") {
    return { error: "Only teachers can approve student accounts.", status: 403 };
  }

  return { user };
}

export async function GET() {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("student_approval_requests")
    .select("user_id, email, first_name, last_name, student_id, period, requested_at, email_verified_at, approved_at, roster_student_id")
    .is("approved_at", null)
    .order("requested_at", { ascending: true });

  if (error) {
    const message = error.code === "42P01"
      ? "Database update needed: run supabase/student-approval-requests.sql in Supabase, then refresh this page."
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    requests: (data ?? []).map((request) => ({
      userId: request.user_id,
      email: request.email,
      firstName: request.first_name,
      lastName: request.last_name,
      studentId: request.student_id,
      period: request.period,
      requestedAt: request.requested_at,
      emailVerifiedAt: request.email_verified_at,
      approvedAt: request.approved_at,
      rosterStudentId: request.roster_student_id,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing Supabase service configuration." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as ApproveBody;
  if (!body.userId) {
    return NextResponse.json({ error: "Student approval user id is required." }, { status: 400 });
  }

  let approvalRequest;
  try {
    approvalRequest = await getStudentApprovalRequestByUserId(body.userId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }

  if (!approvalRequest) {
    return NextResponse.json({ error: "Student approval request was not found." }, { status: 404 });
  }

  if (approvalRequest.approved_at) {
    return NextResponse.json({ error: "This student has already been approved." }, { status: 400 });
  }

  if (!approvalRequest.email_verified_at) {
    return NextResponse.json({ error: "This student still needs to verify their email before approval." }, { status: 400 });
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(body.userId);
  if (authUserError || !authUser.user) {
    return NextResponse.json({ error: authUserError?.message ?? "Student auth account was not found." }, { status: 400 });
  }

  try {
    await ensureVerifiedStudentRosterRow(authUser.user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }

  const { data: student, error: studentLookupError } = await admin
    .from("students")
    .select("id")
    .eq("user_id", body.userId)
    .limit(1)
    .maybeSingle();

  if (studentLookupError) {
    return NextResponse.json({ error: studentLookupError.message }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("student_approval_requests")
    .update({
      approved_at: new Date().toISOString(),
      approved_by: auth.user.id,
      roster_student_id: student?.id ?? null,
    })
    .eq("user_id", body.userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    userId: body.userId,
    rosterStudentId: student?.id ?? null,
  });
}
