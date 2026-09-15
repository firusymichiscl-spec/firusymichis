-- Lote (fecha 2026-09-14) — campos de adopción en la ficha de mascota.

alter table public.pets
  add column if not exists is_adopted boolean not null default false,
  add column if not exists adopted_date date;

alter table public.pets
  drop constraint if exists pets_adopted_date_requires_flag;
alter table public.pets
  add constraint pets_adopted_date_requires_flag
  check (is_adopted or adopted_date is null);
