"use client";

import { useEffect, useState } from "react";
import AppShell from "@/app/components/AppShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Checkout, Period } from "@/app/lib/types";

function duration(start: string, end: string | null | undefined): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function HistoryContent() {
  const [history, setHistory] = useState<Checkout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<Period | "All">("All");
  const [studentFilter, setStudentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;

    createSupabaseBrowserClient()
      .from("checkouts")
      .select(
        `id, student_id, quantity, checked_out_at, checked_in_at, notes, return_notes, period,
         student:students(id, name, student_id),
         equipment:equipment(id, name, category)`
      )
      .order("checked_out_at", { ascending: false })
      .limit(500)
      .then(({ data, error: fetchError }: { data: Checkout[] | null; error: { message?: string } | null }) => {
        if (cancelled) return;
  if (fetchError) setError(fetchError.message ?? "Unknown error");
        else setHistory((data as unknown as Checkout[]) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = (history ?? []).filter((c) => {
    if (periodFilter !== "All" && c.period !== periodFilter) return false;
    if (
      studentFilter &&
      !c.student?.name?.toLowerCase().includes(studentFilter.toLowerCase())
    )
      return false;
    if (dateFrom && new Date(c.checked_out_at) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      if (new Date(c.checked_out_at) > to) return false;
    }
    return true;
  });

  const loading = history === null && error === null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">History</h2>
        <p className="text-gray-500 text-sm mt-1">Full checkout and check-in log</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="search"
          placeholder="Filter by student…"
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          aria-label="Filter by student name"
        />
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as Period | "All")}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label="Filter by period"
        >
          <option value="All">All Periods</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(studentFilter || periodFilter !== "All" || dateFrom || dateTo) && (
          <button
            onClick={() => { setStudentFilter(""); setPeriodFilter("All"); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-red-500 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            No records match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Student</th>
                  <th className="px-5 py-3 text-left font-medium">Item</th>
                  <th className="px-5 py-3 text-left font-medium">Qty</th>
                  <th className="px-5 py-3 text-left font-medium">Period</th>
                  <th className="px-5 py-3 text-left font-medium">Checked Out</th>
                  <th className="px-5 py-3 text-left font-medium">Checked In</th>
                  <th className="px-5 py-3 text-left font-medium">Duration</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {c.student?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {c.equipment?.name ?? "—"}
                      <span className="ml-1.5 text-xs text-gray-400">{c.equipment?.category}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.quantity}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {c.period}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(c.checked_out_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                      {c.checked_in_at
                        ? new Date(c.checked_in_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {duration(c.checked_out_at, c.checked_in_at)}
                    </td>
                    <td className="px-5 py-3">
                      {c.checked_in_at ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Returned
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          Out
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 max-w-xs truncate text-xs">
                      {[c.notes, c.return_notes].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Showing {filtered.length} of {(history ?? []).length} records
      </p>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AppShell>
      <HistoryContent />
    </AppShell>
  );
}
