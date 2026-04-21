"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/app/components/AppShell";
import { usePeriod } from "@/app/lib/period-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Checkout } from "@/app/lib/types";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function durationMs(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

function DashboardContent() {
  const { period } = usePeriod();
  // null = loading, [] = loaded empty, [...] = loaded with data
  const [checkouts, setCheckouts] = useState<Checkout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const supabase = createSupabaseBrowserClient();

  const refresh = useCallback(() => {
    setCheckouts(null);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    createSupabaseBrowserClient()
      .from("checkouts")
      .select(
        `id, student_id, quantity, checked_out_at, notes, period,
         student:students(id, name, student_id),
         equipment:equipment(id, name, category)`
      )
      .is("checked_in_at", null)
      .eq("period", period)
      .order("checked_out_at", { ascending: false })
      .then(({ data, error: fetchError }: { data: Checkout[] | null; error: { message?: string } | null }) => {
        if (cancelled) return;
  if (fetchError) setError(fetchError.message ?? "Unknown error");
        else setCheckouts((data as unknown as Checkout[]) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [period, tick]);

  const handleCheckIn = async (checkoutId: string) => {
    setCheckingIn(checkoutId);
    const { error: updateError } = await supabase
      .from("checkouts")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", checkoutId);

    if (updateError) {
      alert("Check-in failed: " + updateError.message);
    } else {
      refresh();
    }
    setCheckingIn(null);
  };

  const loading = checkouts === null && error === null;
  const list = checkouts ?? [];
  const totalItemsOut = list.reduce((sum, c) => sum + c.quantity, 0);
  const studentsWithCheckouts = new Set(list.map((c) => c.student_id)).size;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">
          Active checkouts for{" "}
          <span className="font-semibold text-blue-700">{period} period</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Items Checked Out" value={totalItemsOut} color="yellow" />
        <StatCard label="Active Records" value={list.length} color="blue" />
        <StatCard label="Students with Items" value={studentsWithCheckouts} color="green" />
      </div>

      {/* Active Checkouts Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Active Checkouts</h3>
          <button
            onClick={refresh}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-red-500 text-sm">{error}</div>
        ) : list.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            No active checkouts for {period} period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Student</th>
                  <th className="px-5 py-3 text-left font-medium">Item</th>
                  <th className="px-5 py-3 text-left font-medium">Qty</th>
                  <th className="px-5 py-3 text-left font-medium">Checked Out</th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                  <th className="px-5 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((c) => {
                  const ms = durationMs(c.checked_out_at);
                  const overdue = ms > 3 * 60 * 60 * 1000;
                  const warning = ms > 60 * 60 * 1000 && !overdue;

                  return (
                    <tr
                      key={c.id}
                      className={
                        overdue ? "bg-red-50" : warning ? "bg-amber-50" : "hover:bg-gray-50"
                      }
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {c.student?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {c.equipment?.name ?? "—"}
                        <span className="ml-2 text-xs text-gray-400">
                          {c.equipment?.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{c.quantity}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-medium ${
                            overdue
                              ? "text-red-600"
                              : warning
                              ? "text-amber-600"
                              : "text-gray-600"
                          }`}
                        >
                          {timeAgo(c.checked_out_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                        {c.notes ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleCheckIn(c.id)}
                          disabled={checkingIn === c.id}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-300 text-white text-xs font-semibold rounded-lg transition-colors"
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
  color,
}: {
  label: string;
  value: number;
  color: "yellow" | "blue" | "green";
}) {
  const colors = {
    yellow: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
  };

  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1 opacity-80">{label}</p>
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
