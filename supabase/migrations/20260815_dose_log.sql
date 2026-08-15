-- ============================================================
-- MIGRACIÓN: dose_log — registro real de dosis (Lote L)
-- Fecha: 2026-08-15
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets (solo se agrega una FK de lectura,
-- igual que treatments/treatment_items).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. TABLA dose_log
-- ════════════════════════════════════════════════════════════
-- Diseño clave: "sin registro" = NO existe fila. Solo se inserta cuando
-- el usuario marca algo (dada/omitida). Esto evita pre-generar miles de
-- filas para cada dosis futura de cada tratamiento, y deja explícita la
-- diferencia entre "omitida" (el usuario dijo que no se dio) y "sin
-- registro" (nunca se supo) — ambos casos NO deben confundirse en el
-- cálculo de adherencia (Feature 3).
--
-- treatment_item_id / medication_id son ambos nullable y mutuamente
-- exclusivos en la práctica: una fila registra la dosis de un
-- treatment_item (tratamiento prescrito, con start_date/start_time/
-- frequency propios) O de un medication (medicamento habitual). Hoy
-- (Lote L) solo se usa treatment_item_id — la tabla `medications` no
-- tiene columnas de horario (start_date/start_time/duration), así que
-- no hay de dónde derivar un "scheduled_at" para medicamentos habituales
-- todavía. Se deja medication_id ya listo para cuando eso exista, en vez
-- de tener que migrar el esquema de nuevo.
create table if not exists dose_log (
  id                bigint      generated always as identity primary key,
  pet_id            uuid        not null references pets(id) on delete cascade,
  treatment_item_id uuid        null references treatment_items(id) on delete cascade,
  medication_id     uuid        null references medications(id) on delete cascade,
  scheduled_at      timestamptz not null,
  status            text        not null check (status in ('dada', 'omitida')),
  marked_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint dose_log_one_source check (
    (treatment_item_id is not null and medication_id is null) or
    (treatment_item_id is null and medication_id is not null)
  )
);

-- Evita duplicados de la misma dosis (mismo ítem, mismo horario). Con
-- COALESCE al mismo patrón que idx_ai_usage_unico (Lote H4): dos NULL
-- nunca son "iguales" en un índice único de Postgres, así que sin el
-- COALESCE se podrían insertar dos filas para la misma dosis de
-- medication_id si treatment_item_id es NULL en ambas.
create unique index if not exists idx_dose_log_unico
  on dose_log (
    coalesce(treatment_item_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(medication_id, '00000000-0000-0000-0000-000000000000'::uuid),
    scheduled_at
  );

-- Consultas por mascota + rango de fechas (vista Semana, adherencia,
-- backfill de dosis atrasadas).
create index if not exists idx_dose_log_pet_scheduled
  on dose_log (pet_id, scheduled_at desc);

-- Consultas por tratamiento (vista Hoy/Fases de un treatment_item puntual).
create index if not exists idx_dose_log_treatment_item
  on dose_log (treatment_item_id, scheduled_at desc)
  where treatment_item_id is not null;

-- ════════════════════════════════════════════════════════════
-- 2. RLS — mismo patrón que treatments/treatment_items:
--    la tabla no tiene user_id directo, el dueño se verifica
--    a través de pets.user_id. Consulta cruzada normal, NO
--    modifica ni toca las políticas de la tabla pets.
-- ════════════════════════════════════════════════════════════
alter table dose_log enable row level security;

drop policy if exists "dose_log_select_own" on dose_log;
create policy "dose_log_select_own" on dose_log
  for select using (
    exists (
      select 1 from pets
      where pets.id = dose_log.pet_id
        and pets.user_id = auth.uid()
    )
  );

drop policy if exists "dose_log_insert_own" on dose_log;
create policy "dose_log_insert_own" on dose_log
  for insert with check (
    exists (
      select 1 from pets
      where pets.id = dose_log.pet_id
        and pets.user_id = auth.uid()
    )
  );

drop policy if exists "dose_log_update_own" on dose_log;
create policy "dose_log_update_own" on dose_log
  for update using (
    exists (
      select 1 from pets
      where pets.id = dose_log.pet_id
        and pets.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from pets
      where pets.id = dose_log.pet_id
        and pets.user_id = auth.uid()
    )
  );

drop policy if exists "dose_log_delete_own" on dose_log;
create policy "dose_log_delete_own" on dose_log
  for delete using (
    exists (
      select 1 from pets
      where pets.id = dose_log.pet_id
        and pets.user_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════
-- 3. GRANTs explícitos
-- ════════════════════════════════════════════════════════════
-- IMPORTANTE (confirmado en este proyecto, ver auditoría Lote L): las
-- tablas creadas por SQL directo (a diferencia de las creadas vía
-- Supabase Studio) NO reciben privilegios de tabla automáticos para
-- authenticated/service_role — solo el owner (postgres) puede acceder
-- hasta que se otorgan explícitamente. RLS por sí sola NO alcanza: sin
-- el GRANT, el SELECT/INSERT/UPDATE/DELETE falla con "permission denied
-- for table dose_log" incluso si la policy sería la correcta. Se
-- comprobó en vivo que medication_logs/treatments/treatment_items HOY
-- le niegan el SELECT a service_role por esta misma razón.
grant select, insert, update, delete on dose_log to authenticated;
grant select, insert, update, delete on dose_log to service_role;
grant usage, select on sequence dose_log_id_seq to authenticated;
grant usage, select on sequence dose_log_id_seq to service_role;
