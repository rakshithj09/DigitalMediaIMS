"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { User } from "@supabase/supabase-js";
import AppShell from "@/app/components/AppShell";
import { usePeriod } from "@/app/lib/period-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Student } from "@/app/lib/types";

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  // Period is no longer selected here; use the top-right selector value
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize newPeriod when opening the add form instead of calling setState synchronously in an effect

  useEffect(() => {
    let cancelled = false;

    createSupabaseBrowserClient()
      .from("students")
      .select("*")
      .eq("period", period)
      .eq("is_active", true)
      .order("name")
      .then(({ data, error: fetchError }: { data: Student[] | null; error: { message?: string } | null }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message ?? "Unknown error");
        else setStudents((data as Student[]) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [period, tick]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await createSupabaseBrowserClient().auth.getUser();
        if (!mounted) return;
        setCurrentUser(res.data.user ?? null);
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const f = firstName.trim();
    const l = lastName.trim();
    if (!f || !l) {
      setSaveError("First and last name are required.");
      setSaving(false);
      return;
    }

    // Call server-side admin API to create an auth user and insert the students row.
    // This requires SUPABASE_SERVICE_ROLE_KEY to be set on the server environment.
    try {
      const resp = await fetch("/api/admin/create-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: f,
          last_name: l,
          student_id: newStudentId.trim(),
          email: newEmail.trim(),
          password: newPassword,
          period,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = (data && (data.error?.message ?? data.error)) ?? JSON.stringify(data) ?? "Failed to create student";
        setSaveError(String(msg));
      } else {
        setFirstName("");
        setLastName("");
        setNewStudentId("");
        setNewEmail("");
        setNewPassword("");
        setShowAdd(false);
        refresh();
      }
    } catch (err) {
      setSaveError(String(err));
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
        {/* Only show add student button to non-students (teachers/admins) */}
        {currentUser?.user_metadata?.role !== "Student" && (
          <button
            onClick={() => {
                  setShowAdd((v) => !v);
                  setSaveError(null);
                }}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {showAdd ? "Cancel" : "+ Add Student"}
          </button>
        )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-first">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                id="s-first"
                type="text"
                required
                maxLength={60}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-last">
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                id="s-last"
                type="text"
                required
                maxLength={60}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Period removed from the add-student form; top-right selector controls the period */}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-sid">
                Student ID <span className="text-red-500">*</span>
              </label>
              <input
                id="s-sid"
                type="text"
                required
                maxLength={20}
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder="4000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-email">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="s-email"
                type="email"
                required
                maxLength={200}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="student@bentonvillek12.org"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="s-password">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="s-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Set a temporary password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Teachers set a temp password — students should change it after first sign in.</p>
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
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    {currentUser?.user_metadata?.role !== "Student" ? (
                      <button
                        onClick={() => handleDeactivate(s.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
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
