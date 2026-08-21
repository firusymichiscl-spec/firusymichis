-- ============================================================
-- MIGRACIÓN: inventario del hogar (Lote S)
-- Fecha: 2026-08-20
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- NO TOCA RLS de la tabla pets — solo agrega FKs de lectura hacia pets,
-- treatment_items y medications, igual que dose_log/treatments (Lote L).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. inventory_items — cuelga del USUARIO, no de una mascota: es del hogar.
-- ════════════════════════════════════════════════════════════
create table if not exists inventory_items (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  name               text        not null,
  category           text        not null check (category in ('medicamento','higiene','insumo','alimento','otro')),
  quantity           numeric     not null default 0,
  unit               text        null,
  units_per_package  int         null,
  expires_at         date        null,
  notes              text        null,
  drug_class         text        null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_inventory_items_user on inventory_items (user_id);

-- ════════════════════════════════════════════════════════════
-- 2. inventory_pets — asignación N:N a mascotas.
-- ════════════════════════════════════════════════════════════
create table if not exists inventory_pets (
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  pet_id            uuid not null references pets(id) on delete cascade,
  primary key (inventory_item_id, pet_id)
);

create index if not exists idx_inventory_pets_pet on inventory_pets (pet_id);

-- ════════════════════════════════════════════════════════════
-- 3. inventory_treatment_links — vínculo con el medicamento.
--    treatment_item_id / medication_id nullable y mutuamente excluyentes —
--    MISMO patrón que dose_log (Lote L): un ítem de inventario puede
--    abastecer un tratamiento con horario (treatment_items, cálculo
--    completo vía lib/doseSchedule.js) O un medicamento habitual sin
--    horario (medications, solo "días que alcanza" vía su frequency de
--    texto libre, igual que ya hace getDosesPerDay en el cron hoy). Sin
--    esto último, los medicamentos crónicos cargados a mano perderían las
--    alertas de stock bajo que hoy sí reciben — la función más usada de
--    la app (ver Lote S).
-- ════════════════════════════════════════════════════════════
create table if not exists inventory_treatment_links (
  id                 bigint      generated always as identity primary key,
  inventory_item_id  uuid        not null references inventory_items(id) on delete cascade,
  treatment_item_id  uuid        null references treatment_items(id) on delete cascade,
  medication_id      uuid        null references medications(id) on delete cascade,
  created_at         timestamptz not null default now(),
  constraint inventory_treatment_links_one_source check (
    (treatment_item_id is not null and medication_id is null) or
    (treatment_item_id is null and medication_id is not null)
  ),
  -- Postgres no aplica una UNIQUE cuando alguna columna de la tupla es
  -- NULL, así que estas dos conviven sin pisarse: cada una solo protege
  -- las filas del tipo de vínculo que le corresponde (mismo razonamiento
  -- que idx_dose_log_unico, pero acá no hace falta COALESCE porque el
  -- CHECK de arriba ya garantiza que nunca hay dos NULL a la vez).
  unique (inventory_item_id, treatment_item_id),
  unique (inventory_item_id, medication_id)
);

create index if not exists idx_inv_links_item on inventory_treatment_links (inventory_item_id);
create index if not exists idx_inv_links_treatment on inventory_treatment_links (treatment_item_id) where treatment_item_id is not null;
create index if not exists idx_inv_links_medication on inventory_treatment_links (medication_id) where medication_id is not null;

-- ════════════════════════════════════════════════════════════
-- 4. RLS — UNA sola policy FOR ALL por tabla (lección Lote P/storage: con
--    policies separadas por comando + upsert + subconsulta anidada, Postgres
--    puede negar la operación aunque cada policy sea correcta). Esta app no
--    hace upsert sobre estas tablas, pero se mantiene FOR ALL igual por
--    consistencia y para no reabrir ese riesgo si el código cambia.
-- ════════════════════════════════════════════════════════════
alter table inventory_items enable row level security;
alter table inventory_pets enable row level security;
alter table inventory_treatment_links enable row level security;

-- inventory_items: user_id directo, sin consultar pets (más simple, sin el
-- problema de RLS anidada del Lote P).
drop policy if exists "inventory_items_own" on inventory_items;
create policy "inventory_items_own" on inventory_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- inventory_pets: no tiene user_id propio — se valida vía el ítem padre.
drop policy if exists "inventory_pets_own" on inventory_pets;
create policy "inventory_pets_own" on inventory_pets
  for all using (
    exists (select 1 from inventory_items where inventory_items.id = inventory_pets.inventory_item_id and inventory_items.user_id = auth.uid())
  ) with check (
    exists (select 1 from inventory_items where inventory_items.id = inventory_pets.inventory_item_id and inventory_items.user_id = auth.uid())
  );

-- inventory_treatment_links: valida vía el ítem padre Y vía el lado que
-- corresponda (treatment_items→pets o medications→pets), igual patrón que
-- treatments_insert_own — cualquiera de los dos lados basta porque el CHECK
-- de la tabla ya garantiza que solo uno está presente por fila.
drop policy if exists "inventory_treatment_links_own" on inventory_treatment_links;
create policy "inventory_treatment_links_own" on inventory_treatment_links
  for all using (
    exists (select 1 from inventory_items where inventory_items.id = inventory_treatment_links.inventory_item_id and inventory_items.user_id = auth.uid())
    and (
      exists (select 1 from treatment_items ti join pets on pets.id = ti.pet_id where ti.id = inventory_treatment_links.treatment_item_id and pets.user_id = auth.uid())
      or
      exists (select 1 from medications m join pets on pets.id = m.pet_id where m.id = inventory_treatment_links.medication_id and pets.user_id = auth.uid())
    )
  ) with check (
    exists (select 1 from inventory_items where inventory_items.id = inventory_treatment_links.inventory_item_id and inventory_items.user_id = auth.uid())
    and (
      exists (select 1 from treatment_items ti join pets on pets.id = ti.pet_id where ti.id = inventory_treatment_links.treatment_item_id and pets.user_id = auth.uid())
      or
      exists (select 1 from medications m join pets on pets.id = m.pet_id where m.id = inventory_treatment_links.medication_id and pets.user_id = auth.uid())
    )
  );

-- ════════════════════════════════════════════════════════════
-- 5. GRANTs explícitos (sin esto: 42501 aunque las policies estén bien,
--    confirmado en este proyecto — ver migración de dose_log, Lote L).
-- ════════════════════════════════════════════════════════════
grant select, insert, update, delete on inventory_items to authenticated;
grant select, insert, update, delete on inventory_items to service_role;
grant select, insert, update, delete on inventory_pets to authenticated;
grant select, insert, update, delete on inventory_pets to service_role;
grant select, insert, update, delete on inventory_treatment_links to authenticated;
grant select, insert, update, delete on inventory_treatment_links to service_role;
grant usage, select on sequence inventory_treatment_links_id_seq to authenticated;
grant usage, select on sequence inventory_treatment_links_id_seq to service_role;
