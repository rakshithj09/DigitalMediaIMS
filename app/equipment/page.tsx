"use client";

import { Fragment, useEffect, useState, useCallback, FormEvent } from "react";
import Link from "next/link";
import type { AppUser as User } from "@/lib/firebase/types";
import { BriefcaseBusiness, CheckCircle2, CircleAlert, Eye, EyeOff, LoaderCircle, Plus, Search, X } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import SelectMenu from "@/components/ui/select-menu";
import { createFirebaseDataClient } from "@/lib/firebase/browser-data";
import { firebaseFetch } from "@/lib/firebase/auth-fetch";
import { Equipment, EQUIPMENT_CATEGORIES } from "@/app/lib/types";
import { categorySupportsSerialNumbers, normalizeSerialNumber, parseSerialNumbers } from "@/app/lib/serials";

type EquipmentWithAvail = Equipment & { available: number; checkedOutSerials: string[] };
type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
type EquipmentGroup = {
  key: string;
  name: string;
  category: string;
  items: EquipmentWithAvail[];
  totalQuantity: number;
  available: number;
  barcodeTracked: boolean;
  conditionSummary: string;
};

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
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
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
  const [editBarcodeFeedback, setEditBarcodeFeedback] = useState<string | null>(null);
  const [addBarcodeFeedback, setAddBarcodeFeedback] = useState<string | null>(null);
  const [removingEquipment, setRemovingEquipment] = useState<EquipmentWithAvail | null>(null);
  const [removePassword, setRemovePassword] = useState("");
  const [showRemovePassword, setShowRemovePassword] = useState(false);
  const [removeSaving, setRemoveSaving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await createFirebaseDataClient().auth.getUser();
        if (!mounted) return;
        setCurrentUser(res.data.user ?? null);
      } catch {
        // ignore failures - role checks are best-effort on the client
      }
    })();

    let cancelled = false;

    Promise.all([
      createFirebaseDataClient()
        .from<Equipment>("equipment")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      createFirebaseDataClient()
        .from<{ equipment_id: string; quantity: number; serial_number?: string | null }>("checkouts")
        .select("equipment_id, quantity, serial_number")
        .is("checked_in_at", null),
    ]).then(([{ data: eqData, error: eqErr }, { data: coData }]) => {
      if (cancelled) return;
      if (eqErr) { setError(eqErr.message); return; }

      const checkedOutMap = new Map<string, number>();
      const checkedOutSerialsMap = new Map<string, Set<string>>();
      (coData ?? []).forEach((c) => {
        checkedOutMap.set(c.equipment_id, (checkedOutMap.get(c.equipment_id) ?? 0) + c.quantity);
        if (c.serial_number) {
          const serials = checkedOutSerialsMap.get(c.equipment_id) ?? new Set<string>();
          serials.add(c.serial_number.trim().toLowerCase());
          checkedOutSerialsMap.set(c.equipment_id, serials);
        }
      });

      const withAvail = (eqData ?? []).map((e) => ({
        ...e,
        available: e.total_quantity - (checkedOutMap.get(e.id) ?? 0),
        checkedOutSerials: Array.from(checkedOutSerialsMap.get(e.id) ?? []),
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
      if (qty !== 1) {
        setSaveError("Barcode-labeled equipment must be added one item at a time.");
        setSaving(false);
        return;
      }
      if (parseSerialNumbers(form.serial_number).length !== 1) {
        setSaveError("Scan exactly one barcode label for this item.");
        setSaving(false);
        return;
      }
    }

    const resp = await firebaseFetch("/api/equipment", {
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
      if (categorySupportsSerialNumbers(form.category)) {
        setForm((current) => ({
          ...current,
          total_quantity: "1",
          serial_number: "",
        }));
        setAddBarcodeFeedback(null);
        setSaveSuccess(`Saved ${form.name.trim()}. Scan the next barcode to add another copy.`);
      } else {
        setForm({
          name: "",
          category: isEquipmentCategory(categoryFilter) ? categoryFilter : "",
          total_quantity: "1",
          serial_number: "",
          condition_notes: "",
        });
        setShowAdd(false);
        setSaveSuccess(null);
      }
      refresh();
    }
    setSaving(false);
  };

  const openRemove = (item: EquipmentWithAvail) => {
    setEditingEquipment(null);
    setRemovingEquipment(item);
    setRemovePassword("");
    setShowRemovePassword(false);
    setRemoveError(null);
  };

  const handleDeactivate = async (e: FormEvent) => {
    e.preventDefault();
    if (!removingEquipment) return;

    setRemoveSaving(true);
    setRemoveError(null);

    const resp = await firebaseFetch("/api/equipment", {
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
    setRemovingEquipment(null);
    setEditingEquipment(item);
    setEditForm({
      name: item.name,
      category: item.category as (typeof EQUIPMENT_CATEGORIES)[number],
      total_quantity: categorySupportsSerialNumbers(item.category) ? "1" : String(item.total_quantity),
      serial_number: item.serial_number ?? "",
      condition_notes: item.condition_notes ?? "",
    });
    setEditError(null);
    setEditBarcodeFeedback(null);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEquipment) return;

    const editHasBarcode = categorySupportsSerialNumbers(editForm.category);
    const qty = editHasBarcode ? 1 : parseInt(editForm.total_quantity, 10);
    if (!editForm.name.trim()) { setEditError("Name is required."); return; }
    if (isNaN(qty) || qty < 1) { setEditError("Quantity must be at least 1."); return; }
    if (editHasBarcode) {
      const serialCount = parseSerialNumbers(editForm.serial_number).length;
      if (serialCount !== 1) {
        setEditError("Scan exactly one barcode label for this item.");
        return;
      }
    }

    setEditSaving(true);
    setEditError(null);

    const resp = await firebaseFetch("/api/equipment", {
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
  const groupedEquipment = filtered.reduce<EquipmentGroup[]>((groups, item) => {
    const barcodeTracked = categorySupportsSerialNumbers(item.category);
    const key = barcodeTracked ? item.id : `${item.name.trim().toLowerCase()}::${item.category.trim().toLowerCase()}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.items.push(item);
      existing.totalQuantity += item.total_quantity;
      existing.available += item.available;
      return groups;
    }

    groups.push({
      key,
      name: item.name,
      category: item.category,
      items: [item],
      totalQuantity: item.total_quantity,
      available: item.available,
      barcodeTracked,
      conditionSummary: item.condition_notes?.trim() || "",
    });
    return groups;
  }, []).map((group) => {
    const notes = Array.from(
      new Set(group.items.map((item) => item.condition_notes?.trim()).filter(Boolean))
    ) as string[];

    return {
      ...group,
      items: [...group.items].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      conditionSummary:
        notes.length === 0 ? "—" : notes.length === 1 ? notes[0] : "Varies by item",
    };
  });

  const loading = equipment === null && error === null;
  const isTeacher = currentUser?.user_metadata?.role !== "Student";
  const addCategoryHasSerials = categorySupportsSerialNumbers(form.category);
  const editCategoryHasSerials = categorySupportsSerialNumbers(editForm.category);
  const openAddForm = () => {
    setEditingEquipment(null);
    setRemovingEquipment(null);
    const selectedCategory = isEquipmentCategory(categoryFilter) ? categoryFilter : "";
    setForm((current) => ({
      ...current,
      category: selectedCategory,
      total_quantity: categorySupportsSerialNumbers(selectedCategory) ? "1" : current.total_quantity,
      serial_number: current.category === selectedCategory ? current.serial_number : "",
    }));
    setShowAdd((visible) => !visible);
    setSaveError(null);
    setSaveSuccess(null);
    setAddBarcodeFeedback(null);
  };

  const applyScannedAddBarcode = (rawValue: string) => {
    const barcode = normalizeSerialNumber(rawValue);
    if (!barcode) return;
    setForm((current) => ({ ...current, serial_number: barcode }));
    setAddBarcodeFeedback(`Scanned ${barcode}.`);
    setSaveError(null);
  };

  const applyScannedEditBarcode = (rawValue: string) => {
    const barcode = normalizeSerialNumber(rawValue);
    if (!barcode) return;
    setEditForm((current) => ({ ...current, serial_number: barcode }));
    setEditBarcodeFeedback(`Scanned ${barcode}.`);
    setEditError(null);
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
            Inventory with real time availability
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
                <X size={14} strokeWidth={2.5} />
                Cancel
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={2.5} />
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
            Add Equipment
          </h3>
          {saveError && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
            >
              <CircleAlert className="mt-0.5 shrink-0" size={14} strokeWidth={2} />
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}
            >
              <CheckCircle2 className="mt-0.5 shrink-0" size={14} strokeWidth={2} />
              {saveSuccess}
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
                <SelectMenu
                  id="eq-cat"
                  value={form.category}
                  onChange={(nextValue) => setForm((f) => ({
                    ...f,
                    category: nextValue as EquipmentCategory | "",
                    total_quantity: categorySupportsSerialNumbers(nextValue) ? "1" : f.total_quantity,
                    serial_number: categorySupportsSerialNumbers(nextValue) ? f.serial_number : "",
                  }))}
                  placeholder="Select category"
                  options={[
                    { label: "Select category", value: "" },
                    ...EQUIPMENT_CATEGORIES.map((c) => ({ label: c, value: c })),
                  ]}
                />
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
                  value={addCategoryHasSerials ? "1" : form.total_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, total_quantity: e.target.value }))}
                  disabled={addCategoryHasSerials}
                  className="form-input"
                />
                {addCategoryHasSerials && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                    Barcode-labeled gear is added one physical item at a time.
                  </p>
                )}
              </div>
              {addCategoryHasSerials && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" htmlFor="eq-serial" style={{ color: "#374151" }}>
                  IGNITE Barcode <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="eq-serial"
                  type="text"
                  maxLength={1000}
                  value={form.serial_number}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, serial_number: e.target.value }));
                    setAddBarcodeFeedback(null);
                  }}
                  placeholder="Scan barcode label"
                  className="form-input"
                />
                {addBarcodeFeedback && (
                  <p className="text-xs mt-1.5" style={{ color: "#047857" }}>
                    {addBarcodeFeedback}
                  </p>
                )}
                <div className="mt-3">
                  <BarcodeScanner onDetected={applyScannedAddBarcode} />
                </div>
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
                    <LoaderCircle className="animate-spin" size={13} strokeWidth={2.5} />
                    Adding…
                  </>
                ) : "Add Equipment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search
            className="absolute pointer-events-none"
            style={{ left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            size={15}
            strokeWidth={2}
          />
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
        <SelectMenu
          value={categoryFilter}
          onChange={setCategoryFilter}
          className="min-w-[12rem]"
          aria-label="Filter by category"
          options={allCategories.map((c) => ({ label: c, value: c }))}
        />
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
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading inventory…</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
        ) : groupedEquipment.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#f8fafc" }}>
              <BriefcaseBusiness size={22} color="#94a3b8" strokeWidth={1.75} />
            </div>
            <p className="font-medium text-sm" style={{ color: "#374151" }}>No equipment found</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {search || categoryFilter !== "All" ? "Try adjusting your filters." : "No equipment in inventory yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table equipment-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Availability</th>
                  <th>Barcode</th>
                  <th>Condition</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedEquipment.map((group) => {
                  const pct = group.totalQuantity > 0 ? group.available / group.totalQuantity : 1;
                  const availStyle =
                    pct === 0
                      ? { background: "#fee2e2", color: "#dc2626" }
                      : pct < 0.5
                      ? { background: "#fef9c3", color: "#ca8a04" }
                      : { background: "#dcfce7", color: "#16a34a" };
                  const sampleBarcodes = group.barcodeTracked
                    ? group.items
                        .flatMap((item) =>
                          parseSerialNumbers(item.serial_number).filter(
                            (serial) => !item.checkedOutSerials.includes(serial.toLowerCase())
                          )
                        )
                        .slice(0, 3)
                    : [];
                  const groupLink = group.items[0];

                  return (
                    <Fragment key={group.key}>
                    <tr>
                      <td className="equipment-name-cell font-semibold" style={{ color: "var(--ignite-navy)" }}>
                        <div className="equipment-name-wrap">
                          {isTeacher ? (
                            <Link href={`/equipment/${groupLink.id}`} className="equipment-name-link hover:underline">
                              {group.name}
                            </Link>
                          ) : (
                            <span className="equipment-name-link">{group.name}</span>
                          )}
                          <p className="equipment-row-subtext">
                            {group.barcodeTracked
                              ? "Individual barcode item"
                              : `${group.items.length} record${group.items.length === 1 ? "" : "s"} grouped`}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: "#f1f5f9", color: "var(--muted)" }}>
                          {group.category}
                        </span>
                      </td>
                      <td>
                        <span className="badge font-bold" style={availStyle}>
                          {group.available} / {group.totalQuantity}
                        </span>
                      </td>
                      <td className="equipment-serial-cell font-mono text-xs" style={{ color: "var(--muted)" }}>
                        <span
                          className="equipment-serial-value"
                          title={
                            group.barcodeTracked
                              ? parseSerialNumbers(group.items[0].serial_number)[0] ?? "Barcode not set"
                              : undefined
                          }
                        >
                          {group.barcodeTracked
                            ? sampleBarcodes.length > 0
                              ? `${sampleBarcodes.join(", ")}${group.items.length > 3 || sampleBarcodes.length === 3 ? "..." : ""}`
                              : "All checked out"
                            : "-"}
                        </span>
                      </td>
                      <td className="equipment-condition-cell text-sm" style={{ color: "var(--muted)" }}>
                        <span className="equipment-condition-value" title={group.conditionSummary === "—" ? undefined : group.conditionSummary}>
                          {group.conditionSummary}
                        </span>
                      </td>
                      <td>
                        {isTeacher ? (
                          <div className="equipment-action-group">
                            <button
                              onClick={() => openEdit(group.items[0])}
                              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                              style={{ color: "var(--ignite-navy)", background: "#e8f0fe" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openRemove(group.items[0])}
                              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                              style={{ color: "#dc2626", background: "rgba(220,38,38,0.08)" }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <Link
                            href={`/checkout?eq=${groupLink.id}`}
                            className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                            style={{ background: "#e8f0fe", color: "#005a78" }}
                          >
                            Checkout
                          </Link>
                        )}
                      </td>
                    </tr>
                    {editingEquipment?.id === groupLink.id && (
                      <tr className="inline-action-row">
                        <td colSpan={6}>
                          <div className="inline-action-panel">
                            <div className="flex items-center justify-between gap-3 mb-4">
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
                                  <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-eq-name-${groupLink.id}`} style={{ color: "#374151" }}>
                                    Name <span style={{ color: "#ef4444" }}>*</span>
                                  </label>
                                  <input
                                    id={`edit-eq-name-${groupLink.id}`}
                                    type="text"
                                    required
                                    maxLength={100}
                                    value={editForm.name}
                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                    className="form-input"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-eq-cat-${groupLink.id}`} style={{ color: "#374151" }}>
                                    Category
                                  </label>
                                  <SelectMenu
                                    id={`edit-eq-cat-${groupLink.id}`}
                                    value={editForm.category}
                                    onChange={(nextValue) => setEditForm((f) => ({
                                      ...f,
                                      category: nextValue as (typeof EQUIPMENT_CATEGORIES)[number],
                                      total_quantity: categorySupportsSerialNumbers(nextValue) ? "1" : f.total_quantity,
                                      serial_number: categorySupportsSerialNumbers(nextValue) ? f.serial_number : "",
                                    }))}
                                    options={EQUIPMENT_CATEGORIES.map((c) => ({ label: c, value: c }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-eq-qty-${groupLink.id}`} style={{ color: "#374151" }}>
                                    Quantity <span style={{ color: "#ef4444" }}>*</span>
                                  </label>
                                  <input
                                    id={`edit-eq-qty-${groupLink.id}`}
                                    type="number"
                                    required
                                    min={1}
                                    max={999}
                                    value={editCategoryHasSerials ? "1" : editForm.total_quantity}
                                    onChange={(e) => setEditForm((f) => ({ ...f, total_quantity: e.target.value }))}
                                    disabled={editCategoryHasSerials}
                                    className="form-input"
                                  />
                                  {editCategoryHasSerials && (
                                    <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                                      Barcode-labeled gear is stored one item per row.
                                    </p>
                                  )}
                                </div>
                                {editCategoryHasSerials && (
                                  <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-eq-serial-${groupLink.id}`} style={{ color: "#374151" }}>
                                      IGNITE Barcode <span style={{ color: "#ef4444" }}>*</span>
                                    </label>
                                    <input
                                      id={`edit-eq-serial-${groupLink.id}`}
                                      type="text"
                                      maxLength={1000}
                                      value={editForm.serial_number}
                                      onChange={(e) => {
                                        setEditForm((f) => ({ ...f, serial_number: e.target.value }));
                                        setEditBarcodeFeedback(null);
                                      }}
                                      placeholder="Scan barcode label"
                                      className="form-input"
                                    />
                                    {editBarcodeFeedback && (
                                      <p className="text-xs mt-1.5" style={{ color: "#047857" }}>
                                        {editBarcodeFeedback}
                                      </p>
                                    )}
                                    <div className="mt-3">
                                      <BarcodeScanner onDetected={applyScannedEditBarcode} />
                                    </div>
                                  </div>
                                )}
                                <div className="sm:col-span-2">
                                  <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-eq-notes-${groupLink.id}`} style={{ color: "#374151" }}>
                                    Condition Notes
                                  </label>
                                  <input
                                    id={`edit-eq-notes-${groupLink.id}`}
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
                        </td>
                      </tr>
                    )}
                    {removingEquipment?.id === groupLink.id && (
                      <tr className="inline-action-row">
                        <td colSpan={6}>
                          <div className="inline-action-panel inline-action-panel-danger">
                            <div className="flex items-start justify-between gap-3 mb-4">
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
                                <label className="block text-sm font-medium mb-1.5" htmlFor={`remove-equipment-password-${groupLink.id}`} style={{ color: "#374151" }}>
                                  Enter your teacher password <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="relative">
                                  <input
                                    id={`remove-equipment-password-${groupLink.id}`}
                                    type={showRemovePassword ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    value={removePassword}
                                    onChange={(event) => setRemovePassword(event.target.value)}
                                    className="form-input"
                                    style={{ paddingRight: "2.75rem" }}
                                  />
                                  <button
                                    type="button"
                                    aria-label={showRemovePassword ? "Hide teacher password" : "Show teacher password"}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2"
                                    style={{ color: "#94a3b8" }}
                                    onClick={() => setShowRemovePassword((value) => !value)}
                                  >
                                    {showRemovePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </button>
                                </div>
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
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
