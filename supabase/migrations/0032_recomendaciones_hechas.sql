-- ─────────────────────────────────────────────────────────────────────────
-- 0032 — Recomendaciones que se tachan.
--
-- Cada recomendación de "Para vos" (la del día, la de la semana y la del mes)
-- se puede marcar como hecha. Al marcarla aparece otra para ese mismo período,
-- y al cambiar el día, la semana o el mes vuelven a empezar.
--
-- Se guarda qué marcó cada persona y para qué período:
--   · `clave` es el período: '2026-09-16' (día), '2026-W38' (semana),
--     '2026-09' (mes), en días de Argentina;
--   · `ref` es cuál: 'ia:<id de la recomendación>' si la armó la IA, o
--     'general:<periodo>:<n>' si es uno de los consejos generales de la app.
--
-- La IA lo lee al armar las siguientes: una recomendación que la persona marcó
-- como hecha es la mejor señal de que le sirvió y de que se puede construir
-- sobre eso.
--
-- ADITIVA. Correr después de 0031.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists recommendation_checks (
  user_id   uuid not null references auth.users (id) on delete cascade,
  periodo   text not null check (periodo in ('dia', 'semana', 'mes')),
  clave     text not null,
  ref       text not null,
  hecha_at  timestamptz not null default now(),
  primary key (user_id, periodo, clave, ref)
);

alter table recommendation_checks enable row level security;

drop policy if exists "hechas propias: leer" on recommendation_checks;
create policy "hechas propias: leer" on recommendation_checks
  for select using (auth.uid() = user_id);

drop policy if exists "hechas propias: marcar" on recommendation_checks;
create policy "hechas propias: marcar" on recommendation_checks
  for insert with check (auth.uid() = user_id);

drop policy if exists "hechas propias: desmarcar" on recommendation_checks;
create policy "hechas propias: desmarcar" on recommendation_checks
  for delete using (auth.uid() = user_id);
