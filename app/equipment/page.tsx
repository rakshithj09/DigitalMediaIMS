"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import AppShell from "@/app/components/AppShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Equipment, EQUIPMENT_CATEGORIES } from "@/app/lib/types";
import { categorySupportsSerialNumbers, parseSerialNumbers } from "@/app/lib/serials";

type EquipmentWithAvail = Equipment & { available: number };
type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

function isEquipmentCategory(value: string): value is EquipmentCategory {
  return EQUIPMENT_CATEGORIES.includes(value as EquipmentCategory);
}

function EquipmentContent() {
  const [equipment, setEquipment] = useState<EquipmentWithAvail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => {
    setEquipment(null);
    setTick((t) => t + 1);
  }, []);

  const [showAdd, setShowAdd] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form, setForm] = useState<{
    name: string;
    category: EquipmentCategory | "";
    total_quantity: string;
    serial_number: string;
    condition_notes: string;
  }>({
    name: "",
    category: "",
    total_quantity: "1",
    serial_number: "",
    condition_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentWithAvail | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    category: EquipmentCategory;
    total_quantity: string;
    serial_number: string;
    condition_notes: string;
  }>({
    name: "",
    category: EQUIPMENT_CATEGORIES[0],
    total_quantity: "1",
    serial_number: "",
    condition_notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [removingEquipment, setRemovingEquipment] = useState<EquipmentWithAvail | null>(null);
  const [removePassword, setRemovePassword] = useState("");
  const [removeSaving, setRemoveSaving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await createSupabaseBrowserClient().auth.getUser();
        if (!mounted) return;
        setCurrentUser(res.data.user ?? null);
      } catch {
        // ignore failures - role checks are best-effort on the client
      }
    })();

    let cancelled = false;

    Promise.all([
      createSupabaseBrowserClient()
        .from("equipment")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      createSupabaseBrowserClient()
        .from("checkouts")
        .select("equipment_id, quantity")
        .is("checked_in_at", null),
    ]).then(([{ data: eqData, error: eqErr }, { data: coData }]) => {
      if (cancelled) return;
      if (eqErr) { setError(eqErr.message); return; }

      const checkedOutMap = new Map<string, number>();
      (coData ?? []).forEach((c: { equipment_id: string; quantity: number }) => {
        checkedOutMap.set(c.equipment_id, (checkedOutMap.get(c.equipment_id) ?? 0) + c.quantity);
      });

      const withAvail = ((eqData ?? []) as Equipment[]).map((e) => ({
        ...e,
        available: e.total_quantity - (checkedOutMap.get(e.id) ?? 0),
      }));
      setEquipment(withAvail);
    });

    return () => {
      cancelled = true;
      mounted = false;
    };
  }, [tick]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const qty = parseInt(form.total_quantity, 10);
    if (!form.name.trim()) { setSaveError("Name is required."); setSaving(false); return; }
    if (!isEquipmentCategory(form.category)) { setSaveError("Please select a category."); setSaving(false); return; }
    if (isNaN(qty) || qty < 1) { setSaveError("Quantity must be at least 1."); setSaving(false); return; }
    if (categorySupportsSerialNumbers(form.category)) {
      const serialCount = parseSerialNumbers(form.serial_number).length;
      if (serialCount < qty) {
        setSaveError("Each item must have a serial number.");
        setSaving(false);
        return;
      }
      if (serialCount > qty) {
        setSaveError("Serial tags cannot be more than the quantity.");
        setSaving(false);
        return;
      }
    }

    const resp = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        category: form.category,
        totalQuantity: qty,
        serialNumber: categorySupportsSerialNumbers(form.category) ? form.serial_number.trim() || null : null,
        conditionNotes: form.condition_notes.trim() || null,
      }),
    });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      setSaveError(String(data?.error?.message ?? data?.error ?? "Unable to add equipment."));
    } else {
      setForm({
        name: "",
        category: isEquipmentCategory(categoryFilter) ? categoryFilter : "",
        total_quantity: "1",
        serial_number: "",
        condition_notes: "",
      });
      setShowAdd(false);
      refresh();
    }
    setSaving(false);
  };

  const openRemove = (item: EquipmentWithAvail) => {
    setRemovingEquipment(item);
    setRemovePassword("");
    setRemoveError(null);
  };

  const handleDeactivate = async (e: FormEvent) => {
    e.preventDefault();
    if (!removingEquipment) return;

    setRemoveSaving(true);
    setRemoveError(null);

    const resp = await fetch("/api/equipment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: removingEquipment.id, isActive: false, teacherPassword: removePassword }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setRemoveError(String(data?.error?.message ?? data?.error ?? "Unable to remove equipment."));
    } else {
      setRemovingEquipment(null);
      setRemovePassword("");
      refresh();
    }
    setRemoveSaving(false);
  };

  const openEdit = (item: EquipmentWithAvail) => {
    setEditingEquipment(item);
    setEditForm({
      name: item.name,
      category: item.category as (typeof EQUIPMENT_CATEGORIES)[number],
      total_quantity: String(item.total_quantity),
      serial_number: item.serial_number ?? "",
      condition_notes: item.condition_notes ?? "",
    });
    setEditError(null);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEquipment) return;

    const qty = parseInt(editForm.total_quantity, 10);
    if (!editForm.name.trim()) { setEditError("Name is required."); return; }
    if (isNaN(qty) || qty < 1) { setEditError("Quantity must be at least 1."); return; }
    if (categorySupportsSerialNumbers(editForm.category)) {
      const serialCount = parseSerialNumbers(editForm.serial_number).length;
      if (serialCount < qty) {
        setEditError("Each item must have a serial number.");
        return;
      }
      if (serialCount > qty) {
        setEditError("Serial tags cannot be more than the quantity.");
        return;
      }
    }

    setEditSaving(true);
    setEditError(null);

    const resp = await fetch("/api/equipment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingEquipment.id,
        name: editForm.name.trim(),
        category: editForm.category,
        totalQuantity: qty,
        serialNumber: categorySupportsSerialNumbers(editForm.category) ? editForm.serial_number.trim() || null : null,
        conditionNotes: editForm.condition_notes.trim() || null,
      }),
    });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      setEditError(String(data?.error?.message ?? data?.error ?? "Unable to update equipment."));
    } else {
      setEditingEquipment(null);
      refresh();
    }
    setEditSaving(false);
  };

  const allCategories = ["All", ...EQUIPMENT_CATEGORIES];
  const filtered = (equipment ?? [])
    .filter((e) => {
      const matchSearch =
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase()) ||
        (categorySupportsSerialNumbers(e.category) ? e.serial_number ?? "" : "").toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "All" || e.category === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const loading = equipment === null && error === null;
  const isTeacher = currentUser?.user_metadata?.role !== "Student";
  const addCategoryHasSerials = categorySupportsSerialNumbers(form.category);
  const editCategoryHasSerials = categorySupportsSerialNumbers(editForm.category);
  const openAddForm = () => {
    const selectedCategory = isEquipmentCategory(categoryFilter) ? categoryFilter : "";
    setForm((current) => ({
      ...current,
      category: selectedCategory,
      serial_number: current.category === selectedCategory ? current.serial_number : "",
    }));
    setShowAdd((visible) => !visible);
    setSaveError(null);
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
            Equipment
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Inventory with real-time availability
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ background: "var(--navy)", boxShadow: "0 2px 8px rgba(0,90,120,0.22)" }}
          >
            {showAdd ? (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Equipment
              </>
            )}
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}
        >
          <h3 className="font-semibold text-base mb-5" style={{ color: "var(--ignite-navy)" }}>
            New Equipment
          </h3>
          {saveError && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
            >
              <svg className="mt-0.5 shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {saveError}
            </div>
          )}
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="eq-name" style={{ color: "#374151" }}>
                  Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="eq-name"
                  type="text"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Canon EOS R50"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="eq-cat" style={{ color: "#374151" }}>
                  Category <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  id="eq-cat"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as EquipmentCategory | "" }))}
                  className="form-input"
                >
                  <option value="">Select category</option>
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="eq-qty" style={{ color: "#374151" }}>
                  Quantity <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="eq-qty"
                  type="number"
                  required
                  min={1}
                  max={999}
                  value={form.total_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, total_quantity: e.target.value }))}
                  className="form-input"
                />
              </div>
              {addCategoryHasSerials && (
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="eq-serial" style={{ color: "#374151" }}>
                  Serial / Asset Tags <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  id="eq-serial"
                  rows={3}
                  maxLength={1000}
                  value={form.serial_number}
                  onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                  placeholder="One per line"
                  className="form-input"
                />
                {parseInt(form.total_quantity, 10) > 1 && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                    {parseSerialNumbers(form.serial_number).length} / {form.total_quantity || "0"} tags entered
                  </p>
                )}
              </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" htmlFor="eq-notes" style={{ color: "#374151" }}>
                  Condition Notes{" "}
                  <span className="font-normal" style={{ color: "var(--muted)" }}>(optional)</span>
                </label>
                <input
                  id="eq-notes"
                  type="text"
                  maxLength={200}
                  value={form.condition_notes}
                  onChange={(e) => setForm((f) => ({ ...f, condition_notes: e.target.value }))}
                  placeholder="e.g. lens cap missing"
                  className="form-input"
                />
              </div>
            </div>
            <div className="pt-1">
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: "var(--navy)" }}>
                {saving ? (
                  <>
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Adding…
                  </>
                ) : "Add Equipment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editingEquipment && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
              Edit Equipment
            </h3>
            <button
              type="button"
              onClick={() => setEditingEquipment(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "var(--muted)", background: "#f1f5f9" }}
            >
              Cancel
            </button>
          </div>
          {editError && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              {editError}
            </div>
          )}
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-eq-name" style={{ color: "#374151" }}>
                  Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="edit-eq-name"
                  type="text"
                  required
                  maxLength={100}
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-eq-cat" style={{ color: "#374151" }}>
                  Category
                </label>
                <select
                  id="edit-eq-cat"
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as (typeof EQUIPMENT_CATEGORIES)[number] }))}
                  className="form-input"
                >
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-eq-qty" style={{ color: "#374151" }}>
                  Quantity <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="edit-eq-qty"
                  type="number"
                  required
                  min={1}
                  max={999}
                  value={editForm.total_quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, total_quantity: e.target.value }))}
                  className="form-input"
                />
              </div>
              {editCategoryHasSerials && (
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-eq-serial" style={{ color: "#374151" }}>
                  Serial / Asset Tags <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  id="edit-eq-serial"
                  rows={3}
                  maxLength={1000}
                  value={editForm.serial_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, serial_number: e.target.value }))}
                  placeholder="One per line"
                  className="form-input"
                />
                {parseInt(editForm.total_quantity, 10) > 1 && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                    {parseSerialNumbers(editForm.serial_number).length} / {editForm.total_quantity || "0"} tags entered
                  </p>
                )}
              </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-eq-notes" style={{ color: "#374151" }}>
                  Condition Notes
                </label>
                <input
                  id="edit-eq-notes"
                  type="text"
                  maxLength={200}
                  value={editForm.condition_notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, condition_notes: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={editSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      )}

      {/* Remove confirmation */}
      {removingEquipment && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "linear-gradient(135deg, #fff5f5 0%, #fff8f8 100%)", border: "1.5px solid #fecaca", boxShadow: "0 1px 3px rgba(185,28,28,0.06), 0 6px 24px rgba(185,28,28,0.06)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="font-semibold text-base" style={{ color: "#b91c1c" }}>
                Remove Equipment
              </h3>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                This removes {removingEquipment.name} from active inventory. Checkout history stays saved.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRemovingEquipment(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "var(--muted)", background: "#f1f5f9" }}
            >
              Cancel
            </button>
          </div>
          {removeError && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              {removeError}
            </div>
          )}
          <form onSubmit={handleDeactivate} className="space-y-4">
            <div className="max-w-sm">
              <label className="block text-sm font-medium mb-1.5" htmlFor="remove-equipment-password" style={{ color: "#374151" }}>
                Enter your teacher password <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="remove-equipment-password"
                type="password"
                required
                autoComplete="current-password"
                value={removePassword}
                onChange={(event) => setRemovePassword(event.target.value)}
                className="form-input"
              />
            </div>
            <button
              type="submit"
              disabled={removeSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#dc2626" }}
            >
              {removeSaving ? "Removing…" : "Remove Equipment"}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <svg
            className="absolute pointer-events-none"
            style={{ left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search equipment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ width: 240, paddingLeft: "2.65rem" }}
            aria-label="Search equipment"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="form-input"
          style={{ width: "auto" }}
          aria-label="Filter by category"
        >
          {allCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}
      >
        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: "#f1f5f9" }}>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading inventory…</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#f8fafc" }}>
              <svg width="22" height="22" fill="none" stroke="#94a3b8" strokeWidth="1.75" viewBox="0 0 24 24">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <p className="font-medium text-sm" style={{ color: "#374151" }}>No equipment found</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {search || categoryFilter !== "All" ? "Try adjusting your filters." : "No equipment in inventory yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Available</th>
                  <th>Total</th>
                  <th>Serial</th>
                  <th>Condition</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const pct = e.total_quantity > 0 ? e.available / e.total_quantity : 1;
                  const availStyle =
                    pct === 0
                      ? { background: "#fee2e2", color: "#dc2626" }
                      : pct < 0.5
                      ? { background: "#fef9c3", color: "#ca8a04" }
                      : { background: "#dcfce7", color: "#16a34a" };

                  return (
                    <tr key={e.id}>
                      <td className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                        <Link href={`/equipment/${e.id}`} className="hover:underline">
                          {e.name}
                        </Link>
                      </td>
                      <td>
                        <span className="badge" style={{ background: "#f1f5f9", color: "var(--muted)" }}>
                          {e.category}
                        </span>
                      </td>
                      <td>
                        <span className="badge font-bold" style={availStyle}>
                          {e.available} / {e.total_quantity}
                        </span>
                      </td>
                      <td className="text-sm" style={{ color: "#374151" }}>{e.total_quantity}</td>
                      <td className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                        {categorySupportsSerialNumbers(e.category) && parseSerialNumbers(e.serial_number).length > 0
                          ? parseSerialNumbers(e.serial_number).join(", ")
                          : "—"}
                      </td>
                      <td className="max-w-[180px] truncate text-sm" style={{ color: "var(--muted)" }}>
                        {e.condition_notes ?? "—"}
                      </td>
                      <td>
                        {isTeacher ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <button
                              onClick={() => openEdit(e)}
                              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                              style={{ color: "var(--ignite-navy)", background: "#e8f0fe" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openRemove(e)}
                              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors hover:bg-red-50"
                              style={{ color: "#dc2626" }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <Link
                            href={`/checkout?eq=${e.id}`}
                            className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                            style={{ background: "#e8f0fe", color: "#005a78" }}
                          >
                            Checkout
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        Showing {filtered.length} of {(equipment ?? []).length} items
      </p>
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <AppShell>
      <EquipmentContent />
    </AppShell>
  );
}
