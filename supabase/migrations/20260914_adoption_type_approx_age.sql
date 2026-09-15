-- Lote (fecha 2026-09-14) — tipo de adopción (adoptada/rescatada) y
-- edad aproximada estimada por veterinario cuando no se sabe la fecha
-- de nacimiento exacta.

alter table public.pets
  add column if not exists adoption_type text,
  add column if not exists birth_date_approximate boolean not null default false,
  add column if not exists approximate_age_years numeric;

alter table public.pets
  drop constraint if exists pets_adoption_type_check;
alter table public.pets
  add constraint pets_adoption_type_check
  check (adoption_type is null or adoption_type in ('adoptada', 'rescatada'));

alter table public.pets
  drop constraint if exists pets_adoption_type_requires_flag;
alter table public.pets
  add constraint pets_adoption_type_requires_flag
  check (adoption_type is null or is_adopted);
