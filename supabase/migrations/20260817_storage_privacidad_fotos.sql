-- ============================================================
-- MIGRACIÓN: privacidad de fotos médicas y boletas de marketplace (Lote P)
-- Fecha: 2026-08-17 (revisada 2026-08-18 tras verificar en producción)
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets — la función nueva de este archivo LEE
-- pets.user_id para verificar ownership, no modifica sus policies.
--
-- Contexto (auditoría del linter de Supabase + auditoría de policies del
-- 2026-08-17): pet-photos y marketplace son buckets públicos con una
-- política de SELECT amplia ("pet_photos_read" / "Anyone can read
-- marketplace files") que permite LISTAR y descargar TODO el contenido
-- sin sesión — incluye fotos de eventos médicos y boletas de compra, que
-- la app nunca muestra sin sesión pero el bucket sí expone directo vía la
-- Storage API con la sola anon key.
--
-- Hallazgo adicional (mismo día): las políticas de escritura de ambos
-- buckets ("pet_photos_upload/update/delete", "Authenticated users can
-- upload marketplace files") solo exigen auth.role()='authenticated', sin
-- validar ownership — cualquier usuario logueado puede sobrescribir o
-- borrar el avatar de la mascota de OTRO usuario si conoce su petId (viaja
-- en URLs y en el HTML de /ficha/[token], que es público). Con
-- upsert:true en PetPhotoUpload.jsx, es vandalismo trivial.
--
-- ⚠️ LECCIÓN DE PRODUCCIÓN (2026-08-18, diagnóstico refinado tras auditar
-- weight_logs) — LEER ANTES DE ESCRIBIR OTRA POLICY DE STORAGE QUE
-- CONSULTE UNA TABLA DE public:
-- La primera versión de este archivo usaba exists(select 1 from pets
-- where ...) directo dentro de TRES policies SEPARADAS de storage.objects
-- (pet_photos_upload para INSERT, pet_photos_update para UPDATE,
-- pet_photos_delete para DELETE). Al ejecutarla, TODAS las subidas
-- fallaban con 403 "new row violates row-level security policy", incluso
-- subiendo el avatar de tu propia mascota.
--
-- Hipótesis inicial (INCORRECTA, descartada tras auditar weight_logs):
-- "exists() contra una tabla con RLS, desde dentro de una policy de
-- storage.objects, no resuelve bien por RLS anidada". Se cae porque
-- weight_logs tiene ownership resuelto contra pets con la MISMA forma de
-- subconsulta anidada (auth.uid() = (select pets.user_id from pets where
-- pets.id = weight_logs.pet_id)) y SE ESCRIBE CON upsert() desde el
-- cliente (WeightHistoryModal.jsx) — y funciona correctamente en
-- producción, confirmado desde el Lote L. Si la subconsulta anidada por sí
-- sola rompiera, weight_logs también estaría roto.
--
-- Diferencia real entre weight_logs (funciona) y pet-photos (fallaba):
-- weight_logs tiene UNA SOLA policy "weight_logs_own" FOR ALL, que cubre
-- INSERT/UPDATE/DELETE/SELECT con la misma condición evaluada una vez.
-- pet-photos tenía TRES policies separadas por comando. El upload con
-- upsert:true de Supabase Storage es, a nivel SQL, un
-- INSERT ... ON CONFLICT (bucket_id, name) DO UPDATE — con policies
-- separadas por comando, Postgres necesita satisfacer VARIAS de ellas a
-- la vez en la misma operación (el WITH CHECK del INSERT para la fase de
-- detección de conflicto, y el USING/WITH CHECK del UPDATE para la rama
-- DO UPDATE). Es esa combinación — policies separadas por comando + el
-- ON CONFLICT del upsert exigiendo varias simultáneamente + la
-- subconsulta anidada a pets dentro de esa evaluación múltiple — la que
-- rompía. Con una sola policy FOR ALL (como weight_logs) no hay múltiples
-- policies que reconciliar en la misma operación, así que el mismo tipo
-- de subconsulta nunca dispara el problema.
--
-- Arreglo verificado en producción (cambio de avatar probado y
-- funcionando): encapsular el chequeo de ownership en una función
-- SECURITY DEFINER (public.user_owns_pet, sección 0 más abajo) — mismo
-- patrón que ya usa el proyecto en log_activity/set_profile_theme. No
-- necesitamos además unificar pet-photos en una sola policy FOR ALL (como
-- weight_logs) porque este arreglo ya resuelve el síntoma directamente;
-- se deja documentado como alternativa válida si algún día hace falta.
--
-- REGLA A FUTURO, más precisa que la versión anterior de este comentario:
-- el riesgo no es "exists() sobre una tabla con RLS" en abstracto (eso
-- solo, sin más, funciona bien — ver dose_log/treatments/weight_logs). El
-- riesgo aparece cuando se combinan estas tres cosas a la vez: (1) una
-- tabla/bucket con policies SEPARADAS por comando (no un solo FOR ALL),
-- (2) una operación de upsert (INSERT ... ON CONFLICT DO UPDATE) contra
-- esa tabla, y (3) alguna de esas policies consulta una segunda tabla con
-- su propia RLS. Con las tres presentes, encapsular la consulta a la
-- segunda tabla en una función SECURITY DEFINER es la salida más simple y
-- ya verificada. weight_logs y notification_preferences se auditaron
-- puntualmente por esto (2026-08-18) y NO tienen el problema — no se
-- tocan en este archivo.
--
-- Este archivo es el PASO 1 del plan:
--   0. Crea la función SECURITY DEFINER public.user_owns_pet.
--   1. Crea los dos buckets privados nuevos (pet-photos-medical,
--      marketplace-receipts) con sus policies de ownership.
--   2. Corrige las policies de escritura existentes de pet-photos y
--      marketplace para exigir ownership real, no solo "estar logueado".
--
-- Lo que este archivo NO hace (a propósito): no toca "pet_photos_read" ni
-- "Anyone can read marketplace files" (las policies de LISTADO amplio).
-- Ese DROP POLICY es el paso que de verdad cierra el hallazgo del linter,
-- pero debe ejecutarse recién DESPUÉS de confirmar que el script de
-- migración de archivos (paso 3, scripts/migrate-storage-privacidad.mjs)
-- terminó de mover todo lo que vive bajo events/ y receipts/ — ver
-- 20260817_storage_cerrar_listado_DESPUES_DE_MIGRAR.sql (documentado
-- aparte, deliberadamente NO ejecutable todavía).
--
-- Nota sobre GRANTs: para storage.buckets/storage.objects NO hacen falta
-- (mismo razonamiento que antes: son tablas del schema storage
-- aprovisionadas por la plataforma Supabase, no tablas nuevas creadas por
-- este proyecto — el problema de GRANTs documentado en 20260815_dose_log.sql
-- es específico de tablas nuevas creadas por SQL directo en public).
-- La función user_owns_pet sí necesita su propio GRANT explícito de
-- EXECUTE (ver sección 0) — eso es distinto del problema de GRANTs de
-- tablas, es simplemente cómo funciona el privilegio EXECUTE en Postgres
-- para cualquier función nueva, y sigue el mismo patrón ya usado en
-- set_profile_dose_view (revoke de anon, grant a authenticated).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 0. Función SECURITY DEFINER — ownership de mascota sin RLS anidada
-- ════════════════════════════════════════════════════════════
-- security definer + set search_path = public: corre con los privilegios
-- de quien la creó (evita la RLS anidada de pets descrita arriba) y fija
-- el search_path explícito por seguridad (evita que alguien con permisos
-- de crear objetos en otro schema intente hacer schema hijacking contra
-- esta función). stable: el resultado no cambia dentro de la misma
-- transacción/statement para el mismo input, permite que el planner la
-- cachee en vez de re-evaluarla por cada fila.
create or replace function public.user_owns_pet(p_pet_id text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from pets
    where pets.id::text = p_pet_id
      and pets.user_id = auth.uid()
  );
$$;

revoke execute on function public.user_owns_pet(text) from anon;
grant execute on function public.user_owns_pet(text) to authenticated;

-- ════════════════════════════════════════════════════════════
-- 1. Buckets nuevos, privados
-- ════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values
  ('pet-photos-medical', 'pet-photos-medical', false),
  ('marketplace-receipts', 'marketplace-receipts', false)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════
-- 2. pet-photos — corregir escritura para exigir ownership real
-- ════════════════════════════════════════════════════════════
-- (storage.foldername(name))[array_length(...)] = ÚLTIMO segmento de
-- carpeta, no el primero. La ruta del avatar es {petId}/avatar.jpg
-- (foldername = {petId}, 1 elemento → último = único = petId). Pero
-- durante la transición (antes de correr el script de migración del
-- paso 3, y mientras haya pestañas de usuarios con el JS viejo todavía
-- cargado en el navegador) puede seguir llegando tráfico de escritura a
-- events/{petId}/{ts}.jpg (foldername = {events, petId}, 2 elementos →
-- último = petId igual, primero = 'events'). Tomar el ÚLTIMO segmento en
-- vez de fijar [1] cubre ambas formas de ruta sin bloquear escrituras
-- legítimas a events/ durante la transición.
drop policy if exists "pet_photos_upload" on storage.objects;
create policy "pet_photos_upload" on storage.objects
  for insert with check (
    bucket_id = 'pet-photos'
    and public.user_owns_pet((storage.foldername(name))[array_length(storage.foldername(name), 1)])
  );

-- USING valida la fila VIEJA (antes del update); WITH CHECK valida la fila
-- NUEVA (después del update) — sin WITH CHECK, nada impide que un update
-- cambie la columna "name" del objeto para moverlo a la carpeta de OTRA
-- mascota (ej. storage.move(), o cualquier update que reescriba name).
-- Mismo hueco que se corrigió en marketplace_listings_update_own (Lote G).
-- Repetimos la misma condición: solo cambia qué fila del storage.objects
-- evalúa Postgres en cada mitad (name viejo vs. name nuevo). Además: el
-- upload con upsert:true de PetPhotoUpload.jsx es, a nivel SQL, un
-- INSERT ... ON CONFLICT (bucket_id, name) DO UPDATE — cuando el avatar
-- ya existe, es ESTA policy (no la de insert) la que gobierna el
-- reemplazo. Ver la lección de producción al inicio del archivo sobre por
-- qué usa user_owns_pet() en vez de exists(...) inline.
drop policy if exists "pet_photos_update" on storage.objects;
create policy "pet_photos_update" on storage.objects
  for update using (
    bucket_id = 'pet-photos'
    and public.user_owns_pet((storage.foldername(name))[array_length(storage.foldername(name), 1)])
  )
  with check (
    bucket_id = 'pet-photos'
    and public.user_owns_pet((storage.foldername(name))[array_length(storage.foldername(name), 1)])
  );

drop policy if exists "pet_photos_delete" on storage.objects;
create policy "pet_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'pet-photos'
    and public.user_owns_pet((storage.foldername(name))[array_length(storage.foldername(name), 1)])
  );

-- "pet_photos_read" (SELECT amplio, permite LISTAR todo el bucket) se deja
-- intacto en este archivo A PROPÓSITO — ver nota al inicio del archivo.

-- ════════════════════════════════════════════════════════════
-- 3. pet-photos-medical — bucket privado nuevo, ownership vía pets
-- ════════════════════════════════════════════════════════════
-- Ruta en régimen: {petId}/{timestamp}.jpg (sin el prefijo events/, ya lo
-- dice el nombre del bucket) — un solo segmento de carpeta, igual que el
-- avatar, así que acá [1] alcanza (no hay una forma de ruta "vieja" que
-- convivir, este bucket es 100% nuevo).
drop policy if exists "pet_photos_medical_select_own" on storage.objects;
create policy "pet_photos_medical_select_own" on storage.objects
  for select using (
    bucket_id = 'pet-photos-medical'
    and public.user_owns_pet((storage.foldername(name))[1])
  );

drop policy if exists "pet_photos_medical_insert_own" on storage.objects;
create policy "pet_photos_medical_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'pet-photos-medical'
    and public.user_owns_pet((storage.foldername(name))[1])
  );

drop policy if exists "pet_photos_medical_delete_own" on storage.objects;
create policy "pet_photos_medical_delete_own" on storage.objects
  for delete using (
    bucket_id = 'pet-photos-medical'
    and public.user_owns_pet((storage.foldername(name))[1])
  );

-- No hace falta policy de SELECT/UPDATE/DELETE para service_role: el
-- service_role tiene bypass de RLS (igual que ya hace hoy contra pets,
-- medical_history, etc. en app/ficha/[token]/page.jsx y
-- app/api/ficha-pdf/[token]/route.jsx). Ninguno de esos dos endpoints
-- públicos lee fotos de eventos hoy, pero si algún día lo hicieran,
-- funcionaría sin tocar esta migración.

-- ════════════════════════════════════════════════════════════
-- 4. marketplace — corregir escritura para exigir ownership real
-- ════════════════════════════════════════════════════════════
-- Esta policy NO usa user_owns_pet() ni consulta ninguna tabla de
-- public — compara (storage.foldername(name))[...] directo contra
-- auth.uid(), sin subconsulta a ninguna tabla con RLS. Por eso nunca tuvo
-- el problema de la sección 0: la lección de producción aplica
-- específicamente a policies que consultan OTRA tabla desde dentro de
-- storage.objects, no a comparaciones directas contra auth.uid().
-- Misma técnica de "último segmento" que pet-photos: la ruta hoy es
-- {folder}/{userId}/{ts}.ext (ej. photos/{userId}/...), 2 niveles. Con
-- receipts/ ya migrado a su propio bucket, en régimen esto queda con 2
-- niveles siempre para "photos/", pero usar el último segmento en vez de
-- fijar [2] deja la policy correcta también si algún día cambia la
-- profundidad de la ruta.
drop policy if exists "Authenticated users can upload marketplace files" on storage.objects;
create policy "Authenticated users can upload marketplace files" on storage.objects
  for insert with check (
    bucket_id = 'marketplace'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[array_length(storage.foldername(name), 1)] = auth.uid()::text
  );

-- "Anyone can read marketplace files" (SELECT amplio) se deja intacto en
-- este archivo A PROPÓSITO — mismo motivo que pet_photos_read, ver nota
-- al inicio del archivo.

-- ════════════════════════════════════════════════════════════
-- 5. marketplace-receipts — bucket privado nuevo, ownership vía userId
-- ════════════════════════════════════════════════════════════
-- Igual que la sección 4: comparación directa contra auth.uid(), sin
-- consultar ninguna tabla de public — no necesita user_owns_pet().
-- Ruta en régimen: {userId}/{timestamp}.jpg (sin el prefijo receipts/).
-- Nadie en el código de la app lee receipt_path para mostrarlo hoy — si el
-- equipo revisa boletas a mano, lo sigue haciendo desde el dashboard de
-- Supabase (bypassa RLS). Si en algún momento se arma una UI de
-- moderación, es una policy nueva aparte, fuera de este lote.
drop policy if exists "marketplace_receipts_select_own" on storage.objects;
create policy "marketplace_receipts_select_own" on storage.objects
  for select using (
    bucket_id = 'marketplace-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "marketplace_receipts_insert_own" on storage.objects;
create policy "marketplace_receipts_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'marketplace-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
