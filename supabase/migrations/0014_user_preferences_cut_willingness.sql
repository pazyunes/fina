-- 0014 — Disposición a recortar por categoría (paso "prioridades").
-- Antes se guardaba un ranking de 5 categorías que NO querías recortar
-- (top_unwilling). Ahora cada categoría tiene un puntaje 1..5 (5 = re dispuesta
-- a recortar; 1 = no está dispuesta), guardado como objeto jsonb { slug: n }.

alter table user_preferences
  add column if not exists cut_willingness jsonb not null default '{}'::jsonb;
