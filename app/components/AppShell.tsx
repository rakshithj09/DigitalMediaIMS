"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { User, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { PeriodProvider, usePeriod } from "@/app/lib/period-context";

const NAV_ICONS: Record<string, ReactNode> = {
  "/": (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  "/students": (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a6 6 0 0 1 6-6h0" />
      <circle cx="17" cy="14" r="3" />
      <path d="M14 21v-1a3 3 0 0 1 6 0v1" />
    </svg>
  ),
  "/equipment": (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18M3 12h18M3 17h12" />
      <circle cx="19" cy="17" r="2" />
    </svg>
  ),
  "/checkout": (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M21 3 9 15" />
      <path d="M3 9v11a2 2 0 0 0 2 2h11" />
    </svg>
  ),
  "/history": (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  ),
};

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/equipment", label: "Equipment" },
  { href: "/checkout", label: "Checkout" },
  { href: "/history", label: "History" },
];

const STUDENT_NAV_HREFS = new Set(["/", "/equipment", "/checkout"]);

function Shell({
  user,
  children,
  onLogout,
}: {
  user: User;
  children: ReactNode;
  onLogout: () => void;
}) {
  const { period, setPeriod } = usePeriod();
  const router = useRouter();
  const pathname = usePathname();
  const meta = (user as unknown as { user_metadata?: { role?: string; period?: string; first_name?: string; last_name?: string } }).user_metadata ?? {};
  const role = meta.role;
  const userPeriod = meta.period as "AM" | "PM" | undefined;
  const first = (meta.first_name ?? "").trim();
  const last = (meta.last_name ?? "").trim();
  const displayName = first ? (last ? `${first} ${last[0]}.` : first) : (user.email?.split("@")[0] ?? "");
  const initials = first
    ? `${first[0]}${last ? last[0] : ""}`.toUpperCase()
    : (user.email?.[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (role === "Student" && (userPeriod === "AM" || userPeriod === "PM")) {
      setPeriod(userPeriod);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userPeriod]);

  useEffect(() => {
    if (role === "Student" && !STUDENT_NAV_HREFS.has(pathname)) {
      router.replace("/checkout");
    }
  }, [role, pathname, router]);

  const links = role === "Student" ? NAV_LINKS.filter((l) => STUDENT_NAV_HREFS.has(l.href)) : NAV_LINKS;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--brand-bg)" }}>
      {/* ── Top header ────────────────────────────────── */}
      <header
        className="brand-header brand-topbar h-14 px-5 flex items-center justify-between z-20 shadow-lg"
        style={{ position: "sticky", top: 0 }}
      >
        <div className="brand-logo">
          {/* Lightning-bolt logo mark */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--ignite-mint)" }}
          >
            <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--ignite-navy)" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight leading-tight text-white">Ignite Digital Media</div>
            <div className="kicker">Equipment Tracker</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {role === "Student" ? (
            <div
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: "var(--ignite-mint-dim)", color: "var(--ignite-mint)" }}
            >
              {userPeriod ? `${userPeriod} Period` : "Student"}
            </div>
          ) : (
            <div
              role="group"
              aria-label="Class period selector"
              className="flex rounded-lg overflow-hidden"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  className="px-4 py-1.5 text-xs font-bold transition-all"
                  style={
                    period === p
                      ? { background: "var(--ignite-mint)", color: "var(--ignite-navy)" }
                      : { color: "rgba(255,255,255,0.65)" }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
            >
              {initials}
            </div>
            <span className="text-xs font-medium max-w-[160px] truncate" style={{ color: "rgba(255,255,255,0.8)" }}>
              {displayName}
            </span>
          </div>

          <button onClick={onLogout} className="btn-ghost">Logout</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ───────────────────────────────────── */}
        <nav
          className="w-56 shrink-0 flex flex-col py-5"
          style={{ background: "var(--sidebar-bg)" }}
          aria-label="Main navigation"
        >
          <div
            className="px-5 pb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            Navigation
          </div>

          <div className="flex flex-col gap-0.5 px-3">
            {links.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={
                    active
                      ? {
                          background: "var(--sidebar-active-bg)",
                          color: "var(--sidebar-active-fg)",
                          boxShadow: "inset 3px 0 0 var(--ignite-mint)",
                        }
                      : {
                          color: "var(--sidebar-fg)",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "";
                      (e.currentTarget as HTMLElement).style.color = "var(--sidebar-fg)";
                    }
                  }}
                >
                  <span style={{ opacity: active ? 1 : 0.65 }}>{NAV_ICONS[href]}</span>
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Bottom: period indicator */}
          <div
            className="mt-auto mx-3 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
              Active period
            </p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--ignite-mint)" }}>
              {role === "Student" && userPeriod ? userPeriod : period} Period
            </p>
          </div>
        </nav>

        {/* ── Main content ──────────────────────────────── */}
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await supabase.auth.getUser();
        if (!mounted) return;
        const userData = res.data?.user ?? null;
        if (!userData) {
          router.replace("/login");
        } else {
          setUser(userData);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (!session?.user) {
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ignite-navy)" }}>
        <div className="text-center">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "var(--ignite-mint)" }}
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="var(--ignite-navy)" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <PeriodProvider>
      <Shell user={user} onLogout={handleLogout}>
        {children}
      </Shell>
    </PeriodProvider>
  );
}
