# Digital Media IMS

Next.js equipment checkout app using Firebase Auth, Firestore, and Firebase Hosting.

## Tech Stack

| Area | Tool |
| --- | --- |
| App | Next.js, React, Tailwind CSS |
| Auth | Firebase Auth |
| Database | Cloud Firestore |
| Hosting | Firebase Hosting with framework backend |

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and fill in the Firebase values:

```txt
NEXT_PUBLIC_SITE_URL=https://igndigitalmedia.web.app
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Run locally:

```bash
npm run dev
```

## Firebase

Deploy Firestore rules and indexes:

```bash
npm run firebase:deploy:firestore
```

Verify Firestore collection counts:

```bash
npm run firebase:verify
```

Verify and backfill active student/equipment identifier keys and reservation documents before deploying duplicate-identifier enforcement changes:

```bash
npm run firebase:backfill-identifiers
npm run firebase:backfill-identifiers -- --apply
```

Deploy Hosting:

```bash
npm run firebase:deploy:hosting -- --project igndigitalmedia --non-interactive --force
```

Live site:

```txt
https://igndigitalmedia.web.app
```

## GitHub Actions

`.github/workflows/firebase-hosting-live.yml` deploys to Firebase Hosting whenever `main` receives a push.

Required GitHub Actions secrets:

```txt
FIREBASE_SERVICE_ACCOUNT_IGNDIGITALMEDIA
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

`FIREBASE_SERVICE_ACCOUNT_IGNDIGITALMEDIA` should contain the full Firebase service account JSON. Do not write `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, or `FIREBASE_PRIVATE_KEY` into the deploy `.env`; Firebase Functions rejects env keys with the reserved `FIREBASE_` prefix. The hosted backend uses Firebase's default runtime credentials.

## Important Auth Note

The database rows were moved to Firestore, but existing user passwords from the old auth provider cannot be copied into Firebase Auth. Users need Firebase Auth accounts. Teachers can create/approve accounts through the app once signed in with a Firebase teacher account.

## School App Access Review

The app currently uses Firebase Auth email/password authentication for `@bentonvillek12.org` accounts. It does not use Google Sign-In, does not request Google Workspace OAuth scopes, and does not access Gmail, Drive, Calendar, Classroom, Contacts, or Google Admin data.

Data used by the app is limited to school email, name, role, student ID, class period, email verification status, teacher approval status, and equipment checkout records created inside the app. Student users may be under 18 if the school approves student access; student accounts require email verification and teacher approval before full use.

The public privacy/data-access page is available at `/privacy`.
