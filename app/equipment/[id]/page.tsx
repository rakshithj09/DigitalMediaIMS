"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import { Equipment, Checkout } from "@/app/lib/types";
import { categorySupportsSerialNumbers, parseSerialNumbers } from "@/app/lib/serials";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type CheckoutWithStudent = Checkout & {
  student?: {
    id: string;
    name: string;
    student_id?: string | null;
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

function formatDuration(start: string, end?: string | null) {
  const endMs = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.floor((endMs - new Date(start).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function EquipmentDetailContent() {
  const params = useParams<{ id: string }>();
  const equipmentId = params.id;
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [checkouts, setCheckouts] = useState<CheckoutWithStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    Promise.all([
      supabase.from("equipment").select("*").eq("id", equipmentId).maybeSingle(),
      supabase
        .from("checkouts")
        .select(
          `id, student_id, equipment_id, quantity, serial_number, checked_out_at, checked_in_at, notes, return_notes, period, created_at,
           student:students(id, name, student_id)`
        )
        .eq("equipment_id", equipmentId)
        .order("checked_out_at", { ascending: false }),
    ]).then(([equipmentResult, checkoutResult]) => {
      if (cancelled) return;
      if (equipmentResult.error) {
        setError(equipmentResult.error.message);
        return;
      }
      if (checkoutResult.error) {
        setError(checkoutResult.error.message);
        return;
      }
      setEquipment((equipmentResult.data as Equipment | null) ?? null);
      setCheckouts((checkoutResult.data as unknown as CheckoutWithStudent[]) ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  const activeCheckouts = useMemo(
    () => (checkouts ?? []).filter((checkout) => !checkout.checked_in_at),
    [checkouts]
  );
  const checkedOutQuantity = activeCheckouts.reduce((sum, checkout) => sum + checkout.quantity, 0);
  const available = equipment ? Math.max(0, equipment.total_quantity - checkedOutQuantity) : 0;
  const serials = equipment && categorySupportsSerialNumbers(equipment.category)
    ? parseSerialNumbers(equipment.serial_number)
    : [];
  const activeSerials = new Set(activeCheckouts.map((checkout) => checkout.serial_number).filter(Boolean));

  const loading = equipment === null && checkouts === null && error === null;

  return (
    <div>
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/equipment" className="text-sm font-semibold hover:underline" style={{ color: "var(--ignite-navy)" }}>
            &larr; Back to equipment
          </Link>
          <h2 className="text-2xl font-bold mt-3" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
            {equipment?.name ?? "Equipment Details"}
          </h2>
        </div>
        {equipment && (
          <Link
            href={`/checkout?eq=${equipment.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--navy)", boxShadow: "0 2px 8px rgba(0,90,120,0.22)" }}
          >
            Check Out
          </Link>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl px-6 py-16 text-center" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)" }}>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading equipment details...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl px-6 py-12 text-center text-sm" style={{ background: "white", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      ) : !equipment ? (
        <div className="rounded-2xl px-6 py-12 text-center" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)" }}>
          <p className="font-medium text-sm" style={{ color: "#374151" }}>Equipment not found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <DetailCard label="Category" value={equipment.category} />
            <DetailCard label="Available" value={`${available} / ${equipment.total_quantity}`} accent={available === 0 ? "danger" : "success"} />
            <DetailCard label="Active Checkouts" value={String(activeCheckouts.length)} />
            <DetailCard label="Serial Tags" value={String(serials.length)} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-6">
            <section className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.06)" }}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>Currently Out</h3>
              </div>
              {activeCheckouts.length === 0 ? (
                <div className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>No active checkouts for this item.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeCheckouts.map((checkout) => (
                    <div key={checkout.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                          {checkout.student?.name ?? "Unknown student"}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                          {checkout.student?.student_id ? `${checkout.student.student_id} · ` : ""}
                          {checkout.period} · out for {formatDuration(checkout.checked_out_at)}
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
              <h3 className="font-semibold text-base mb-4" style={{ color: "var(--ignite-navy)" }}>Item Info</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Condition Notes</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "#374151" }}>
                    {equipment.condition_notes || "No condition notes."}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Serial / Asset Tags</p>
                  {serials.length === 0 ? (
                    <p className="text-sm mt-1" style={{ color: "#374151" }}>No serial tags saved.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {serials.map((serial) => (
                        <span
                          key={serial}
                          className="badge"
                          style={activeSerials.has(serial)
                            ? { background: "#fef9c3", color: "#ca8a04" }
                            : { background: "#e8f0fe", color: "#005a78" }}
                        >
                          {serial}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.06)" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>Checkout History</h3>
            </div>
            {(checkouts ?? []).length === 0 ? (
              <div className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>No checkout history yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Qty</th>
                      <th>Serial</th>
                      <th>Period</th>
                      <th>Checked Out</th>
                      <th>Checked In</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(checkouts ?? []).map((checkout) => (
                      <tr key={checkout.id}>
                        <td className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                          {checkout.student?.name ?? "Unknown"}
                        </td>
                        <td style={{ color: "#374151" }}>{checkout.quantity}</td>
                        <td className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                          {checkout.serial_number ?? "-"}
                        </td>
                        <td><span className="badge badge-period">{checkout.period}</span></td>
                        <td style={{ color: "#374151" }}>{formatDateTime(checkout.checked_out_at)}</td>
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

function DetailCard({ label, value, accent }: { label: string; value: string; accent?: "success" | "danger" }) {
  const valueColor = accent === "danger" ? "#dc2626" : accent === "success" ? "#16a34a" : "var(--ignite-navy)";

  return (
    <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.06)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: valueColor, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}

export default function EquipmentDetailPage() {
  return (
    <AppShell>
      <EquipmentDetailContent />
    </AppShell>
  );
}
