-- Prevent double-booking the same room on overlapping dates.
-- Run after reservations.sql, roles.sql, and audit.sql.
--
-- 1) Server-side overlap lookup (used by the app before insert/update)
-- 2) DB exclusion constraint (final safety net for concurrent saves)
-- 3) Realtime so calendars refresh when anyone saves

create extension if not exists btree_gist;

-- Returns the first conflicting stay for a room + date range, if any.
create or replace function public.find_reservation_room_overlap(
  p_room_unit_id text,
  p_check_in date,
  p_check_out date,
  p_exclude_reservation_id uuid default null
)
returns table (
  reservation_id uuid,
  guest_name text,
  check_in date,
  check_out date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.guest_name,
    rr.check_in,
    rr.check_out
  from public.reservation_rooms rr
  inner join public.reservations r on r.id = rr.reservation_id
  where rr.room_unit_id = p_room_unit_id
    and (p_exclude_reservation_id is null or rr.reservation_id <> p_exclude_reservation_id)
    and daterange(rr.check_in, rr.check_out, '[)')
        && daterange(p_check_in, p_check_out, '[)')
  limit 1;
$$;

revoke all on function public.find_reservation_room_overlap(text, date, date, uuid)
  from public;
grant execute on function public.find_reservation_room_overlap(text, date, date, uuid)
  to authenticated;

-- No two stays on the same room may overlap (check_in inclusive, check_out exclusive).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservation_rooms_no_overlap'
  ) then
    alter table public.reservation_rooms
      add constraint reservation_rooms_no_overlap
      exclude using gist (
        room_unit_id with =,
        daterange(check_in, check_out, '[)') with &&
      );
  end if;
end $$;

-- Realtime: refresh calendars when reservations change.
alter table public.reservations replica identity full;
alter table public.reservation_rooms replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.reservations;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reservation_rooms;
exception
  when duplicate_object then null;
end $$;
