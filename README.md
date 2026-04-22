# Digital Media Equipment Tracker

A Next.js app for managing Ignite Digital Media equipment inventory, student rosters, checkouts, check-ins, and audit history.

The app uses Supabase for authentication, database access, email verification, password reset, and server-side admin actions.

## Features

- Teacher and student sign-in with Supabase Auth.
- Email verification for self-created accounts.
- Password reset by email.
- Student dashboard focused on the student's active checkouts.
- Teacher dashboard with active checkout totals and class-period filtering.
- AM/PM period selector for teachers.
- Student roster management:
  - add students
  - edit student name, ID, email, and period
  - delete student account with teacher password confirmation
- Equipment inventory management:
  - add equipment
  - edit equipment after creation
  - remove equipment from active inventory
- Checkout and check-in flows with return notes.
- Checkout history/audit log.

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- `@supabase/ssr`
- `@supabase/supabase-js`

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_publishable_key
NEXT_PUBLIC_SITE_URL=https://digital-media-ims.vercel.app
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-for-server-only-admin-routes
```

For local development, you can set `NEXT_PUBLIC_SITE_URL` to:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For production, set it to:

```env
NEXT_PUBLIC_SITE_URL=https://digital-media-ims.vercel.app
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev      # Start local dev server
npm run build    # Build production app
npm run start    # Start production server after build
npm run lint     # Run ESLint
```

## Supabase Setup

### Required Environment Values

In Supabase, get these values from Project Settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service role key is used only in server routes for teacher/admin operations. Do not expose it in client components.

### Student Account Link SQL

Run this SQL file in the Supabase SQL Editor:

```text
supabase/student-account-link.sql
```

It adds the student/auth linking fields used by student self-checkout:

- `students.user_id`
- `students.email`
- indexes for active linked student lookup

## Authentication

### Email Verification

Self-created accounts use Supabase email verification.

Signup is handled by:

```text
app/api/auth/create-account/route.ts
```

Email verification callback is handled by:

```text
app/auth/callback/route.ts
```

The callback reads `token_hash` and `type`, verifies the OTP with Supabase, persists the session through the server Supabase client, then redirects the user.

### Supabase URL Configuration

In Supabase Dashboard, set:

```text
Authentication -> URL Configuration
```

Site URL:

```text
https://digital-media-ims.vercel.app
```

Redirect URLs:

```text
https://digital-media-ims.vercel.app/auth/callback
https://digital-media-ims.vercel.app/login
https://digital-media-ims.vercel.app/reset-password
http://localhost:3000/auth/callback
http://localhost:3000/login
http://localhost:3000/reset-password
```

### Supabase Confirm Signup Email Template

The confirmation email must send `token_hash` and `type` to the app callback route.

In Supabase Dashboard:

```text
Authentication -> Email Templates -> Confirm signup
```

Use a link like:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">
  Confirm your email
</a>
```

The app sets `emailRedirectTo` to:

```text
https://digital-media-ims.vercel.app/auth/callback
```

### Password Reset

Password reset starts on the login page through `Forgot password?`.

Reset destination:

```text
/reset-password
```

The reset page lets the user choose a new password and then redirects back to login.

### Teacher-Created Student Accounts

Teachers can create student accounts from the Students tab. These accounts are created by a server admin route and are linked to the `students` table.

### Deleting Student Accounts

When a teacher deletes a student:

1. The teacher must enter their password.
2. The server verifies that password.
3. The linked profile row is deleted if a `profiles` table exists.
4. The student row is deleted from `students`.
5. The linked Supabase Auth user is deleted.

Checkout history may require database foreign keys that allow student deletion. If Supabase returns a foreign key constraint error, update the checkout foreign key behavior to match the desired history policy.

## Main Routes

```text
/                    Dashboard
/login               Sign in and password reset request
/email-password      Account creation page
/auth/callback       Supabase email verification callback
/reset-password      Set new password from reset email
/students            Teacher student roster management
/equipment           Inventory management and student equipment browsing
/checkout            Check equipment in/out
/history             Checkout history
```

## Deployment

The production app is intended to run on Vercel:

```text
https://digital-media-ims.vercel.app
```

Set these environment variables in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://digital-media-ims.vercel.app
SUPABASE_SERVICE_ROLE_KEY=...
```

After changing Supabase redirect settings or email templates, create a new test account and use a fresh verification email. Old verification emails can keep old URLs.

## Testing Checklist

Before release, verify:

1. Signup
   - Create a student account with a `@bentonvillek12.org` email.
   - Confirm the email points to `/auth/callback`, not localhost.

2. Email confirmation
   - Click the verification email.
   - Confirm the user lands in the app and can access the dashboard.

3. Login/logout
   - Sign out.
   - Sign back in with the verified account.

4. Password reset
   - Use `Forgot password?`.
   - Confirm the email opens `/reset-password`.
   - Set a new password and sign in.

5. Teacher roster management
   - Add a student.
   - Edit the student.
   - Delete the student after entering the teacher password.
   - Confirm the student is removed from the list.

6. Equipment flow
   - Add equipment.
   - Edit equipment.
   - Check equipment out and back in.
   - Confirm history records are created.

## Troubleshooting

### Verification Email Opens Localhost

Check:

- `NEXT_PUBLIC_SITE_URL` in Vercel is set to `https://digital-media-ims.vercel.app`
- Supabase Site URL is set to `https://digital-media-ims.vercel.app`
- Supabase redirect URLs include `/auth/callback`
- The Confirm signup email template uses `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`

Old emails may still point to old URLs. Send a new verification email or create a new test account.

### Email Rate Limit Exceeded

Supabase's default email sender has rate limits. For production, configure custom SMTP in Supabase Auth settings.

### Invalid Refresh Token

This usually means the browser has a stale Supabase session. Clear site data for the app domain or sign out and sign back in.

### Unable To Reach Supabase

Verify:

- Supabase project is active.
- `NEXT_PUBLIC_SUPABASE_URL` is correct.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is correct.
- Local `.env.local` or Vercel env vars are set.
