"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Eye, EyeOff } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type PendingStudentApproval = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  studentId: string;
  period: "AM" | "PM";
  requestedAt: string;
  emailVerifiedAt: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not verified yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ProfileContent() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [pendingStudents, setPendingStudents] = useState<PendingStudentApproval[]>([]);
  const [loadingPendingStudents, setLoadingPendingStudents] = useState(true);
  const [pendingStudentsError, setPendingStudentsError] = useState<string | null>(null);
  const [teacherApprovalEmail, setTeacherApprovalEmail] = useState("");
  const [teacherApprovalPassword, setTeacherApprovalPassword] = useState("");
  const [showTeacherApprovalPassword, setShowTeacherApprovalPassword] = useState(false);
  const [teacherApprovalSaving, setTeacherApprovalSaving] = useState(false);
  const [teacherApprovalError, setTeacherApprovalError] = useState<string | null>(null);
  const [teacherApprovalMessage, setTeacherApprovalMessage] = useState<string | null>(null);
  const [approvingStudentId, setApprovingStudentId] = useState<string | null>(null);
  const [studentApprovalError, setStudentApprovalError] = useState<string | null>(null);
  const [studentApprovalMessage, setStudentApprovalMessage] = useState<string | null>(null);

  const loadPendingStudents = useCallback(async () => {
    setLoadingPendingStudents(true);
    setPendingStudentsError(null);

    try {
      const resp = await fetch("/api/admin/student-approvals", { cache: "no-store" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setPendingStudentsError(String(data?.error?.message ?? data?.error ?? "Unable to load pending student approvals."));
        setPendingStudents([]);
      } else {
        setPendingStudents((data.requests ?? []) as PendingStudentApproval[]);
      }
    } catch (error) {
      setPendingStudentsError(error instanceof Error ? error.message : String(error));
      setPendingStudents([]);
    } finally {
      setLoadingPendingStudents(false);
    }
  }, []);

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
          return;
        }
        await loadPendingStudents();
      } finally {
        if (mounted) setAuthResolved(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadPendingStudents, router]);

  const handleTeacherApproval = async (event: FormEvent) => {
    event.preventDefault();
    setTeacherApprovalSaving(true);
    setTeacherApprovalError(null);
    setTeacherApprovalMessage(null);

    const resp = await fetch("/api/admin/teacher-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: teacherApprovalEmail, teacherPassword: teacherApprovalPassword }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setTeacherApprovalError(String(data?.error?.message ?? data?.error ?? "Unable to approve teacher email."));
    } else {
      setTeacherApprovalMessage(`${data.email ?? teacherApprovalEmail.trim()} can now create a teacher account.`);
      setTeacherApprovalEmail("");
      setTeacherApprovalPassword("");
      setShowTeacherApprovalPassword(false);
    }

    setTeacherApprovalSaving(false);
  };

  const handleStudentApproval = async (userId: string) => {
    setApprovingStudentId(userId);
    setStudentApprovalError(null);
    setStudentApprovalMessage(null);

    try {
      const resp = await fetch("/api/admin/student-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStudentApprovalError(String(data?.error?.message ?? data?.error ?? "Unable to approve student."));
      } else {
        const approvedStudent = pendingStudents.find((student) => student.userId === userId);
        setStudentApprovalMessage(
          approvedStudent
            ? `${approvedStudent.firstName} ${approvedStudent.lastName} has been added to the class roster.`
            : "Student approved successfully."
        );
        setPendingStudents((current) => current.filter((student) => student.userId !== userId));
      }
    } catch (error) {
      setStudentApprovalError(error instanceof Error ? error.message : String(error));
    } finally {
      setApprovingStudentId(null);
    }
  };

  if (!authResolved || currentUser?.user_metadata?.role === "Student") {
    return (
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #e9eef5" }}>
        <h2 className="text-xl font-semibold" style={{ color: "var(--ignite-navy)" }}>Profile</h2>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Redirecting…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-bold" style={{ color: "var(--ignite-navy)", letterSpacing: "-0.02em" }}>
          Profile
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Approve teacher accounts and review pending student signups
        </p>
      </div>

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
        <form onSubmit={handleTeacherApproval} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_max-content] sm:items-stretch">
          <input
            type="email"
            required
            maxLength={200}
            value={teacherApprovalEmail}
            onChange={(event) => setTeacherApprovalEmail(event.target.value)}
            placeholder="teacher@bentonvillek12.org"
            className="form-input"
          />
          <div className="relative">
            <input
              type={showTeacherApprovalPassword ? "text" : "password"}
              required
              value={teacherApprovalPassword}
              onChange={(event) => setTeacherApprovalPassword(event.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              className="form-input"
              style={{ paddingRight: "2.75rem" }}
            />
            <button
              type="button"
              aria-label={showTeacherApprovalPassword ? "Hide teacher password" : "Show teacher password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2"
              style={{ color: "#94a3b8" }}
              onClick={() => setShowTeacherApprovalPassword((value) => !value)}
            >
              {showTeacherApprovalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            type="submit"
            disabled={teacherApprovalSaving}
            className="inline-flex items-center justify-center justify-self-start sm:justify-self-end px-4 py-2 rounded-lg text-sm font-semibold text-white whitespace-nowrap disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            {teacherApprovalSaving ? "Approving..." : "Approve Teacher"}
          </button>
        </form>
      </div>

      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #e9eef5", boxShadow: "0 1px 3px rgba(15,36,55,0.06), 0 4px 14px rgba(15,36,55,0.04)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h3 className="font-semibold text-base" style={{ color: "var(--ignite-navy)" }}>
              Pending Student Approvals
            </h3>
          </div>
          <button
            type="button"
            onClick={loadPendingStudents}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#e8f0fe", color: "var(--navy)" }}
          >
            Refresh
          </button>
        </div>

        {studentApprovalError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
            {studentApprovalError}
          </div>
        )}
        {studentApprovalMessage && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
            {studentApprovalMessage}
          </div>
        )}
        {pendingStudentsError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
            {pendingStudentsError}
          </div>
        )}

        {loadingPendingStudents ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Loading pending student approvals…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Student ID</th>
                  <th>Period</th>
                  <th>Email Status</th>
                  <th>Requested</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-sm text-center"
                      style={{ color: "var(--muted)", paddingTop: "2rem", paddingBottom: "2rem" }}
                    >
                      No pending student approvals.
                    </td>
                  </tr>
                ) : (
                  pendingStudents.map((student) => {
                    const emailVerified = Boolean(student.emailVerifiedAt);
                    return (
                      <tr key={student.userId}>
                        <td style={{ fontWeight: 600, color: "var(--navy)" }}>
                          {student.firstName} {student.lastName}
                        </td>
                        <td>{student.email}</td>
                        <td>{student.studentId}</td>
                        <td>
                          <span className="category-chip">{student.period}</span>
                        </td>
                        <td>
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={emailVerified
                              ? { background: "#f0fdf4", color: "#15803d" }
                              : { background: "#fff7ed", color: "#c2410c" }}
                          >
                            {emailVerified ? "Verified" : "Waiting"}
                          </span>
                        </td>
                        <td>{formatDateTime(student.requestedAt)}</td>
                        <td>
                          <button
                            type="button"
                            disabled={!emailVerified || approvingStudentId === student.userId}
                            onClick={() => handleStudentApproval(student.userId)}
                            className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                            style={{ background: "var(--navy)" }}
                          >
                            {approvingStudentId === student.userId ? "Approving..." : "Approve"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileContent />
    </AppShell>
  );
}
