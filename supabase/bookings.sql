-- Coto Queen — bookings table
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_unit_id text not null,
  guest_name text not null,
  guest_phone text not null default '',
  guests integer not null default 1 check (guests >= 1),
  notes text not null default '',
  check_in date not null,
  check_out date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_out_after_check_in check (check_out > check_in)
);

create index if not exists bookings_room_unit_idx on public.bookings (room_unit_id);
create index if not exists bookings_check_in_idx on public.bookings (check_in);

-- Same open policy as the price tables (no login yet).
-- Tighten these when you add admin authentication.
alter table public.bookings enable row level security;

drop policy if exists "public read bookings" on public.bookings;
create policy "public read bookings"
  on public.bookings for select using (true);

drop policy if exists "public write bookings" on public.bookings;
create policy "public write bookings"
  on public.bookings for all using (true) with check (true);
