-- ─────────────────────────────────────────────────────────────────────────
-- 0030 — Notificaciones de la app (web push).
--
-- Cada navegador o celular donde la persona activa las notificaciones deja una
-- "suscripción": la dirección a la que el servidor le manda los avisos. Una
-- persona puede tener varias (el celular y la compu).
--
-- Qué se manda, con el tono de FINA (avisa, no reta):
--   · a las 19 hs, si todavía no cumplió el paso del día;
--   · a las 21:30, si tiene una racha y ese día todavía no sumó.
-- Cada una se activa o desactiva desde Perfil.
--
-- Los avisos los manda una función del servidor (api/notificaciones.ts) que
-- corre sola dos veces por día y usa service_role: tiene que ver a todas las
-- personas con notificaciones activas. Desde el navegador cada una sólo ve y
-- toca lo suyo.
--
-- ADITIVA. Correr después de 0029.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- La dirección del servicio de notificaciones del navegador. Única: el mismo
  -- navegador no se anota dos veces.
  endpoint    text not null unique,
  -- Las dos claves con las que se cifra cada aviso para ese navegador.
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "suscripciones propias: leer" on push_subscriptions;
create policy "suscripciones propias: leer" on push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "suscripciones propias: crear" on push_subscriptions;
create policy "suscripciones propias: crear" on push_subscriptions
  for insert with check (auth.uid() = user_id);

-- Hace falta para volver a activar desde el mismo navegador (upsert).
drop policy if exists "suscripciones propias: actualizar" on push_subscriptions;
create policy "suscripciones propias: actualizar" on push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "suscripciones propias: borrar" on push_subscriptions;
create policy "suscripciones propias: borrar" on push_subscriptions
  for delete using (auth.uid() = user_id);


-- ── Qué avisos quiere cada persona ───────────────────────────────────────
-- Sin fila = los dos activados (se activan al prender las notificaciones).
create table if not exists notification_prefs (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  paso        boolean not null default true,
  racha       boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table notification_prefs enable row level security;

drop policy if exists "preferencias propias: leer" on notification_prefs;
create policy "preferencias propias: leer" on notification_prefs
  for select using (auth.uid() = user_id);

drop policy if exists "preferencias propias: crear" on notification_prefs;
create policy "preferencias propias: crear" on notification_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "preferencias propias: actualizar" on notification_prefs;
create policy "preferencias propias: actualizar" on notification_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── Qué se mandó ─────────────────────────────────────────────────────────
-- Uno por persona, tipo y día. Si la tarea programada corre dos veces (Vercel
-- puede reintentar), el segundo intento choca con esta fila y no manda de nuevo.
-- Sin policies: sólo la escribe y la lee el servidor.
create table if not exists notification_log (
  user_id   uuid not null references auth.users (id) on delete cascade,
  tipo      text not null check (tipo in ('paso', 'racha')),
  dia       date not null,
  enviadas  int not null default 0,
  sent_at   timestamptz not null default now(),
  primary key (user_id, tipo, dia)
);

alter table notification_log enable row level security;
