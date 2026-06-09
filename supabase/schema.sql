-- Coto Queen — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run

-- Per-room settings (names/descriptions stay in the frontend i18n files)
create table if not exists public.room_settings (
  room_id integer primary key,
  capacity integer not null check (capacity >= 1),
  weekday_price bigint not null check (weekday_price >= 0),
  weekend_price bigint not null check (weekend_price >= 0),
  extra_adult_weekday_price bigint not null check (extra_adult_weekday_price >= 0),
  extra_adult_weekend_price bigint not null check (extra_adult_weekend_price >= 0),
  extra_child_weekday_price bigint not null check (extra_child_weekday_price >= 0),
  extra_child_weekend_price bigint not null check (extra_child_weekend_price >= 0),
  updated_at timestamptz not null default now()
);

-- Single-row app settings (weekend day numbers: 0 = Sunday … 6 = Saturday)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed default rooms (matches src/data/rooms.ts)
insert into public.room_settings (
  room_id, capacity,
  weekday_price, weekend_price,
  extra_adult_weekday_price, extra_adult_weekend_price,
  extra_child_weekday_price, extra_child_weekend_price
) values
  (1, 4, 1000000, 1400000, 200000, 280000, 100000, 140000),
  (2, 2,  800000, 1100000, 150000, 200000,  80000, 110000),
  (3, 6, 1600000, 2000000, 200000, 250000, 100000, 125000)
on conflict (room_id) do nothing;

insert into public.app_settings (key, value)
values ('weekend_days', '[5, 6, 0]')
on conflict (key) do nothing;

-- Row Level Security.
-- The site currently lets anyone edit prices (no login), so the anon key
-- gets read + write. When you add auth later, replace the write policies
-- with ones that check the user's role.
alter table public.room_settings enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "public read room_settings" on public.room_settings;
create policy "public read room_settings"
  on public.room_settings for select using (true);

drop policy if exists "public write room_settings" on public.room_settings;
create policy "public write room_settings"
  on public.room_settings for all using (true) with check (true);

drop policy if exists "public read app_settings" on public.app_settings;
create policy "public read app_settings"
  on public.app_settings for select using (true);

drop policy if exists "public write app_settings" on public.app_settings;
create policy "public write app_settings"
  on public.app_settings for all using (true) with check (true);
