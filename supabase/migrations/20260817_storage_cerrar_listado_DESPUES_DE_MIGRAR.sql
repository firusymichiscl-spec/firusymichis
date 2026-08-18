-- ============================================================
-- ⚠️  NO EJECUTAR TODAVÍA  ⚠️
-- ============================================================
-- MIGRACIÓN (DIFERIDA): cerrar el listado público de pet-photos y
-- marketplace (Lote P, paso 4 del plan)
-- Fecha en que se escribió: 2026-08-17
--
-- Este es el paso que de verdad cierra el hallazgo del linter de
-- Supabase ("bucket público con política de SELECT amplia = cualquiera
-- puede LISTAR y descargar todo"). Se documenta acá completo y listo
-- para copiar/pegar, pero NO debe correrse hasta que:
--
--   1. 20260817_storage_privacidad_fotos.sql (paso 1) ya esté aplicado.
--   2. 20260817_photo_path_columns.sql (paso 3) ya esté aplicado.
--   3. El código del paso 2 (DashboardClient.jsx, app/marketplace/page.jsx,
--      app/api/pets/eliminar/route.js) ya esté deployado en producción.
--   4. scripts/migrate-storage-privacidad.js --run ya haya terminado de
--      migrar TODO lo que vivía bajo events/ y receipts/ a los buckets
--      privados nuevos.
--
-- Verificación recomendada antes de correr esto — debería devolver 0
-- filas en ambas queries (si no da 0, todavía queda algo sin migrar,
-- no cerrar el listado hasta resolverlo):
--
--   select count(*) from medical_history
--     where photo_url is not null and photo_path is null;
--
--   select count(*) from marketplace_listings
--     where receipt_url is not null and receipt_path is null;
--
-- Por qué el orden importa: si se cierra el listado ANTES de terminar la
-- migración, en principio no debería romper nada — el bucket sigue
-- público, así que el GET directo por URL exacta sigue funcionando, solo
-- se pierde la capacidad de LISTAR el bucket completo. Pero preferimos no
-- depender de esa garantía y confirmar con las queries de arriba primero.
-- ============================================================

drop policy if exists "pet_photos_read" on storage.objects;

drop policy if exists "Anyone can read marketplace files" on storage.objects;
