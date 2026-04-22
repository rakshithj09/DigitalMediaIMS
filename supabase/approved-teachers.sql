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
