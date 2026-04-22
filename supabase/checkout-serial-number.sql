alter table public.checkouts
  add column if not exists serial_number text;

create index if not exists checkouts_active_serial_number_idx
  on public.checkouts (equipment_id, serial_number)
  where checked_in_at is null and serial_number is not null;
