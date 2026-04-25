# Teacher Guide

## Overview

Ignite IMS is an equipment checkout system with separate teacher and student roles. Teachers manage inventory, manage students, approve accounts, and handle checkouts and check-ins for both AM and PM classes.

As a teacher, you can access these main pages:

- `Dashboard` (`/`)
- `Students` (`/students`)
- `Equipment` (`/equipment`)
- `Checkout` (`/checkout`)
- `History` (`/history`)
- `Profile` (`/profile`)

You can also open individual equipment detail pages at `/equipment/[id]`.

## Sign In And Password Help

### Login page

Page: `/login`

Features:

- Sign in with your email and password
- Reset your password with the `Forgot password?` link
- See status messages for verification, sign-in errors, or password reset email results

If you use the reset flow, Supabase sends a reset link to your email. That link returns you to the app so you can choose a new password.

### Reset password page

Page: `/reset-password`

Features:

- Enter a new password after opening the password reset link
- Submit the new password and return to the app

## App Navigation

The app uses a shared navigation shell.

Teacher navigation includes:

- `Dashboard`
- `Students`
- `Equipment`
- `Checkout`
- `History`
- `Profile`

### Period switching

Teachers can switch between `AM` and `PM` using the period toggle in the header/sidebar.

What period switching affects:

- Dashboard checkout data
- Checkout page student list
- Other period-based views tied to active student/equipment activity

You are not locked to one class period. You can switch as needed.

## Dashboard

Page: `/`

Purpose:

- View all active checkouts for the currently selected period
- Quickly see checkout load and risk level
- Check items back in directly from the dashboard

Main features:

- `Items Checked Out` stat card
- `Students with Items` stat card
- `Refresh` button
- `Active Checkouts` table

### Active Checkouts table

Columns:

- Student
- Item
- Qty
- Return By
- Notes
- Action

What the table shows:

- Student name
- Equipment name
- Category tag when available
- Serial number tag when used
- Due date and time
- Remaining time until due
- Notes entered during checkout
- `Check In` button

### Due date status colors

The dashboard colors active checkouts based on how much of the checkout window has passed:

- Green: on track
- Yellow: 50% or more of the checkout time has elapsed
- Red: 75% or more of the checkout time has elapsed
- Red overdue state: the due date/time has already passed

This appears both in badges and row background emphasis.

### Check in from the dashboard

Teachers can check an item in directly from the `Action` column without opening the checkout page.

## Students Page

Page: `/students`

Purpose:

- Manage the student roster
- Add new students
- Edit existing students
- Delete student records when needed

Students cannot access this page.

Main features:

- Search/filter student list
- Add student form
- Edit student details
- Delete student action with teacher password confirmation

### Student data managed here

Depending on the current schema and form fields, this page manages the student information needed by the checkout system, including:

- Student name
- Student ID
- Email
- Class period
- Active status
- User link when the student has a connected login

### Teacher-created students

Teachers can create student records directly from this page. This is useful when building the roster before a student signs in.

### Editing students

Teachers can update student information when:

- A name changes
- A student is moved to AM or PM
- Contact/account details need correction
- A student needs to be reactivated or adjusted in the roster

### Deleting students

Deleting a student requires teacher password confirmation. This is intended as a deliberate cleanup action, not an everyday workflow.

## Equipment Page

Page: `/equipment`

Purpose:

- View the inventory catalog
- Add equipment
- Edit equipment
- Deactivate equipment

Students can view this page, but teachers have management actions that students do not.

Main features:

- Search and filtering
- Add equipment form
- Edit equipment form
- Deactivate equipment option
- Links into equipment detail pages

### Equipment records

Equipment entries can include:

- Equipment name
- Category
- Quantity
- Availability-related information
- Serialized tracking when required

### Serialized categories

Some equipment categories are serialized. For those items:

- Serial tags are tracked separately
- Checkout flow requires choosing available serial numbers
- Inventory detail pages show serial-specific information

### Deactivating equipment

Teachers can deactivate items that should no longer appear as normal available inventory. This is useful for broken, retired, or otherwise removed equipment.

## Equipment Detail Page

Page: `/equipment/[id]`

Purpose:

- Inspect one equipment item in detail
- See item-specific status and history
- Jump directly into checkout

Main features:

- Equipment metadata
- Current active checkouts for that item
- Serial tags and serial-level status where applicable
- Checkout history for that specific item
- `Check Out` button linking to `/checkout?eq=<id>`

Use this page when you need item-specific context before checking it out or auditing its recent use.

## Checkout Page

Page: `/checkout`

Purpose:

- Check items out
- Check items in
- Review currently active checkouts

This is the main operational page for daily equipment handling.

Main features:

- Teacher checkout form
- Student selection for the current period
- Equipment selection
- Quantity and serial handling
- Required return date and time
- Notes field
- Active checkout list with check-in actions

### Teacher checkout flow

Typical process:

1. Open `Checkout`
2. Make sure the correct class period is selected in the app shell
3. Select the student
4. Select the equipment item
5. Enter quantity or choose a serial number, depending on the item type
6. Choose the required return date
7. Choose the required return time
8. Optionally enter notes
9. Submit the checkout

### Return date and time

A due date is required for every checkout.

Important behavior:

- The date is selected separately from the time
- The time list is generated in set intervals
- If the selected date is today, past times are blocked so users cannot choose a time earlier than the current time window

This keeps return deadlines valid and prevents already-expired due times.

### Quantity and serial rules

Non-serialized items:

- Teachers can usually enter a quantity, limited by current availability

Serialized items:

- Teachers select the exact serial number(s) being checked out
- Each serial tracks a specific physical item

### Notes

The checkout form can store notes for extra context such as:

- Why the item is being used
- Condition notes
- Project/lab usage details

### Active checkout list

The page also shows items currently checked out, with options to check them back in.

Teachers can check in student items from this page regardless of the student self-service window restrictions.

## History Page

Page: `/history`

Purpose:

- Review past and current checkout records
- Filter activity for auditing or troubleshooting

Main features:

- Student name filter
- Period filter
- Date range filters
- Read-only audit trail of checkout activity

Use this page when you need to answer questions like:

- Who had an item last?
- When was an item checked out?
- Which period used certain equipment?
- What happened during a specific date range?

## Profile Page

Page: `/profile`

Purpose:

- Handle approval workflows

Main features:

- Approve teacher email/account requests
- Review and approve pending student signups after they verify their own email

This page controls who is allowed into the full system flows.

### Teacher approval workflow

Teacher accounts can require approval before they should be treated as valid teacher access. Use this page to review and approve them.

### Student approval workflow

When a student signs up and verifies their email, they still wait for teacher approval before they can fully use the app. Teachers complete that approval from this page.

## Student Approval Waiting State

Page: `/pending-approval`

Students see this page when:

- They have signed in successfully
- Their student account still has not been approved by a teacher

Teachers do not use this page directly, but you should know it exists because students may ask why they cannot proceed. Once you approve them in `Profile`, they can continue into the student app.

## Student Role Restrictions

Students only have access to:

- `Dashboard`
- `Equipment`
- `Checkout`

Students do not have access to:

- `Students`
- `History`
- `Profile`

Students are also tied to their own student record. They cannot check items in or out for other students.

## Student Time Restrictions

Student self-service check-in and check-out actions are restricted by class period and only work on weekdays.

AM students:

- Allowed Monday through Friday
- Allowed from `7:45 AM` to `10:00 AM`

PM students:

- Allowed Monday through Friday
- Allowed from `11:00 AM` to `2:00 PM`

What this means for teachers:

- Students may see disabled actions outside their allowed window
- Server-side rules also block attempts outside the allowed window
- Teachers can still manage checkouts and check-ins from the teacher interface

## Due Dates And Deadline Tracking

Every checkout now includes a `Return By` deadline.

This deadline is used in:

- Dashboard warning colors
- Student dashboard attention state
- Remaining-time text
- Overdue display

The system compares the current time against the original checkout time and due time, then calculates how far through the checkout window the item is.

## Daily Teacher Workflow

Recommended routine:

1. Sign in
2. Switch to the correct `AM` or `PM` period
3. Open `Dashboard` to review active items and urgency colors
4. Use `Checkout` for new checkouts and returns
5. Use `Students` when roster adjustments are needed
6. Use `Equipment` when inventory changes are needed
7. Use `History` for audits or missing-item research
8. Use `Profile` to approve new teachers and students

## Troubleshooting

### A student cannot access the app after signing in

Check:

- The student verified their email
- The student was approved on the `Profile` page
- The student has an active linked student record

### A student says the checkout button is disabled

Check:

- Whether it is a weekday
- Whether the current time is inside the student window for that period
- Whether the student is in the correct AM/PM class

### An item cannot be checked out

Check:

- Inventory availability
- Quantity limits
- Whether the item is serialized and needs a serial selection
- Whether a due date and valid due time were selected

### A record is showing yellow or red

That means the checkout is moving deeper into its allowed time range:

- Yellow at 50%
- Red at 75%
- Overdue after the due date/time passes

