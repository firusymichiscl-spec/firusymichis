-- Lote (fecha 2026-09-14) — arregla el alta de cuentas nuevas: pets.user_id
-- referencia public.users, pero no existía ningún trigger que creara esa
-- fila al registrarse (solo había uno para `profiles`). Por eso ninguna
-- cuenta nueva podía crear su primera mascota (FK violation 23503).
--
-- NOTA: la tabla public.users (id uuid PK, full_name text, phone text,
-- plan text default 'free', created_at timestamptz default now()) ya
-- existe en la base de datos desde antes de este repo empezar a trackear
-- migraciones — no se crea acá porque ya está en producción.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.users (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.users (id, full_name)
select id, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')
from auth.users
on conflict (id) do nothing;
