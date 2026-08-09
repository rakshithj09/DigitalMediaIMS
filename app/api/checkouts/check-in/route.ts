import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";

type Body = {
  checkoutId?: string;
  returnNotes?: string | null;
};

async function getOwnedStudentId(userId: string): Promise<string | null> {
  const snap = await getFirebaseAdminDb()
    .collection("students")
    .where("user_id", "==", userId)
    .where("is_active", "==", true)
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
}

export async function POST(req: Request) {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to check in equipment." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.checkoutId) {
    return NextResponse.json({ error: "checkoutId is required." }, { status: 400 });
  }

  try {
    const checkoutRef = getFirebaseAdminDb().collection("checkouts").doc(body.checkoutId);
    const checkoutDoc = await checkoutRef.get();
    const checkout = checkoutDoc.exists ? checkoutDoc.data() as { student_id?: string; checked_in_at?: string | null } : null;

    if (!checkout || checkout.checked_in_at) {
      return NextResponse.json({ error: "Active checkout was not found." }, { status: 404 });
    }

    if (user.user_metadata?.role === "Student") {
      const ownedStudentId = await getOwnedStudentId(user.id);
      if (!ownedStudentId || checkout.student_id !== ownedStudentId) {
        return NextResponse.json({ error: "You can only check in equipment you checked out." }, { status: 403 });
      }
    }

    const update = {
      checked_in_at: new Date().toISOString(),
      return_notes: body.returnNotes?.trim() || null,
    };
    await checkoutRef.set(update, { merge: true });

    return NextResponse.json({ checkout: { id: body.checkoutId, ...checkout, ...update } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
