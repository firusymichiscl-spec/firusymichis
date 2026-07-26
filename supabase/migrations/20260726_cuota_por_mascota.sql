-- ============================================================
-- MIGRACIÓN: cuota de IA por mascota (Lote H4)
-- Fecha: 2026-07-26
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets (solo se agrega una FK de lectura).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. pet_id EN ai_usage
-- ════════════════════════════════════════════════════════════

alter table ai_usage
  add column if not exists pet_id uuid null references pets(id) on delete cascade;

-- La PK original era (user_id, fecha, tipo). La reemplazamos por un id
-- autoincremental + un índice único que incluye pet_id, para poder tener
-- una fila por (usuario, fecha, tipo, mascota) además de la fila general
-- por usuario (pet_id NULL = cuota histórica / lector de recetas, que no
-- tiene límite por mascota).
alter table ai_usage drop constraint if exists ai_usage_pkey;

alter table ai_usage
  add column if not exists id bigint generated always as identity primary key;

-- COALESCE con un UUID centinela porque en un índice único de Postgres dos
-- NULL nunca se consideran iguales: sin el COALESCE, cada fila con
-- pet_id NULL del mismo (user_id, fecha, tipo) sería "distinta" y el
-- ON CONFLICT de increment_ai_usage dejaría de detectar duplicados,
-- rompiendo el conteo diario para tipos sin mascota (ej. "recipe").
create unique index if not exists idx_ai_usage_unico
  on ai_usage (user_id, fecha, tipo, coalesce(pet_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Para las sumas de la ventana semanal por mascota (últimos 7 días).
create index if not exists idx_ai_usage_pet_fecha
  on ai_usage (pet_id, tipo, fecha desc);

-- ════════════════════════════════════════════════════════════
-- 2. increment_ai_usage ahora recibe pet_id (opcional)
-- ════════════════════════════════════════════════════════════

create or replace function increment_ai_usage(p_user_id uuid, p_tipo text, p_pet_id uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare new_count int;
begin
  insert into ai_usage (user_id, fecha, tipo, pet_id, count)
  values (p_user_id, current_date, p_tipo, p_pet_id, 1)
  on conflict (user_id, fecha, tipo, coalesce(pet_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set count = ai_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke execute on function increment_ai_usage(uuid, text, uuid) from anon;
grant execute on function increment_ai_usage(uuid, text, uuid) to authenticated;

-- El cliente (AITab) necesita poder LEER sus propias filas de ai_usage
-- directamente (sin RPC) para mostrar "Consultas disponibles hoy: X de Y"
-- antes de enviar. La policy "ai_usage_select_own" ya existe desde la
-- migración 20260610_seguridad_cuotas.sql; solo confirmamos el GRANT.
grant select on ai_usage to authenticated;
grant select, insert, update on ai_usage to service_role;

-- ════════════════════════════════════════════════════════════
-- 3. (OPCIONAL / ALTERNATIVA) Tiempo de respuesta — Feature 4
-- ════════════════════════════════════════════════════════════
-- No se ejecuta ni se requiere si se usa la tabla activity_log existente
-- (vía el RPC log_activity ya disponible, ver lib/activityLog.js): esa
-- opción no necesita ninguna migración. Se deja este SQL solo por si en
-- el futuro se quiere análisis numérico agregado (promedios, percentiles)
-- que un campo de texto en activity_log no puede dar bien.
--
-- Nota: NO se agrega la columna a ai_usage porque esa tabla es una cuenta
-- agregada por día (una fila = N consultas de ese día), así que un solo
-- "tiempo_ms" por fila no representaría a todas las consultas del día.
-- Una tabla nueva de grano fino (una fila por consulta) es más simple y
-- correcta.

-- create table if not exists ai_response_log (
--   id         bigint      generated always as identity primary key,
--   user_id    uuid        not null references auth.users(id) on delete cascade,
--   pet_id     uuid        null references pets(id) on delete cascade,
--   tipo       text        not null,
--   tiempo_ms  int         not null,
--   created_at timestamptz not null default now()
-- );
--
-- alter table ai_response_log enable row level security;
--
-- drop policy if exists "ai_response_log_select_own" on ai_response_log;
-- create policy "ai_response_log_select_own" on ai_response_log
--   for select using (auth.uid() = user_id);
-- -- escrituras solo vía service role, igual que ai_usage
