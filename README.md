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
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

`FIREBASE_SERVICE_ACCOUNT_IGNDIGITALMEDIA` should contain the full Firebase service account JSON.

## Important Auth Note

The database rows were moved to Firestore, but existing user passwords from the old auth provider cannot be copied into Firebase Auth. Users need Firebase Auth accounts. Teachers can create/approve accounts through the app once signed in with a Firebase teacher account.
