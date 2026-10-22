-- 0042 · Inversiones: las mini lecciones que la persona marcó como "ya lo aprendí".
--
-- Una fila por persona y lección. La app las guarda SIEMPRE también en el dispositivo:
-- si esta migración no se corrió, las cards andan igual (sólo que no pasan de un
-- dispositivo a otro).
--
-- Cómo correrla: pegar este archivo entero en el SQL Editor de Supabase y ejecutar.
-- Se puede correr más de una vez sin problema.

create table if not exists learned_cards (
  user_id     uuid not null references auth.users (id) on delete cascade,
  card_id     text not null,
  learned_at  timestamptz not null default now(),
  primary key (user_id, card_id)
);

alter table learned_cards enable row level security;

drop policy if exists "tarjetas aprendidas: leer" on learned_cards;
create policy "tarjetas aprendidas: leer" on learned_cards
  for select using (auth.uid() = user_id);

drop policy if exists "tarjetas aprendidas: crear" on learned_cards;
create policy "tarjetas aprendidas: crear" on learned_cards
  for insert with check (auth.uid() = user_id);

drop policy if exists "tarjetas aprendidas: borrar" on learned_cards;
create policy "tarjetas aprendidas: borrar" on learned_cards
  for delete using (auth.uid() = user_id);
