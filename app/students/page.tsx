"use client";

import { Fragment, useEffect, useState, useCallback, FormEvent } from "react";
import type { AppUser as User } from "@/lib/firebase/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Eye, EyeOff, LoaderCircle, Plus, Search, UsersRound, X } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import PeriodBadge from "@/app/components/PeriodBadge";
import SelectMenu from "@/components/ui/select-menu";
import { usePeriod } from "@/app/lib/period-context";
import { firebaseFetch } from "@/lib/firebase/auth-fetch";
import { createFirebaseDataClient } from "@/lib/firebase/browser-data";
import { Period, Student } from "@/app/lib/types";

function StudentsContent() {
  const { period } = usePeriod();
  const router = useRouter();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => {
    setStudents(null);
    setTick((t) => t + 1);
  }, []);

  const [showAdd, setShowAdd] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: "", student_id: "", email: "", period: "AM" as Period });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!authResolved) return;
    if (currentUser?.user_metadata?.role === "Student") {
      queueMicrotask(() => setStudents([]));
      return;
    }

    let cancelled = false;

    createFirebaseDataClient()
      .from<Student>("students")
      .select("*")
      .eq("period", period)
      .eq("is_active", true)
      .order("name")
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message ?? "Unknown error");
        else setStudents(data ?? []);
      });

    return () => { cancelled = true; };
  }, [authResolved, currentUser, period, tick]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await createFirebaseDataClient().auth.getUser();
        if (!mounted) return;
        const user = res.data.user ?? null;
        setCurrentUser(user);
        if (user?.user_metadata?.role === "Student") {
          router.replace("/checkout");
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setAuthResolved(true);
      }
    })();

    return () => { mounted = false; };
  }, [router]);

  if (!authResolved || currentUser?.user_metadata?.role === "Student") {
    return (
      <div className="material-panel-strong rounded-2xl p-6">
        <h2 className="text-xl font-semibold" style={{ color: "var(--ignite-navy)" }}>Students</h2>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Redirecting to checkout…</p>
      </div>
    );
  }

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

    try {
      const resp = await firebaseFetch("/api/admin/create-student", {
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

  const openDelete = (student: Student) => {
    setEditingStudent(null);
    setDeletingStudent(student);
    setDeletePassword("");
    setShowDeletePassword(false);
    setDeleteError(null);
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!deletingStudent) return;

    setDeleteSaving(true);
    setDeleteError(null);

    const resp = await firebaseFetch("/api/admin/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deletingStudent.id, teacherPassword: deletePassword }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setDeleteError(String(data?.error?.message ?? data?.error ?? "Unable to delete student."));
    } else {
      setStudents((current) => current?.filter((student) => student.id !== deletingStudent.id) ?? current);
      setDeletingStudent(null);
      setDeletePassword("");
      refresh();
    }

    setDeleteSaving(false);
  };

  const openEdit = (student: Student) => {
    setDeletingStudent(null);
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      student_id: student.student_id ?? "",
      email: student.email ?? "",
      period: student.period,
    });
    setEditError(null);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setEditSaving(true);
    setEditError(null);

    const resp = await firebaseFetch("/api/admin/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingStudent.id,
        userId: editingStudent.user_id ?? null,
        name: editForm.name,
        studentId: editForm.student_id,
        email: editForm.email,
        period: editForm.period,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setEditError(String(data?.error?.message ?? data?.error ?? "Unable to update student."));
    } else {
      setEditingStudent(null);
      refresh();
    }

    setEditSaving(false);
  };

  const filtered = (students ?? []).filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.student_id ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const loading = students === null && error === null;

  return (
    <div>
      {/* Page header */}
      <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="page-title text-2xl">
            Students
          </h2>
          <p className="page-subtitle text-sm mt-1">
            <PeriodBadge>{period} period</PeriodBadge>{" "}
            roster — {(students ?? []).length} student{(students ?? []).length !== 1 ? "s" : ""}
          </p>
        </div>
        {currentUser?.user_metadata?.role !== "Student" && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
            onClick={() => {
              setEditingStudent(null);
              setDeletingStudent(null);
              setShowAdd((v) => !v);
              setSaveError(null);
            }}
              className="action-button px-4 py-2 text-sm"
            >
              {showAdd ? (
                <>
                  <X size={14} strokeWidth={2.5} />
                  Cancel
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={2.5} />
                  Add Student
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div
          className="material-panel-strong rounded-2xl p-6 mb-6"
        >
          <h3 className="font-semibold text-base mb-5" style={{ color: "var(--ignite-navy)" }}>
            Add Student
          </h3>
          {saveError && (
            <div
              className="status-alert status-alert-danger mb-4 flex items-start gap-2.5"
            >
              <CircleAlert className="mt-0.5 shrink-0" size={14} strokeWidth={2} />
              {saveError}
            </div>
          )}
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="s-first" style={{ color: "#374151" }}>
                  First name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="s-first"
                  type="text"
                  required
                  maxLength={60}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="s-last" style={{ color: "#374151" }}>
                  Last name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="s-last"
                  type="text"
                  required
                  maxLength={60}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="s-sid" style={{ color: "#374151" }}>
                  Student ID <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="s-sid"
                  type="text"
                  required
                  maxLength={20}
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="4000"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="s-email" style={{ color: "#374151" }}>
                  Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="s-email"
                  type="email"
                  required
                  maxLength={200}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student@bentonvillek12.org"
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="s-password" style={{ color: "#374151" }}>
                  Temporary password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="relative">
                  <input
                    id="s-password"
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set a temporary password"
                    className="form-input"
                    style={{ paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? "Hide temporary password" : "Show temporary password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2"
                    style={{ color: "#94a3b8" }}
                    onClick={() => setShowNewPassword((value) => !value)}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <button type="submit" disabled={saving}
                className="action-button px-4 py-2 text-sm disabled:opacity-50">
                {saving ? (
                  <>
                    <LoaderCircle className="animate-spin" size={13} strokeWidth={2.5} />
                    Adding…
                  </>
                ) : "Add Student"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="material-panel rounded-2xl p-3 mb-4">
        <div className="relative max-w-sm">
          <Search
            className="absolute pointer-events-none"
            style={{ left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            size={15}
            strokeWidth={2}
          />
          <input
            type="search"
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: "2.65rem" }}
            aria-label="Search students"
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="material-panel-strong rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon !h-8 !w-8">
              <LoaderCircle className="animate-spin" size={16} color="#94a3b8" strokeWidth={2.5} />
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading students…</p>
          </div>
        ) : error ? (
          <div className="empty-state text-sm" style={{ color: "#dc2626" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <UsersRound size={22} color="#94a3b8" strokeWidth={1.75} />
            </div>
            <p className="font-medium text-sm" style={{ color: "#374151" }}>No students found</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {search ? "Try a different search." : `No active students in ${period} period.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table students-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Student ID</th>
                  <th>Period</th>
                  <th>Added</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <Fragment key={s.id}>
                  <tr>
                    <td>
                      <Link
                        href={`/students/${s.id}`}
                        className="students-name font-semibold hover:underline"
                        style={{ color: "var(--ignite-navy)" }}
                        title={`Open ${s.name}`}
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td>
                      <span className="font-mono text-sm" style={{ color: "#374151" }}>
                        {s.student_id ?? <span style={{ color: "var(--muted)" }}>—</span>}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: "#e8f0fe", color: "#005a78" }}
                      >
                        {s.period}
                      </span>
                    </td>
                    <td className="text-sm whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td>
                      {currentUser?.user_metadata?.role !== "Student" ? (
                        <div className="students-actions">
                          <button
                            onClick={() => openEdit(s)}
                            className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                            style={{ color: "var(--ignite-navy)", background: "#e8f0fe" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openDelete(s)}
                            className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                            style={{ color: "#dc2626", background: "rgba(220,38,38,0.08)" }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                  {editingStudent?.id === s.id && (
                    <tr className="inline-action-row">
                      <td colSpan={5}>
                        <div className="inline-action-panel">
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
                              Edit Student
                            </h3>
                            <button
                              type="button"
                              onClick={() => setEditingStudent(null)}
                              className="quiet-button text-xs px-3 py-1.5"
                            >
                              Cancel
                            </button>
                          </div>
                          {editError && (
                            <div className="status-alert status-alert-danger mb-4">
                              {editError}
                            </div>
                          )}
                          <form onSubmit={handleEdit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="sm:col-span-2">
                                <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-name-${s.id}`} style={{ color: "#374151" }}>
                                  Full name <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <input
                                  id={`edit-name-${s.id}`}
                                  type="text"
                                  required
                                  maxLength={120}
                                  value={editForm.name}
                                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                  className="form-input"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-sid-${s.id}`} style={{ color: "#374151" }}>
                                  Student ID <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <input
                                  id={`edit-sid-${s.id}`}
                                  type="text"
                                  required
                                  maxLength={20}
                                  value={editForm.student_id}
                                  onChange={(e) => setEditForm((f) => ({ ...f, student_id: e.target.value }))}
                                  className="form-input"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-period-${s.id}`} style={{ color: "#374151" }}>
                                  Period
                                </label>
                                <SelectMenu
                                  id={`edit-period-${s.id}`}
                                  value={editForm.period}
                                  onChange={(nextValue) => setEditForm((f) => ({ ...f, period: nextValue as Period }))}
                                  options={[
                                    { label: "AM", value: "AM" },
                                    { label: "PM", value: "PM" },
                                  ]}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-sm font-medium mb-1.5" htmlFor={`edit-email-${s.id}`} style={{ color: "#374151" }}>
                                  Email <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <input
                                  id={`edit-email-${s.id}`}
                                  type="email"
                                  required
                                  maxLength={200}
                                  value={editForm.email}
                                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                  className="form-input"
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              disabled={editSaving}
                              className="action-button px-4 py-2 text-sm disabled:opacity-50"
                            >
                              {editSaving ? "Saving…" : "Save Changes"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )}
                  {deletingStudent?.id === s.id && (
                    <tr className="inline-action-row">
                      <td colSpan={5}>
                        <div className="inline-action-panel inline-action-panel-danger">
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <h3 className="font-semibold text-base" style={{ color: "#b91c1c" }}>
                                Delete Student Account
                              </h3>
                              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                                This removes {deletingStudent.name} from the active roster and deletes their sign-in account. Checkout history stays saved.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDeletingStudent(null)}
                              className="quiet-button text-xs px-3 py-1.5"
                            >
                              Cancel
                            </button>
                          </div>
                          {deleteError && (
                            <div className="status-alert status-alert-danger mb-4">
                              {deleteError}
                            </div>
                          )}
                          <form onSubmit={handleDelete} className="space-y-4">
                            <div className="max-w-sm">
                              <label className="block text-sm font-medium mb-1.5" htmlFor={`delete-password-${s.id}`} style={{ color: "#374151" }}>
                                Enter your teacher password <span style={{ color: "#ef4444" }}>*</span>
                              </label>
                              <div className="relative">
                                <input
                                  id={`delete-password-${s.id}`}
                                  type={showDeletePassword ? "text" : "password"}
                                  required
                                  autoComplete="current-password"
                                  value={deletePassword}
                                  onChange={(event) => setDeletePassword(event.target.value)}
                                  className="form-input"
                                  style={{ paddingRight: "2.75rem" }}
                                />
                                <button
                                  type="button"
                                  aria-label={showDeletePassword ? "Hide teacher password" : "Show teacher password"}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2"
                                  style={{ color: "#94a3b8" }}
                                  onClick={() => setShowDeletePassword((value) => !value)}
                                >
                                  {showDeletePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                            </div>
                            <button
                              type="submit"
                              disabled={deleteSaving}
                              className="action-button px-4 py-2 text-sm disabled:opacity-50"
                              style={{ background: "#dc2626" }}
                            >
                              {deleteSaving ? "Deleting…" : "Delete Student and Auth Account"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
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
