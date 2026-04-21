"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { User, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { PeriodProvider, usePeriod } from "@/app/lib/period-context";

/* ── Nav icons ──────────────────────────────────────── */
const ICONS: Record<string, ReactNode> = {
  "/": (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  "/students": (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a6 6 0 0 1 6-6"/><circle cx="17" cy="14" r="3"/><path d="M14 21v-1a3 3 0 0 1 6 0v1"/>
    </svg>
  ),
  "/equipment": (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  ),
  "/checkout": (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
    </svg>
  ),
  "/history": (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
    </svg>
  ),
};

const NAV = [
  { href: "/",          label: "Dashboard" },
  { href: "/students",  label: "Students"  },
  { href: "/equipment", label: "Equipment" },
  { href: "/checkout",  label: "Checkout"  },
  { href: "/history",   label: "History"   },
];
const STUDENT_HREFS = new Set(["/", "/equipment", "/checkout"]);

/* ── Shell ──────────────────────────────────────────── */
function Shell({ user, children, onLogout }: { user: User; children: ReactNode; onLogout: () => void }) {
  const { period, setPeriod } = usePeriod();
  const router   = useRouter();
  const pathname = usePathname();
  const meta     = (user as unknown as { user_metadata?: Record<string, string> }).user_metadata ?? {};
  const role      = meta.role ?? "";
  const userPeriod = meta.period as "AM" | "PM" | undefined;
  const first = (meta.first_name ?? "").trim();
  const last  = (meta.last_name  ?? "").trim();
  const displayName = first ? (last ? `${first} ${last[0]}.` : first) : (user.email?.split("@")[0] ?? "");
  const initials    = first ? `${first[0]}${last ? last[0] : ""}`.toUpperCase() : (user.email?.[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (role === "Student" && (userPeriod === "AM" || userPeriod === "PM")) setPeriod(userPeriod);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userPeriod]);

  useEffect(() => {
    if (role === "Student" && !STUDENT_HREFS.has(pathname)) router.replace("/checkout");
  }, [role, pathname, router]);

  const links = role === "Student" ? NAV.filter(l => STUDENT_HREFS.has(l.href)) : NAV;
  const activePeriod = role === "Student" && userPeriod ? userPeriod : period;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--brand-bg)" }}>

      {/* ── Header ────────────────────────────────────── */}
      <header className="brand-header min-h-14 px-3 sm:px-5 py-2 flex items-center justify-between gap-3 z-20 sticky top-0">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--mint)" }}>
            {/* Lightning bolt */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polygon points="13,2 4,14 12,14 11,22 20,10 12,10" fill="#002c51"/>
            </svg>
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Digital Media</p>
            <p className="text-kicker hidden sm:block">Equipment Tracker</p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {role === "Student" ? (
            <span className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)" }}>
              {userPeriod ?? "Student"} Period
            </span>
          ) : (
            <div role="group" aria-label="Period selector"
              className="flex rounded-lg overflow-hidden"
              style={{ background: "rgba(255,255,255,0.12)" }}>
              {(["AM", "PM"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
                  className="px-2.5 sm:px-4 py-1.5 text-xs font-bold transition-all"
                  style={period === p
                    ? { background: "var(--mint)", color: "var(--navy)" }
                    : { color: "rgba(255,255,255,0.6)" }}>
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "rgba(255,255,255,0.16)", color: "white" }}>
              {initials}
            </div>
            <span className="text-xs font-medium text-white/80 max-w-[150px] truncate">{displayName}</span>
          </div>

          <button onClick={onLogout}
            className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.9)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ───────────────────────────────────── */}
        <nav className="hidden md:flex w-56 shrink-0 flex-col py-4 overflow-y-auto"
          style={{ background: "var(--navy)" }} aria-label="Main navigation">

          <p className="px-5 pb-3 text-kicker font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            Menu
          </p>

          <div className="flex flex-col gap-0.5 px-3 flex-1">
            {links.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={active
                    ? { background: "rgba(255,255,255,0.12)", color: "#fff", boxShadow: "inset 3px 0 0 var(--mint)" }
                    : { color: "rgba(255,255,255,0.65)" }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}>
                  <span style={{ opacity: active ? 1 : 0.6 }}>{ICONS[href]}</span>
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Period pill at bottom */}
          <div className="mx-3 mt-4 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>Active period</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--mint)" }}>
              {activePeriod} Period
            </p>
          </div>
        </nav>

        {/* ── Content ───────────────────────────────────── */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8">{children}</main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 grid border-t bg-white"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))`, borderColor: "#e2e8f0" }}
        aria-label="Mobile navigation"
      >
        {links.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2 text-[0.68rem] font-semibold"
              style={active ? { color: "var(--navy)" } : { color: "#64748b" }}
            >
              <span className="h-5 flex items-center" style={{ color: active ? "var(--navy)" : "#94a3b8" }}>
                {ICONS[href]}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ── AppShell wrapper ───────────────────────────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await supabase.auth.getUser();
        if (!mounted) return;
        if (!res.data?.user) router.replace("/login");
        else setUser(res.data.user);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_: string, session: Session | null) => {
      if (!session?.user) router.replace("/login");
      else setUser(session.user);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--navy)" }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
          style={{ background: "var(--mint)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <polygon points="13,2 4,14 12,14 11,22 20,10 12,10" fill="#002c51"/>
          </svg>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <PeriodProvider>
      <Shell user={user} onLogout={handleLogout}>{children}</Shell>
    </PeriodProvider>
  );
}
