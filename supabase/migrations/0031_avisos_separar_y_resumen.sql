-- ─────────────────────────────────────────────────────────────────────────
-- 0031 — Dos avisos nuevos: "día de separar" y "resumen de la semana".
--
--   · Día de separar: a las 10 hs del día del mes en que la persona cobra,
--     para que separe para sus objetivos apenas entra la plata. Separar al
--     principio, en automático, funciona mucho mejor que intentar ahorrar lo
--     que sobra a fin de mes.
--   · Resumen de la semana: los lunes a las 10 hs, cómo le fue la semana
--     anterior (días que registró, cuánto gastó, cuánto le sumó a sus
--     objetivos).
--
-- Además, el paso del día y la racha pasan a mandarse juntos a las 19 hs, en un
-- solo aviso: dos recordatorios seguidos por lo mismo cansan.
--
-- ADITIVA. Correr después de 0030.
-- ─────────────────────────────────────────────────────────────────────────

alter table notification_prefs add column if not exists separar boolean not null default true;
alter table notification_prefs add column if not exists resumen boolean not null default true;
-- Día del mes en que cobra (1 a 31). null = no lo dijo, y entonces no hay aviso
-- de separar. Si el mes tiene menos días (un 31 en abril), se avisa el último.
alter table notification_prefs add column if not exists dia_cobro smallint
  check (dia_cobro is null or dia_cobro between 1 and 31);

alter table notification_log drop constraint if exists notification_log_tipo_check;
alter table notification_log add constraint notification_log_tipo_check
  check (tipo in ('paso', 'racha', 'separar', 'resumen'));
