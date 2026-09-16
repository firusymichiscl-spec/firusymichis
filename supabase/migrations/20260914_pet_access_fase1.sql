-- Fase 1 (retroactiva) — Cuentas multi-usuario por mascota: modelo de
-- datos + invitación del tutor suplente. NO modifica la tabla `pets`
-- ni su política RLS — se apoya en una función SECURITY DEFINER
-- (mismo patrón ya usado para Storage con public.user_owns_pet) para
-- evitar el problema de política recursiva que ya tuvimos una vez.

create table if not exists public.pet_access (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  email        text not null,
  status       text not null default 'pending',
  role         text not null default 'secondary',
  invited_by   uuid not null references auth.users(id),
  invite_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  unique (pet_id, email)
);

alter table public.pet_access enable row level security;

create or replace function public.user_owns_pet_uuid(p_pet_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.pets where id = p_pet_id and user_id = auth.uid()
  );
$$;

drop policy if exists "pet_access_select" on public.pet_access;
create policy "pet_access_select"
  on public.pet_access
  for select
  to authenticated
  using (
    invited_by = auth.uid()
    or user_id = auth.uid()
    or email = auth.jwt()->>'email'
  );

drop policy if exists "pet_access_insert" on public.pet_access;
create policy "pet_access_insert"
  on public.pet_access
  for insert
  to authenticated
  with check (
    invited_by = auth.uid()
    and public.user_owns_pet_uuid(pet_id)
  );

drop policy if exists "pet_access_update" on public.pet_access;
create policy "pet_access_update"
  on public.pet_access
  for update
  to authenticated
  using (invited_by = auth.uid() or email = auth.jwt()->>'email')
  with check (invited_by = auth.uid() or email = auth.jwt()->>'email');

drop policy if exists "pet_access_delete" on public.pet_access;
create policy "pet_access_delete"
  on public.pet_access
  for delete
  to authenticated
  using (invited_by = auth.uid());

grant select, insert, update, delete on public.pet_access to authenticated;
grant all on public.pet_access to service_role;
