"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { User, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { PeriodProvider, usePeriod } from "@/app/lib/period-context";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/equipment", label: "Equipment" },
  { href: "/checkout", label: "Checkout" },
  { href: "/history", label: "History" },
];

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
  const pathname = usePathname();
  const role = (user as unknown as { user_metadata?: { role?: string; period?: string } }).user_metadata?.role;
  const userPeriod = (user as unknown as { user_metadata?: { period?: string } }).user_metadata?.period as "AM" | "PM" | undefined;

  useEffect(() => {
    if (role === "Student" && (userPeriod === "AM" || userPeriod === "PM")) {
      setPeriod(userPeriod);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userPeriod]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--brand-bg)" }}>
      <header className="brand-header brand-topbar px-6 py-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="brand-logo">
            {/* Place a logo at /public/ignite-logo.png to show here; fallback to text */}
            <div>
              <div className="text-lg font-semibold">Ignite Digital Media</div>
              <div className="kicker">Equipment Tracker</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* If the current user is a Student, lock the period to their saved period
              and show a static label. Teachers can still toggle AM/PM. */}
          {role === "Student" ? (
            <div className="px-3 py-1.5 text-sm font-semibold text-white/90">
              {userPeriod ? `${userPeriod} period` : "Student"}
            </div>
          ) : (
            <div role="group" aria-label="Class period selector" className="flex overflow-hidden rounded-lg border border-transparent">
              {( ["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                    period === p
                      ? "bg-white text-[var(--ignite-navy)]"
                      : "text-white/90 hover:bg-white/10"
                  } rounded`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Show first name + last initial (e.g. "Sam P.") falling back to email */}
          <div className="text-sm text-white/90 hidden lg:inline truncate max-w-[220px]">
            {(() => {
              const meta = (user as unknown as { user_metadata?: { first_name?: string; last_name?: string } }).user_metadata ?? {};
              const first = (meta.first_name ?? "").toString().trim();
              const last = (meta.last_name ?? "").toString().trim();
              if (first) return last ? `${first} ${last[0]}.` : first;
              // fallback to email local part
              try {
                return user.email?.split("@")[0] ?? "";
              } catch {
                return "";
              }
            })()}
          </div>

          <button onClick={onLogout} className="btn-ghost">Logout</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-56 shrink-0 bg-white border-r border-gray-100 py-4" aria-label="Main navigation">
          <div className="px-4 pb-3 text-xs uppercase tracking-wide text-muted">Navigation</div>
          {(() => {
            const role = (user as unknown as { user_metadata?: { role?: string } }).user_metadata?.role;
            const allowedForStudent = new Set(["/", "/equipment", "/checkout"]);
            const links = role === "Student" ? NAV_LINKS.filter((l) => allowedForStudent.has(l.href)) : NAV_LINKS;
            return links.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`block px-6 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--ignite-navy)]/5 text-[var(--ignite-navy)] border-r-4 border-[var(--ignite-mint)]"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </Link>
              );
            });
          })()}
        </nav>

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Loading…</p>
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


