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
