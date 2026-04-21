"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { User } from "@supabase/supabase-js";
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
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const currentRole = (currentUser as unknown as { user_metadata?: { role?: string } })?.user_metadata?.role;
  const checkoutPeriod = currentRole === "Student" && ownStudentPeriod ? ownStudentPeriod : period;

  useEffect(() => {
    const eq = new URLSearchParams(window.location.search).get("eq");
    if (eq) queueMicrotask(() => setEquipmentId(eq));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await createSupabaseBrowserClient().auth.getUser();
        const u = res.data.user ?? null;
        if (!mounted) return;
        setCurrentUser(u);

        const meta = (u as unknown as { user_metadata?: { role?: string } }).user_metadata ?? {};
        if (meta.role === "Student") {
          const found = (await createSupabaseBrowserClient()
            .from("students")
            .select("id, name, period")
            .eq("user_id", u.id)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle()) as { data?: { id?: string; name?: string; period?: string } | null; error?: unknown } | null;
          if (!mounted) return;
          const foundId = found?.data?.id;
          if (foundId) {
            setStudentId(foundId);
            setOwnStudentId(foundId);
            setOwnStudentName(found.data?.name ?? null);
            setOwnStudentPeriod(found.data?.period === "PM" ? "PM" : "AM");
          }
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
    const isStudent = currentRole === "Student";

    if (isStudent && !ownStudentId) {
      queueMicrotask(() => {
        setStudents([]);
        setEquipment([]);
        setActiveCheckouts([]);
        setLoadingData(false);
      });
      return;
    }

    queueMicrotask(() => setLoadingData(true));

    const studentsQuery = createSupabaseBrowserClient()
      .from("students")
      .select("id, name, student_id, user_id, email, period, is_active, created_at")
      .eq("is_active", true)
      .order("name");

    if (isStudent && ownStudentId) {
      studentsQuery.eq("id", ownStudentId);
    } else {
      studentsQuery.eq("period", checkoutPeriod);
    }

    const activeCheckoutsQuery = createSupabaseBrowserClient()
      .from("checkouts")
      .select(
        `id, student_id, equipment_id, quantity, checked_out_at, notes, period,
         student:students(id, name, student_id),
         equipment:equipment(id, name, category)`
      )
      .is("checked_in_at", null)
      .eq("period", checkoutPeriod)
      .order("checked_out_at", { ascending: false });

    if (isStudent && ownStudentId) {
      activeCheckoutsQuery.eq("student_id", ownStudentId);
    }

    Promise.all([
      studentsQuery,
      createSupabaseBrowserClient().from("equipment").select("*").eq("is_active", true).order("name"),
      createSupabaseBrowserClient().from("checkouts").select("equipment_id, quantity").is("checked_in_at", null),
      activeCheckoutsQuery,
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

    return () => { cancelled = true; };
  }, [authResolved, checkoutPeriod, currentRole, ownStudentId, period, tick]);

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const maxQty = selectedEquipment?.available ?? 0;
  const visibleActiveCheckouts = (activeCheckouts ?? []).filter((c) => {
    if (currentRole === "Student") return c.student_id === ownStudentId;
    return true;
  });

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    setSubmitSuccess(false);

    const qty = parseInt(quantity, 10);
    const finalStudentId = ownStudentId ?? studentId;
    if (!finalStudentId) { setSubmitError("Please select a student."); setSubmitting(false); return; }
    if (!equipmentId) { setSubmitError("Please select an equipment item."); setSubmitting(false); return; }
    if (isNaN(qty) || qty < 1) { setSubmitError("Quantity must be at least 1."); setSubmitting(false); return; }
    if (qty > maxQty) { setSubmitError(`Only ${maxQty} unit(s) available.`); setSubmitting(false); return; }

    const checkoutResp = await fetch("/api/checkouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: finalStudentId, equipmentId, quantity: qty, notes, period }),
    });

    if (!checkoutResp.ok) {
      const data = await checkoutResp.json().catch(() => ({}));
      const msg = (data && (data.error?.message ?? data.error)) ?? "Checkout failed.";
      setSubmitError(String(msg));
    } else {
      if (!ownStudentId) setStudentId("");
      setEquipmentId("");
      setQuantity("1");
      setNotes("");
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
    const checkInResp = await fetch("/api/checkouts/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutId, returnNotes: returnNotes[checkoutId] ?? null }),
    });

    if (!checkInResp.ok) {
      const data = await checkInResp.json().catch(() => ({}));
      const msg = (data && (data.error?.message ?? data.error)) ?? "Check-in failed.";
      alert("Check-in failed: " + String(msg));
    } else refresh();
    setCheckingIn(null);
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
          <span
            className="font-semibold px-2 py-0.5 rounded-full text-xs"
            style={{ background: "var(--ignite-mint-dim)", color: "var(--ignite-teal)" }}
          >
            {checkoutPeriod} period
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Checkout form ─────────────────────────────── */}
        <div
          className="bg-white rounded-2xl p-6"
          style={{ border: "1px solid #e9eef5", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--ignite-mint-dim)" }}
            >
              <svg width="16" height="16" fill="none" stroke="var(--ignite-teal)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5" /><path d="M21 3 9 15" /><path d="M3 9v11a2 2 0 0 0 2 2h11" />
              </svg>
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
              <svg className="mt-0.5 shrink-0" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
              </svg>
              Checkout recorded successfully!
            </div>
          )}
          {submitError && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
            >
              <svg className="mt-0.5 shrink-0" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {submitError}
            </div>
          )}

          {loadingData ? (
            <div className="py-8 text-center">
              <svg className="animate-spin mx-auto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Loading…</p>
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
                    <select
                      id="co-student"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="form-input"
                    >
                      <option value="">Select a student…</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.student_id ? ` (${s.student_id})` : ""}
                        </option>
                      ))}
                    </select>
                    {students.length === 0 && (
                      <p className="text-xs mt-1.5" style={{ color: "#ca8a04" }}>
                        No students in {checkoutPeriod} roster. Add students first.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-eq" style={{ color: "#374151" }}>
                  Equipment <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  id="co-eq"
                  value={equipmentId}
                  onChange={(e) => { setEquipmentId(e.target.value); setQuantity("1"); }}
                  className="form-input"
                >
                  <option value="">Select equipment…</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id} disabled={eq.available === 0}>
                      {eq.name} — {eq.available} available{eq.available === 0 ? " (none left)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="co-qty" style={{ color: "#374151" }}>
                  Quantity <span style={{ color: "#ef4444" }}>*</span>
                  {selectedEquipment && (
                    <span className="ml-2 font-normal text-xs" style={{ color: "var(--muted)" }}>
                      (max {maxQty} available)
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
                  className="form-input"
                />
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
                className="btn-primary w-full justify-center py-2.5 mt-1"
                style={{ fontSize: "0.9375rem" }}
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Recording…
                  </>
                ) : "Confirm Checkout"}
              </button>
            </form>
          )}
        </div>

        {/* ── Check-in list ──────────────────────────────── */}
        <div
          className="bg-white rounded-2xl p-6"
          style={{ border: "1px solid #e9eef5", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "#dcfce7" }}
              >
                <svg width="16" height="16" fill="none" stroke="#16a34a" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
                Check In Equipment
              </h3>
            </div>
            {visibleActiveCheckouts.length > 0 && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "var(--ignite-mint-dim)", color: "var(--ignite-teal)" }}
              >
                {visibleActiveCheckouts.length} out
              </span>
            )}
          </div>

          {activeCheckouts === null ? (
            <div className="py-8 text-center">
              <svg className="animate-spin mx-auto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Loading…</p>
            </div>
          ) : visibleActiveCheckouts.length === 0 ? (
            <div className="py-10 text-center">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "#f8fafc" }}
              >
                <svg width="22" height="22" fill="none" stroke="#94a3b8" strokeWidth="1.75" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="font-medium text-sm" style={{ color: "#374151" }}>All clear</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                No active checkouts for {checkoutPeriod} period.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleActiveCheckouts.map((c) => (
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
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        {c.equipment?.name ?? "—"}
                        <span
                          className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: "#f1f5f9", color: "var(--muted)" }}
                        >
                          qty {c.quantity}
                        </span>
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
