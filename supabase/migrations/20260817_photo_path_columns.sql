-- ============================================================
-- MIGRACIÓN: columnas photo_path / receipt_path (Lote P)
-- Fecha: 2026-08-17
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- Ejecutar DESPUÉS de 20260817_storage_privacidad_fotos.sql (los buckets
-- nuevos tienen que existir antes de que el código empiece a escribir
-- rutas que apuntan a ellos).
--
-- medical_history y marketplace_listings son tablas antiguas (ya tienen
-- GRANTs y RLS correctos desde antes de este proyecto — mismo caso
-- documentado en 20260815_drug_class.sql), así que agregar columnas
-- nullable no requiere tocar policies ni GRANTs.
--
-- photo_path / receipt_path guardan la RUTA del objeto dentro del bucket
-- privado nuevo (pet-photos-medical / marketplace-receipts), NO un URL:
-- los signed URLs vencen, así que no tiene sentido persistir uno ya
-- resuelto — se firma al leer (TTL 1h, ver EVENT_PHOTO_SIGN_TTL en
-- components/DashboardClient.jsx).
--
-- Las columnas viejas (photo_url / receipt_url) se dejan intactas a
-- propósito como fallback durante la transición: el código nuevo lee
-- photo_path primero y cae a photo_url si no existe, así que filas
-- migradas y sin migrar conviven sin romperse. Se limpian en un lote
-- posterior, una vez confirmada y estable la migración de archivos
-- (paso 3, scripts/migrate-storage-privacidad.mjs).
-- ============================================================

alter table medical_history
  add column if not exists photo_path text null;

alter table marketplace_listings
  add column if not exists receipt_path text null;
