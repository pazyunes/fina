-- 0044: el próximo paso y la racha por días con gastos, sin cambiarle a nadie
-- la racha que ya tiene. Idempotente: se puede correr más de una vez.
--
-- ANTES (0028): un paso distinto por día, que se cumplía solo mirando los
-- datos, y la racha contaba los días con el paso cumplido o con algo contado
-- por WhatsApp.
--
-- AHORA (decisión oct 2026): en Inicio hay UN próximo paso grande ("Abrí una
-- cuenta para hacer rendir tu plata", "Hacé tu primera inversión") que queda
-- hasta que la persona marca que lo hizo, y la racha cuenta los días en que
-- anotó al menos un gasto, en la app o por WhatsApp.
--
-- EL CAMBIO NO MUEVE LA RACHA DE NADIE (regla 14 de CLAUDE.md). Los días
-- anteriores al cambio se siguen contando con la regla de la 0028, y desde el
-- día en que se corre esta migración, con la nueva. La historia queda como
-- estaba y la regla nueva rige de acá en adelante. La fecha del cambio se
-- guarda la primera vez que se corre y no se pisa si se vuelve a correr.
--
-- ORDEN: correrla ANTES de subir a producción la versión de Inicio con el
-- próximo paso. Esa versión ya no escribe `daily_steps`: si llegara primero,
-- los días hasta correr la migración se juzgarían con la regla vieja sin el
-- paso, y a quien anota sólo en la app se le cortaría la racha. Correrla antes
-- es seguro: la versión de hoy sigue andando igual (ver más abajo).
--
-- `daily_steps` no se borra: tiene la historia de los pasos de cada día.

-- ── 1) Los pasos grandes que la persona marcó como hechos ────────────────
-- Una fila por paso hecho. Se marca a mano porque estos pasos pasan afuera de
-- la app (abrir una cuenta en un banco, invertir), donde FINA no los puede ver.
-- El catálogo vive en la app: src/app/api/v2/proximoPaso.ts.
create table if not exists next_steps (
  user_id      uuid not null references auth.users (id) on delete cascade,
  step_key     text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, step_key)
);

alter table next_steps enable row level security;

drop policy if exists "proximos pasos propios: leer" on next_steps;
create policy "proximos pasos propios: leer" on next_steps
  for select using (auth.uid() = user_id);

drop policy if exists "proximos pasos propios: marcar" on next_steps;
create policy "proximos pasos propios: marcar" on next_steps
  for insert with check (auth.uid() = user_id);

-- Para "Me equivoqué, todavía no lo hice".
drop policy if exists "proximos pasos propios: desmarcar" on next_steps;
create policy "proximos pasos propios: desmarcar" on next_steps
  for delete using (auth.uid() = user_id);


-- ── 2) El día en que cambia la regla de la racha ────────────────────────
-- Una sola fila. La fecha es el día de Argentina en que se corre esta
-- migración por primera vez; volver a correrla no la cambia.
create table if not exists streak_rule_change (
  id             boolean primary key default true check (id),
  new_rule_since date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date)
);

-- Sin policies: nadie la lee ni la escribe desde la app. Sólo la lee
-- `_calcular_racha`, que es security definer.
alter table streak_rule_change enable row level security;

insert into streak_rule_change (id) values (true) on conflict (id) do nothing;


-- ── 3) La racha ──────────────────────────────────────────────────────────
-- Mismas reglas que la 0028 (un comodín por semana, el día de Argentina, hoy
-- no se juzga, no se camina más atrás del primer día activo). Cambia sólo qué
-- hace activo a un día, según su fecha:
--   · antes del cambio: el paso del día cumplido o algo contado por WhatsApp,
--     como en la 0028;
--   · el día del cambio: cualquiera de las dos reglas, así lo que ya contaba
--     ese día sigue contando;
--   · después: un gasto anotado, por cualquier canal. También cuenta un paso
--     del día cumplido: mientras alguien tenga abierta la versión anterior de
--     la app todavía puede cumplirlo, y no tiene que perder ese día. Cuando
--     nadie la use, `daily_steps` deja de recibir filas.
--
-- `created_at`, no `occurred_at`: la racha mide si apareciste ese día. Quien
-- hoy anota "ayer gasté 5.000" apareció HOY.
create or replace function _calcular_racha(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  zona      constant text := 'America/Argentina/Buenos_Aires';
  hoy       date := (now() at time zone zona)::date;
  corte     date;
  d         date;
  primero   date;
  con_paso  date[];
  wpp_todo  date[];
  con_gasto date[];
  wpp_gasto date[];
  activos   date[];
  cuenta    int := 0;
  usadas    date[] := '{}';
  semana    date;
  detalle   jsonb := '[]'::jsonb;
  clave     text;
begin
  select new_rule_since into corte from streak_rule_change where id;
  -- Sin la fila (no debería pasar): todo lo anterior a hoy, con la regla vieja.
  corte := coalesce(corte, hoy);

  -- Regla vieja: el paso del día cumplido y cualquier movimiento por WhatsApp.
  select coalesce(array_agg(day), '{}') into con_paso
  from daily_steps
  where user_id = p_user and completed_at is not null;

  select coalesce(array_agg(distinct (created_at at time zone zona)::date), '{}') into wpp_todo
  from transactions
  where user_id = p_user and source = 'whatsapp';

  -- Regla nueva: algún gasto anotado. Los de WhatsApp se marcan aparte en el
  -- detalle ("Le contaste un gasto a FINA por WhatsApp").
  select coalesce(array_agg(distinct (created_at at time zone zona)::date), '{}') into con_gasto
  from transactions
  where user_id = p_user and type = 'expense';

  select coalesce(array_agg(distinct (created_at at time zone zona)::date), '{}') into wpp_gasto
  from transactions
  where user_id = p_user and type = 'expense' and source = 'whatsapp';

  -- Los días que cuentan, cada uno con la regla de su fecha.
  select coalesce(array_agg(distinct t.dia), '{}') into activos
  from (
    select unnest(con_paso) as dia
    union all
    select w as dia from unnest(wpp_todo) as w where w <= corte
    union all
    select g as dia from unnest(con_gasto) as g where g >= corte
  ) t;

  select min(x) into primero from unnest(activos) as x;

  if primero is null then
    return jsonb_build_object('dias', 0, 'hoyCumplido', false, 'comodinDisponible', true, 'detalle', '[]'::jsonb);
  end if;

  d := case when hoy = any(activos) then hoy else hoy - 1 end;

  while d >= primero loop
    if d = any(activos) then
      cuenta := cuenta + 1;
      -- Qué lo hizo contar, para el detalle: desde el cambio, primero el gasto;
      -- antes, como en la 0028, primero el paso.
      if d >= corte and d = any(wpp_gasto) then
        detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'whatsapp');
      elsif d >= corte and d = any(con_gasto) then
        detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'gasto');
      elsif d = any(con_paso) then
        select step_key into clave from daily_steps where user_id = p_user and day = d;
        detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'paso', 'paso', clave);
      else
        detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'whatsapp');
      end if;
    else
      -- `::timestamp` explícito: `date_trunc` sobre un date puede elegir la
      -- versión con zona horaria y convertir con la de la sesión.
      semana := date_trunc('week', d::timestamp)::date;
      exit when semana = any(usadas);
      usadas := usadas || semana;
      detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'comodin');
    end if;
    d := d - 1;
  end loop;

  -- Si la racha se cortó, los comodines que se gastaron caminando hacia atrás
  -- no salvaron nada: se sacan del detalle.
  while jsonb_array_length(detalle) > 0 and detalle -> -1 ->> 'tipo' = 'comodin' loop
    detalle := detalle - (jsonb_array_length(detalle) - 1);
  end loop;

  return jsonb_build_object(
    'dias', cuenta,
    'hoyCumplido', hoy = any(activos),
    'comodinDisponible', not exists (
      select 1 from jsonb_array_elements(detalle) e
      where e ->> 'tipo' = 'comodin'
        and date_trunc('week', (e ->> 'dia')::date::timestamp)::date = date_trunc('week', hoy::timestamp)::date
    ),
    'detalle', detalle
  );
end;
$$;

-- La función interna no la ejecuta nadie directo: sólo `mi_racha` (la app) y
-- `racha_de` (el bot), que siguen como en la 0028.
revoke all on function _calcular_racha(uuid) from public, anon, authenticated;
