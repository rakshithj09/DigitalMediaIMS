alter table public.checkouts
  add column if not exists due_at timestamptz;

create index if not exists idx_checkouts_due_at_active
  on public.checkouts (due_at)
  where checked_in_at is null;
