-- Append-only edit history for reservations by default.
-- Admins may delete entries to reclaim storage (see delete policy below).
-- Run after reservations.sql, roles.sql, and audit.sql.
--
-- Snapshot semantics:
--   create  → state after creation
--   update  → state before the change (what was replaced)
--   delete  → state before deletion

create table if not exists public.reservation_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  snapshot jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_by_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists reservation_history_res_id_idx
  on public.reservation_history (reservation_id, created_at desc);

alter table public.reservation_history enable row level security;

drop policy if exists "staff read reservation_history" on public.reservation_history;
create policy "staff read reservation_history"
  on public.reservation_history for select
  to authenticated
  using (public.is_staff_or_admin());

drop policy if exists "staff insert reservation_history" on public.reservation_history;
create policy "staff insert reservation_history"
  on public.reservation_history for insert
  to authenticated
  with check (public.is_staff_or_admin());

-- History is immutable for staff; admins may delete to free storage.

drop policy if exists "admin delete reservation_history" on public.reservation_history;
create policy "admin delete reservation_history"
  on public.reservation_history for delete
  to authenticated
  using (public.is_admin());

-- Realtime: refresh history log when new entries are appended.
alter table public.reservation_history replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.reservation_history;
exception
  when duplicate_object then null;
end $$;
