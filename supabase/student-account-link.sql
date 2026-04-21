alter table public.students
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text;

create unique index if not exists students_user_id_unique
  on public.students (user_id)
  where user_id is not null;

create index if not exists idx_students_user_id_active
  on public.students (user_id)
  where is_active = true;
