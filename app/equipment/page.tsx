"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { Eye, EyeOff } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import SelectMenu from "@/components/ui/select-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
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
  const [scanToEditGroup, setScanToEditGroup] = useState<EquipmentGroup | null>(null);
  const [scanToEditValue, setScanToEditValue] = useState("");
  const [scanToEditError, setScanToEditError] = useState<string | null>(null);
  const [scanToEditSuccess, setScanToEditSuccess] = useState<string | null>(null);
  const [removingEquipment, setRemovingEquipment] = useState<EquipmentWithAvail | null>(null);
  const [removePassword, setRemovePassword] = useState("");
  const [showRemovePassword, setShowRemovePassword] = useState(false);
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
        .select("equipment_id, quantity, serial_number")
        .is("checked_in_at", null),
    ]).then(([{ data: eqData, error: eqErr }, { data: coData }]) => {
      if (cancelled) return;
      if (eqErr) { setError(eqErr.message); return; }

      const checkedOutMap = new Map<string, number>();
      const checkedOutSerialsMap = new Map<string, Set<string>>();
      (coData ?? []).forEach((c: { equipment_id: string; quantity: number; serial_number?: string | null }) => {
        checkedOutMap.set(c.equipment_id, (checkedOutMap.get(c.equipment_id) ?? 0) + c.quantity);
        if (c.serial_number) {
          const serials = checkedOutSerialsMap.get(c.equipment_id) ?? new Set<string>();
          serials.add(c.serial_number.trim().toLowerCase());
          checkedOutSerialsMap.set(c.equipment_id, serials);
        }
      });

      const withAvail = ((eqData ?? []) as Equipment[]).map((e) => ({
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
    setEditBarcodeFeedback(null);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEquipment) return;

    const qty = parseInt(editForm.total_quantity, 10);
    if (!editForm.name.trim()) { setEditError("Name is required."); return; }
    if (isNaN(qty) || qty < 1) { setEditError("Quantity must be at least 1."); return; }
    if (categorySupportsSerialNumbers(editForm.category)) {
      const serialCount = parseSerialNumbers(editForm.serial_number).length;
      if (qty === 1 && serialCount !== 1) {
        setEditError("Scan exactly one barcode label for this item.");
        return;
      }
      if (qty > 1 && serialCount < qty) {
        setEditError("Each item must have a barcode label.");
        return;
      }
      if (qty > 1 && serialCount > qty) {
        setEditError("Barcode labels cannot be more than the quantity.");
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
  const groupedEquipment = filtered.reduce<EquipmentGroup[]>((groups, item) => {
    const key = `${item.name.trim().toLowerCase()}::${item.category.trim().toLowerCase()}`;
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
      barcodeTracked: categorySupportsSerialNumbers(item.category),
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
  const editingLegacyGroupedSerialized =
    editCategoryHasSerials && parseInt(editForm.total_quantity, 10) > 1;
  const openAddForm = () => {
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

  const openEditGroup = (group: EquipmentGroup) => {
    if (!group.barcodeTracked || group.items.length === 1) {
      openEdit(group.items[0]);
      return;
    }

    setScanToEditGroup(group);
    setScanToEditValue("");
    setScanToEditError(null);
    setScanToEditSuccess(null);
  };

  const matchScannedEditItem = (rawValue: string) => {
    const barcode = normalizeSerialNumber(rawValue);
    if (!barcode || !scanToEditGroup) {
      setScanToEditError("Scan the item's barcode first.");
      setScanToEditSuccess(null);
      return;
    }

    setScanToEditValue(barcode);

    const matches = scanToEditGroup.items.filter((item) =>
      parseSerialNumbers(item.serial_number).some((savedBarcode) => savedBarcode.toLowerCase() === barcode.toLowerCase())
    );

    if (matches.length === 0) {
      setScanToEditError(`That barcode does not belong to ${scanToEditGroup.name}.`);
      setScanToEditSuccess(null);
      return;
    }

    if (matches.length > 1) {
      setScanToEditError("That barcode is duplicated inside this group. Fix the barcodes before editing.");
      setScanToEditSuccess(null);
      return;
    }

    setScanToEditError(null);
    setScanToEditSuccess(`Editing ${matches[0].name} (${barcode}).`);
    setScanToEditGroup(null);
    openEdit(matches[0]);
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
            Add Equipment
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
          {saveSuccess && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}
            >
              <svg className="mt-0.5 shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
              </svg>
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
      {scanToEditGroup && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafcff 100%)", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 1px 3px rgba(15,36,55,0.07), 0 6px 24px rgba(15,36,55,0.06)" }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
                Scan Item To Edit
              </h3>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                {scanToEditGroup.items.length} copies of {scanToEditGroup.name} are grouped together. Scan the exact item you want to change.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScanToEditGroup(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "var(--muted)", background: "#f1f5f9" }}
            >
              Cancel
            </button>
          </div>
          {scanToEditError && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              {scanToEditError}
            </div>
          )}
          {scanToEditSuccess && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
              {scanToEditSuccess}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="scan-edit-barcode" style={{ color: "#374151" }}>
                IGNITE Barcode <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="flex gap-2 flex-col sm:flex-row">
                <input
                  id="scan-edit-barcode"
                  type="text"
                  value={scanToEditValue}
                  onChange={(e) => setScanToEditValue(e.target.value)}
                  placeholder="Scan barcode label"
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={() => matchScannedEditItem(scanToEditValue)}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--navy)" }}
                >
                  Match Item
                </button>
              </div>
            </div>
            <BarcodeScanner onDetected={matchScannedEditItem} />
          </div>
        </div>
      )}

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
                <SelectMenu
                  id="edit-eq-cat"
                  value={editForm.category}
                  onChange={(nextValue) => setEditForm((f) => ({ ...f, category: nextValue as (typeof EQUIPMENT_CATEGORIES)[number] }))}
                  options={EQUIPMENT_CATEGORIES.map((c) => ({ label: c, value: c }))}
                />
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
                  value={editCategoryHasSerials && !editingLegacyGroupedSerialized ? "1" : editForm.total_quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, total_quantity: e.target.value }))}
                  disabled={editCategoryHasSerials && !editingLegacyGroupedSerialized}
                  className="form-input"
                />
                {editCategoryHasSerials && !editingLegacyGroupedSerialized && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                    Barcode-labeled gear is stored one item per row.
                  </p>
                )}
                {editingLegacyGroupedSerialized && (
                  <p className="text-xs mt-1.5" style={{ color: "#ca8a04" }}>
                    This is a legacy grouped record. Leave quantity above 1 to keep editing it as a batch.
                  </p>
                )}
              </div>
              {editCategoryHasSerials && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-eq-serial" style={{ color: "#374151" }}>
                  {editingLegacyGroupedSerialized ? "IGNITE Barcodes" : "IGNITE Barcode"} <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {editingLegacyGroupedSerialized ? (
                  <>
                    <textarea
                      id="edit-eq-serial"
                      rows={3}
                      maxLength={1000}
                      value={editForm.serial_number}
                      onChange={(e) => setEditForm((f) => ({ ...f, serial_number: e.target.value }))}
                      placeholder="One barcode per line"
                      className="form-input"
                    />
                    <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                      {parseSerialNumbers(editForm.serial_number).length} / {editForm.total_quantity || "0"} barcodes entered
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      id="edit-eq-serial"
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
                  </>
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
              <div className="relative">
                <input
                  id="remove-equipment-password"
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
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading inventory…</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
        ) : groupedEquipment.length === 0 ? (
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
                    <tr key={group.key}>
                      <td className="font-semibold" style={{ color: "var(--ignite-navy)" }}>
                        {isTeacher ? (
                          <Link href={`/equipment/${groupLink.id}`} className="hover:underline">
                            {group.name}
                          </Link>
                        ) : (
                          group.name
                        )}
                        <p className="text-xs font-normal mt-1" style={{ color: "var(--muted)" }}>
                          {group.items.length} record{group.items.length === 1 ? "" : "s"} grouped
                        </p>
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
                        {group.barcodeTracked
                          ? sampleBarcodes.length > 0
                            ? `${sampleBarcodes.join(", ")}${group.items.length > 3 || sampleBarcodes.length === 3 ? "…" : ""}`
                            : "All checked out"
                          : "—"}
                      </td>
                      <td className="equipment-condition-cell text-sm" style={{ color: "var(--muted)" }}>
                        {group.conditionSummary}
                      </td>
                      <td>
                        {isTeacher ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <button
                              onClick={() => openEditGroup(group)}
                              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                              style={{ color: "var(--ignite-navy)", background: "#e8f0fe" }}
                            >
                              {group.barcodeTracked && group.items.length > 1 ? "Scan To Edit" : "Edit"}
                            </button>
                            <button
                              onClick={() => openRemove(group.items[0])}
                              disabled={group.barcodeTracked && group.items.length > 1}
                              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                              style={
                                group.barcodeTracked && group.items.length > 1
                                  ? { color: "#94a3b8", background: "#e2e8f0" }
                                  : { color: "#dc2626", background: "rgba(220,38,38,0.08)" }
                              }
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
