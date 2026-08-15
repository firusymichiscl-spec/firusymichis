-- ============================================================
-- MIGRACIÓN: profiles.dose_view_pref — vista preferida (Lote M, Feature 2)
-- Fecha: 2026-08-15
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets.
-- ============================================================

-- profiles solo tiene política RLS de SELECT propia (a propósito, ver
-- 20260610_seguridad_cuotas.sql) — un UPDATE directo con el cliente
-- anon-key queda bloqueado en silencio por RLS. Mismo patrón que
-- set_profile_theme (20260722_profile_theme_rpc.sql): RPC SECURITY
-- DEFINER que solo puede tocar esta columna, y solo en la fila propia
-- (auth.uid()).
alter table profiles add column if not exists dose_view_pref text null
  check (dose_view_pref in ('hoy','semana','fases'));

create or replace function public.set_profile_dose_view(p_dose_view_pref text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_dose_view_pref is not null and p_dose_view_pref not in ('hoy','semana','fases') then
    raise exception 'invalid dose_view_pref: %', p_dose_view_pref;
  end if;

  insert into public.profiles (id, dose_view_pref)
  values (auth.uid(), p_dose_view_pref)
  on conflict (id) do update
    set dose_view_pref = excluded.dose_view_pref;
end;
$$;

-- Igual que dose_log_check_not_future (Lote L2): sin este revoke, Postgres
-- le otorga EXECUTE a PUBLIC (incluye anon) por defecto al crear la función.
revoke execute on function public.set_profile_dose_view(text) from anon;
grant execute on function public.set_profile_dose_view(text) to authenticated;
