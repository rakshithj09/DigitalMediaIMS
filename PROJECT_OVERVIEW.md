# Digital Media IMS Project Overview

Digital Media IMS is a Next.js equipment checkout system for a school digital media program. It lets teachers manage students, equipment, approvals, and checkouts, while students can see and manage only their own approved checkout activity.

## Summary

This project is an inventory and accountability platform for school media labs. It replaces manual checkout workflows with a secure web app that tracks users, assets, due dates, returns, and approvals in real time.

The key idea is simple: every piece of equipment becomes a tracked digital asset. Students and teachers interact with the system through a browser, while the backend verifies identity, permissions, inventory availability, and return rules before anything is recorded.

What makes it valuable:

- It protects expensive equipment by tying each checkout to a real authenticated user.
- It gives teachers a real-time dashboard of what is out, who has it, and what is overdue.
- It supports barcode-labeled gear, so physical items can be scanned instead of manually typed.
- It uses camera-based barcode scanning in supported browsers, so phones and laptops can act like scanners without extra hardware.
- It separates teacher and student permissions, so students only see and manage their own equipment.
- It stores data in Firebase, which gives the app cloud authentication, database storage, hosting, and security rules.

In normal terms, the app works like a school-friendly version of an equipment rental system. The difference is that it is designed around classroom periods, student approvals, teacher controls, and fast daily checkout/check-in.

## Camera and Computer Vision Feature

The app includes a camera barcode scanner in `app/components/BarcodeScanner.tsx`. When a user clicks **Scan With Camera**, the browser asks for camera access and opens a live video preview.

The scanner uses the browser's native `BarcodeDetector` API. That API analyzes the camera frames and detects supported barcode formats such as Code 128, Code 39, UPC, EAN, and QR codes. This is a computer-vision-style feature because the browser is reading visual data from the camera feed and converting the detected barcode into text.

The app then uses that scanned barcode to find the matching equipment item. If the barcode is valid and the item is available, the checkout can continue. If the item is already checked out, assigned to multiple records, or not found, the app stops the workflow and shows an error.

This feature matters because it makes the system faster and more reliable in real use. Teachers and students do not have to type long equipment labels by hand, and the app can prevent the wrong physical item from being checked out.

If camera barcode scanning is not supported on a device, the app still works with typed barcode labels or most USB barcode scanners.

## Example Demo Pitch

Here is a simple way to explain the project to non-technical people:

> Digital Media IMS helps schools track expensive media equipment like cameras, lenses, and lighting kits. Students sign in, scan a barcode with the camera, check out the item, and the teacher can instantly see who has what and when it is due back. The system uses secure logins, cloud storage, and barcode scanning so classrooms do not have to rely on paper forms or spreadsheets.

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | Next.js App Router, React, TypeScript | Pages, layouts, client-side interactions |
| Styling | Tailwind CSS, custom global CSS variables | Responsive app UI and brand styling |
| Auth | Firebase Auth | Email/password login and identity |
| Authorization | Firebase custom claims and Firestore rules | Teacher vs Student access control |
| Database | Cloud Firestore | Equipment, students, checkouts, profiles, approvals |
| Backend | Next.js route handlers using Firebase Admin SDK | Validated writes and privileged operations |
| Hosting | Firebase Hosting with frameworks backend | Hosts the Next.js app and server routes |
| Tests | Jest, React Testing Library | Unit and route-handler coverage |

## High-Level Architecture

This is a full-stack Next.js app, not a separate frontend and backend service.

The frontend lives mostly under `app/` and `components/`. It renders pages, manages local UI state, signs users in through Firebase Auth, reads permitted Firestore data with the Firebase browser SDK, and calls backend API routes for actions that change data.

The backend lives under `app/api/`. These route handlers run on the server side through the Next.js/Firebase frameworks backend. They verify the Firebase ID token sent by the browser, check the user's role, validate request bodies, and then use the Firebase Admin SDK to create or update Firestore documents.

Firestore security rules intentionally make the browser mostly read-only. Direct client writes to important collections are denied. Writes happen through server routes after the app has validated the user and the request.

## Main Directories

| Path | What it does |
| --- | --- |
| `app/` | Next.js App Router pages, layouts, API routes, and app-specific helpers |
| `app/api/` | Server-side route handlers for checkouts, equipment, auth, and admin workflows |
| `app/components/` | App-level UI components like the shell, scanner, date picker, and period badge |
| `app/lib/` | Frontend/domain helpers for types, periods, barcodes, serial numbers, and return windows |
| `components/ui/` | Reusable low-level UI primitives such as buttons, cards, inputs, tabs, and labels |
| `lib/firebase/` | Firebase browser/admin setup, auth helpers, and data-client wrappers |
| `lib/auth/` | Student roster and approval workflow helpers |
| `__tests__/` | Jest tests for route handlers, Firebase helpers, and app utilities |
| `scripts/` | Maintenance and verification scripts for Firestore and barcode migration |
| `firestore.rules` | Firestore read/write access rules |
| `firestore.indexes.json` | Composite indexes needed by app queries |

## Frontend

The app uses the Next.js App Router. Every route under `app/*/page.tsx` is a page:

| Page | Purpose |
| --- | --- |
| `/` | Dashboard showing active checkout activity |
| `/login` | Login and account entry |
| `/reset-password` | Password reset flow |
| `/equipment` | Equipment list and teacher equipment management |
| `/equipment/[id]` | Equipment detail page |
| `/checkout` | Checkout and check-in workflow |
| `/history` | Historical checkout records |
| `/students` | Teacher student roster management |
| `/students/[id]` | Student detail page |
| `/my-info` | Student-facing account/info page |
| `/profile` | User profile page |
| `/pending-approval` | Student waiting state before teacher approval |

`app/components/AppShell.tsx` wraps the authenticated parts of the app. It:

- Loads the current Firebase user through `createFirebaseDataClient()`.
- Redirects signed-out users to `/login`.
- Reads the user's Firebase custom claims to determine role and profile information.
- Shows teacher navigation or student navigation depending on the role.
- Lets teachers switch between `AM` and `PM` periods through `PeriodProvider`.
- Locks students to their own period and redirects them away from teacher-only pages.
- Checks whether a student has an active Firestore `students` row before letting them use the app.

The frontend reads Firestore through `lib/firebase/browser-data.ts`. That file creates a small Supabase-like query wrapper around the Firebase browser SDK, so pages can write code such as:

```ts
createFirebaseDataClient()
  .from("checkouts")
  .select("...")
  .eq("period", period)
  .order("checked_out_at", { ascending: false });
```

For server mutations, frontend code uses `firebaseFetch()` from `lib/firebase/auth-fetch.ts`. That helper gets the current Firebase ID token and sends it as:

```txt
Authorization: Bearer <firebase-id-token>
```

The API routes then use that token to identify the user securely on the server.

## Backend

The backend is a set of Next.js route handlers in `app/api/`. Each file named `route.ts` exports HTTP handlers such as `GET`, `POST`, or `PATCH`.

Important routes:

| Route | Purpose |
| --- | --- |
| `POST /api/equipment` | Teacher creates equipment |
| `PATCH /api/equipment` | Teacher updates or deactivates equipment |
| `GET /api/checkouts/options` | Loads students, equipment, active checkouts, and availability for the checkout page |
| `POST /api/checkouts` | Creates a checkout |
| `POST /api/checkouts/check-in` | Checks equipment back in |
| `GET /api/admin/students` | Teacher student list/admin data |
| `POST /api/admin/create-student` | Teacher creates a Firebase student account and matching Firestore student row |
| `POST /api/admin/add-student-roster` | Adds or updates student roster data |
| `GET/PATCH /api/admin/student-approvals` | Teacher manages student approval requests |
| `GET/POST /api/admin/teacher-approvals` | Teacher approval workflow for new teacher accounts |
| `POST /api/auth/create-account` | Creates a Student or approved Teacher account |
| `GET /api/auth/account-exists` | Checks whether an account already exists |
| `GET/POST /api/auth/student-approval-request` | Student approval request status and creation |

Server auth is centralized in `lib/firebase/server-auth.ts`. It reads the `Authorization` header, verifies the Firebase ID token with Firebase Admin Auth, loads the full Firebase user, and converts Firebase custom claims into the app's `user_metadata` shape.

Firebase Admin setup is in `lib/firebase/admin-client.ts`. Locally, it can use `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. In Firebase Hosting's backend runtime, it can fall back to application default credentials.

`lib/firebase/admin-data.ts` provides a small Firestore Admin data wrapper with methods like `.from("equipment").insert(...)`, `.eq(...)`, `.update(...)`, and `.maybeSingle()`. This keeps the route handlers similar to the older data-access style while storing data in Firestore.

## Data Model

Core TypeScript types are defined in `app/lib/types.ts`.

| Collection | Main fields | Meaning |
| --- | --- | --- |
| `students` | `name`, `student_id`, `user_id`, `email`, `period`, `is_active` | Student roster rows linked to Firebase Auth users |
| `equipment` | `name`, `category`, `total_quantity`, `serial_number`, `condition_notes`, `is_active` | Inventory records |
| `checkouts` | `student_id`, `equipment_id`, `quantity`, `serial_number`, `checked_out_at`, `due_at`, `checked_in_at`, `period` | Equipment checkout records |
| `student_approval_requests` | `user_id`, `email`, `first_name`, `last_name`, `student_id`, `period`, `approved_at` | Pending student account approvals |
| `approved_teachers` | `email`, `approved_user_id`, `used_at` | Teacher signup allowlist |
| `profiles` | `email`, `first_name`, `last_name`, `role`, `is_staff` | Teacher profile data |

The app uses two roles in Firebase custom claims:

- `Teacher`: can manage students, equipment, approvals, and checkouts.
- `Student`: can use student-facing pages and only act on their linked student record.

Student users are linked to Firestore roster rows by `students.user_id === Firebase Auth uid`.

## How Auth Works

1. A user signs in with Firebase Auth in the browser.
2. Firebase returns a browser-side user session.
3. `AppShell` reads the user and custom claims through `createFirebaseDataClient().auth.getUser()`.
4. The custom claims determine whether the user is a `Teacher` or `Student`.
5. For API calls, `firebaseFetch()` sends the Firebase ID token in the `Authorization` header.
6. Server routes call `createFirebaseServerAuthClient()` to verify the token and load the user.
7. Routes check `user.user_metadata.role` before allowing teacher-only or student-only actions.

Firestore rules add another layer of protection. Browser reads are limited by the user's auth state and role. Browser writes to key collections are denied, so trusted writes must go through server routes.

## Main Workflows

### Login and App Access

The user logs in on `/login`. After authentication, `AppShell` decides where they can go. Teachers see the full app navigation. Students see a smaller navigation set: dashboard, equipment, checkout, and my info.

If a student account exists in Firebase Auth but does not yet have an active `students` roster row, the app sends them to `/pending-approval`.

### Teacher Creates Equipment

1. Teacher uses the equipment UI.
2. The browser sends a request to `/api/equipment` with `firebaseFetch()`.
3. The route verifies that the user is signed in and has role `Teacher`.
4. The route validates the name, category, quantity, and barcode/serial rules.
5. Firebase Admin writes the document to the `equipment` collection.

Serialized categories such as cameras, lenses, lighting, and stabilization gear require one physical item per row with exactly one barcode label.

### Checkout Equipment

1. The checkout page loads options from `GET /api/checkouts/options`.
2. Teachers can request data for the selected `AM` or `PM` period.
3. Students automatically use their own linked student row and period.
4. The backend loads active students, active equipment, active checkouts, and current equipment availability.
5. When a checkout is submitted, `POST /api/checkouts` validates:
   - user is signed in,
   - student is valid,
   - return date is in the future,
   - return date is a weekday in America/Chicago,
   - return time fits the student's period window,
   - requested quantity is available,
   - barcode-labeled equipment uses a valid available barcode.
6. The route creates a `checkouts` document with `checked_in_at: null`.

Return windows are defined in `app/lib/return-windows.ts`:

- AM period: `7:45 AM` to `10:00 AM`
- PM period: `11:45 AM` to `3:00 PM`

### Check In Equipment

1. The dashboard or checkout UI sends `POST /api/checkouts/check-in`.
2. The route verifies the signed-in user.
3. If the user is a student, the route confirms the checkout belongs to that student's linked roster row.
4. The route updates the checkout with `checked_in_at` and optional `return_notes`.

### Student Account Approval

Student signup creates a Firebase Auth user and a `student_approval_requests` document. A teacher can approve the request, which links or creates the relevant `students` roster row. Until that row exists and is active, the student remains on the pending approval screen.

Teacher signup is restricted by `approved_teachers`: the teacher email must already be present and unused before `/api/auth/create-account` creates the teacher account.

## Firestore Access Rules

`firestore.rules` enforces these main rules:

- Signed-in users can read active equipment.
- Teachers can read teacher-visible collections and inactive equipment.
- Students can read their own `students` record.
- Students can read checkouts they own and active checkout records allowed by the rules.
- Direct browser writes to `equipment`, `students`, `checkouts`, approvals, and profiles are denied.

Because direct writes are denied, API routes use Firebase Admin after performing application-level validation.

## Availability and Barcode Logic

Equipment availability is calculated from active checkout records where `checked_in_at` is `null`.

For normal equipment, availability is:

```txt
equipment.total_quantity - sum(active checkout quantities)
```

For barcode-labeled equipment, `app/lib/serials.ts` parses serial labels from comma-separated or newline-separated text. The checkout route prevents checking out a barcode that is not listed on the equipment item or is already active in another checkout.

## Build, Test, and Deploy

Common commands:

```bash
npm run dev
npm run build
npm run lint
npm test
npm run test:coverage
npm run firebase:verify
npm run firebase:deploy:firestore
npm run firebase:deploy:hosting
```

Firebase Hosting is configured in `firebase.json` with a frameworks backend in `us-central1`. Firestore rules and indexes are deployed from `firestore.rules` and `firestore.indexes.json`.

## Mental Model

Think of the project as three connected layers:

1. React pages and components render the app and collect user actions.
2. Firebase Auth identifies the user and provides role claims.
3. Firestore stores the data, while Next.js API routes perform trusted writes with Firebase Admin.

The most important design decision is that the browser is not trusted to write inventory, roster, approval, or checkout data directly. The browser can read what Firestore rules allow, but important changes flow through server routes that verify identity, role, ownership, period rules, quantities, and barcode availability first.
