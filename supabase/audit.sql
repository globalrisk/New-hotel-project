-- Track who created or last updated each reservation.
-- Run after reservations.sql and roles.sql.

alter table public.reservations
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.reservations
  add column if not exists created_by_email text not null default '';

alter table public.reservations
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table public.reservations
  add column if not exists updated_by_email text not null default '';

-- Backfill empty email default for existing rows (imports / legacy data).
update public.reservations
set created_by_email = ''
where created_by_email is null;
