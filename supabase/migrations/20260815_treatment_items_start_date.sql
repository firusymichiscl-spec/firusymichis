-- ============================================================
-- MIGRACIÓN: treatment_items — límite de fecha de inicio (Lote M2, Feature 1.3)
-- Fecha: 2026-08-15
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets ni de treatment_items.
-- ============================================================

-- El cliente ya limita start_date con min/max en los <input type="date">
-- (AITab.jsx al guardar una receta, DashboardClient.jsx al editar un
-- medicamento) y valida de nuevo en JS antes de guardar — pero eso es
-- evitable con una llamada directa a la API de Supabase, igual que
-- dose_log_check_not_future (Lote L2, Fix 1). Mismo patrón: trigger
-- BEFORE INSERT OR UPDATE, no un CHECK (start_date es una columna `date`
-- fija por fila, pero el LÍMITE contra el que se compara (current_date)
-- avanza día a día — current_date es tan no-inmutable como now(), así que
-- aplica la misma restricción de Postgres: "functions in check constraint
-- must be marked IMMUTABLE". Se usa trigger por la misma razón real.
create or replace function public.treatment_items_check_start_date()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.start_date is not null then
    if new.start_date > current_date then
      raise exception 'La fecha de inicio no puede ser posterior a hoy (start_date: %, hoy: %)', new.start_date, current_date;
    end if;
    if new.start_date < current_date - 30 then
      raise exception 'La fecha de inicio no puede ser anterior a 30 días atrás (start_date: %, límite: %)', new.start_date, current_date - 30;
    end if;
  end if;
  return new;
end;
$$;

-- Igual que dose_log_check_not_future: sin este revoke, Postgres le otorga
-- EXECUTE a PUBLIC (incluye anon) por defecto al crear la función.
revoke execute on function public.treatment_items_check_start_date() from anon;

drop trigger if exists treatment_items_check_start_date on treatment_items;
create trigger treatment_items_check_start_date
  before insert or update on treatment_items
  for each row execute function public.treatment_items_check_start_date();
