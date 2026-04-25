# Digital Media Equipment Tracker

A web app for Ignite Professional Studies at Bentonville West High School that lets teachers manage equipment inventory and students check out and check in digital media gear.

Built with Next.js, React, Tailwind CSS, and Supabase.

---

## Features

- Supabase Auth sign-in with email verification for self-created accounts
- Teacher approval allow-list for self-created teacher accounts
- Student signup requests with teacher approval before joining the roster
- Password reset by email
- Teacher dashboard with active checkout totals, period filtering, and quick check-in
- Student dashboard with personal active checkout tracking
- Return deadlines for every checkout with color-coded urgency states
- Equipment inventory management with categories, quantities, serial tags, and condition notes
- Equipment detail pages with current status, serial visibility, and full item history
- Student roster management with add, edit, and delete flows
- Checkout flow with due date, due time, optional notes, quantity limits, and serialized item handling
- Check-in flow with optional return notes
- Audit history for teachers

---

## Tech Stack

| Layer | Library / Service |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Components | Radix UI primitives, Lucide React icons |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Database | Supabase Postgres (`@supabase/supabase-js`) |
| Language | TypeScript 5 |
| Deployment | Vercel |

---

## User Guides

Role-specific walkthroughs live in the [`instructions/`](./instructions) folder:

- [Teacher Guide](./instructions/teacher.md)
- [Student Guide](./instructions/student.md)

---

## Project Structure

`igniteims/` contains the Next.js app, shared UI, Supabase helpers, SQL migrations, and user documentation. Expand any section below to inspect its files and descriptions.

<details>
<summary><code>app/</code> — Next.js App Router pages, route handlers, and app-specific utilities</summary>

```text
app/
├── layout.tsx                       # Root HTML layout and metadata
├── globals.css                      # Global styling, tokens, table styles, form styles
├── icon.png                         # App icon
├── page.tsx                         # Dashboard for teachers and students
├── login/
│   └── page.tsx                     # Sign-in form and forgot-password flow
├── email-password/
│   ├── page.tsx                     # Auth entry page for sign-in/sign-up mode
│   └── EmailPasswordDemo.tsx        # Self-service account creation and sign-in UI
├── reset-password/
│   └── page.tsx                     # Password reset page opened from email link
├── pending-approval/
│   └── page.tsx                     # Student waiting screen until a teacher approves the account
├── checkout/
│   └── page.tsx                     # Check-out form, check-in list, due date/time selection
├── equipment/
│   ├── page.tsx                     # Inventory list with teacher add/edit/deactivate actions
│   └── [id]/
│       └── page.tsx                 # Single equipment detail page with active use and history
├── students/
│   └── page.tsx                     # Teacher-only roster management
├── history/
│   └── page.tsx                     # Teacher-only audit log page
├── profile/
│   └── page.tsx                     # Teacher approvals and pending student approvals
├── auth/
│   └── callback/
│       └── route.ts                 # Supabase email verification callback
├── api/
│   ├── auth/
│   │   └── create-account/
│   │       └── route.ts             # Self-service teacher/student account creation
│   ├── checkouts/
│   │   ├── route.ts                 # POST checkout creation
│   │   └── check-in/
│   │       └── route.ts             # POST check-in and optional return notes
│   ├── equipment/
│   │   └── route.ts                 # Teacher equipment create/update/deactivate API
│   └── admin/
│       ├── add-student-roster/
│       │   └── route.ts             # Admin roster import endpoint
│       ├── create-student/
│       │   └── route.ts             # Teacher-created student Auth + roster record
│       ├── student-approvals/
│       │   └── route.ts             # Pending student approval API
│       ├── students/
│       │   └── route.ts             # Teacher student CRUD endpoints
│       └── teacher-approvals/
│           └── route.ts             # Teacher email allow-list approval API
├── components/
│   ├── AppShell.tsx                 # Shared authenticated shell, nav, period toggle, redirects
│   └── PeriodBadge.tsx              # AM/PM badge UI
└── lib/
    ├── period-context.tsx           # Client state for AM/PM period selection
    ├── serials.ts                   # Serial parsing and normalization helpers
    └── types.ts                     # Shared app types and equipment category constants
```

</details>

<details>
<summary><code>components/</code> — Reusable UI primitives shared across auth and app pages</summary>

```text
components/
└── ui/
    ├── button.tsx                   # Button primitive
    ├── card.tsx                     # Card wrappers
    ├── checkbox.tsx                 # Checkbox primitive
    ├── input.tsx                    # Input primitive
    ├── label.tsx                    # Label primitive
    ├── login-signup.tsx             # Auth page frame and shared auth input classes
    ├── separator.tsx                # Separator primitive
    └── tabs.tsx                     # Tabs primitive
```

</details>

<details>
<summary><code>lib/</code> — Root-level helpers for auth, deadlines, Supabase, and utilities</summary>

```text
lib/
├── checkout-deadlines.ts            # Deadline formatting and warning-state calculation
├── utils.ts                         # Shared className helper
├── auth/
│   ├── student-approvals.ts         # Student approval request helpers
│   └── student-roster.ts            # Student roster lookup helpers
└── supabase/
    ├── admin-client.ts              # Service-role Supabase client
    ├── browser-client.ts            # Browser Supabase client
    └── server-client.ts             # Server Supabase client
```

</details>

<details>
<summary><code>instructions/</code> — Role-specific user documentation</summary>

```text
instructions/
├── student.md                       # End-user guide for student accounts
└── teacher.md                       # End-user guide for teacher accounts
```

</details>

<details>
<summary><code>supabase/</code> — SQL migration files to run in the Supabase SQL Editor</summary>

```text
supabase/
├── approved-teachers.sql            # Teacher email allow-list table
├── checkout-return-deadline.sql     # Adds due_at to checkouts
├── checkout-serial-number.sql       # Adds serial_number to checkouts
├── student-account-link.sql         # Adds user_id/email support for student-auth linking
└── student-approval-requests.sql    # Pending student approval requests table and policies
```

</details>

<details>
<summary><code>public/</code> — Static assets served at runtime</summary>

```text
public/
└── ignite-logo.png                  # App logo used in auth screens and shell
```

</details>

<details>
<summary>Root config files — environment, build, lint, and package setup</summary>

```text
.env.example                         # Required environment variable template
eslint.config.mjs                    # ESLint config
next.config.ts                       # Next.js config
package.json                         # Dependencies and scripts
postcss.config.mjs                   # PostCSS/Tailwind config
tsconfig.json                        # TypeScript config
```

</details>

---

## Getting Started

**1. Install dependencies**

```bash
npm install
```

**2. Create your local environment file**

```bash
cp .env.example .env.local
```

**3. Fill in the environment variables**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_publishable_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is only used in server route handlers. It is never sent to the browser.

**4. Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

```bash
npm run dev      # Start local dev server
npm run build    # Build the production app
npm run start    # Run the production build locally
npm run lint     # Run ESLint
```

To clear old compiled output:

```bash
rm -rf .next && npm run dev
```

---

## Supabase Setup

### 1. Run SQL Migrations

Run each file in the Supabase SQL Editor in this order:

| File | What it does |
|---|---|
| `supabase/student-account-link.sql` | Links student roster rows to Auth users with `user_id` and `email` support |
| `supabase/student-approval-requests.sql` | Creates the pending student approval table and policies |
| `supabase/approved-teachers.sql` | Creates the teacher approval allow-list table |
| `supabase/checkout-serial-number.sql` | Adds `serial_number` to checkouts |
| `supabase/checkout-return-deadline.sql` | Adds `due_at` to checkouts |

### 2. Configure Supabase Auth URLs

In **Supabase Dashboard → Authentication → URL Configuration**, set:

**Site URL**

```text
https://digital-media-ims.vercel.app
```

**Redirect URLs**

```text
https://digital-media-ims.vercel.app/auth/callback
https://digital-media-ims.vercel.app/login
https://digital-media-ims.vercel.app/reset-password
http://localhost:3000/auth/callback
http://localhost:3000/login
http://localhost:3000/reset-password
```

### 3. Update the Confirm Signup Email Template

In **Supabase Dashboard → Authentication → Email Templates → Confirm signup**, use:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">
  Confirm your email
</a>
```

This points verification back to `app/auth/callback/route.ts`, which verifies the token and redirects the user.

---

## Authentication Flow

### Self-Service Student Signup

1. Student opens `/email-password?mode=signup`
2. Student enters first name, last name, student ID, email, password, and AM/PM period
3. `app/api/auth/create-account/route.ts` creates the Auth account
4. Supabase sends a verification email
5. `app/auth/callback/route.ts` verifies the email and marks the approval request as verified
6. Student is redirected to `/pending-approval`
7. A teacher approves the student from `/profile`
8. After approval, the student can use the app

### Self-Service Teacher Signup

1. Teacher opens `/email-password?mode=signup`
2. Teacher selects the `Teacher` role
3. The email must already be approved in the `approved_teachers` table
4. Supabase sends a verification email
5. After verification, the teacher can sign in normally

### Teacher-Created Student Accounts

Teachers can create student accounts directly from the `Students` page. That flow creates:

- a Supabase Auth user with email already confirmed
- a linked row in the `students` table

### Password Reset

1. User clicks `Forgot password?` on `/login`
2. Supabase sends a reset email pointing to `/reset-password`
3. User chooses a new password
4. The app signs them out and redirects them back to `/login`

---

## Routes

| Route | Who sees it | What it does |
|---|---|---|
| `/` | Teachers and students | Dashboard |
| `/login` | Unauthenticated | Sign-in form and password reset request |
| `/email-password` | Unauthenticated | Self-service sign-in / sign-up UI |
| `/auth/callback` | System route | Supabase email verification callback |
| `/reset-password` | From email link | Choose a new password |
| `/pending-approval` | Students awaiting approval | Waiting screen until a teacher approves the account |
| `/checkout` | Teachers and students | Checkout form and check-in list |
| `/equipment` | Teachers and students | Inventory list |
| `/equipment/[id]` | Teachers and students | Detail view for one equipment item |
| `/students` | Teachers only | Roster management |
| `/history` | Teachers only | Audit log |
| `/profile` | Teachers only | Teacher approvals and student approvals |

---

## Role Behavior

### Teachers

Teachers can:

- switch between `AM` and `PM`
- manage students
- manage equipment
- create checkouts for students
- check items back in
- review audit history
- approve teachers and students

### Students

Students can:

- view their own dashboard
- browse equipment
- check out equipment for themselves
- check in their own active items

Students are redirected away from teacher-only pages and only see:

- `/`
- `/equipment`
- `/checkout`

### Checkout Deadlines

Every checkout requires a return deadline. Deadline states are calculated from the original checkout time to the due time:

- Green: on track
- Yellow: 50% or more of the checkout window has elapsed
- Red: 75% or more of the checkout window has elapsed
- Overdue: due date/time has passed

The due date picker blocks past dates, and the due time list removes earlier times when the selected date is today.

---

## Deployment (Vercel)

The production app runs at `https://digital-media-ims.vercel.app`.

Add these environment variables in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=https://digital-media-ims.vercel.app
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

After updating Supabase redirect settings or email templates, create a fresh test account because old emails may still contain old URLs.

---

## Troubleshooting

**Verification email opens the wrong URL**

- Check `NEXT_PUBLIC_SITE_URL`
- Check Supabase `Site URL` and redirect URLs
- Check the Confirm signup email template
- Use a newly generated email if the older one still points to the wrong place

**Students stay on pending approval**

- Confirm the email was verified
- Confirm the student approval request exists
- Approve the student from `/profile`
- Confirm there is an active linked row in `students`

**Checkout page says a database update is needed**

Run the missing SQL file in Supabase:

- `supabase/checkout-serial-number.sql`
- `supabase/checkout-return-deadline.sql`

**Cannot reach Supabase**

- Make sure the Supabase project is active
- Double-check `NEXT_PUBLIC_SUPABASE_URL`
- Double-check `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Double-check `SUPABASE_SERVICE_ROLE_KEY`

**Old UI still shows after reverting code**

Clear `.next` and restart the dev server:

```bash
rm -rf .next && npm run dev
```

---

## Future Implementations

- Create a custom domain and add email reminder notifications for upcoming due dates
- Add restricted check in/check out dates and times for items
- Add barcode scanning to replace serial tags
