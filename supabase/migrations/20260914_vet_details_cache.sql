-- Lote (fecha 2026-09-14) — caché de teléfono/web de veterinarias
-- (Google Place Details), para no pagarle a Google por la misma
-- clínica en cada búsqueda de cualquier usuario.

create table if not exists public.vet_details_cache (
  place_id   text primary key,
  phone      text,
  website    text,
  fetched_at timestamptz not null default now()
);

alter table public.vet_details_cache enable row level security;

drop policy if exists "vet_details_cache_all_authenticated" on public.vet_details_cache;
create policy "vet_details_cache_all_authenticated"
  on public.vet_details_cache
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update on public.vet_details_cache to authenticated;
grant all on public.vet_details_cache to service_role;
