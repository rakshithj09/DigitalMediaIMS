-- Run this file in Supabase SQL Editor to apply the schema updates
-- required by the current app code.

-- 1. Link student roster rows to Auth users
alter table public.students
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text;

create unique index if not exists students_user_id_unique
  on public.students (user_id)
  where user_id is not null;

create index if not exists idx_students_user_id_active
  on public.students (user_id)
  where is_active = true;

-- 2. Student self-signup approval flow
create table if not exists public.student_approval_requests (
  user_id uuid primary key,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  student_id text not null,
  period text not null check (period in ('AM', 'PM')),
  requested_at timestamptz not null default timezone('utc', now()),
  email_verified_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  roster_student_id uuid
);

alter table public.student_approval_requests enable row level security;

revoke all on public.student_approval_requests from anon, authenticated;

create index if not exists student_approval_requests_requested_at_idx
  on public.student_approval_requests(requested_at desc);

create index if not exists student_approval_requests_email_verified_at_idx
  on public.student_approval_requests(email_verified_at);

create index if not exists student_approval_requests_approved_at_idx
  on public.student_approval_requests(approved_at);

-- 3. Teacher self-signup allow-list
create table if not exists public.approved_teachers (
  email text primary key,
  invited_by uuid references auth.users(id) on delete set null,
  approved_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.approved_teachers enable row level security;

revoke all on public.approved_teachers from anon, authenticated;

create index if not exists approved_teachers_invited_by_idx
  on public.approved_teachers(invited_by);

create index if not exists approved_teachers_used_at_idx
  on public.approved_teachers(used_at);

-- 4. Serialized checkout support
alter table public.checkouts
  add column if not exists serial_number text;

create index if not exists checkouts_active_serial_number_idx
  on public.checkouts (equipment_id, serial_number)
  where checked_in_at is null and serial_number is not null;

-- 5. Checkout due-date support
alter table public.checkouts
  add column if not exists due_at timestamptz;

create index if not exists idx_checkouts_due_at_active
  on public.checkouts (due_at)
  where checked_in_at is null;
