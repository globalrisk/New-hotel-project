-- Role-based access: admin (full) vs staff (read + insert only).
-- Run in Supabase SQL Editor after reservations.sql, auth.sql, and revisions.sql.
--
-- After running, grant yourself admin (replace the email):
--
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'you@example.com'
--   on conflict (user_id) do update set role = excluded.role;
--
-- Add staff accounts:
--
--   insert into public.user_roles (user_id, role)
--   select id, 'staff' from auth.users where email = 'staff@example.com'
--   on conflict (user_id) do update set role = excluded.role;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff')
  );
$$;

drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "admin manage roles" on public.user_roles;
create policy "admin manage roles"
  on public.user_roles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- room_settings / app_settings: admin-only writes (public read unchanged in schema.sql)
drop policy if exists "authenticated write room_settings" on public.room_settings;
drop policy if exists "admin write room_settings" on public.room_settings;
create policy "admin write room_settings"
  on public.room_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "authenticated write app_settings" on public.app_settings;
drop policy if exists "admin write app_settings" on public.app_settings;
create policy "admin write app_settings"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- reservations: staff read + insert; admin update + delete
drop policy if exists "authenticated read reservations" on public.reservations;
drop policy if exists "staff read reservations" on public.reservations;
create policy "staff read reservations"
  on public.reservations for select
  to authenticated
  using (public.is_staff_or_admin());

drop policy if exists "authenticated write reservations" on public.reservations;
drop policy if exists "staff insert reservations" on public.reservations;
drop policy if exists "admin update reservations" on public.reservations;
drop policy if exists "admin delete reservations" on public.reservations;

create policy "staff insert reservations"
  on public.reservations for insert
  to authenticated
  with check (public.is_staff_or_admin());

create policy "admin update reservations"
  on public.reservations for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin delete reservations"
  on public.reservations for delete
  to authenticated
  using (public.is_admin());

-- reservation_rooms: same pattern
drop policy if exists "authenticated read reservation_rooms" on public.reservation_rooms;
drop policy if exists "staff read reservation_rooms" on public.reservation_rooms;
create policy "staff read reservation_rooms"
  on public.reservation_rooms for select
  to authenticated
  using (public.is_staff_or_admin());

drop policy if exists "authenticated write reservation_rooms" on public.reservation_rooms;
drop policy if exists "staff insert reservation_rooms" on public.reservation_rooms;
drop policy if exists "admin update reservation_rooms" on public.reservation_rooms;
drop policy if exists "admin delete reservation_rooms" on public.reservation_rooms;

create policy "staff insert reservation_rooms"
  on public.reservation_rooms for insert
  to authenticated
  with check (public.is_staff_or_admin());

create policy "admin update reservation_rooms"
  on public.reservation_rooms for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin delete reservation_rooms"
  on public.reservation_rooms for delete
  to authenticated
  using (public.is_admin());

-- reservation_revisions: admin only (undo)
drop policy if exists "authenticated read reservation_revisions" on public.reservation_revisions;
drop policy if exists "admin read reservation_revisions" on public.reservation_revisions;
create policy "admin read reservation_revisions"
  on public.reservation_revisions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "authenticated write reservation_revisions" on public.reservation_revisions;
drop policy if exists "admin write reservation_revisions" on public.reservation_revisions;
create policy "admin write reservation_revisions"
  on public.reservation_revisions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
