-- ============================================================
-- MIGRACIÓN: dose_log — bloquear dosis futuras (Lote L2, Fix 1)
-- Fecha: 2026-08-15
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets ni de dose_log.
-- ============================================================

-- El cliente ya bloquea marcar una dosis futura (botón deshabilitado en
-- las 3 vistas), pero eso es evitable con una llamada directa a la API de
-- Supabase — esta es la garantía real.
--
-- NO se puede usar un CHECK (scheduled_at <= now()): las restricciones
-- CHECK deben ser inmutables y now() no lo es — Postgres rechaza el
-- ALTER TABLE con "functions in check constraint must be marked
-- IMMUTABLE". La forma correcta de validar contra el reloj del servidor
-- al momento de la escritura es un trigger BEFORE INSERT OR UPDATE.
--
-- Margen de 1 minuto: evita falsos rechazos por desfase de reloj entre
-- el cliente (que arma scheduled_at) y el servidor de Postgres.
create or replace function public.dose_log_check_not_future()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.scheduled_at > now() + interval '1 minute' then
    raise exception 'No se puede registrar una dosis futura: scheduled_at (%) es posterior a la hora actual del servidor (%)', new.scheduled_at, now();
  end if;
  return new;
end;
$$;

-- Igual que increment_ai_usage (Lote H4): sin este revoke, Postgres le
-- otorga EXECUTE a PUBLIC (incluye anon) por defecto al crear la función.
revoke execute on function public.dose_log_check_not_future() from anon;

drop trigger if exists dose_log_no_future on dose_log;
create trigger dose_log_no_future
  before insert or update on dose_log
  for each row execute function public.dose_log_check_not_future();
