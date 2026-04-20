# Product Requirements Document (PRD)
## Digital Media Equipment Tracker — Ignite Professional Studies

---

### 1. Overview

**Product name:** Digital Media Equipment Tracker

**Summary:** A web-based application that allows an Ignite Professional Studies classroom teacher to manage digital media equipment inventory, track student checkouts and returns, and maintain a historical log of all equipment usage. The app supports multiple class periods (AM/PM) and is designed to be simple, fast, and reliable enough for daily classroom use.

**Target users:** Classroom teacher(s) managing digital media equipment in an Ignite Professional Studies program.

**Platform:** Web application (desktop browser primary, tablet/mobile responsive), developed in VS Code, hosted on static hosting (GitHub Pages, Netlify, or Vercel) with Supabase as the backend.

---

### 2. Problem Statement

The classroom teacher currently has no streamlined way to track which students have checked out which pieces of digital media equipment, when items were taken and returned, or whether inventory counts are accurate. Manual tracking (paper logs, spreadsheets) is error-prone, slow, and lacks real-time visibility. A purpose-built tool will reduce lost equipment, save class time, and create accountability.

---

### 3. Goals and Success Metrics

| Goal | Success metric |
|---|---|
| Reduce time spent on equipment management | Teacher spends < 2 minutes per class period on checkout/check-in |
| Eliminate lost equipment | 100% of checkouts have a corresponding check-in record |
| Provide accountability | Full audit trail of who had what and when |
| Easy adoption | Teacher can use the system with < 10 minutes of training |
| Reliable daily use | App loads in < 3 seconds, zero data loss |

---

### 4. User Roles

| Role | Description | Permissions |
|---|---|---|
| **Teacher (Admin)** | Primary user. Manages students, equipment, and checkouts. | Full CRUD on all data. Can switch between AM/PM classes. Can view history and reports. |
| **Student** (future/stretch) | Could self-checkout via a kiosk mode. | Check out / check in equipment assigned to them only. View own history. |

> **MVP scope:** Teacher role only. Student self-service is a stretch goal.

---

### 5. Core Features (MVP)

#### 5.1 Class Period Selection

- Teacher can select the active class period: **AM** or **PM**
- All student lists, active checkouts, and displays filter by the selected period
- Period selection persists during the session (does not reset on page refresh)
- Visual indicator showing which period is currently active

#### 5.2 Student Management

- **Add a student** to the AM or PM roster (name, optional student ID)
- **Remove a student** from a roster (soft delete preferred — mark inactive rather than hard delete to preserve checkout history)
- **View student roster** for the selected period
- **Edit student info** (name correction, move between AM/PM)
- Students are unique per period (same student could theoretically be in both, but this is uncommon)

#### 5.3 Equipment Inventory

- **Add equipment items** with the following fields:
  - Item name (e.g., "Canon EOS R50", "Rode VideoMic GO II")
  - Category (e.g., Camera, Microphone, Tripod, Lighting, Memory Card, Lens, Accessory)
  - Total quantity in stock
  - Serial number or asset tag (optional, per unit)
  - Condition notes (optional)
- **Edit equipment** details (name, category, quantity, notes)
- **Remove equipment** (soft delete preferred)
- **View inventory list** showing: item name, category, total quantity, available quantity (total minus currently checked out), and condition
- **Search and filter** inventory by name or category

#### 5.4 Checkout System

- **Check out equipment:**
  - Select a student (from the active period roster)
  - Select one or more equipment items
  - Specify quantity for each item
  - System records the checkout timestamp automatically
  - Optional: teacher can add a note (e.g., "for podcast project")
- **Check in equipment:**
  - Select an active checkout record
  - Mark item(s) as returned
  - System records the check-in timestamp automatically
  - Optional: teacher can note condition on return (e.g., "lens cap missing")
- **Validation rules:**
  - Cannot check out more units than are currently available
  - Cannot check out to a student who is not on the active period roster
  - Cannot check in items that are not currently checked out

#### 5.5 Active Checkouts Dashboard

- **Real-time view** of all currently checked-out items for the selected period
- Displays: student name, item(s), quantity, checkout time, duration (how long ago)
- **Visual indicators:**
  - Items checked out for an extended time (e.g., > 1 class period) highlighted in warning color
  - Overdue items (if due-time feature is enabled) highlighted in red
- **Quick check-in** button directly from the dashboard
- Sort by student name, item, or checkout time

#### 5.6 Checkout History

- **Full log** of all past checkouts and check-ins
- Filterable by:
  - Date range
  - Student
  - Equipment item
  - Class period (AM/PM)
- Each record shows: student, item(s), quantity, checkout time, check-in time, duration, and any notes
- **Export** history to CSV (stretch goal)

---

### 6. Stretch Features (Post-MVP)

| Feature | Description |
|---|---|
| **Student self-checkout (kiosk mode)** | Students scan a barcode or enter their ID to check out equipment themselves |
| **Barcode/QR scanning** | Use device camera to scan equipment asset tags for faster checkout |
| **Due dates and reminders** | Set expected return times; show overdue alerts |
| **Damage reporting** | Students or teacher can flag damaged items with photos |
| **Usage analytics** | Charts showing most-used equipment, busiest checkout times, students with most checkouts |
| **Multi-teacher support** | Multiple teachers with separate classrooms on the same system |
| **Email/notification alerts** | Notify teacher when items are overdue |
| **CSV export of history** | Download checkout history as a spreadsheet |
| **Print-friendly reports** | Generate end-of-semester equipment usage reports |
| **Equipment reservation** | Students can reserve equipment for upcoming class periods |
| **Photo documentation** | Take a photo of equipment condition at checkout and check-in |

---

### 7. Technical Architecture

#### 7.1 Frontend

- **HTML / CSS / JavaScript** (vanilla JS for MVP; React optional if team prefers)
- Responsive design: works on desktop (primary), tablets, and phones
- Single-page application (SPA) feel with dynamic content updates
- No page reloads for checkout/check-in operations

#### 7.2 Backend (Supabase)

- **Database (PostgreSQL via Supabase):**
  - `students` table: id, name, student_id (optional), period (AM/PM), is_active, created_at
  - `equipment` table: id, name, category, total_quantity, serial_number (optional), condition_notes, is_active, created_at
  - `checkouts` table: id, student_id (FK), equipment_id (FK), quantity, checked_out_at, checked_in_at (null while active), notes, return_notes, period
- **Row Level Security (RLS):** Enabled on all tables; policies scoped to authenticated teacher
- **Supabase Auth:** Simple email/password login for the teacher (or magic link)
- **Supabase Realtime:** Subscribe to `checkouts` table for live dashboard updates (stretch)

#### 7.3 Environment and Config

- Supabase URL and anon key stored in `.env` (not committed)
- `.env.example` provided with placeholder values
- Supabase client initialized once in `js/supabase.js`

#### 7.4 Hosting

- Static files deployed to GitHub Pages, Netlify, or Vercel
- No server-side rendering required

---

### 8. Database Schema

```sql
-- Students table
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  student_id TEXT,
  period TEXT NOT NULL CHECK (period IN ('AM', 'PM')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Equipment table
CREATE TABLE equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 1 CHECK (total_quantity >= 0),
  serial_number TEXT,
  condition_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Checkouts table
CREATE TABLE checkouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  checked_out_at TIMESTAMPTZ DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  notes TEXT,
  return_notes TEXT,
  period TEXT NOT NULL CHECK (period IN ('AM', 'PM')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups on active checkouts
CREATE INDEX idx_checkouts_active ON checkouts (checked_in_at) WHERE checked_in_at IS NULL;
CREATE INDEX idx_checkouts_student ON checkouts (student_id);
CREATE INDEX idx_checkouts_equipment ON checkouts (equipment_id);
CREATE INDEX idx_students_period ON students (period) WHERE is_active = true;
```

---

### 9. UI / UX Requirements

#### 9.1 Layout

- **Top navigation bar:** App title, period selector (AM/PM toggle), user info/logout
- **Sidebar or tab navigation:** Dashboard, Students, Equipment, Checkout, History
- **Main content area:** Dynamic based on selected tab

#### 9.2 Key Screens

1. **Dashboard (home)**
   - Active checkouts for the selected period
   - Quick stats: items out, items available, students with checkouts
   - Quick check-in buttons

2. **Students**
   - Roster table for selected period
   - Add / edit / deactivate student
   - Search bar

3. **Equipment**
   - Inventory table with available vs. total counts
   - Add / edit / deactivate equipment
   - Filter by category
   - Search bar

4. **Checkout**
   - Step-by-step or form-based checkout flow:
     1. Select student (dropdown filtered by active period)
     2. Select equipment item(s) (shows only available)
     3. Set quantity
     4. Add optional note
     5. Confirm checkout

5. **History**
   - Paginated table of all checkout records
   - Filters: date range, student, item, period
   - Each row expandable to show full details and notes

#### 9.3 Design Principles

- **Clarity over decoration:** The teacher needs to move fast during class. Large buttons, clear labels, minimal clicks.
- **Color-coded status:** Green = available, Yellow = checked out, Red = overdue or low stock
- **Responsive:** Must work on the teacher's laptop and optionally on a tablet
- **Accessible:** Proper contrast, keyboard navigation, screen-reader-friendly labels
- **Fast:** All interactions should feel instant; no unnecessary loading spinners

---

### 10. Non-Functional Requirements

| Requirement | Target |
|---|---|
| **Page load time** | < 3 seconds on school network |
| **Browser support** | Chrome (latest), Firefox (latest), Edge (latest) |
| **Data persistence** | All data stored in Supabase; no data loss on browser close |
| **Offline behavior** | Graceful degradation: show cached data if offline, queue operations for sync (stretch) |
| **Security** | Supabase RLS, authenticated access only, no hardcoded secrets |
| **Accessibility** | WCAG 2.1 AA compliance for core flows |

---

### 11. Development Workflow

1. **Setup:**
   - Clone repo and open in VS Code
   - Copy `.env.example` to `.env` and fill in Supabase credentials
   - Open `index.html` with a local dev server (e.g., VS Code Live Server extension)

2. **Branching:**
   - Create feature branches from `main`
   - Follow `agents.md` rules for all generated content
   - Open PRs for review before merging

3. **Testing:**
   - Test all CRUD operations in the browser
   - Verify Supabase connectivity and RLS policies
   - Walk through the full checkout → check-in flow
   - Test with both AM and PM periods

4. **Deployment:**
   - Push to `main` triggers deployment to static hosting
   - Verify production Supabase credentials are set in hosting env vars

---

### 12. Milestones

| Milestone | Features | Target |
|---|---|---|
| **M1: Foundation** | Project setup, Supabase schema, auth, basic UI shell, period selector | Week 1 |
| **M2: Student Management** | Add/edit/remove students, roster display, period filtering | Week 2 |
| **M3: Equipment Inventory** | Add/edit/remove equipment, inventory display, available counts | Week 3 |
| **M4: Checkout System** | Checkout flow, check-in flow, validation, active checkouts dashboard | Week 4–5 |
| **M5: History and Polish** | Checkout history, filters, UI polish, accessibility pass, bug fixes | Week 6 |
| **M6: Stretch Features** | CSV export, analytics, kiosk mode (as time permits) | Week 7+ |

---

### 13. Open Questions

- Does the teacher want to track individual units (by serial number) or just quantities per item type?
- Should there be a "class set" concept (e.g., check out 15 tripods at once for a class activity)?
- Is there a maximum checkout duration that should trigger alerts?
- Will multiple teachers or rooms share the same Supabase project, or is it single-teacher only?
- Does the school have any data privacy requirements for student names/IDs?

---

### 14. References

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [VS Code Live Server Extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
- `agents.md` — Generated content policy for this repository