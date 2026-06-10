-- Coto Queen — reservations with per-room check-in/check-out dates
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run
-- Safe to run no matter which earlier scripts you applied: it creates the
-- final schema on fresh projects, upgrades the older reservations schema,
-- and migrates rows from the original `bookings` table if it still exists.

-- 1. Base tables (final schema)
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  guest_phone text not null default '',
  guests integer not null default 1 check (guests >= 1),
  notes text not null default '',
  guest_color text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_rooms (
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  room_unit_id text not null,
  check_in date,
  check_out date,
  primary key (reservation_id, room_unit_id)
);

-- 2. Upgrade the older schema (dates stored on the reservation) to per-room dates
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reservation_rooms'
      and column_name = 'check_in'
  ) then
    alter table public.reservation_rooms add column check_in date;
    alter table public.reservation_rooms add column check_out date;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reservations'
      and column_name = 'check_in'
  ) then
    update public.reservation_rooms rr
    set check_in = r.check_in, check_out = r.check_out
    from public.reservations r
    where rr.reservation_id = r.id and rr.check_in is null;

    alter table public.reservations drop column check_in;
    alter table public.reservations drop column check_out;
  end if;
end $$;

-- 3. Migrate rows from the original single-room `bookings` table, if present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'bookings'
  ) then
    insert into public.reservations (id, guest_name, guest_phone, guests, notes)
    select id, guest_name, guest_phone, guests, notes
    from public.bookings
    on conflict (id) do nothing;

    insert into public.reservation_rooms (reservation_id, room_unit_id, check_in, check_out)
    select id, room_unit_id, check_in, check_out
    from public.bookings
    on conflict do nothing;

    drop table public.bookings;
  end if;
end $$;

-- 4. Per-customer calendar color (user-chosen; empty = app picks a unique fallback)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reservations'
      and column_name = 'guest_color'
  ) then
    alter table public.reservations add column guest_color text not null default '';
  end if;
end $$;

-- 5. Enforce dates now that all rows are backfilled
alter table public.reservation_rooms alter column check_in set not null;
alter table public.reservation_rooms alter column check_out set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rr_check_out_after_check_in'
  ) then
    alter table public.reservation_rooms
      add constraint rr_check_out_after_check_in check (check_out > check_in);
  end if;
end $$;

create index if not exists reservation_rooms_unit_idx on public.reservation_rooms (room_unit_id);
create index if not exists reservation_rooms_check_in_idx on public.reservation_rooms (check_in);

-- 6. Same open policies as the other tables (no login yet)
alter table public.reservations enable row level security;
alter table public.reservation_rooms enable row level security;

drop policy if exists "public read reservations" on public.reservations;
create policy "public read reservations"
  on public.reservations for select using (true);

drop policy if exists "public write reservations" on public.reservations;
create policy "public write reservations"
  on public.reservations for all using (true) with check (true);

drop policy if exists "public read reservation_rooms" on public.reservation_rooms;
create policy "public read reservation_rooms"
  on public.reservation_rooms for select using (true);

drop policy if exists "public write reservation_rooms" on public.reservation_rooms;
create policy "public write reservation_rooms"
  on public.reservation_rooms for all using (true) with check (true);
