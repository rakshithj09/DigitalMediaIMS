import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link href="/login" className="text-sm font-semibold text-[#005a78] hover:underline">
          Back to login
        </Link>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#005a78]">
            Terms of service
          </p>
          <h1 className="mt-2 text-3xl font-bold">Digital Media Equipment Tracker</h1>
          <p className="mt-4 text-sm text-slate-500">Last updated: August 14, 2026</p>

          <h2 className="mt-8 text-xl font-semibold">Purpose</h2>
          <p className="mt-3 text-slate-700">
            Digital Media Equipment Tracker is provided for school class use to manage digital
            media equipment checkout and return records. The application is intended for authorized
            students, teachers, and school staff only.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Account access</h2>
          <p className="mt-3 text-slate-700">
            Users must use a valid <strong>@bentonvillek12.org</strong> email address. Student
            accounts require email verification and teacher approval before full access is granted.
            Users are responsible for keeping their account credentials private.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Acceptable use</h2>
          <p className="mt-3 text-slate-700">
            Users may only use the app for legitimate class-related equipment management. Users may
            not attempt to access another user&apos;s account, bypass approval controls, interfere
            with app security, or enter false checkout or return information.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Data</h2>
          <p className="mt-3 text-slate-700">
            The app stores account and equipment checkout information needed to operate the class
            equipment system. More detail is available in the{" "}
            <Link href="/privacy" className="font-semibold text-[#005a78] hover:underline">
              privacy and data-access page
            </Link>
            .
          </p>

          <h2 className="mt-8 text-xl font-semibold">Availability and changes</h2>
          <p className="mt-3 text-slate-700">
            The app may be updated, limited, or disabled as needed for maintenance, school review,
            or security. Access may be removed if an account is no longer authorized or if these
            terms are violated.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Questions</h2>
          <p className="mt-3 text-slate-700">
            Questions about access, data, or school approval should be directed to the project owner
            or the school technology department.
          </p>
        </section>
      </div>
    </main>
  );
}
