# Student Guide

## Overview

Ignite IMS lets students view equipment, check items out, and check items back in. Your student account is limited to your own equipment activity.

As a student, you can access these pages:

- `Dashboard` (`/`)
- `Equipment` (`/equipment`)
- `Checkout` (`/checkout`)

You cannot access teacher-only pages such as:

- `Students`
- `History`
- `Profile`

## First-Time Access

### Sign in

Page: `/login`

Use your school or assigned account email and password to sign in.

The login page also lets you:

- Reset your password with `Forgot password?`
- See messages about verification or sign-in errors

### Email verification and approval

Depending on how your account was created, you may need to complete email verification first. After that, a teacher may still need to approve your account before you can use the app normally.

If your account is not approved yet, you will be sent to the pending approval page.

## Pending Approval Page

Page: `/pending-approval`

This page means:

- Your sign-in worked
- Your account is still waiting for teacher approval

Features:

- A message explaining that your account is still pending
- A button to check your approval status again

If you stay on this page, contact your teacher so they can approve your account.

## Password Reset

### Request reset link

Page: `/login`

Use `Forgot password?` to request a reset email.

### Set a new password

Page: `/reset-password`

After opening the reset link, enter your new password on the reset page.

## Navigation

Student navigation includes:

- `Dashboard`
- `Equipment`
- `Checkout`

Your account is linked to your own student record. You cannot act for other students.

## Dashboard

Page: `/`

Purpose:

- See everything you currently have checked out
- See what needs attention soon
- Check items back in

Main features:

- `Items You Have`
- `Needs Attention`
- `Next Due`
- `Check Out Item` button
- `What You Have Out` list

### What You Have Out

This section shows each active checkout with:

- Equipment name
- Quantity
- Serial number tag when used
- Due date and time
- Remaining time until due
- Notes
- `Check In` button

### Deadline colors

Each active item gets a status color based on how far through the checkout time range it is:

- Green: on track
- Yellow: 50% of the checkout window has passed
- Red: 75% of the checkout window has passed
- Overdue: the due date/time has already passed

### Needs Attention

The `Needs Attention` number counts items that are:

- Yellow
- Red
- Overdue

### Next Due

The `Next Due` card highlights the checkout with the closest due date and shows the rough time left.

### Check in from the dashboard

You can check in your own items directly from the dashboard with the `Check In` button.

You cannot check in equipment that belongs to another student.

## Equipment Page

Page: `/equipment`

Purpose:

- Browse the equipment catalog
- Search for items
- Open item detail pages before checking something out

As a student, this page is view-only. You cannot create, edit, or deactivate equipment.

Typical uses:

- Find an item you need
- Check whether it exists in the system
- Open its detail page for more information

## Equipment Detail Page

Page: `/equipment/[id]`

Purpose:

- View one equipment item in more detail
- See item-specific information before checking it out

This page can include:

- Item name and category
- Current status
- Serial information for serialized items
- Checkout history or recent activity context
- A `Check Out` button that takes you to the checkout page with that item selected

## Checkout Page

Page: `/checkout`

Purpose:

- Check out your own items
- Check in your own current items
- Review your active checkouts in one place

Main features:

- Equipment selection
- Quantity or serial selection, depending on the item
- Required return date
- Required return time
- Optional notes
- Active checkout list

## How To Check Out An Item

1. Open `Checkout`
2. Select the equipment you want
3. If needed, choose quantity
4. If the item is serialized, choose the specific serial number
5. Choose the date you will return it
6. Choose the time you will return it
7. Optionally enter notes
8. Submit the checkout

### Return date and time rules

Every checkout requires a `Return By` date and time.

Important behavior:

- Date and time are selected separately
- If you choose today, times earlier than the current time are not available
- You cannot choose a due time that is already in the past

## How To Check In An Item

You can check in from:

- The `Dashboard`
- The `Checkout` page

To return equipment:

1. Find the active checkout
2. Click `Check In`

You can only check in equipment that is checked out under your own student account.

## Time Restrictions For Student Actions

Students can only check items in and out during their allowed class window, and only on weekdays.

### AM students

- Monday through Friday only
- Allowed from `7:45 AM` to `10:00 AM`

### PM students

- Monday through Friday only
- Allowed from `11:00 AM` to `2:00 PM`

### What happens outside your allowed time

If you are outside your allowed window:

- Checkout actions are disabled
- Check-in actions are disabled
- The app shows a warning message
- The server also blocks requests outside the allowed time

This means you cannot bypass the limit by refreshing or trying again later in the same blocked window.

## Serialized Items

Some equipment is tracked by serial number. For those items:

- You may have to choose a specific serial number instead of only entering quantity
- The serial number identifies the exact physical item you are borrowing

If no serial is available, the item may already be checked out or unavailable.

## Notes

The checkout form may let you add notes. Use notes for short, useful details such as:

- Project name
- Class activity
- Item condition you noticed before borrowing it

## Common Situations

### I signed in but I am stuck on pending approval

Your teacher still needs to approve your account.

### I cannot click checkout or check in

Check:

- Whether today is a weekday
- Whether the current time is inside your AM or PM class window
- Whether your teacher has approved your account

### I do not see a piece of equipment available

Possible reasons:

- It is already checked out
- It is inactive
- The serial you need is not currently available

### My item is yellow or red

That means the due deadline is getting closer:

- Yellow after 50% of the allowed checkout time has passed
- Red after 75% has passed
- Overdue after the due date/time passes

## Best Practices

- Return items on or before the due date and time you selected
- Check your dashboard regularly for color changes
- Use notes when they help explain what the equipment is for
- If your account is pending, ask a teacher to approve it
- If you miss your class window, wait until the next allowed weekday period or ask a teacher for help
