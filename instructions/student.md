# Student Guide

## Overview

Ignite IMS lets students view equipment, check out equipment for themselves, and check in their own active items.

Student pages:

- `Dashboard` (`/`)
- `Equipment` (`/equipment`)
- `Checkout` (`/checkout`)

Students cannot access teacher-only pages such as:

- `Students`
- `History`
- `Profile`

## Getting Started

### Create a student account

Page: `/email-password?mode=signup`

Required information:

- first name
- last name
- student ID
- school email ending in `@bentonvillek12.org`
- password
- class period (`AM` or `PM`)

After signup:

1. Check your email
2. Click the verification link
3. Sign in
4. Wait for a teacher to approve your account into the class roster

### Sign in

Page: `/login`

Use your school email and password.

The login page also includes:

- error messages if your email is not verified
- password reset request flow
- verification status messages after you return from the email link

## Pending Approval

Page: `/pending-approval`

If you see this page, your email is verified but a teacher still needs to approve your account.

Features:

- approval status message
- `Check Approval Status` button
- `Sign Out` button

Once a teacher approves you, the app sends you to `/checkout`.

## Password Reset

### Request a reset link

1. Open `/login`
2. Click `Forgot password?`
3. Enter your school email

### Set a new password

Open the email link and choose a new password on `/reset-password`.

## Navigation

Student navigation includes:

- `Dashboard`
- `Equipment`
- `Checkout`

Your account is linked to your own student record. You cannot act for another student.

## Dashboard

Page: `/`

Purpose:

- see what you currently have checked out
- spot items that need attention soon
- check your own items back in

Main sections:

- `Items You Have`
- `Needs Attention`
- `Next Due`
- `What You Have Out`

### What You Have Out

Each active item can show:

- equipment name
- quantity
- serial tag when used
- due date/time
- time remaining
- notes
- `Check In` button

### Deadline colors

Each item is color-coded based on how far through the checkout window it is:

- Green: on track
- Yellow: 50% or more of the checkout window has elapsed
- Red: 75% or more of the checkout window has elapsed
- Overdue: the due time has passed

### Needs Attention

The `Needs Attention` number counts items that are:

- yellow
- red
- overdue

### Next Due

The `Next Due` card shows the checkout with the closest due time.

## Equipment Page

Page: `/equipment`

Purpose:

- browse the equipment list
- search for items
- open equipment detail pages

This page is view-only for students. You cannot add, edit, or deactivate equipment.

## Equipment Detail Page

Page: `/equipment/[id]`

Purpose:

- view one item in more detail before checking it out

This page can show:

- category
- current availability
- current active checkouts
- serial/asset tags
- condition notes
- item history

You can use the `Check Out` button here to jump to the checkout page with that item selected.

## Checkout Page

Page: `/checkout`

Purpose:

- check out equipment for yourself
- check in your own active equipment
- review your current active checkouts

Main sections:

- `Check Out Equipment`
- `Check In Equipment`

## How To Check Out Equipment

1. Open `Checkout`
2. Select the equipment item
3. Choose quantity or serial tag
4. Choose a return date
5. Choose a return time
6. Add notes if needed
7. Submit the checkout

### Important checkout rules

- your student account is selected automatically
- every checkout needs a future `Return By` date and time
- if the selected date is today, earlier times are removed from the time dropdown
- the server rejects due times that are already in the past

### Quantity and serialized items

Non-serialized items:

- you can choose a quantity up to the available amount

Serialized items:

- you must choose a serial/asset tag
- serialized checkouts are one unit at a time

## How To Check In Equipment

You can check in your own items from:

- `Dashboard`
- `Checkout`

To return an item:

1. Find the active checkout
2. Optionally add return notes on the checkout page
3. Click `Check In`

You cannot check in equipment belonging to another student.

## Notes And Return Notes

During checkout:

- you can add optional notes

During check-in on the checkout page:

- you can add optional return notes

These notes may appear later in item history and audit records.

## What You Cannot Access

Students are redirected away from:

- `/students`
- `/history`
- `/profile`

Those pages are for teachers only.

## Common Situations

### I signed up but cannot use the app yet

You may still need:

- email verification
- teacher approval

### I cannot submit a checkout

Check:

- the equipment is available
- the quantity is valid
- the required serial tag is selected
- the due date and time are in the future

### I do not see an item available

Possible reasons:

- it is already checked out
- it is inactive
- the serial tag you need is already in use

### My item is yellow, red, or overdue

That means the due time is getting closer:

- Yellow at 50%
- Red at 75%
- Overdue after the due time passes

## Best Practices

- choose a realistic return time
- check your dashboard regularly
- return items on time
- use notes when they help explain the equipment use
- contact a teacher if your account is still pending approval
