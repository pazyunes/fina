-- PR7 — Preferencias de personalización del informe.
-- Guarda lo que la usuaria ingresa en el botón "Quiero recomendaciones
-- personalizadas" de la pestaña Objetivos:
--   - topUnwilling: ranking de 5 categorías que NO está dispuesta a recortar
--     (posición 1 = la que MENOS recorta; posición 5 = la que más).
--   - frequentSpots: lugares (cafeterías / restaurantes) que frecuenta.
-- Se persiste aparte de reports.user_data porque (a) la usuaria puede
-- actualizarlas múltiples veces sin tocar el snapshot del informe y (b)
-- el bot de WhatsApp también va a leer/escribir esta tabla cuando arme
-- recomendaciones más finas.
--
-- Correr una vez en el SQL editor de Supabase.

begin;

create table if not exists user_preferences (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  -- Array de exactamente 5 categorías (slugs), del 1 al 5. Se valida en app.
  top_unwilling    jsonb not null default '[]'::jsonb,
  -- Lista libre de nombres que la usuaria frecuenta.
  frequent_spots   jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on user_preferences;
create trigger user_preferences_set_updated_at
  before update on user_preferences
  for each row execute function set_updated_at();

-- RLS owner-only, mismo patrón que el resto de las tablas del usuario.
alter table user_preferences enable row level security;

drop policy if exists "user_preferences owner read"   on user_preferences;
drop policy if exists "user_preferences owner insert" on user_preferences;
drop policy if exists "user_preferences owner update" on user_preferences;
drop policy if exists "user_preferences owner delete" on user_preferences;

create policy "user_preferences owner read"   on user_preferences for select using   (auth.uid() = user_id);
create policy "user_preferences owner insert" on user_preferences for insert with check (auth.uid() = user_id);
create policy "user_preferences owner update" on user_preferences for update using   (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_preferences owner delete" on user_preferences for delete using   (auth.uid() = user_id);

commit;

-- ── Rollback ───────────────────────────────────────────────────────────
-- drop table if exists user_preferences cascade;
