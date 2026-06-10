-- Authenticated admin access (run after creating a user in Supabase Auth).
-- Public site keeps read access to prices; writes require a logged-in session.

-- room_settings: public read, authenticated write
drop policy if exists "public write room_settings" on public.room_settings;
create policy "authenticated write room_settings"
  on public.room_settings for all
  to authenticated
  using (true) with check (true);

-- app_settings: public read, authenticated write
drop policy if exists "public write app_settings" on public.app_settings;
create policy "authenticated write app_settings"
  on public.app_settings for all
  to authenticated
  using (true) with check (true);

-- reservations: authenticated read + write only
drop policy if exists "public read reservations" on public.reservations;
drop policy if exists "public write reservations" on public.reservations;
create policy "authenticated read reservations"
  on public.reservations for select
  to authenticated
  using (true);
create policy "authenticated write reservations"
  on public.reservations for all
  to authenticated
  using (true) with check (true);

-- reservation_rooms: authenticated read + write only
drop policy if exists "public read reservation_rooms" on public.reservation_rooms;
drop policy if exists "public write reservation_rooms" on public.reservation_rooms;
create policy "authenticated read reservation_rooms"
  on public.reservation_rooms for select
  to authenticated
  using (true);
create policy "authenticated write reservation_rooms"
  on public.reservation_rooms for all
  to authenticated
  using (true) with check (true);
