"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lip/supabase/browser-client";
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <span className="font-bold text-xl tracking-tight">Ignite IMS</span>
          <span className="text-blue-300 text-sm hidden sm:inline">
            · Digital Media Tracker
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="flex rounded overflow-hidden border border-blue-500"
            role="group"
            aria-label="Class period selector"
          >
            {(["AM", "PM"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                  period === p
                    ? "bg-white text-blue-700"
                    : "hover:bg-blue-600 text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <span className="text-sm text-blue-200 hidden lg:inline truncate max-w-[200px]">
            {user.email}
          </span>

          <button
            onClick={onLogout}
            className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav
          className="w-48 shrink-0 bg-white border-r border-gray-200 py-2"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`block px-5 py-3 text-sm font-medium border-r-2 transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 border-blue-700"
                    : "text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-auto p-6">{children}</main>
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
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        setUser(data.user);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session?.user) {
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
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
