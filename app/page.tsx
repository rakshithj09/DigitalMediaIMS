import Image from "next/image";
import Link from "next/link";
import { ClipboardCheck, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";

const appName = "Digital Media Equipment Tracker";

const details = [
  {
    title: "Purpose",
    body: "Manage school digital media equipment checkouts, returns, due dates, and active inventory records for class use.",
    icon: ClipboardCheck,
  },
  {
    title: "Access",
    body: "Accounts are limited to authorized @bentonvillek12.org users. Students must verify email and receive teacher approval.",
    icon: UsersRound,
  },
  {
    title: "Data scope",
    body: "The app stores only account, class roster, approval, equipment, checkout, and return information needed for the equipment workflow.",
    icon: ShieldCheck,
  },
  {
    title: "Authentication",
    body: "The app uses Firebase authentication and does not request Gmail, Drive, Calendar, Classroom, Contacts, or Google Admin access.",
    icon: LockKeyhole,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <Image src="/ignite-logo.png" alt="Ignite logo" width={30} height={30} priority />
            </div>
            <div>
              <p className="font-bold leading-tight text-[#005a78]">{appName}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ignite Professional Studies
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm font-semibold" aria-label="Public navigation">
            <Link href="/privacy" className="hidden text-slate-600 hover:text-[#005a78] sm:inline">
              Privacy
            </Link>
            <Link href="/terms" className="hidden text-slate-600 hover:text-[#005a78] sm:inline">
              Terms
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#005a78] px-4 py-2 text-white shadow-sm hover:bg-[#00708f]"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#005a78]">
            School equipment management
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
            {appName}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            A classroom application for tracking digital media equipment inventory, student
            checkouts, return deadlines, and teacher-approved access.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-[#005a78] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#00708f]"
            >
              Sign in to app
            </Link>
            <Link
              href="/privacy"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-[#005a78] hover:text-[#005a78]"
            >
              View data access
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#005a78]">Application review summary</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-slate-900">Application name</dt>
              <dd className="mt-1 text-slate-700">{appName}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Homepage purpose</dt>
              <dd className="mt-1 text-slate-700">
                Explains the school equipment checkout workflow before login.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Google Workspace access</dt>
              <dd className="mt-1 text-slate-700">
                No Gmail, Drive, Calendar, Classroom, Contacts, or Admin scopes.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-10 md:grid-cols-2">
          {details.map(({ title, body, icon: Icon }) => (
            <article key={title} className="rounded-lg border border-slate-200 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f0fe] text-[#005a78]">
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>{appName}</p>
        <div className="flex gap-4">
          <Link href="/privacy" className="font-semibold hover:text-[#005a78]">
            Privacy
          </Link>
          <Link href="/terms" className="font-semibold hover:text-[#005a78]">
            Terms
          </Link>
        </div>
      </footer>
    </main>
  );
}
