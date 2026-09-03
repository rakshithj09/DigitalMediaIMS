"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Check, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import type { AppUser as User } from "@/lib/firebase/types";
import AppShell from "@/app/components/AppShell";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import PeriodBadge from "@/app/components/PeriodBadge";
import DatePicker from "@/app/components/DatePicker";
import SelectMenu from "@/components/ui/select-menu";
import { findEquipmentByBarcode } from "@/app/lib/barcodes";
import { usePeriod } from "@/app/lib/period-context";
import { filterTimeOptionsForPeriod, nextWeekday } from "@/app/lib/return-windows";
import { createFirebaseDataClient } from "@/lib/firebase/browser-data";
import { firebaseFetch } from "@/lib/firebase/auth-fetch";
import { Student, Equipment, Checkout } from "@/app/lib/types";
import { categorySupportsSerialNumbers, parseSerialNumbers } from "@/app/lib/serials";
import { formatDateTime, formatRemainingTime, getCheckoutDeadlineMeta } from "@/lib/checkout-deadlines";

type EquipmentWithAvail = Equipment & {
  available: number;
  availableSerialNumbers: string[];
  allSerialNumbers: string[];
};

type CheckoutOptionsResponse = {
  role?: string;
  period?: "AM" | "PM" | null;
  students?: Student[];
  equipment?: EquipmentWithAvail[];
  activeCheckouts?: Checkout[];
  error?: string | { message?: string };
};

function toLocalDateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toLocalTimeInputValue(date: Date) {
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function roundUpToFiveMinutes(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % 5;
  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (5 - remainder));
  }
  return rounded;
}

function createDefaultReturnDateTime() {
  const date = nextWeekday(roundUpToFiveMinutes(new Date()));
  return {
    date: toLocalDateInputValue(date),
    time: `${padTime(date.getHours())}:${padTime(date.getMinutes())}`,
  };
}

function createMinimumReturnDate() {
  return toLocalDateInputValue(nextWeekday(new Date()));
}

function createMinimumReturnTime(dateValue: string) {
  if (dateValue !== toLocalDateInputValue(new Date())) return null;
  const date = roundUpToFiveMinutes(new Date());
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function getCheckoutDueDateTime(checkout: Checkout) {
  const dueAt = checkout.due_at ? new Date(checkout.due_at) : null;
  if (!dueAt || Number.isNaN(dueAt.getTime())) return createDefaultReturnDateTime();

  return {
    date: toLocalDateInputValue(dueAt),
    time: toLocalTimeInputValue(dueAt),
  };
}

function getMinimumExtensionDate(checkout: Checkout) {
  const today = createMinimumReturnDate();
  const dueDate = getCheckoutDueDateTime(checkout).date;
  return dueDate > today ? dueDate : today;
}

function getDefaultExtensionDateTime(checkout: Checkout) {
  const dueDateTime = getCheckoutDueDateTime(checkout);
  const minimumDate = getMinimumExtensionDate(checkout);
  return {
    date: dueDateTime.date >= minimumDate ? dueDateTime.date : minimumDate,
    time: dueDateTime.time,
  };
}

function buildTimeOptions() {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 5) {
      options.push(`${padTime(hour)}:${padTime(minute)}`);
    }
  }
  return options;
}

function formatTimeOption(value: string) {
  const [hoursString, minutesString] = value.split(":");
  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${padTime(minutes)} ${suffix}`;
}

function CheckoutContent() {
  const { period } = usePeriod();
  const [students, setStudents] = useState<Student[]>([]);
  const [equipment, setEquipment] = useState<EquipmentWithAvail[]>([]);
  const [activeCheckouts, setActiveCheckouts] = useState<Checkout[] | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => {
    setActiveCheckouts(null);
    setTick((t) => t + 1);
  }, []);

  const [studentId, setStudentId] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ownStudentId, setOwnStudentId] = useState<string | null>(null);
  const [ownStudentName, setOwnStudentName] = useState<string | null>(null);
  const [ownStudentPeriod, setOwnStudentPeriod] = useState<"AM" | "PM" | null>(null);
  const [equipmentId, setEquipmentId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [serialNumber, setSerialNumber] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeFeedback, setBarcodeFeedback] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [returnDate, setReturnDate] = useState(() => createDefaultReturnDateTime().date);
  const [returnTime, setReturnTime] = useState(() => createDefaultReturnDateTime().time);
  const [minimumReturnDate] = useState(createMinimumReturnDate);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [requestedEquipmentId, setRequestedEquipmentId] = useState<string | null>(null);
  const [handledRequestedEquipmentId, setHandledRequestedEquipmentId] = useState<string | null>(null);

  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const [extendingDue, setExtendingDue] = useState<string | null>(null);
  const [extendDueDates, setExtendDueDates] = useState<Record<string, string>>({});
  const [extendDueTimes, setExtendDueTimes] = useState<Record<string, string>>({});
  const [extendDueErrors, setExtendDueErrors] = useState<Record<string, string>>({});
  const currentRole = (currentUser as unknown as { user_metadata?: { role?: string } })?.user_metadata?.role;
  const checkoutPeriod = currentRole === "Student" && ownStudentPeriod ? ownStudentPeriod : period;

  useEffect(() => {
    const eq = new URLSearchParams(window.location.search).get("eq");
    if (eq) {
      queueMicrotask(() => {
        setRequestedEquipmentId(eq);
        setEquipmentId(eq);
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await createFirebaseDataClient().auth.getUser();
        const u = res.data.user ?? null;
        if (!mounted) return;
        setCurrentUser(u);

        if (!u) return;

        const meta = (u as unknown as { user_metadata?: { role?: string; period?: string } }).user_metadata ?? {};
        if (meta.role === "Student") {
          setOwnStudentPeriod(meta.period === "PM" ? "PM" : "AM");
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setAuthResolved(true);
      }
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!authResolved) return;

    let cancelled = false;
    queueMicrotask(() => setLoadFailed(false));
    queueMicrotask(() => setLoadingData(true));

    firebaseFetch(`/api/checkouts/options?period=${encodeURIComponent(period)}`, { cache: "no-store" })
      .then(async (resp) => {
        const data = await resp.json().catch(() => ({})) as CheckoutOptionsResponse;
        if (!resp.ok) {
          const message = typeof data.error === "string" ? data.error : data.error?.message;
          throw new Error(message ?? "Unable to load checkout data.");
        }
        return data;
      })
      .then((data) => {
      if (cancelled) return;
      const nextStudents = data.students ?? [];
      const ownStudent = currentRole === "Student" ? nextStudents[0] : null;
      setStudents(nextStudents);
      if (ownStudent) {
        setStudentId(ownStudent.id);
        setOwnStudentId(ownStudent.id);
        setOwnStudentName(ownStudent.name ?? null);
        setOwnStudentPeriod(ownStudent.period === "PM" ? "PM" : "AM");
      } else if (currentRole === "Student") {
        setStudentId("");
        setOwnStudentId(null);
        setOwnStudentName(null);
        setOwnStudentPeriod(data.period === "PM" ? "PM" : data.period === "AM" ? "AM" : ownStudentPeriod);
      }
      setEquipment((data.equipment ?? []).map((item) => {
        const allSerialNumbers = item.allSerialNumbers ?? (categorySupportsSerialNumbers(item.category) ? parseSerialNumbers(item.serial_number) : []);
        return {
          ...item,
          available: Number(item.available ?? item.total_quantity ?? 0),
          allSerialNumbers,
          availableSerialNumbers: item.availableSerialNumbers ?? allSerialNumbers,
        };
      }));
      setActiveCheckouts(data.activeCheckouts ?? []);
      setLoadingData(false);
    }).catch(() => {
      if (cancelled) return;
      setSubmitError("Unable to load checkout data. Please refresh or contact your teacher.");
      setLoadFailed(true);
      setStudents([]);
      setEquipment([]);
      setActiveCheckouts([]);
      setLoadingData(false);
    });

    return () => { cancelled = true; };
  }, [authResolved, currentRole, ownStudentPeriod, period, tick]);

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const maxQty = selectedEquipment?.available ?? 0;
  const requiresBarcodeScan = Boolean(
    selectedEquipment && categorySupportsSerialNumbers(selectedEquipment.category)
  );
  const manualEquipmentOptions = equipment.filter(
    (item) => !categorySupportsSerialNumbers(item.category)
  );
  const timeOptions = filterTimeOptionsForPeriod(checkoutPeriod, buildTimeOptions());
  const minimumReturnTime = createMinimumReturnTime(returnDate);
  const availableTimeOptions = timeOptions.filter((time) => !minimumReturnTime || time >= minimumReturnTime);
  const selectedReturnTime = availableTimeOptions.includes(returnTime)
    ? returnTime
    : (availableTimeOptions[0] ?? "");
  const visibleActiveCheckouts = (activeCheckouts ?? []).filter((c) => {
    if (currentRole === "Student") return c.student_id === ownStudentId;
    return true;
  });

  useEffect(() => {
    if (!requestedEquipmentId || handledRequestedEquipmentId === requestedEquipmentId || loadingData) return;

    queueMicrotask(() => {
      const requestedEquipment = equipment.find((item) => item.id === requestedEquipmentId);
      if (!requestedEquipment) {
        setSubmitError("That equipment item is not available for checkout.");
        setHandledRequestedEquipmentId(requestedEquipmentId);
        return;
      }

      setEquipmentId(requestedEquipment.id);
      setQuantity("1");

      if (!categorySupportsSerialNumbers(requestedEquipment.category)) {
        setSerialNumber("");
        setBarcodeInput("");
        setBarcodeFeedback(null);
        setSubmitError(null);
        setHandledRequestedEquipmentId(requestedEquipmentId);
        return;
      }

      const allSerialNumbers = requestedEquipment.allSerialNumbers.length > 0
        ? requestedEquipment.allSerialNumbers
        : parseSerialNumbers(requestedEquipment.serial_number);

      if (allSerialNumbers.length === 0) {
        setSerialNumber("");
        setBarcodeInput("");
        setBarcodeFeedback(null);
        setSubmitError("This barcode item does not have a saved barcode. Scan or type the barcode label to continue.");
        setHandledRequestedEquipmentId(requestedEquipmentId);
        return;
      }

      if (allSerialNumbers.length > 1) {
        setSerialNumber("");
        setBarcodeInput("");
        setBarcodeFeedback(null);
        setSubmitError("This equipment has multiple barcode labels. Scan or type the exact barcode label to continue.");
        setHandledRequestedEquipmentId(requestedEquipmentId);
        return;
      }

      const barcode = allSerialNumbers[0];
      setSerialNumber(barcode);
      setBarcodeInput(barcode);

      const isAvailable = requestedEquipment.availableSerialNumbers.some(
        (serial) => serial.toLowerCase() === barcode.toLowerCase()
      );
      if (!isAvailable || requestedEquipment.available <= 0) {
        setBarcodeFeedback(null);
        setSubmitError(`${requestedEquipment.name} is already checked out.`);
        setHandledRequestedEquipmentId(requestedEquipmentId);
        return;
      }

      setSubmitError(null);
      setBarcodeFeedback(`Selected ${requestedEquipment.name} (${barcode}).`);
      setHandledRequestedEquipmentId(requestedEquipmentId);
    });
  }, [equipment, handledRequestedEquipmentId, loadingData, requestedEquipmentId]);

  const applyScannedBarcode = useCallback(
    (rawBarcode: string) => {
      const result = findEquipmentByBarcode(
        equipment.map((item) => ({
          id: item.id,
          name: item.name,
          barcodes: item.allSerialNumbers,
          availableBarcodes: item.availableSerialNumbers,
        })),
        rawBarcode
      );

      setBarcodeInput(rawBarcode.trim());

      if (result.status === "missing") {
        setBarcodeFeedback(null);
        setSubmitError("Enter or scan a barcode first.");
        return;
      }

      if (result.status === "not_found") {
        setBarcodeFeedback(null);
        setSubmitError("That barcode is not linked to any active equipment item.");
        return;
      }

      if (result.status === "duplicate") {
        setBarcodeFeedback(null);
        setSubmitError("That barcode is assigned to multiple equipment items. Fix the inventory entry before scanning.");
        return;
      }

      setEquipmentId(result.match.id);
      setSerialNumber(result.barcode);
      setQuantity("1");

      if (result.status === "unavailable") {
        setBarcodeFeedback(null);
        setSubmitError(`${result.match.name} matches this barcode, but that item is already checked out.`);
        return;
      }

      setSubmitError(null);
      setBarcodeFeedback(`Matched ${result.match.name} (${result.barcode}).`);
    },
    [equipment]
  );

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    setSubmitSuccess(false);

    const qty = parseInt(quantity, 10);
    const finalStudentId = ownStudentId ?? studentId;
    if (!finalStudentId) { setSubmitError("Please select a student."); setSubmitting(false); return; }
    if (!equipmentId) { setSubmitError("Scan a barcode or select an equipment item."); setSubmitting(false); return; }
    if (isNaN(qty) || qty < 1) { setSubmitError("Quantity must be at least 1."); setSubmitting(false); return; }
    if (qty > maxQty) { setSubmitError(`Only ${maxQty} unit(s) available.`); setSubmitting(false); return; }
    if (requiresBarcodeScan && !serialNumber) { setSubmitError("Scan the item's barcode to check it out."); setSubmitting(false); return; }
    if (!returnDate || !selectedReturnTime) { setSubmitError("Please choose when the item should be returned."); setSubmitting(false); return; }
    const returnBy = new Date(`${returnDate}T${selectedReturnTime}:00`);
    if (Number.isNaN(returnBy.getTime()) || returnBy.getTime() <= Date.now()) {
      setSubmitError("Return time must be in the future.");
      setSubmitting(false);
      return;
    }

    const checkoutResp = await firebaseFetch("/api/checkouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: finalStudentId,
        equipmentId,
        quantity: qty,
        serialNumber: serialNumber || null,
        notes,
        period: checkoutPeriod,
        returnBy: returnBy.toISOString(),
      }),
    });

    if (!checkoutResp.ok) {
      const data = await checkoutResp.json().catch(() => ({}));
      const msg = (data && (data.error?.message ?? data.error)) ?? "Checkout failed.";
      setSubmitError(String(msg));
    } else {
      if (!ownStudentId) setStudentId("");
      setEquipmentId("");
      setQuantity("1");
      setSerialNumber("");
      setBarcodeInput("");
      setBarcodeFeedback(null);
      setRequestedEquipmentId(null);
      setHandledRequestedEquipmentId(null);
      setNotes("");
      {
        const nextDefault = createDefaultReturnDateTime();
        setReturnDate(nextDefault.date);
        setReturnTime(nextDefault.time);
      }
      setSubmitSuccess(true);
      refresh();
    }
    setSubmitting(false);
  };

  const handleCheckIn = async (checkoutId: string) => {
    if (currentRole === "Student") {
      const co = (activeCheckouts ?? []).find((x) => x.id === checkoutId);
      if (!co || co.student_id !== ownStudentId) {
        alert("You can only check in items you have checked out.");
        return;
      }
    }

    setCheckingIn(checkoutId);
    const checkInResp = await firebaseFetch("/api/checkouts/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutId, returnNotes: returnNotes[checkoutId] ?? null }),
    });

    if (!checkInResp.ok) {
      const data = await checkInResp.json().catch(() => ({}));
      const msg = (data && (data.error?.message ?? data.error)) ?? "Check in failed.";
      alert("Check in failed: " + String(msg));
    } else refresh();
    setCheckingIn(null);
  };

  const getExtensionTimeOptions = (checkout: Checkout, dateValue: string) => {
    const checkoutDue = getCheckoutDueDateTime(checkout);
    const extensionPeriod = checkout.period === "PM" ? "PM" : "AM";
    const minimumTodayTime = createMinimumReturnTime(dateValue);

    return filterTimeOptionsForPeriod(extensionPeriod, buildTimeOptions()).filter((time) => {
      if (minimumTodayTime && time < minimumTodayTime) return false;
      if (dateValue === checkoutDue.date && time <= checkoutDue.time) return false;
      return true;
    });
  };

  const handleExtendDue = async (checkout: Checkout) => {
    if (currentRole !== "Teacher") return;

    const defaultExtension = getDefaultExtensionDateTime(checkout);
    const dateValue = extendDueDates[checkout.id] ?? defaultExtension.date;
    const options = getExtensionTimeOptions(checkout, dateValue);
    const requestedTime = extendDueTimes[checkout.id] ?? defaultExtension.time;
    const timeValue = options.includes(requestedTime) ? requestedTime : (options[0] ?? "");

    setExtendDueErrors((current) => ({ ...current, [checkout.id]: "" }));

    if (!dateValue || !timeValue) {
      setExtendDueErrors((current) => ({ ...current, [checkout.id]: "Choose a later due date and time." }));
      return;
    }

    const returnBy = new Date(`${dateValue}T${timeValue}:00`);
    if (Number.isNaN(returnBy.getTime())) {
      setExtendDueErrors((current) => ({ ...current, [checkout.id]: "Choose a valid due date and time." }));
      return;
    }

    try {
      setExtendingDue(checkout.id);
      const extendResp = await firebaseFetch("/api/checkouts/extend-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutId: checkout.id,
          returnBy: returnBy.toISOString(),
        }),
      });

      if (!extendResp.ok) {
        const data = await extendResp.json().catch(() => ({}));
        const msg = (data && (data.error?.message ?? data.error)) ?? "Due date extension failed.";
        setExtendDueErrors((current) => ({ ...current, [checkout.id]: String(msg) }));
        return;
      }

      setExtendDueDates((current) => {
        const next = { ...current };
        delete next[checkout.id];
        return next;
      });
      setExtendDueTimes((current) => {
        const next = { ...current };
        delete next[checkout.id];
        return next;
      });
      setExtendDueErrors((current) => {
        const next = { ...current };
        delete next[checkout.id];
        return next;
      });
      refresh();
    } catch (error) {
      setExtendDueErrors((current) => ({
        ...current,
        [checkout.id]: error instanceof Error ? error.message : "Due date extension failed.",
      }));
    } finally {
      setExtendingDue(null);
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-7">
        <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
          Checkout
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Check equipment in or out for{" "}
          <PeriodBadge>{checkoutPeriod} period</PeriodBadge>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Checkout form ─────────────────────────────── */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "#e8f0fe" }}
            >
              <ArrowUpRight size={16} color="#005a78" strokeWidth={2} />
            </div>
            <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
              Check Out Equipment
            </h3>
          </div>

          {submitSuccess && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}
            >
              <CheckCircle2 className="mt-0.5 shrink-0" size={15} strokeWidth={2} />
              Checkout recorded successfully!
            </div>
          )}
          {submitError && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
            >
              <CircleAlert className="mt-0.5 shrink-0" size={15} strokeWidth={2} />
              {submitError}
            </div>
          )}

          {loadingData ? (
            <div className="py-8 text-center">
              <LoaderCircle className="animate-spin mx-auto" size={20} color="#94a3b8" strokeWidth={2.5} />
              <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Loading…</p>
            </div>
          ) : currentRole === "Student" && !ownStudentId ? (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#c2410c" }}
            >
              Your email is verified, but your teacher still needs to approve your student account before you join the class roster.
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-student" style={{ color: "#374151" }}>
                  Student <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {ownStudentId ? (
                  <div
                    className="px-3 py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "var(--ignite-navy)" }}
                  >
                    {ownStudentName ?? students.find((s) => s.id === ownStudentId)?.name ?? "Your student"}
                    <input type="hidden" value={ownStudentId} />
                  </div>
                ) : (
                  <>
                    <SelectMenu
                      id="co-student"
                      value={studentId}
                      onChange={setStudentId}
                      placeholder="Select a student…"
                      options={[
                        { label: "Select a student…", value: "" },
                        ...students.map((s) => ({
                          label: `${s.name}${s.student_id ? ` (${s.student_id})` : ""}`,
                          value: s.id,
                        })),
                      ]}
                    />
                    {students.length === 0 && !loadFailed && (
                      <p className="text-xs mt-1.5" style={{ color: "#ca8a04" }}>
                        No students in {checkoutPeriod} roster. Add students first.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-barcode" style={{ color: "#374151" }}>
                  IGNITE Barcode
                </label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <input
                    id="co-barcode"
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan or type barcode label"
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={() => applyScannedBarcode(barcodeInput)}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: "var(--navy)" }}
                  >
                    Match Barcode
                  </button>
                </div>
                {barcodeFeedback && (
                  <p className="text-xs mt-1.5" style={{ color: "#047857" }}>
                    {barcodeFeedback}
                  </p>
                )}
                <div className="mt-3">
                  <BarcodeScanner onDetected={applyScannedBarcode} disabled={loadingData} />
                </div>
                <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                  Barcode-labeled equipment must be checked out by scanning the sticker.
                </p>
              </div>

              {selectedEquipment && requiresBarcodeScan && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "#f8fafc", border: "1px solid #dbeafe" }}
                >
                  <p className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                    Selected barcode item
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase" style={{ color: "var(--muted)", letterSpacing: "0.04em" }}>
                        Item
                      </p>
                      <p className="mt-0.5 font-medium" style={{ color: "#374151" }}>{selectedEquipment.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase" style={{ color: "var(--muted)", letterSpacing: "0.04em" }}>
                        Category
                      </p>
                      <p className="mt-0.5" style={{ color: "#374151" }}>{selectedEquipment.category}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase" style={{ color: "var(--muted)", letterSpacing: "0.04em" }}>
                        Barcode
                      </p>
                      <p className="mt-0.5 font-mono text-xs" style={{ color: "#374151" }}>{serialNumber || "Scan required"}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-eq" style={{ color: "#374151" }}>
                  Equipment Without Barcode Labels
                </label>
                <SelectMenu
                  id="co-eq"
                  value={equipmentId}
                  onChange={(nextValue) => {
                    setEquipmentId(nextValue);
                    setQuantity("1");
                    setSerialNumber("");
                    setBarcodeInput("");
                    setBarcodeFeedback(null);
                    setRequestedEquipmentId(null);
                    setHandledRequestedEquipmentId(null);
                  }}
                  placeholder="Select non-barcoded equipment…"
                  searchable
                  searchPlaceholder="Search non-barcoded equipment..."
                  options={[
                    { label: "Select non-barcoded equipment…", value: "" },
                    ...manualEquipmentOptions.map((eq) => ({
                      label: `${eq.name} — ${eq.available} available${eq.available === 0 ? " (none left)" : ""}`,
                      value: eq.id,
                      disabled: eq.available === 0,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-qty" style={{ color: "#374151" }}>
                  Quantity <span style={{ color: "#ef4444" }}>*</span>
                  {selectedEquipment && (
                    <span className="ml-2 font-normal text-xs" style={{ color: "var(--muted)" }}>
                    {requiresBarcodeScan ? "(barcode-labeled items are checked out one at a time)" : `(max ${maxQty} available)`}
                    </span>
                  )}
                </label>
                <input
                  id="co-qty"
                  type="number"
                  min={1}
                  max={requiresBarcodeScan ? 1 : maxQty || 1}
                  value={requiresBarcodeScan ? "1" : quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={requiresBarcodeScan}
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-return-date" style={{ color: "#374151" }}>
                  Return By <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3">
                  <div>
                    <label className="sr-only" htmlFor="co-return-date-hidden">Return date</label>
                    <DatePicker
                      value={returnDate}
                      minDate={minimumReturnDate}
                      onChange={setReturnDate}
                      placeholder="Choose return date"
                      quickActionLabel="Today"
                      disableWeekends
                    />
                    <input
                      id="co-return-date-hidden"
                      type="hidden"
                      required
                      value={returnDate}
                      readOnly
                    />
                  </div>
                  <SelectMenu
                    id="co-return-time"
                    value={selectedReturnTime}
                    onChange={setReturnTime}
                    disabled={availableTimeOptions.length === 0}
                    placeholder="Choose return time"
                    options={availableTimeOptions.map((time) => ({
                      label: formatTimeOption(time),
                      value: time,
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-notes" style={{ color: "#374151" }}>
                  Notes{" "}
                  <span className="font-normal" style={{ color: "var(--muted)" }}>(optional)</span>
                </label>
                <input
                  id="co-notes"
                  type="text"
                  maxLength={200}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. for podcast project"
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || maxQty === 0}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 mt-1 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: "var(--navy)", boxShadow: "0 2px 10px rgba(0,90,120,0.22)", fontSize: "0.9375rem" }}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="animate-spin" size={15} strokeWidth={2.5} />
                    Recording…
                  </>
                ) : "Confirm Checkout"}
              </button>
            </form>
          )}
        </div>

        {/* ── Check in list ──────────────────────────────── */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "#dcfce7" }}
              >
                <ArrowDownLeft size={16} color="#16a34a" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
                Check In Equipment
              </h3>
            </div>
            {visibleActiveCheckouts.length > 0 && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#e8f0fe", color: "#005a78" }}
              >
                {visibleActiveCheckouts.length} out
              </span>
            )}
          </div>

          {activeCheckouts === null ? (
            <div className="py-8 text-center">
              <LoaderCircle className="animate-spin mx-auto" size={20} color="#94a3b8" strokeWidth={2.5} />
              <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Loading…</p>
            </div>
          ) : visibleActiveCheckouts.length === 0 ? (
            <div className="py-10 text-center">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "#f8fafc" }}
              >
                <Check size={22} color="#94a3b8" strokeWidth={1.75} />
              </div>
              <p className="font-medium text-sm" style={{ color: "#374151" }}>All clear</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                No active checkouts for {checkoutPeriod} period.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleActiveCheckouts.map((c) => {
                const deadline = getCheckoutDeadlineMeta(c.checked_out_at, c.due_at ?? null);
                const state = deadline?.state ?? "healthy";
                const statusStyle =
                  state === "warning"
                    ? { background: "#fef3c7", color: "#b45309" }
                    : state === "danger" || state === "overdue"
                    ? { background: "#fee2e2", color: "#dc2626" }
                    : { background: "#dcfce7", color: "#15803d" };
                const defaultExtension = getDefaultExtensionDateTime(c);
                const extensionDate = extendDueDates[c.id] ?? defaultExtension.date;
                const extensionTimeOptions = getExtensionTimeOptions(c, extensionDate);
                const requestedExtensionTime = extendDueTimes[c.id] ?? defaultExtension.time;
                const extensionTime = extensionTimeOptions.includes(requestedExtensionTime)
                  ? requestedExtensionTime
                  : (extensionTimeOptions[0] ?? "");
                const extensionError = extendDueErrors[c.id];

                return (
                  <div
                    key={c.id}
                    className="rounded-xl p-3.5"
                    style={{ border: "1px solid #e9eef5", background: "#fafbfd" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight" style={{ color: "var(--ignite-navy)" }}>
                          {c.student?.name ?? "—"}
                        </p>
                        <p className="text-xs mt-0.5 leading-tight" style={{ color: "var(--muted)" }}>
                          {c.equipment?.name ?? "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: "#f1f5f9", color: "var(--muted)" }}
                          >
                            qty {c.quantity}
                          </span>
                          {c.serial_number && (
                            <span
                              className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: "#e8f0fe", color: "#005a78" }}
                            >
                              {c.serial_number}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium" style={statusStyle}>
                            {state === "overdue" ? "Overdue" : state === "danger" ? "75% elapsed" : state === "warning" ? "50% elapsed" : "On track"}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                          Due {formatDateTime(c.due_at ?? null)}
                          {deadline ? ` · ${deadline.remainingMs > 0 ? `${formatRemainingTime(deadline.remainingMs)} left` : `${formatRemainingTime(deadline.remainingMs)} overdue`}` : ""}
                        </p>
                        {c.notes && (
                          <p className="text-xs mt-1 italic" style={{ color: "#94a3b8" }}>{c.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCheckIn(c.id)}
                        disabled={checkingIn === c.id}
                        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                        style={{
                          background: checkingIn === c.id ? "#d1fae5" : "#059669",
                          color: checkingIn === c.id ? "#059669" : "white",
                        }}
                      >
                        {checkingIn === c.id ? "…" : "Check In"}
                      </button>
                    </div>
                    {currentRole === "Teacher" && (
                      <div
                        className="mt-3 rounded-lg p-3"
                        style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <CalendarClock size={14} color="#005a78" strokeWidth={2.2} />
                          <p className="text-xs font-semibold" style={{ color: "var(--ignite-navy)" }}>
                            Extend Due Date
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-2">
                          <DatePicker
                            value={extensionDate}
                            minDate={getMinimumExtensionDate(c)}
                            onChange={(value) => {
                              setExtendDueDates((current) => ({ ...current, [c.id]: value }));
                              setExtendDueErrors((current) => ({ ...current, [c.id]: "" }));
                            }}
                            placeholder="Choose due date"
                            quickActionLabel="Today"
                            disableWeekends
                          />
                          <SelectMenu
                            value={extensionTime}
                            onChange={(value) => {
                              setExtendDueTimes((current) => ({ ...current, [c.id]: value }));
                              setExtendDueErrors((current) => ({ ...current, [c.id]: "" }));
                            }}
                            disabled={extensionTimeOptions.length === 0}
                            placeholder="Choose time"
                            triggerClassName="text-sm"
                            options={extensionTimeOptions.map((time) => ({
                              label: formatTimeOption(time),
                              value: time,
                            }))}
                          />
                          <button
                            type="button"
                            onClick={() => handleExtendDue(c)}
                            disabled={extendingDue === c.id || extensionTimeOptions.length === 0}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            style={{ background: "var(--navy)" }}
                          >
                            {extendingDue === c.id ? (
                              <LoaderCircle className="animate-spin" size={13} strokeWidth={2.5} />
                            ) : (
                              <CalendarClock size={13} strokeWidth={2.4} />
                            )}
                            Extend
                          </button>
                        </div>
                        {extensionError && (
                          <p className="mt-2 text-xs" style={{ color: "#dc2626" }}>
                            {extensionError}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-2.5">
                      <input
                        type="text"
                        maxLength={200}
                        placeholder="Return notes (optional)"
                        value={returnNotes[c.id] ?? ""}
                        onChange={(e) => setReturnNotes((r) => ({ ...r, [c.id]: e.target.value }))}
                        className="form-input text-xs py-1.5"
                        style={{ fontSize: "0.75rem" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <AppShell>
      <CheckoutContent />
    </AppShell>
  );
}
