# Digital Media Equipment Tracker

A web app for Ignite Professional Studies at Bentonville West High School that lets teachers manage equipment inventory and students check out/check in digital media gear.

Built with Next.js, React, Tailwind CSS, and Supabase.

---

## Features

- Teacher and student sign-in via Supabase Auth
- Email verification for self-created accounts
- Password reset by email
- AM/PM class period selector for teachers
- **Teacher dashboard** — active checkout totals, class-period filtering, quick check-in, deadline-based warning colors
- **Student dashboard** — view and check in their own active checkouts with return deadlines
- **Equipment inventory** — add, edit, and remove equipment items with category, serial number, quantity, and condition notes
- **Equipment detail page** — full item history and checkout list per equipment item
- **Student roster** — add, edit, and delete students; teacher password confirmation required to delete
- **Checkout flow** — check equipment out to a student with period, return date/time, and optional notes
- **Check-in flow** — return equipment with optional return notes
- **History / audit log** — full checkout and check-in history across all items and students

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

## Project Structure

`igniteims/` contains the main app, shared UI, server utilities, database SQL, and project configuration. Expand any section below to inspect its files and descriptions.

<details>
<summary><code>app/</code> — Next.js App Router pages, layouts, route handlers, and app-level utilities</summary>

```text
app/
├── layout.tsx                # Root HTML layout (sets metadata, body styles)
├── globals.css               # Global CSS: brand tokens, utility classes, table/badge styles
├── page.tsx                  # Dashboard — active checkout stats, check-in button
├── login/
│   └── page.tsx              # Sign-in form + forgot password link
├── email-password/
│   ├── page.tsx              # Account creation page
│   └── EmailPasswordDemo.tsx # Sign-up form component
├── reset-password/
│   └── page.tsx              # Set new password (after clicking reset email link)
├── pending-approval/
│   └── page.tsx              # Shown to users whose account is awaiting teacher approval
├── checkout/
│   └── page.tsx              # Check-out and check-in flow
├── equipment/
│   ├── page.tsx              # Equipment inventory list — add, edit, remove items
│   └── [id]/
│       └── page.tsx          # Individual equipment item detail — history, active checkouts
├── students/
│   └── page.tsx              # Student roster — add, edit, delete students
├── history/
│   └── page.tsx              # Full checkout/check-in audit log
├── profile/
│   └── page.tsx              # Logged-in user's profile and account settings
├── auth/
│   └── callback/
│       └── route.ts          # Supabase email verification callback (verifies OTP, sets session)
├── api/                      # Next.js Route Handlers (server-side only)
│   ├── auth/
│   │   └── create-account/
│   │       └── route.ts      # Creates a new student or teacher account via service role
│   ├── checkouts/
│   │   ├── route.ts          # POST: create a new checkout record
│   │   └── check-in/
│   │       └── route.ts      # POST: check equipment back in, record return notes
│   ├── equipment/
│   │   └── route.ts          # GET: fetch equipment list; POST: add new equipment
│   └── admin/
│       ├── students/
│       │   └── route.ts      # GET/POST/PATCH/DELETE student records (teacher only)
│       ├── create-student/
│       │   └── route.ts      # Creates a student Auth account + students row together
│       ├── add-student-roster/
│       │   └── route.ts      # Bulk-adds students from a roster
│       ├── student-approvals/
│       │   └── route.ts      # GET/PATCH pending student approval requests
│       └── teacher-approvals/
│           └── route.ts      # GET/PATCH pending teacher approval requests
├── components/               # Shared layout components (app-specific)
│   ├── AppShell.tsx          # Sidebar navigation, header, period selector, logout button
│   └── PeriodBadge.tsx       # AM/PM badge chip used in tables
└── lib/                      # App-level shared utilities
    ├── types.ts              # TypeScript types: Student, Equipment, Checkout, Period, EQUIPMENT_CATEGORIES
    ├── period-context.tsx    # React context that stores the selected AM/PM period across pages
    └── serials.ts            # Helpers for parsing and displaying serial numbers
```

</details>

<details>
<summary><code>components/</code> — Reusable UI primitives shared across the app</summary>

```text
components/
└── ui/                       # Reusable headless/primitive UI components (shadcn-style)
    ├── button.tsx            # Button with size/variant props
    ├── card.tsx              # Card, CardHeader, CardContent, CardFooter
    ├── checkbox.tsx          # Radix Checkbox wrapper
    ├── input.tsx             # Styled text input
    ├── label.tsx             # Form label
    ├── separator.tsx         # Horizontal/vertical divider
    ├── tabs.tsx              # Radix Tabs wrapper (TabsList, TabsTrigger, TabsContent)
    └── login-signup.tsx      # LoginSignupFrame layout used on all auth pages
```

</details>

<details>
<summary><code>lib/</code> — Root-level server utilities, auth helpers, and Supabase clients</summary>

```text
lib/
├── utils.ts                  # cn() helper (clsx + tailwind-merge)
├── supabase/
│   ├── browser-client.ts     # Supabase client for use in Client Components
│   ├── server-client.ts      # Supabase client for use in Server Components and Route Handlers
│   └── admin-client.ts       # Supabase service-role client for admin API routes (never exposed to browser)
└── auth/
    ├── student-approvals.ts  # Server helpers for reading/updating student approval state
    └── student-roster.ts     # Server helpers for student roster queries
```

</details>

<details>
<summary><code>supabase/</code> — SQL migration files to run in the Supabase SQL Editor</summary>

```text
supabase/
├── student-account-link.sql      # Adds user_id and email columns to students table; creates indexes
├── student-approval-requests.sql # Creates the student_approval_requests table and RLS policies
├── approved-teachers.sql         # Creates the approved_teachers table for teacher allow-list
├── checkout-serial-number.sql    # Adds serial_number column to checkouts table
└── checkout-return-deadline.sql  # Adds due_at to checkouts
```

</details>

<details>
<summary><code>public/</code> — Static assets served at <code>/</code></summary>

```text
public/
└── ignite-logo.png           # Logo shown in the app header
```

</details>

<details>
<summary>Root config files — environment, build, lint, and package setup</summary>

```text
.env.example                  # Template for required environment variables
.env.local                    # Local environment variables (not committed)
next.config.ts                # Next.js configuration
tsconfig.json                 # TypeScript configuration
postcss.config.mjs            # PostCSS config for Tailwind CSS v4
eslint.config.mjs             # ESLint configuration
package.json                  # Dependencies and npm scripts
```

</details>

---

## Getting Started

**1. Install dependencies:**

```bash
npm install
```

**2. Create your local environment file:**

```bash
cp .env.example .env.local
```

**3. Fill in the environment variables:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> `SUPABASE_SERVICE_ROLE_KEY` is only used in server Route Handlers. It is never sent to the browser.

**4. Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

```bash
npm run dev      # Start local dev server with hot reload
npm run build    # Build the production app
npm run start    # Serve the production build locally
npm run lint     # Run ESLint
```

**To clear the Next.js build cache** (useful if old compiled output shows up after reverting code):

```bash
rm -rf .next && npm run dev
```

---

## Supabase Setup

### 1. Run SQL Migrations

Run each file in the Supabase SQL Editor in this order:

| File | What it does |
|---|---|
| `supabase/student-account-link.sql` | Adds `user_id` and `email` to the `students` table so Auth accounts can be linked to roster entries |
| `supabase/student-approval-requests.sql` | Creates the `student_approval_requests` table with RLS policies |
| `supabase/approved-teachers.sql` | Creates the `approved_teachers` allow-list table |
| `supabase/checkout-serial-number.sql` | Adds the `serial_number` column to the `checkouts` table |
| `supabase/checkout-return-deadline.sql` | Adds a `due_at` column so checkouts can have return deadlines |

### 2. Configure Supabase Auth URLs

In **Supabase Dashboard → Authentication → URL Configuration**, set:

**Site URL:**
```
https://digital-media-ims.vercel.app
```

**Redirect URLs (add all of these):**
```
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

This sends `token_hash` and `type` to `app/auth/callback/route.ts`, which verifies the OTP and establishes the session.

---

## Authentication Flow

### Student / Teacher Sign-up
- Self-created accounts go through `app/api/auth/create-account/route.ts`
- Supabase sends a verification email; the link goes to `app/auth/callback/route.ts`
- After verification, the user is redirected to the dashboard or pending-approval page

### Password Reset
- User clicks **Forgot password?** on the login page
- Supabase emails a reset link pointing to `/reset-password`
- `app/reset-password/page.tsx` lets them set a new password, then redirects to login

### Teacher-Created Student Accounts
- Teachers add students from the Students tab
- `app/api/admin/create-student/route.ts` uses the service role to create both an Auth user and a `students` row in one step

### Deleting a Student Account
1. Teacher enters their own password to confirm
2. Server verifies the password
3. Deletes the student's `profiles` row (if present), the `students` row, and the Supabase Auth user

---

## Routes

| Route | Who sees it | What it does |
|---|---|---|
| `/` | Teachers & students | Dashboard with active checkout stats |
| `/login` | Unauthenticated | Sign-in form and forgot-password link |
| `/email-password` | Unauthenticated | Create a new account |
| `/auth/callback` | — | Supabase email verification callback |
| `/reset-password` | From email link | Set a new password |
| `/pending-approval` | New users | Waiting screen while account is being approved |
| `/checkout` | Teachers | Check equipment out to a student or check it back in |
| `/equipment` | Teachers & students | Browse inventory; teachers can add/edit/remove |
| `/equipment/[id]` | Teachers & students | Detail view for one item — full checkout history |
| `/students` | Teachers | Manage student roster |
| `/history` | Teachers | Full checkout and check-in audit log |
| `/profile` | Teachers & students | Account settings |

---

## Deployment (Vercel)

The production app runs at `https://digital-media-ims.vercel.app`.

**Add these environment variables in your Vercel project settings:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=https://digital-media-ims.vercel.app
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

After updating Supabase redirect settings or email templates, create a fresh test account — old verification emails may still contain old URLs.

---

## Troubleshooting

**Verification email opens localhost instead of production**
- Check that `NEXT_PUBLIC_SITE_URL` in Vercel is set to `https://digital-media-ims.vercel.app`
- Check that Supabase Site URL and redirect URLs include the production domain
- Make sure the Confirm signup email template uses `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`
- Old emails may still point to localhost — send a new one or create a new test account

**Email rate limit exceeded**
- Supabase's default email sender has rate limits. For production, configure custom SMTP in Supabase Auth settings.

**Invalid refresh token error**
- The browser has a stale Supabase session. Clear site data for the app domain, or sign out and sign back in.

**Old UI still showing after reverting code changes**
- Next.js caches compiled output in `.next/`. Clear it and restart: `rm -rf .next && npm run dev`

**Cannot reach Supabase**
- Verify the Supabase project is active (not paused)
- Double-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`
