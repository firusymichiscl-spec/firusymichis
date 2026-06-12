-- ============================================================
-- MIGRACIÓN: seguridad, cuotas IA, perfiles de plan,
--            idempotencia notificaciones, heartbeat cron
-- Fecha: 2026-06-10
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Idempotente: seguro de ejecutar más de una vez
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. PERFILES DE USUARIO Y PLAN
-- ════════════════════════════════════════════════════════════

create table if not exists profiles (
  id              uuid        primary key references auth.users(id) on delete cascade,
  plan            text        not null default 'free'
                              check (plan in ('free', 'pro', 'business')),
  plan_expires_at timestamptz null,
  created_at      timestamptz not null default now()
);

alter table profiles enable row level security;

-- Política SELECT: cada usuario solo ve su propia fila
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
-- INSERT/UPDATE solo vía service role (Stripe webhook o admin manual)
-- sin policy de insert/update para usuarios

-- ── Función que crea la fila en profiles al registrarse ──────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger sobre auth.users (drop+create para idempotencia)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Backfill: crear fila para usuarios ya existentes ─────────
insert into profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════
-- 2. CUOTA DE IA
-- ════════════════════════════════════════════════════════════

create table if not exists ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha   date not null default current_date,
  tipo    text not null,
  count   int  not null default 0,
  primary key (user_id, fecha, tipo)
);

alter table ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on ai_usage;
create policy "ai_usage_select_own" on ai_usage
  for select using (auth.uid() = user_id);
-- escrituras solo vía service role / rpc

create or replace function increment_ai_usage(p_user_id uuid, p_tipo text)
returns int
language plpgsql security definer set search_path = public
as $$
declare new_count int;
begin
  insert into ai_usage (user_id, fecha, tipo, count)
  values (p_user_id, current_date, p_tipo, 1)
  on conflict (user_id, fecha, tipo)
  do update set count = ai_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 3. IDEMPOTENCIA DE NOTIFICACIONES
-- ════════════════════════════════════════════════════════════

create table if not exists sent_notifications (
  notification_key text        primary key,
  sent_at          timestamptz not null default now()
);

alter table sent_notifications enable row level security;
-- sin policies: solo service role escribe/lee

-- ════════════════════════════════════════════════════════════
-- 4. HEARTBEAT DEL CRON
-- ════════════════════════════════════════════════════════════

create table if not exists cron_heartbeats (
  id             bigint      generated always as identity primary key,
  ran_at         timestamptz not null default now(),
  emails_sent    int         not null default 0,
  emails_skipped int         not null default 0
);

alter table cron_heartbeats enable row level security;
-- sin policies: solo service role escribe/lee

-- ════════════════════════════════════════════════════════════
-- 5. ÍNDICES DE PERFORMANCE
-- ════════════════════════════════════════════════════════════
-- Nota: el repo usa "medical_history", no "health_events".
-- El índice sobre health_events se omite (tabla inexistente).

create index if not exists idx_medical_history_pet_fecha
  on medical_history (pet_id, event_date desc);

create index if not exists idx_medications_pet
  on medications (pet_id);

-- ════════════════════════════════════════════════════════════
-- 6. RLS DE TABLAS DE DATOS (treatments, marketplace_listings)
--    Estas tablas se crearon vía Dashboard sin archivo SQL.
--    Si ya tienen políticas propias, este bloque las reemplaza
--    de forma idempotente con las políticas correctas.
-- ════════════════════════════════════════════════════════════

-- ── treatments ───────────────────────────────────────────────
-- La tabla NO tiene user_id directo; el dueño se verifica
-- a través de pets.user_id. Esto es una consulta cruzada
-- normal — NO modifica ni toca las políticas de la tabla pets.
alter table treatments enable row level security;

drop policy if exists "treatments_select_own" on treatments;
create policy "treatments_select_own" on treatments
  for select using (
    exists (
      select 1 from pets
      where pets.id = treatments.pet_id
        and pets.user_id = auth.uid()
    )
  );

drop policy if exists "treatments_insert_own" on treatments;
create policy "treatments_insert_own" on treatments
  for insert with check (
    exists (
      select 1 from pets
      where pets.id = treatments.pet_id
        and pets.user_id = auth.uid()
    )
  );

drop policy if exists "treatments_delete_own" on treatments;
create policy "treatments_delete_own" on treatments
  for delete using (
    exists (
      select 1 from pets
      where pets.id = treatments.pet_id
        and pets.user_id = auth.uid()
    )
  );

-- ── marketplace_listings ─────────────────────────────────────
-- Tiene columna user_id directa — política simple.
alter table marketplace_listings enable row level security;

drop policy if exists "marketplace_listings_select" on marketplace_listings;
create policy "marketplace_listings_select" on marketplace_listings
  for select using (status = 'active' or user_id = auth.uid());

drop policy if exists "marketplace_listings_insert_own" on marketplace_listings;
create policy "marketplace_listings_insert_own" on marketplace_listings
  for insert with check (user_id = auth.uid());

drop policy if exists "marketplace_listings_update_own" on marketplace_listings;
create policy "marketplace_listings_update_own" on marketplace_listings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
