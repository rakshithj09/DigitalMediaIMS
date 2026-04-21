Manual testing instructions for the generated `app/page.tsx` landing page

This file was added to satisfy the repository's agent policy requirement to include manual testing steps for UI changes (see `.agents/agents.md`).

Steps

1. Install dependencies (if not already):

```bash
npm install
```

2. Run the dev server:

```bash
npm run dev
```

3. Open a browser and visit:

http://localhost:3000

4. Verify the landing page loads with:
- Title: "Digital Media IMS"
- Description paragraph under the title
- Navigation links: "View Inventory" and "Checkouts"
- "Key features" list present

5. Click the "View Inventory" link. If you have not yet implemented the inventory page, it may 404 — this is expected for the starter UI. The link should be a standard anchor element and accessible by keyboard (Tab / Enter).

6. Accessibility quick checks:
- Confirm the page is keyboard-navigable (tab to links and press Enter).
- Verify heading hierarchy (h1, h2, h3) is present.

Notes

- No secrets are included in this change.
- This is a minimal UI placeholder. Automated tests were not added because this project does not currently include a test runner; consider adding Jest/React Testing Library if automated UI tests are required.

If you want, I can add automated tests and wire a simple test runner in a follow-up change.

---

Additional manual test: Email sign-up

1. Visit the sign-up page (if using the demo component, go to /email-password).
2. Toggle to "Create account", enter an email at @bentonvillek12.org and a password, then submit.
3. Expect to see a message saying the account was created.
4. Sign in using the same credentials and confirm access.
5. For student accounts, confirm the student appears in the selected AM/PM roster.

Notes for maintainers
- The client enforces the @bentonvillek12.org domain before calling Supabase, but you should also enforce domain restrictions server-side or with RLS policies to prevent abuse.
- Ensure `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL`, either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
