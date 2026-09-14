-- ─────────────────────────────────────────────────────────────────────────
-- 0029 — Recomendaciones personalizadas: del día, de la semana y del mes.
--
-- Las arma un modelo de IA (Claude) a partir de los datos de cada persona. El
-- modelo corre en una función del servidor (api/recomendaciones.ts), nunca en
-- el navegador: la clave de la API no puede llegar al teléfono de nadie.
--
-- QUÉ SIGNIFICA QUE "APRENDA". No se entrena ningún modelo con los datos de
-- nadie. Aprende de dos formas que se pueden ver y auditar:
--
--   1. Memoria. Cada vez que genera, el modelo deja anotadas observaciones
--      sobre cómo se maneja la persona ("cobra a principio de mes", "los fines
--      de semana gasta el doble en delivery"). La próxima vez las lee y las
--      corrige con los datos nuevos. Vive en `recommendation_memory`.
--
--   2. Resultados. Cada recomendación guarda en qué se enfocaba (una sección, el
--      ahorro, registrar). La próxima vez se le muestra al modelo qué pasó con
--      eso después — si el delivery bajó o no — y si la persona marcó que le
--      sirvió. Así deja de insistir con lo que no funciona para ella.
--
-- CACHÉ. Se genera como mucho una vez por período: la del día una vez por día,
-- la de la semana una vez por semana, la del mes una vez por mes. Cada
-- generación cuesta plata; abrir Home diez veces en un día no puede costar diez.
--
-- ADITIVA. Correr después de 0028.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists recommendations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  periodo     text not null check (periodo in ('dia', 'semana', 'mes')),
  -- Qué día / semana / mes cubre: '2026-09-14', '2026-W38', '2026-09'. En días
  -- de Argentina, igual que la racha (0028).
  clave       text not null,
  -- La recomendación tal como se muestra (título, texto, dato, acción).
  -- NULL a propósito: significa "para este período no había nada útil que
  -- decir". Se guarda igual, porque si no se guardara, cada vez que la persona
  -- abre Home se volvería a llamar al modelo para ese mismo período — y cada
  -- llamada se cobra. Un "no hay nada" también es una respuesta cacheable.
  contenido   jsonb,
  -- En qué se enfocaba, para poder medir después si cambió algo.
  foco_tipo   text,
  foco_ref    text,
  -- Lo que marcó la persona: true = me sirvió, false = no, null = no dijo.
  util        boolean,
  modelo      text,
  created_at  timestamptz not null default now(),
  unique (user_id, periodo, clave)
);

create index if not exists recommendations_user_idx on recommendations (user_id, created_at desc);

alter table recommendations enable row level security;

drop policy if exists "recomendaciones propias: leer" on recommendations;
create policy "recomendaciones propias: leer" on recommendations
  for select using (auth.uid() = user_id);

-- La función del servidor escribe ACTUANDO COMO la persona (con su sesión, no
-- con service_role), así que las policies son las de siempre: cada una sólo
-- toca lo suyo, y la función no puede escribir en la cuenta de otra.
drop policy if exists "recomendaciones propias: crear" on recommendations;
create policy "recomendaciones propias: crear" on recommendations
  for insert with check (auth.uid() = user_id);

drop policy if exists "recomendaciones propias: marcar" on recommendations;
create policy "recomendaciones propias: marcar" on recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Desde el navegador sólo se puede cambiar `util`. Sin esto, cualquiera podría
-- reescribir el texto de sus recomendaciones y hacerle creer al modelo, la
-- próxima vez, que le recomendó algo que nunca recomendó.
revoke update on recommendations from authenticated;
grant update (util) on recommendations to authenticated;


create table if not exists recommendation_memory (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  -- Lista corta de observaciones, cada una con su evidencia.
  observaciones jsonb not null default '[]'::jsonb,
  -- Cuándo arrancó la última generación. Frena dos cosas que cuestan plata:
  -- abrir la app en dos pestañas a la vez (dos generaciones iguales), y un
  -- error que se repite (un timeout se cobra, y reintentar en cada apertura
  -- de Home lo cobraría una y otra vez).
  ultimo_intento timestamptz,
  updated_at    timestamptz not null default now()
);

alter table recommendation_memory enable row level security;

drop policy if exists "memoria propia: leer" on recommendation_memory;
create policy "memoria propia: leer" on recommendation_memory
  for select using (auth.uid() = user_id);

drop policy if exists "memoria propia: crear" on recommendation_memory;
create policy "memoria propia: crear" on recommendation_memory
  for insert with check (auth.uid() = user_id);

drop policy if exists "memoria propia: actualizar" on recommendation_memory;
create policy "memoria propia: actualizar" on recommendation_memory
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
