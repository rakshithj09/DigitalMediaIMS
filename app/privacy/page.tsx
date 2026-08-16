import Link from "next/link";

const dataItems = [
  "School email address",
  "First and last name",
  "Student ID and AM/PM class period for student accounts",
  "Teacher or student role",
  "Email verification and account approval status",
  "Equipment checkout and return records created inside this app",
];

const notAccessedItems = [
  "Gmail messages or inbox data",
  "Google Drive files",
  "Google Calendar events",
  "Google Classroom data",
  "Google Contacts",
  "Google Admin or domain-wide data",
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link href="/login" className="text-sm font-semibold text-[#005a78] hover:underline">
          Back to login
        </Link>
        <span className="mx-2 text-sm text-slate-400">/</span>
        <Link href="/terms" className="text-sm font-semibold text-[#005a78] hover:underline">
          Terms
        </Link>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#005a78]">
            Privacy and data access
          </p>
          <h1 className="mt-2 text-3xl font-bold">Digital Media Equipment Tracker</h1>
          <p className="mt-4 text-slate-700">
            This application is used to manage digital media equipment checkouts and returns for
            school class use. Accounts are limited to <strong>@bentonvillek12.org</strong> email
            addresses and require email verification. Student accounts also require teacher approval
            before full access is granted.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Authentication method</h2>
          <p className="mt-3 text-slate-700">
            The app currently uses Firebase Auth email/password authentication. It does not request
            Google Workspace OAuth scopes and does not access Google Workspace APIs.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Data stored by the app</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            {dataItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="mt-8 text-xl font-semibold">Google data not accessed</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            {notAccessedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="mt-8 text-xl font-semibold">Student access</h2>
          <p className="mt-3 text-slate-700">
            Users may include students under 18 if the school permits them to use the application.
            Student access is limited by Firebase authentication, Firestore security rules, email
            verification, and teacher approval.
          </p>

          <h2 className="mt-8 text-xl font-semibold">Source code access</h2>
          <p className="mt-3 text-slate-700">
            Source code access is controlled by the project owner. The source can be provided to
            school technology staff for review before approval or broader student use.
          </p>

          <p className="mt-8 text-sm text-slate-600">
            Review the{" "}
            <Link href="/terms" className="font-semibold text-[#005a78] hover:underline">
              terms of service
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
