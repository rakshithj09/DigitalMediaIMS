import { NextResponse } from "next/server";
import { createStudentApprovalRequest, getStudentApprovalRequestByUserId, markStudentApprovalEmailVerified } from "@/lib/auth/student-approvals";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

export async function POST() {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (user.user_metadata?.role !== "Student") {
    return NextResponse.json({ error: "Only student accounts can request student approval." }, { status: 403 });
  }

  try {
    await createStudentApprovalRequest(user);
    const emailSync = await markStudentApprovalEmailVerified(user);
    const request = await getStudentApprovalRequestByUserId(user.id);
    const emailVerified = "skipped" in emailSync ? emailSync.skipped !== "unverified" : true;

    return NextResponse.json({
      ok: true,
      emailVerified,
      request: request
        ? {
            userId: request.user_id,
            email: request.email,
            requestedAt: request.requested_at,
            emailVerifiedAt: request.email_verified_at,
            approvedAt: request.approved_at,
            rosterStudentId: request.roster_student_id,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
