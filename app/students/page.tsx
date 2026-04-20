"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import AppShell from "@/app/components/AppShell";
import { usePeriod } from "@/app/lib/period-context";
import { createSupabaseBrowserClient } from "@/lip/supabase/browser-client";
import { Student, Period } from "@/app/lib/types";

function StudentsContent() {
  const { period } = usePeriod();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => {
    setStudents(null);
    setTick((t) => t + 1);
  }, []);

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newPeriod, setNewPeriod] = useState<Period>(period);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setNewPeriod(period);
  }, [period]);

  useEffect(() => {
    let cancelled = false;

    createSupabaseBrowserClient()
      .from("students")
      .select("*")
      .eq("period", period)
      .eq("is_active", true)
      .order("name")
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setStudents((data as Student[]) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [period, tick]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setSaveError("Name is required.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await createSupabaseBrowserClient()
      .from("students")
      .insert({ name: trimmedName, student_id: newStudentId.trim() || null, period: newPeriod });

    if (insertError) {
      setSaveError(insertError.message);
    } else {
      setNewName("");
      setNewStudentId("");
      setShowAdd(false);
      refresh();
    }
    setSaving(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Remove this student from the roster? Their checkout history is preserved.")) return;
    const { error: updateError } = await createSupabaseBrowserClient()
      .from("students")
      .update({ is_active: false })
      .eq("id", id);
    if (updateError) alert("Error: " + updateError.message);
    else refresh();
  };

  const filtered = (students ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.student_id ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const loading = students === null && error === null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-gray-500 text-sm mt-1">
            <span className="font-semibold text-blue-700">{period} period</span> roster
          </p>
        </div>
        <button
          onClick={() => { setShowAdd((v) => !v); setSaveError(null); }}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add Student"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm"
        >
          <h3 className="font-semibold text-gray-800 mb-4">New Student</h3>
          {saveError && (
            <p className="text-red-600 text-sm mb-3">{saveError}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-name">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="s-name"
                type="text"
                required
                maxLength={100}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="First Last"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-sid">
                Student ID <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="s-sid"
                type="text"
                maxLength={20}
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder="12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-period">
                Period
              </label>
              <select
                id="s-period"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value as Period)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving ? "Adding…" : "Add Student"}
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search students"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-red-500 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {search ? "No students match your search." : `No active students in ${period} period.`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Name</th>
                <th className="px-5 py-3 text-left font-medium">Student ID</th>
                <th className="px-5 py-3 text-left font-medium">Period</th>
                <th className="px-5 py-3 text-left font-medium">Added</th>
                <th className="px-5 py-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-5 py-3 text-gray-500">{s.student_id ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {s.period}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDeactivate(s.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Showing {filtered.length} of {(students ?? []).length} students
      </p>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <AppShell>
      <StudentsContent />
    </AppShell>
  );
}
