-- 0040 — Alertas de calidad de los datos de mercado.
--
-- Cada vez que /api/mercado arma el paquete de datos, compara cada dato crítico
-- contra una segunda fuente (el dólar contra Bluelytics, la inflación contra el
-- INDEC, los precios de CEDEARs contra otra fuente…) y revisa que no esté viejo.
-- Lo que no cierra se anota acá, una vez por día y por dato, y se le avisa a
-- quien mantiene FINA (ver ALERTAS_USER_ID en docs/inversiones-guiadas.md).
--
-- Sin ninguna policy: sólo la lee y escribe el servidor con service_role. Es
-- información operativa, no de las personas.
--
-- ADITIVA e idempotente.

create table if not exists data_alerts (
  id          uuid primary key default gen_random_uuid(),
  day         date not null,
  key         text not null,
  severity    text not null check (severity in ('aviso', 'grave')),
  message     text not null,
  created_at  timestamptz not null default now(),
  unique (day, key)
);

create index if not exists data_alerts_day_idx on data_alerts (day desc);

alter table data_alerts enable row level security;
