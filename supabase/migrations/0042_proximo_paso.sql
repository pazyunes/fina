-- 0042: el próximo paso y la racha por días con gastos.
-- Idempotente: se puede correr más de una vez. Correr después de 0041.
--
-- ANTES (0028): un paso distinto por día, que se cumplía solo mirando los
-- datos, y la racha contaba los días con el paso cumplido o con un gasto
-- contado por WhatsApp.
--
-- AHORA (decisión oct 2026): en Inicio hay UN próximo paso grande ("Abrí una
-- cuenta donde tu plata rinda", "Hacé tu primera inversión") que queda hasta
-- que la persona marca que lo hizo, y la racha cuenta los días en que anotó al
-- menos un gasto, en la app o por WhatsApp. Registrar lo del día es lo que
-- sostiene todo lo demás; el próximo paso es lo que hace avanzar.
--
-- `daily_steps` no se borra: tiene la historia de los pasos de cada día. Deja
-- de escribirse.

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


-- ── 2) La racha: días con al menos un gasto anotado ─────────────────────
-- Mismas reglas que la 0028 (un comodín por semana, el día de Argentina, no se
-- camina más atrás del primer día activo); cambia sólo qué hace activo a un
-- día: haber anotado un gasto, por cualquier canal.
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
  d         date;
  primero   date;
  con_gasto date[];
  por_wpp   date[];
  cuenta    int := 0;
  usadas    date[] := '{}';
  semana    date;
  detalle   jsonb := '[]'::jsonb;
begin
  select coalesce(array_agg(distinct (created_at at time zone zona)::date), '{}') into con_gasto
  from transactions
  where user_id = p_user and type = 'expense';

  -- Los de WhatsApp se marcan aparte en el detalle ("Le contaste un gasto a
  -- FINA por WhatsApp"): es el canal que más queremos que use.
  select coalesce(array_agg(distinct (created_at at time zone zona)::date), '{}') into por_wpp
  from transactions
  where user_id = p_user and type = 'expense' and source = 'whatsapp';

  select min(x) into primero from unnest(con_gasto) as x;

  if primero is null then
    return jsonb_build_object('dias', 0, 'hoyCumplido', false, 'comodinDisponible', true, 'detalle', '[]'::jsonb);
  end if;

  d := case when hoy = any(con_gasto) then hoy else hoy - 1 end;

  while d >= primero loop
    if d = any(por_wpp) then
      cuenta := cuenta + 1;
      detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'whatsapp');
    elsif d = any(con_gasto) then
      cuenta := cuenta + 1;
      detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'gasto');
    else
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
    'hoyCumplido', hoy = any(con_gasto),
    'comodinDisponible', not exists (
      select 1 from jsonb_array_elements(detalle) e
      where e ->> 'tipo' = 'comodin'
        and date_trunc('week', (e ->> 'dia')::date::timestamp)::date = date_trunc('week', hoy::timestamp)::date
    ),
    'detalle', detalle
  );
end;
$$;

revoke all on function _calcular_racha(uuid) from public, anon, authenticated;
