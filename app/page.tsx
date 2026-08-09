"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  Clock,
  LoaderCircle,
  PackageCheck,
  UsersRound,
} from "lucide-react";
import type { AppUser as User } from "@/lib/firebase/types";
import AppShell from "@/app/components/AppShell";
import PeriodBadge from "@/app/components/PeriodBadge";
import { usePeriod } from "@/app/lib/period-context";
import { createFirebaseDataClient } from "@/lib/firebase/browser-data";
import { Checkout } from "@/app/lib/types";
import { firebaseFetch } from "@/lib/firebase/auth-fetch";
import { formatDateTime, formatRemainingTime, getCheckoutDeadlineMeta } from "@/lib/checkout-deadlines";

function DashboardContent() {
  const { period } = usePeriod();
  const [checkouts, setCheckouts] = useState<Checkout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ownStudentId, setOwnStudentId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const firebaseClient = createFirebaseDataClient();

  const refresh = useCallback(() => {
    setCheckouts(null);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!authResolved) return;

    let cancelled = false;
    const currentRole = currentUser?.user_metadata?.role;

    if (currentRole === "Student" && !ownStudentId) {
      queueMicrotask(() => setCheckouts([]));
      return;
    }

    const query = createFirebaseDataClient()
      .from<Checkout>("checkouts")
      .select(
        `id, student_id, quantity, serial_number, checked_out_at, due_at, notes, period,
         student:students(id, name, student_id, email),
         equipment:equipment(id, name, category)`
      )
      .is("checked_in_at", null)
      .eq("period", period);

    if (currentRole === "Student" && ownStudentId) {
      query.eq("student_id", ownStudentId);
    }

    query.order("checked_out_at", { ascending: false }).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      if (fetchError) setError(fetchError.message ?? "Unknown error");
      else setCheckouts(data ?? []);
    });

    return () => { cancelled = true; };
  }, [authResolved, currentUser, ownStudentId, period, tick]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const res = await firebaseClient.auth.getUser();
      const user = res.data.user ?? null;
      if (!mounted) return;
      setCurrentUser(user);

      if (user?.user_metadata?.role === "Student") {
        const found = (await firebaseClient
          .from<{ id?: string }>("students")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()) as { data?: { id?: string } | null } | null;

        if (mounted) setOwnStudentId(found?.data?.id ?? null);
      }
      if (mounted) setAuthResolved(true);
    })();

    return () => { mounted = false; };
  }, [firebaseClient]);

  const handleCheckIn = async (checkoutId: string) => {
    if (currentUser?.user_metadata?.role === "Student") {
      const checkout = (checkouts ?? []).find((c) => c.id === checkoutId);
      if (!checkout || checkout.student_id !== ownStudentId) {
        alert("You can only check in equipment you checked out.");
        return;
      }
    }

    setCheckingIn(checkoutId);
    const checkInResp = await firebaseFetch("/api/checkouts/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutId }),
    });

    if (!checkInResp.ok) {
      const data = await checkInResp.json().catch(() => ({}));
      const msg = (data && (data.error?.message ?? data.error)) ?? "Check in failed.";
      alert("Check in failed: " + String(msg));
    } else {
      refresh();
    }
    setCheckingIn(null);
  };

  const loading = checkouts === null && error === null;
  const currentRole = currentUser?.user_metadata?.role;
  const list =
    currentRole === "Student"
      ? (checkouts ?? []).filter((c) => c.student_id === ownStudentId)
      : checkouts ?? [];
  const totalItemsOut = list.reduce((sum, c) => sum + c.quantity, 0);
  const studentsWithCheckouts = new Set(list.map((c) => c.student_id)).size;

  if (currentRole === "Student") {
    const attentionCount = list.filter((c) => {
      const deadline = getCheckoutDeadlineMeta(c.checked_out_at, c.due_at ?? null);
      return deadline?.state === "warning" || deadline?.state === "danger" || deadline?.state === "overdue";
    }).length;
    const nextDueCheckout = list.reduce<Checkout | null>((soonest, c) => {
      if (!c.due_at) return soonest;
      if (!soonest?.due_at) return c;
      return new Date(c.due_at) < new Date(soonest.due_at) ? c : soonest;
    }, null);
    const nextDueMeta = nextDueCheckout ? getCheckoutDeadlineMeta(nextDueCheckout.checked_out_at, nextDueCheckout.due_at ?? null) : null;

    return (
      <div>
        <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
              My Equipment
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Your active checkouts for <PeriodBadge>{period} period</PeriodBadge>
            </p>
          </div>
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--navy)", boxShadow: "0 2px 8px rgba(0,90,120,0.22)" }}
          >
            <ArrowRight size={14} strokeWidth={2.5} />
            Check Out Item
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Items You Have"
            value={totalItemsOut}
            icon={<BriefcaseBusiness size={20} strokeWidth={2} />}
            iconBg="#e8f0fe"
            iconColor="#005a78"
          />
          <StatCard
            label="Needs Attention"
            value={attentionCount}
            icon={<CircleAlert size={20} strokeWidth={2} />}
            iconBg="#fee2e2"
            iconColor="#dc2626"
          />
          <StatCard
            label={nextDueCheckout ? "Next Due" : "Ready To Go"}
            value={nextDueMeta ? Math.max(1, Math.round(Math.abs(nextDueMeta.remainingMs) / 3600000)) : 0}
            suffix={nextDueCheckout ? "h" : ""}
            icon={<Clock size={20} strokeWidth={2} />}
            iconBg="#dcfce7"
            iconColor="#16a34a"
          />
        </div>

        <div>
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1.5px solid #f1f5f9", background: "linear-gradient(to bottom, #fafcff, #f8fafc)" }}>
              <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>What You Have Out</h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#dbeafe", color: "#005a78", border: "1px solid rgba(59,130,246,0.18)" }}>
                {list.length} active
              </span>
            </div>

            {loading ? (
              <div className="px-6 py-16 text-center text-sm" style={{ color: "var(--muted)" }}>Loading your checkouts…</div>
            ) : error ? (
              <div className="px-6 py-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
            ) : list.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#f8fafc" }}>
                  <Check size={22} color="#94a3b8" strokeWidth={1.75} />
                </div>
                <p className="font-medium text-sm" style={{ color: "#374151" }}>No equipment checked out</p>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>You are clear for {period} period.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {list.map((c) => {
                  const deadline = getCheckoutDeadlineMeta(c.checked_out_at, c.due_at ?? null);
                  const state = deadline?.state ?? "healthy";
                  const needsRed = state === "danger" || state === "overdue";
                  const needsYellow = state === "warning";

                  return (
                    <div
                      key={c.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold" style={{ color: "var(--ignite-navy)" }}>{c.equipment?.name ?? "Equipment"}</p>
                          <span className="badge badge-neutral">qty {c.quantity}</span>
                          {c.serial_number && <span className="badge" style={{ background: "#e8f0fe", color: "#005a78" }}>{c.serial_number}</span>}
                          <span
                            className="badge"
                            style={needsRed ? { background: "#fca5a5", color: "#b91c1c" } : needsYellow ? { background: "#fbbf24", color: "#92400e" } : { background: "#dcfce7", color: "#16a34a" }}
                          >
                            {state === "overdue" ? "Overdue" : state === "danger" ? "75% elapsed" : state === "warning" ? "50% elapsed" : "On track"}
                          </span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                          Due {formatDateTime(c.due_at ?? null)}
                          {deadline ? ` · ${deadline.remainingMs > 0 ? `${formatRemainingTime(deadline.remainingMs)} left` : `${formatRemainingTime(deadline.remainingMs)} overdue`}` : ""}
                        </p>
                        {c.notes && <p className="text-sm mt-1 truncate" style={{ color: "var(--muted)" }}>{c.notes}</p>}
                      </div>
                      <button
                        onClick={() => handleCheckIn(c.id)}
                        disabled={checkingIn === c.id}
                        className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg"
                        style={{ background: checkingIn === c.id ? "#d1fae5" : "#059669", color: checkingIn === c.id ? "#059669" : "white" }}
                      >
                        {checkingIn === c.id ? "Checking In…" : "Check In"}
                      </button>
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

  return (
    <div>
      {/* Page header */}
      <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
            Dashboard
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Active checkouts for{" "}
            <PeriodBadge>{period} period</PeriodBadge>
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "#015a78", color: "#ffffff" }}
        >
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Items Checked Out"
          value={totalItemsOut}
          icon={<PackageCheck size={20} strokeWidth={2} />}
          iconBg="#fef9c3"
          iconColor="#ca8a04"
        />
        <StatCard
          label="Students with Items"
          value={studentsWithCheckouts}
          icon={
            <UsersRound size={20} strokeWidth={2} />
          }
          iconBg="#dcfce7"
          iconColor="#16a34a"
        />
      </div>

      {/* Active checkouts table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1.5px solid #f1f5f9", background: "linear-gradient(to bottom, #fafcff, #f8fafc)" }}>
          <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
            Active Checkouts
          </h3>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: list.length > 0 ? "#dbeafe" : "#f1f5f9", color: list.length > 0 ? "#005a78" : "var(--muted)", border: list.length > 0 ? "1px solid rgba(59,130,246,0.18)" : "1px solid rgba(148,163,184,0.3)" }}
          >
            {list.length} active
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: "#f1f5f9" }}>
              <LoaderCircle className="animate-spin" size={16} color="#94a3b8" strokeWidth={2.5} />
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading checkouts…</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
        ) : list.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "#f8fafc" }}
            >
              <Activity size={22} color="#94a3b8" strokeWidth={1.75} />
            </div>
            <p className="font-medium text-sm" style={{ color: "#374151" }}>All clear</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              No active checkouts for {period} period.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table dashboard-checkouts-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Return By</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const deadline = getCheckoutDeadlineMeta(c.checked_out_at, c.due_at ?? null);
                  const state = deadline?.state ?? "healthy";
                  const needsRed = state === "danger" || state === "overdue";
                  const needsYellow = state === "warning";

                  return (
                    <tr
                      key={c.id}
                    >
                      <td className="dashboard-student-cell font-medium" style={{ color: "var(--ignite-navy)" }}>
                        <span className="dashboard-cell-clip">{c.student?.name ?? "—"}</span>
                      </td>
                      <td className="dashboard-item-cell" style={{ color: "#374151" }}>
                        <div className="dashboard-item-content">
                          <span className="dashboard-item-name font-medium">{c.equipment?.name ?? "—"}</span>
                          {c.equipment?.category && (
                            <span
                              className="dashboard-item-chip text-xs px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: "#f1f5f9", color: "var(--muted)" }}
                            >
                              {c.equipment.category}
                            </span>
                          )}
                          {c.serial_number && (
                            <span
                              className="dashboard-item-chip text-xs px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: "#e8f0fe", color: "#005a78" }}
                            >
                              {c.serial_number}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: "#374151" }}>{c.quantity}</td>
                      <td>
                        <div>
                          <span
                            className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              whiteSpace: "nowrap",
                              ...(needsRed
                                ? { background: "#fee2e2", color: "#dc2626" }
                                : needsYellow
                                ? { background: "#fef9c3", color: "#ca8a04" }
                                : { background: "#f0fdf4", color: "#16a34a" }),
                            }}
                          >
                            {state === "overdue" ? "Overdue" : state === "danger" ? "75% elapsed" : state === "warning" ? "50% elapsed" : "On track"}
                          </span>
                          <div className="text-xs mt-1" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                            {formatDateTime(c.due_at ?? null)}
                          </div>
                          {deadline && (
                            <div className="text-xs mt-1" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                              {deadline.remainingMs > 0
                                ? `${formatRemainingTime(deadline.remainingMs)} left`
                                : `${formatRemainingTime(deadline.remainingMs)} overdue`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="dashboard-notes-cell text-sm" style={{ color: "var(--muted)" }}>
                        <span className="dashboard-cell-clip">{c.notes ?? "—"}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleCheckIn(c.id)}
                          disabled={checkingIn === c.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                          style={{
                            background: checkingIn === c.id ? "#d1fae5" : "#059669",
                            color: checkingIn === c.id ? "#059669" : "white",
                          }}
                        >
                          {checkingIn === c.id ? "…" : "Check In"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  suffix = "",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  suffix?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
        border: "1px solid rgba(226,232,240,0.9)",
        boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.07)",
      }}
    >
      <div
        className="absolute top-5 right-5 w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor, boxShadow: `0 2px 10px ${iconBg}` }}
      >
        {icon}
      </div>
      <p className="text-3xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.03em" }}>
        {value}{suffix}
      </p>
      <p className="text-sm font-medium mt-1" style={{ color: "var(--muted)" }}>
        {label}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
