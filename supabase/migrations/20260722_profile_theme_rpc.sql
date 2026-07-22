-- ============================================================
-- MIGRACIÓN: RPC segura para guardar el tema del usuario
-- Fecha: 2026-07-22
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- ============================================================
--
-- Contexto (ver 20260610_seguridad_cuotas.sql líneas 27-28):
-- profiles tiene RLS activo con SOLO política de SELECT propia.
-- A propósito NO existe política de INSERT/UPDATE para usuarios,
-- para que nadie pueda auto-asignarse "plan"/"plan_expires_at".
-- Por eso app/api/profile/theme/route.js (cliente autenticado con
-- anon key, no service role) nunca pudo escribir ahí: sus UPDATE/
-- UPSERT eran bloqueados en silencio por RLS (0 filas afectadas,
-- sin error), así que el tema jamás quedaba guardado y al recargar
-- volvía a "clasico".
--
-- Esta función SECURITY DEFINER abre una vía angosta: el usuario
-- solo puede escribir su propio theme/theme_custom_color, nunca
-- plan ni plan_expires_at.

alter table profiles add column if not exists theme text default 'clasico';
alter table profiles add column if not exists theme_custom_color text;

create or replace function public.set_profile_theme(p_theme text, p_theme_custom_color text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_theme not in ('clasico','canino','felino','nocturno','primavera','bosque','conejito','oceano','custom') then
    raise exception 'invalid theme: %', p_theme;
  end if;

  insert into public.profiles (id, theme, theme_custom_color)
  values (auth.uid(), p_theme, case when p_theme = 'custom' then p_theme_custom_color else null end)
  on conflict (id) do update
    set theme = excluded.theme,
        theme_custom_color = excluded.theme_custom_color;
end;
$$;

grant execute on function public.set_profile_theme(text, text) to authenticated;
