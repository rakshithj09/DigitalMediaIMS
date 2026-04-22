"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import { usePeriod } from "@/app/lib/period-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
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
  const [showTeacherApproval, setShowTeacherApproval] = useState(false);
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
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [teacherApprovalEmail, setTeacherApprovalEmail] = useState("");
  const [teacherApprovalSaving, setTeacherApprovalSaving] = useState(false);
  const [teacherApprovalError, setTeacherApprovalError] = useState<string | null>(null);
  const [teacherApprovalMessage, setTeacherApprovalMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authResolved) return;
    if (currentUser?.user_metadata?.role === "Student") {
      queueMicrotask(() => setStudents([]));
      return;
    }

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

    return () => { cancelled = true; };
  }, [authResolved, currentUser, period, tick]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await createSupabaseBrowserClient().auth.getUser();
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
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #e9eef5" }}>
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

  const openDelete = (student: Student) => {
    setDeletingStudent(student);
    setDeletePassword("");
    setDeleteError(null);
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!deletingStudent) return;

    setDeleteSaving(true);
    setDeleteError(null);

    const resp = await fetch("/api/admin/students", {
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

    const resp = await fetch("/api/admin/students", {
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

  const handleTeacherApproval = async (e: FormEvent) => {
    e.preventDefault();
    setTeacherApprovalSaving(true);
    setTeacherApprovalError(null);
    setTeacherApprovalMessage(null);

    const resp = await fetch("/api/admin/teacher-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: teacherApprovalEmail }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setTeacherApprovalError(String(data?.error?.message ?? data?.error ?? "Unable to approve teacher email."));
    } else {
      setTeacherApprovalMessage(`${data.email ?? teacherApprovalEmail.trim()} can now create a teacher account.`);
      setTeacherApprovalEmail("");
    }

    setTeacherApprovalSaving(false);
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
          <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
            Students
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            <span
              className="font-semibold px-2 py-0.5 rounded-full text-xs"
              style={{ background: "#e8f0fe", color: "#005a78" }}
            >
              {period} period
            </span>{" "}
            roster — {(students ?? []).length} student{(students ?? []).length !== 1 ? "s" : ""}
          </p>
        </div>
        {currentUser?.user_metadata?.role !== "Student" && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setShowTeacherApproval((value) => !value);
                setTeacherApprovalError(null);
                setTeacherApprovalMessage(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity"
              style={{ background: "var(--mint)", color: "var(--navy-deep)", boxShadow: "0 2px 8px rgba(255,210,31,0.22)" }}
            >
              {showTeacherApproval ? "Cancel" : "Approve Teacher"}
            </button>
            <button
              onClick={() => { setShowAdd((v) => !v); setSaveError(null); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ background: "var(--navy)" }}
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
          className="bg-white rounded-2xl p-6 mb-6"
          style={{ border: "1px solid #e9eef5", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
        >
          <h3 className="font-semibold text-base mb-5" style={{ color: "var(--ignite-navy)" }}>
            New Student
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
                    placeholder="Set a temp password"
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
                <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                  Students should change this after first sign in.
                </p>
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
                ) : "Add Student"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showTeacherApproval && (
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: "1px solid #e9eef5", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
      >
        <h3 className="font-semibold text-base mb-4" style={{ color: "var(--ignite-navy)" }}>
          Approve Teacher
        </h3>
        {teacherApprovalError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
            {teacherApprovalError}
          </div>
        )}
        {teacherApprovalMessage && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
            {teacherApprovalMessage}
          </div>
        )}
        <form onSubmit={handleTeacherApproval} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            maxLength={200}
            value={teacherApprovalEmail}
            onChange={(event) => setTeacherApprovalEmail(event.target.value)}
            placeholder="teacher@bentonvillek12.org"
            className="form-input"
            style={{ maxWidth: 360 }}
          />
          <button
            type="submit"
            disabled={teacherApprovalSaving}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            {teacherApprovalSaving ? "Approving..." : "Approve Teacher"}
          </button>
        </form>
      </div>
      )}

      {/* Edit form */}
      {editingStudent && (
        <div
          className="bg-white rounded-2xl p-6 mb-6"
          style={{ border: "1px solid #e9eef5", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
              Edit Student
            </h3>
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-name" style={{ color: "#374151" }}>
                  Full name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  maxLength={120}
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-sid" style={{ color: "#374151" }}>
                  Student ID <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="edit-sid"
                  type="text"
                  required
                  maxLength={20}
                  value={editForm.student_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, student_id: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-period" style={{ color: "#374151" }}>
                  Period
                </label>
                <select
                  id="edit-period"
                  value={editForm.period}
                  onChange={(e) => setEditForm((f) => ({ ...f, period: e.target.value as Period }))}
                  className="form-input"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" htmlFor="edit-email" style={{ color: "#374151" }}>
                  Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="edit-email"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingStudent && (
        <div
          className="bg-white rounded-2xl p-6 mb-6"
          style={{ border: "1px solid #fecaca", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-5">
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
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "var(--muted)", background: "#f1f5f9" }}
            >
              Cancel
            </button>
          </div>
          {deleteError && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              {deleteError}
            </div>
          )}
          <form onSubmit={handleDelete} className="space-y-4">
            <div className="max-w-sm">
              <label className="block text-sm font-medium mb-1.5" htmlFor="delete-password" style={{ color: "#374151" }}>
                Enter your teacher password <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="delete-password"
                type="password"
                required
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                className="form-input"
              />
            </div>
            <button
              type="submit"
              disabled={deleteSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#dc2626" }}
            >
              {deleteSaving ? "Deleting…" : "Delete Student and Auth Account"}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg
            className="absolute pointer-events-none"
            style={{ left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
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
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid #e9eef5", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
      >
        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: "#f1f5f9" }}>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading students…</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: "#dc2626" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#f8fafc" }}>
              <svg width="22" height="22" fill="none" stroke="#94a3b8" strokeWidth="1.75" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
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
                  <tr key={s.id}>
                    <td>
                      <span className="students-name" title={s.name}>{s.name}</span>
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
