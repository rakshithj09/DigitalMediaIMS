"use client";

import { useEffect, useState } from "react";
import { Clock, LoaderCircle, Search, X } from "lucide-react";
import type { AppUser as User } from "@/lib/firebase/types";
import AppShell from "@/app/components/AppShell";
import DatePicker from "@/app/components/DatePicker";
import SelectMenu from "@/components/ui/select-menu";
import { createFirebaseDataClient } from "@/lib/firebase/browser-data";
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ownStudentId, setOwnStudentId] = useState<string | null>(null);

  const [periodFilter, setPeriodFilter] = useState<Period | "All">("All");
  const [studentFilter, setStudentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    const firebaseClient = createFirebaseDataClient();

    firebaseClient
      .from<Checkout>("checkouts")
      .select(
        `id, student_id, quantity, serial_number, checked_out_at, checked_in_at, notes, return_notes, period,
         student:students(id, name, student_id),
         equipment:equipment(id, name, category)`
      )
      .order("checked_out_at", { ascending: false })
      .limit(500)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message ?? "Unknown error");
        else setHistory(data ?? []);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const firebaseClient = createFirebaseDataClient();

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
    })();

    return () => { mounted = false; };
  }, []);

  const filtered = (history ?? []).filter((c) => {
    if (currentUser?.user_metadata?.role === "Student" && c.student_id !== ownStudentId) return false;
    if (periodFilter !== "All" && c.period !== periodFilter) return false;
    if (studentFilter && !c.student?.name?.toLowerCase().includes(studentFilter.toLowerCase())) return false;
    if (dateFrom && new Date(c.checked_out_at) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      if (new Date(c.checked_out_at) > to) return false;
    }
    return true;
  });

  const loading = history === null && error === null;
  const hasFilters = studentFilter || periodFilter !== "All" || dateFrom || dateTo;

  return (
    <div>
      {/* Page header */}
      <div className="mb-7">
        <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
          History
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Full checkout and check in log
        </p>
      </div>

      {/* Filters bar */}
      <div
        className="rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-3"
        style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 4px 16px rgba(15,36,55,0.05)" }}
      >
        <div className="relative">
          <Search
            className="absolute pointer-events-none"
            style={{ left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            size={14}
            strokeWidth={2}
          />
          <input
            type="search"
            placeholder="Filter by student…"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="form-input text-sm"
            style={{ width: 180, paddingLeft: "2.65rem" }}
            aria-label="Filter by student name"
          />
        </div>

        <SelectMenu
          value={periodFilter}
          onChange={(nextValue) => setPeriodFilter(nextValue as Period | "All")}
          className="min-w-[10rem]"
          triggerClassName="text-sm"
          aria-label="Filter by period"
          options={[
            { label: "All Periods", value: "All" },
            { label: "AM", value: "AM" },
            { label: "PM", value: "PM" },
          ]}
        />

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--muted)" }}>From</label>
          <DatePicker
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="From date"
            quickActionLabel="Today"
            className="min-w-[12rem]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--muted)" }}>To</label>
          <DatePicker
            value={dateTo}
            onChange={setDateTo}
            placeholder="To date"
            quickActionLabel="Today"
            className="min-w-[12rem]"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => { setStudentFilter(""); setPeriodFilter("All"); setDateFrom(""); setDateTo(""); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--ignite-navy)", background: "#f1f5f9" }}
          >
            <X size={12} strokeWidth={2.5} />
            Clear
          </button>
        )}

        <div className="ml-auto text-xs font-medium" style={{ color: "var(--muted)" }}>
          {filtered.length} / {(history ?? []).length} records
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}
      >
        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: "#f1f5f9" }}>
              <LoaderCircle className="animate-spin" size={16} color="#94a3b8" strokeWidth={2.5} />
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading history…</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#f8fafc" }}>
              <Clock size={22} color="#94a3b8" strokeWidth={1.75} />
            </div>
            <p className="font-medium text-sm" style={{ color: "#374151" }}>No records found</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {hasFilters ? "Try adjusting your filters." : "No checkout history yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Period</th>
                  <th>Checked Out</th>
                  <th>Checked In</th>
                  <th>Duration</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                      {c.student?.name ?? "—"}
                    </td>
                    <td className="history-item-cell" style={{ color: "#374151" }}>
                      <span className="font-medium history-item-name">{c.equipment?.name ?? "—"}</span>
                      <div className="history-item-tags">
                        {c.equipment?.category && (
                          <span
                            className="history-item-tag"
                            style={{ background: "#f1f5f9", color: "var(--muted)" }}
                          >
                            {c.equipment.category}
                          </span>
                        )}
                        {c.serial_number && (
                          <span
                            className="history-item-tag"
                            style={{ background: "#e8f0fe", color: "#005a78" }}
                          >
                            {c.serial_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-sm" style={{ color: "#374151" }}>{c.quantity}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: "#e8f0fe", color: "#005a78" }}
                      >
                        {c.period}
                      </span>
                    </td>
                    <td className="text-sm whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {new Date(c.checked_out_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="text-sm whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {c.checked_in_at
                        ? new Date(c.checked_in_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td className="text-sm" style={{ color: "var(--muted)" }}>
                      {duration(c.checked_out_at, c.checked_in_at)}
                    </td>
                    <td className="history-notes" style={{ color: "#94a3b8" }}>
                      {[c.notes, c.return_notes].filter(Boolean).join(" | ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
