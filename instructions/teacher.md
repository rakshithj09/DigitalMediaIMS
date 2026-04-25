# Teacher Guide

## Overview

Ignite IMS is the teacher-facing equipment checkout system for Digital Media. Teachers manage inventory, manage students, approve accounts, and handle checkouts and returns for AM and PM classes.

Teacher pages:

- `Dashboard` (`/`)
- `Students` (`/students`)
- `Equipment` (`/equipment`)
- `Checkout` (`/checkout`)
- `History` (`/history`)
- `Profile` (`/profile`)

You can also open equipment detail pages at `/equipment/[id]`.

## Sign In, Sign Up, And Password Reset

### Sign in

Page: `/login`

Use your school email and password to sign in.

This page also includes:

- forgot-password flow
- status messages after email verification
- error handling for invalid sign-in attempts

### Create a teacher account

Page: `/email-password?mode=signup`

Important rules:

- Your email must end with `@bentonvillek12.org`
- Your email must already be approved by an existing teacher
- You still need to verify your email before the account is ready

If your email is not in the teacher approval allow-list, account creation is blocked.

### Reset your password

Flow:

1. Open `/login`
2. Click `Forgot password?`
3. Request the reset link
4. Open the email link
5. Set the new password on `/reset-password`

## App Navigation

Teachers use the full navigation shell.

Available links:

- `Dashboard`
- `Students`
- `Equipment`
- `Checkout`
- `History`
- `Profile`

### Period toggle

Teachers can switch between `AM` and `PM` in the shell header/sidebar.

The selected period affects:

- dashboard data
- visible roster on the students page
- default checkout student list
- period-based checkout views

## Dashboard

Page: `/`

Purpose:

- review active checkouts for the selected period
- check items in quickly
- see urgency based on checkout deadlines

Main sections:

- `Items Checked Out`
- `Students with Items`
- `Active Checkouts`

### Active Checkouts table

Columns:

- Student
- Item
- Qty
- Return By
- Notes
- Action

The table shows:

- student name
- equipment name
- category tag
- serial tag when used
- due date/time
- remaining time
- deadline state
- quick `Check In` action

### Deadline colors

Each active checkout is color-coded from the original checkout time to the due time:

- Green: on track
- Yellow: 50% or more of the checkout window has elapsed
- Red: 75% or more of the checkout window has elapsed
- Overdue: due date/time has passed

### Quick check-in

Teachers can return equipment directly from the dashboard without opening the checkout page.

## Students Page

Page: `/students`

Purpose:

- manage the active roster for the selected period
- create student accounts
- edit student records
- delete student records

Students cannot access this page.

### What you can do here

- search students by name or student ID
- add a new student
- edit name, student ID, email, and period
- delete a student after confirming your own teacher password

### Add student flow

When a teacher creates a student from this page, the app creates:

- a Supabase Auth user
- a linked row in the `students` table

The created student account is email-confirmed immediately by the server-side admin flow.

## Equipment Page

Page: `/equipment`

Purpose:

- browse inventory
- add equipment
- edit equipment
- deactivate equipment

Students can view this page, but only teachers can manage equipment.

### Available management actions

- search by name
- filter by category
- add new items
- edit existing items
- deactivate items with teacher password confirmation

### Equipment fields

Equipment records can include:

- name
- category
- total quantity
- serial/asset tags
- condition notes
- active/inactive state

### Serialized items

Some categories require serial numbers. For those items:

- serial tags must match the quantity
- checkout is one serialized unit at a time
- availability is based on both quantity and serial status

## Equipment Detail Page

Page: `/equipment/[id]`

Purpose:

- inspect one item in detail
- review current usage
- review the full history for that item

Main sections:

- summary cards
- `Currently Out`
- `Item Info`
- `Checkout History`

### What you can see here

- category
- available count
- active checkout count
- serial tag count
- condition notes
- active serialized tags
- full item history including notes and return notes

There is also a `Check Out` button that opens `/checkout?eq=<id>`.

## Checkout Page

Page: `/checkout`

Purpose:

- check equipment out
- check equipment in
- manage active checkouts for the selected period

Main sections:

- `Check Out Equipment`
- `Check In Equipment`

### Teacher checkout flow

1. Make sure the correct `AM` or `PM` period is selected
2. Choose the student
3. Choose the equipment item
4. Choose quantity or serial tag
5. Choose `Return By` date
6. Choose `Return By` time
7. Add notes if needed
8. Submit the checkout

### Due date and due time behavior

Every checkout requires a future return deadline.

Important details:

- date and time are selected separately
- past dates are blocked
- if the selected date is today, earlier times are removed from the time dropdown
- the server rejects past due times even if the UI is bypassed

### Quantity and serial behavior

Non-serialized items:

- quantity can be more than 1
- quantity cannot exceed current availability

Serialized items:

- one serialized unit is checked out at a time
- a serial/asset tag must be selected
- already checked-out serials are excluded

### Notes and return notes

During checkout:

- optional checkout notes can be saved

During check-in:

- optional return notes can be added before returning the item

### Check-in list

The right side of the checkout page shows current active checkouts for the active period, including:

- student name
- item name
- quantity
- serial tag
- due time
- deadline badge
- notes
- return-notes field
- `Check In` button

## History Page

Page: `/history`

Purpose:

- audit checkout and return activity
- filter records for troubleshooting or reporting

Main features:

- student search
- period filter
- date range filter
- status display
- duration calculation

Columns include:

- Student
- Item
- Qty
- Period
- Checked Out
- Checked In
- Duration
- Status
- Notes

## Profile Page

Page: `/profile`

Purpose:

- approve new teacher emails
- approve pending student signups

Students are redirected away from this page.

### Approve Teacher

Use this form to approve a teacher email address so that user can create a teacher account later.

This requires:

- the teacher email to approve
- your current teacher password

### Pending Student Approvals

This section shows student signup requests waiting for roster approval.

Each request shows:

- email
- first and last name
- student ID
- AM/PM period
- requested time
- email verification status

A student must verify their email before approval can be completed.

## Pending Approval Page

Page: `/pending-approval`

Students see this after verifying email but before a teacher approves them into the roster.

Teachers do not use this page directly, but it is part of the student onboarding flow.

## Student Access Rules

Students only have access to:

- `/`
- `/equipment`
- `/checkout`

Students are redirected away from:

- `/students`
- `/history`
- `/profile`

Students can only check in equipment tied to their own student record, and student checkouts are always tied to their linked student row.

## Daily Teacher Workflow

Recommended routine:

1. Sign in
2. Pick `AM` or `PM`
3. Review the dashboard for active and urgent checkouts
4. Use `Checkout` for day-to-day checkouts and returns
5. Use `Students` when roster data needs to change
6. Use `Equipment` for inventory management
7. Use `History` when you need an audit trail
8. Use `Profile` to approve teachers and students

## Troubleshooting

### A student says they cannot get past pending approval

Check:

- they verified their email
- their request appears in `Profile`
- you approved the request successfully
- a linked active `students` row exists

### A checkout fails

Check:

- student selection
- equipment availability
- quantity limits
- serial requirements
- due date/time is still in the future

### A row is yellow, red, or overdue

That means the checkout is progressing deeper into its deadline window:

- Yellow at 50%
- Red at 75%
- Overdue after the due time passes

### A teacher cannot create a teacher account

Check:

- the email was approved first from `Profile`
- the user used a `@bentonvillek12.org` email
- the user verified their email after signup
