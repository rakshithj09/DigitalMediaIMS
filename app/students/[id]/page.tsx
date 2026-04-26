"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import { Checkout, Student } from "@/app/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type CheckoutWithEquipment = Checkout & {
  equipment?: {
    id: string;
    name: string;
    category: string;
  } | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDuration(start: string, end?: string | null) {
  const endMs = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.floor((endMs - new Date(start).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function StudentDetailContent() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [student, setStudent] = useState<Student | null>(null);
  const [checkouts, setCheckouts] = useState<CheckoutWithEquipment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    Promise.all([
      supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
      supabase
        .from("checkouts")
        .select(
          `id, student_id, equipment_id, quantity, serial_number, checked_out_at, due_at, checked_in_at, notes, return_notes, period, created_at,
           equipment:equipment(id, name, category)`
        )
        .eq("student_id", studentId)
        .order("checked_out_at", { ascending: false }),
    ]).then(([studentResult, checkoutResult]) => {
      if (cancelled) return;
      if (studentResult.error) {
        setError(studentResult.error.message);
        return;
      }
      if (checkoutResult.error) {
        setError(checkoutResult.error.message);
        return;
      }

      setStudent((studentResult.data as Student | null) ?? null);
      setCheckouts((checkoutResult.data as unknown as CheckoutWithEquipment[]) ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const activeCheckouts = useMemo(
    () => (checkouts ?? []).filter((checkout) => !checkout.checked_in_at),
    [checkouts]
  );
  const totalItemsOut = activeCheckouts.reduce((sum, checkout) => sum + checkout.quantity, 0);
  const historyCount = (checkouts ?? []).length;
  const latestCheckout = (checkouts ?? [])[0]?.checked_out_at ?? null;
  const loading = student === null && checkouts === null && error === null;

  return (
    <div>
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/students" className="text-sm font-semibold hover:underline" style={{ color: "var(--ignite-navy)" }}>
            &larr; Back to students
          </Link>
          <h2 className="text-2xl font-bold mt-3" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
            {student?.name ?? "Student Details"}
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Teacher view of account details, current checkouts, and history
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl px-6 py-16 text-center" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)" }}>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading student details...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl px-6 py-12 text-center text-sm" style={{ background: "white", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      ) : !student ? (
        <div className="rounded-2xl px-6 py-12 text-center" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)" }}>
          <p className="font-medium text-sm" style={{ color: "#374151" }}>Student not found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <DetailCard label="Period" value={student.period} />
            <DetailCard label="Items Out" value={String(totalItemsOut)} accent={totalItemsOut > 0 ? "warning" : "success"} />
            <DetailCard label="Active Checkouts" value={String(activeCheckouts.length)} />
            <DetailCard label="Total Records" value={String(historyCount)} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-6">
            <section className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.06)" }}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>Currently Out</h3>
              </div>
              {activeCheckouts.length === 0 ? (
                <div className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>No items are currently checked out to this student.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeCheckouts.map((checkout) => (
                    <div key={checkout.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                          {checkout.equipment?.name ?? "Unknown equipment"}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                          {checkout.equipment?.category ? `${checkout.equipment.category} · ` : ""}
                          {checkout.period} · out for {formatDuration(checkout.checked_out_at)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                          Due {formatDateTime(checkout.due_at)}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <span className="badge badge-neutral">qty {checkout.quantity}</span>
                        {checkout.serial_number && (
                          <span className="badge" style={{ background: "#e8f0fe", color: "#005a78" }}>
                            {checkout.serial_number}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl p-6" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.06)" }}>
              <h3 className="font-semibold text-base mb-4" style={{ color: "var(--ignite-navy)" }}>Student Info</h3>
              <div className="space-y-4">
                <InfoRow label="Student ID" value={student.student_id || "Not set"} mono />
                <InfoRow label="Email" value={student.email || "Not linked"} />
                <InfoRow label="Account Link" value={student.user_id ? "Linked to sign-in account" : "No linked account"} />
                <InfoRow label="Roster Status" value={student.is_active ? "Active" : "Inactive"} />
                <InfoRow label="Added" value={formatDate(student.created_at)} />
                <InfoRow label="Last Checkout" value={formatDateTime(latestCheckout)} />
              </div>
            </section>
          </div>

          <section className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.06)" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>Checkout History</h3>
            </div>
            {historyCount === 0 ? (
              <div className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>No checkout history yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Qty</th>
                      <th>Serial</th>
                      <th>Checked Out</th>
                      <th>Due</th>
                      <th>Checked In</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkouts?.map((checkout) => (
                      <tr key={checkout.id}>
                        <td className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                          {checkout.equipment?.name ?? "Unknown"}
                        </td>
                        <td style={{ color: "#374151" }}>{checkout.quantity}</td>
                        <td className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                          {checkout.serial_number ?? "-"}
                        </td>
                        <td style={{ color: "#374151" }}>{formatDateTime(checkout.checked_out_at)}</td>
                        <td style={{ color: "#374151" }}>{formatDateTime(checkout.due_at)}</td>
                        <td style={{ color: "#374151" }}>{formatDateTime(checkout.checked_in_at)}</td>
                        <td>
                          <span className={`badge ${checkout.checked_in_at ? "badge-success" : "badge-warning"}`}>
                            {checkout.checked_in_at ? "Returned" : "Out"}
                          </span>
                        </td>
                        <td className="history-notes" style={{ color: "var(--muted)" }}>
                          {[checkout.notes, checkout.return_notes].filter(Boolean).join(" / ") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DetailCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "warning";
}) {
  const valueColor = accent === "warning" ? "#ca8a04" : accent === "success" ? "#16a34a" : "var(--ignite-navy)";

  return (
    <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.06)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: valueColor, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</p>
      <p className={`text-sm mt-1 ${mono ? "font-mono" : ""}`} style={{ color: "#374151" }}>{value}</p>
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <AppShell>
      <StudentDetailContent />
    </AppShell>
  );
}
