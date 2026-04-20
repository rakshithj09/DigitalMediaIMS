"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import AppShell from "@/app/components/AppShell";
import { createSupabaseBrowserClient } from "@/lip/supabase/browser-client";
import { Equipment, EQUIPMENT_CATEGORIES } from "@/app/lib/types";

type EquipmentWithAvail = Equipment & { available: number };

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

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: EQUIPMENT_CATEGORIES[0],
    total_quantity: "1",
    serial_number: "",
    condition_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
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
    };
  }, [tick]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const qty = parseInt(form.total_quantity, 10);
    if (!form.name.trim()) { setSaveError("Name is required."); setSaving(false); return; }
    if (isNaN(qty) || qty < 1) { setSaveError("Quantity must be at least 1."); setSaving(false); return; }

    const { error: insertError } = await createSupabaseBrowserClient()
      .from("equipment")
      .insert({
        name: form.name.trim(),
        category: form.category,
        total_quantity: qty,
        serial_number: form.serial_number.trim() || null,
        condition_notes: form.condition_notes.trim() || null,
      });

    if (insertError) {
      setSaveError(insertError.message);
    } else {
      setForm({ name: "", category: EQUIPMENT_CATEGORIES[0], total_quantity: "1", serial_number: "", condition_notes: "" });
      setShowAdd(false);
      refresh();
    }
    setSaving(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Remove this item from inventory? Checkout history is preserved.")) return;
    const { error: updateError } = await createSupabaseBrowserClient()
      .from("equipment")
      .update({ is_active: false })
      .eq("id", id);
    if (updateError) alert("Error: " + updateError.message);
    else refresh();
  };

  const allCategories = ["All", ...EQUIPMENT_CATEGORIES];
  const filtered = (equipment ?? []).filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || e.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const loading = equipment === null && error === null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Equipment</h2>
          <p className="text-gray-500 text-sm mt-1">Inventory with real-time availability</p>
        </div>
        <button
          onClick={() => { setShowAdd((v) => !v); setSaveError(null); }}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add Equipment"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm"
        >
          <h3 className="font-semibold text-gray-800 mb-4">New Equipment</h3>
          {saveError && <p className="text-red-600 text-sm mb-3">{saveError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="eq-name">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="eq-name"
                type="text"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Canon EOS R50"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="eq-cat">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="eq-cat"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="eq-qty">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                id="eq-qty"
                type="number"
                required
                min={1}
                max={999}
                value={form.total_quantity}
                onChange={(e) => setForm((f) => ({ ...f, total_quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="eq-serial">
                Serial / Asset Tag <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="eq-serial"
                type="text"
                maxLength={50}
                value={form.serial_number}
                onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="eq-notes">
                Condition Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="eq-notes"
                type="text"
                maxLength={200}
                value={form.condition_notes}
                onChange={(e) => setForm((f) => ({ ...f, condition_notes: e.target.value }))}
                placeholder="e.g. lens cap missing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving ? "Adding…" : "Add Equipment"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="search"
          placeholder="Search equipment…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search equipment"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label="Filter by category"
        >
          {allCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-red-500 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {search || categoryFilter !== "All" ? "No items match your filters." : "No equipment in inventory."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Category</th>
                  <th className="px-5 py-3 text-left font-medium">Available</th>
                  <th className="px-5 py-3 text-left font-medium">Total</th>
                  <th className="px-5 py-3 text-left font-medium">Serial</th>
                  <th className="px-5 py-3 text-left font-medium">Condition</th>
                  <th className="px-5 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => {
                  const pct = e.total_quantity > 0 ? e.available / e.total_quantity : 1;
                  const availColor =
                    pct === 0
                      ? "text-red-600 bg-red-50"
                      : pct < 0.5
                      ? "text-amber-700 bg-amber-50"
                      : "text-green-700 bg-green-50";

                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{e.name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${availColor}`}>
                          {e.available} / {e.total_quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{e.total_quantity}</td>
                      <td className="px-5 py-3 text-gray-500">{e.serial_number ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                        {e.condition_notes ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleDeactivate(e.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Remove
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

      <p className="text-xs text-gray-400 mt-3">
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
