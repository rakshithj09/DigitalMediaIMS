"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import AppShell from "@/app/components/AppShell";
import { usePeriod } from "@/app/lib/period-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Student, Equipment, Checkout } from "@/app/lib/types";

type EquipmentWithAvail = Equipment & { available: number };

function CheckoutContent() {
  const { period } = usePeriod();
  const [students, setStudents] = useState<Student[]>([]);
  const [equipment, setEquipment] = useState<EquipmentWithAvail[]>([]);
  const [activeCheckouts, setActiveCheckouts] = useState<Checkout[] | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => {
    setActiveCheckouts(null);
    setTick((t) => t + 1);
  }, []);

  // Checkout form
  const [studentId, setStudentId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Check-in
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      createSupabaseBrowserClient()
        .from("students")
        .select("id, name, student_id, period, is_active, created_at")
        .eq("period", period)
        .eq("is_active", true)
        .order("name"),
      createSupabaseBrowserClient()
        .from("equipment")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      createSupabaseBrowserClient()
        .from("checkouts")
        .select("equipment_id, quantity")
        .is("checked_in_at", null),
      createSupabaseBrowserClient()
        .from("checkouts")
        .select(
          `id, student_id, equipment_id, quantity, checked_out_at, notes, period,
           student:students(id, name, student_id),
           equipment:equipment(id, name, category)`
        )
        .is("checked_in_at", null)
        .eq("period", period)
        .order("checked_out_at", { ascending: false }),
    ]).then(([{ data: stuData }, { data: eqData }, { data: coSums }, { data: coData }]) => {
      if (cancelled) return;
      setStudents((stuData as Student[]) ?? []);

      const checkedOutMap = new Map<string, number>();
      (coSums ?? []).forEach((c: { equipment_id: string; quantity: number }) => {
        checkedOutMap.set(c.equipment_id, (checkedOutMap.get(c.equipment_id) ?? 0) + c.quantity);
      });
      const withAvail = ((eqData ?? []) as Equipment[]).map((e) => ({
        ...e,
        available: e.total_quantity - (checkedOutMap.get(e.id) ?? 0),
      }));
      setEquipment(withAvail);
      setActiveCheckouts((coData as unknown as Checkout[]) ?? []);
      setLoadingData(false);
    });

    return () => {
      cancelled = true;
    };
  }, [period, tick]);

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const maxQty = selectedEquipment?.available ?? 0;

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    setSubmitSuccess(false);

    const qty = parseInt(quantity, 10);
    if (!studentId) { setSubmitError("Please select a student."); setSubmitting(false); return; }
    if (!equipmentId) { setSubmitError("Please select an equipment item."); setSubmitting(false); return; }
    if (isNaN(qty) || qty < 1) { setSubmitError("Quantity must be at least 1."); setSubmitting(false); return; }
    if (qty > maxQty) { setSubmitError(`Only ${maxQty} unit(s) available.`); setSubmitting(false); return; }

    const { error: insertError } = await createSupabaseBrowserClient()
      .from("checkouts")
      .insert({
        student_id: studentId,
        equipment_id: equipmentId,
        quantity: qty,
        notes: notes.trim() || null,
        period,
      });

    if (insertError) {
      setSubmitError(insertError.message);
    } else {
      setStudentId("");
      setEquipmentId("");
      setQuantity("1");
      setNotes("");
      setSubmitSuccess(true);
      refresh();
    }
    setSubmitting(false);
  };

  const handleCheckIn = async (checkoutId: string) => {
    setCheckingIn(checkoutId);
    const { error: updateError } = await createSupabaseBrowserClient()
      .from("checkouts")
      .update({
        checked_in_at: new Date().toISOString(),
        return_notes: returnNotes[checkoutId]?.trim() || null,
      })
      .eq("id", checkoutId);

    if (updateError) alert("Check-in failed: " + updateError.message);
    else refresh();
    setCheckingIn(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
        <p className="text-gray-500 text-sm mt-1">
          Check equipment in or out for{" "}
          <span className="font-semibold text-blue-700">{period} period</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checkout Form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 text-lg">Check Out Equipment</h3>

          {submitSuccess && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
              Checkout recorded successfully!
            </div>
          )}
          {submitError && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {submitError}
            </div>
          )}

          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="co-student">
                  Student <span className="text-red-500">*</span>
                </label>
                <select
                  id="co-student"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select a student…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.student_id ? ` (${s.student_id})` : ""}
                    </option>
                  ))}
                </select>
                {students.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No students in {period} roster. Add students first.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="co-eq">
                  Equipment <span className="text-red-500">*</span>
                </label>
                <select
                  id="co-eq"
                  value={equipmentId}
                  onChange={(e) => { setEquipmentId(e.target.value); setQuantity("1"); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select equipment…</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id} disabled={eq.available === 0}>
                      {eq.name} ({eq.available} available){eq.available === 0 ? " — none available" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="co-qty">
                  Quantity <span className="text-red-500">*</span>
                  {selectedEquipment && (
                    <span className="ml-2 font-normal text-gray-400">
                      (max {maxQty})
                    </span>
                  )}
                </label>
                <input
                  id="co-qty"
                  type="number"
                  min={1}
                  max={maxQty || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="co-notes">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="co-notes"
                  type="text"
                  maxLength={200}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. for podcast project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || maxQty === 0}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                {submitting ? "Recording…" : "Confirm Checkout"}
              </button>
            </form>
          )}
        </div>

        {/* Active Checkouts for Check-in */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 text-lg">Check In Equipment</h3>

          {activeCheckouts === null ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : activeCheckouts.length === 0 ? (
            <p className="text-gray-400 text-sm">No active checkouts for {period} period.</p>
          ) : (
            <div className="space-y-3">
              {activeCheckouts.map((c) => (
                <div key={c.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {c.student?.name ?? "—"}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {c.equipment?.name ?? "—"} · qty {c.quantity}
                      </p>
                      {c.notes && (
                        <p className="text-gray-400 text-xs mt-0.5 italic">{c.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleCheckIn(c.id)}
                      disabled={checkingIn === c.id}
                      className="shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-300 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {checkingIn === c.id ? "…" : "Check In"}
                    </button>
                  </div>
                  <div className="mt-2">
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="Return notes (optional)"
                      value={returnNotes[c.id] ?? ""}
                      onChange={(e) =>
                        setReturnNotes((r) => ({ ...r, [c.id]: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-black focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
              ))}
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
