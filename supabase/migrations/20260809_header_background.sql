-- ============================================================
-- MIGRACIÓN: fondo de header por mascota (Lote J)
-- Fecha: 2026-08-09
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets — solo agrega una columna. La policy de
-- UPDATE existente de pets (dueño actualiza su propia fila) ya cubre este
-- campo nuevo sin cambios, por eso el UPDATE desde ThemeSelector.jsx
-- funciona con el cliente de sesión normal, sin RPC.
-- ============================================================

alter table pets
  add column if not exists header_background text null;

-- Guarda el identificador del fondo (ej. "huellas", ver lib/fondos.js),
-- nunca una URL ni un valor generado por el usuario. NULL = sin fondo,
-- color plano del tema (comportamiento actual, sin cambios).
comment on column pets.header_background is
  'Identificador del fondo decorativo del header (ver lib/fondos.js). NULL = sin fondo. Feature PRO, se aplica en el cliente.';
