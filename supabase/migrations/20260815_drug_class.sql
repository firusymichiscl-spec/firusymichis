-- ============================================================
-- MIGRACIÓN: drug_class — clase farmacológica del medicamento (Lote L2)
-- Fecha: 2026-08-15
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- Ambas tablas son antiguas (ya tienen GRANTs y RLS correctos desde antes
-- de este proyecto), así que agregar una columna nullable no requiere
-- tocar policies ni GRANTs — a diferencia de dose_log (tabla nueva),
-- esto no cae en el problema de privilegios documentado en Lote L.
-- ============================================================

ALTER TABLE treatment_items ADD COLUMN IF NOT EXISTS drug_class text NULL;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS drug_class text NULL;
