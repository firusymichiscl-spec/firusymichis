-- ============================================================
-- MIGRACIÓN: treatment_items.condicion — tratamientos condicionales (Lote T)
-- Fecha: 2026-08-23
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente. treatment_items ya tiene GRANTs/RLS correctos desde antes
-- (mismo caso que drug_class/phases, Lote L2/M) — agregar una columna
-- nullable no los toca. NO TOCA RLS de pets ni de treatment_items.
-- ============================================================
alter table treatment_items add column if not exists condicion text null;
