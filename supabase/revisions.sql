-- One-step undo: snapshot stored before each reservation update or delete.
-- Run in Supabase SQL Editor after reservations.sql and auth.sql.

create table if not exists public.reservation_revisions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  action text not null check (action in ('update', 'delete')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists reservation_revisions_res_id_idx
  on public.reservation_revisions (reservation_id, created_at desc);

alter table public.reservation_revisions enable row level security;

drop policy if exists "authenticated read reservation_revisions" on public.reservation_revisions;
create policy "authenticated read reservation_revisions"
  on public.reservation_revisions for select
  to authenticated
  using (true);

drop policy if exists "authenticated write reservation_revisions" on public.reservation_revisions;
create policy "authenticated write reservation_revisions"
  on public.reservation_revisions for all
  to authenticated
  using (true) with check (true);
