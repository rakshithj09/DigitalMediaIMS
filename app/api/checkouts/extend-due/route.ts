import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-client";
import { createFirebaseServerAuthClient } from "@/lib/firebase/server-auth";
import { getChicagoTimeValue, getChicagoWeekday, isPeriodValue, isTimeWithinReturnWindow } from "@/app/lib/return-windows";

type Body = {
  checkoutId?: string;
  returnBy?: string;
};

type CheckoutRow = {
  checked_in_at?: string | null;
  due_at?: string | null;
  period?: string | null;
};

type RouteErrorStatus = 400 | 404;

class CheckoutExtensionError extends Error {
  status: RouteErrorStatus;

  constructor(message: string, status: RouteErrorStatus) {
    super(message);
    this.status = status;
  }
}

function getDueDate(value?: string | null) {
  if (!value) return null;
  const dueAt = new Date(value);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

function validateReturnWindow(period: "AM" | "PM", dueAt: Date) {
  const dueWeekdayInChicago = getChicagoWeekday(dueAt);
  if (dueWeekdayInChicago === "Sat" || dueWeekdayInChicago === "Sun") {
    return "Return date must be on a weekday (Monday through Friday) in America/Chicago.";
  }

  const dueTimeInChicago = getChicagoTimeValue(dueAt);
  if (!isTimeWithinReturnWindow(period, dueTimeInChicago)) {
    const allowedWindow = period === "AM" ? "7:45 AM to 10:00 AM" : "11:45 AM to 3:00 PM";
    return `Return time for ${period} students must be between ${allowedWindow} (America/Chicago).`;
  }

  return null;
}

export async function POST(req: Request) {
  const firebaseClient = await createFirebaseServerAuthClient();
  const {
    data: { user },
  } = await firebaseClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to extend a checkout due date." }, { status: 401 });
  }

  if (user.user_metadata?.role !== "Teacher") {
    return NextResponse.json({ error: "Only teachers can extend checkout due dates." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const newDueAt = getDueDate(body.returnBy);

  if (!body.checkoutId) {
    return NextResponse.json({ error: "checkoutId is required." }, { status: 400 });
  }

  if (!newDueAt || newDueAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "A valid future return date and time is required." }, { status: 400 });
  }

  try {
    const db = getFirebaseAdminDb();
    const checkoutRef = db.collection("checkouts").doc(body.checkoutId);
    const updatedCheckout = await db.runTransaction(async (transaction) => {
      const checkoutDoc = await transaction.get(checkoutRef);
      const checkout = checkoutDoc.exists ? checkoutDoc.data() as CheckoutRow : null;

      if (!checkout || checkout.checked_in_at) {
        throw new CheckoutExtensionError("Active checkout was not found.", 404);
      }

      const checkoutPeriod = checkout.period;
      if (!checkoutPeriod || !isPeriodValue(checkoutPeriod)) {
        throw new CheckoutExtensionError("Checkout is missing a valid class period.", 400);
      }

      const currentDueAt = getDueDate(checkout.due_at);
      if (!currentDueAt || newDueAt.getTime() <= currentDueAt.getTime()) {
        throw new CheckoutExtensionError("New due date must be later than the current due date.", 400);
      }

      const returnWindowError = validateReturnWindow(checkoutPeriod, newDueAt);
      if (returnWindowError) {
        throw new CheckoutExtensionError(returnWindowError, 400);
      }

      const update = {
        due_at: newDueAt.toISOString(),
        due_extended_at: new Date().toISOString(),
        due_extended_by: user.id,
      };
      transaction.set(checkoutRef, update, { merge: true });

      return { id: body.checkoutId, ...checkout, ...update };
    });

    return NextResponse.json({ checkout: updatedCheckout });
  } catch (err) {
    if (err instanceof CheckoutExtensionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
