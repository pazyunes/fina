-- ─────────────────────────────────────────────────────────────────────────
-- 0028 — Un paso por día, y la racha que se arma cumpliéndolo.
--
-- ANTES: el "próximo paso" era siempre el mismo hasta que se hacía (si no
-- había gastos, decía "Registrá tu primer gasto" todos los días), y la racha
-- contaba días seguidos con al menos un gasto.
--
-- AHORA: cada día toca UN paso distinto, y la racha cuenta los días seguidos en
-- los que se cumplió. El motivo para volver mañana es que mañana toca otro.
--
-- DOS REGLAS QUE DECIDIÓ MARÍA PAZ:
--
--   1. Un comodín por semana. Si se pasa un día, el comodín salva la racha
--      solo. Si se pasan dos días en la misma semana, vuelve a cero. Perder una
--      racha de 20 días por un olvido se siente como un castigo, y la app no
--      reta.
--
--   2. Registrar por WhatsApp cuenta. Un día en el que la persona le contó un
--      gasto al bot suma a la racha aunque no haya abierto la app. Si no
--      contara, la racha castigaría a quien usa el bot, que es justo lo que
--      queremos que haga.
--
-- EL DÍA ES EL DE ARGENTINA, no el de UTC. A las 22 hs de Buenos Aires ya es
-- el día siguiente en UTC: con fechas UTC, un paso cumplido a la noche contaría
-- para el día equivocado y las rachas se cortarían solas.
--
-- ADITIVA. Correr después de 0027.
-- ─────────────────────────────────────────────────────────────────────────

-- ── El paso de cada día ──────────────────────────────────────────────────
-- Se guarda qué paso le tocó a cada persona cada día. No se recalcula: si se
-- recalculara, completar otra cosa a la tarde podía cambiar el paso a mitad del
-- día, y "uno por día" dejaría de ser cierto. También es lo que hace que se vea
-- el mismo en el celular y en la compu.
create table if not exists daily_steps (
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  -- Clave del paso (ej. 'gasto_hoy', 'tope'). El catálogo vive en la app:
  -- src/app/api/v2/pasos.ts.
  step_key     text not null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (user_id, day)
);

alter table daily_steps enable row level security;

drop policy if exists "pasos propios: leer" on daily_steps;
create policy "pasos propios: leer" on daily_steps
  for select using (auth.uid() = user_id);

drop policy if exists "pasos propios: crear" on daily_steps;
create policy "pasos propios: crear" on daily_steps
  for insert with check (auth.uid() = user_id);

-- Sin esta, marcar el paso como cumplido fallaría en silencio: una tabla con
-- RLS sin policy de UPDATE rechaza los updates sin devolver error.
drop policy if exists "pasos propios: cumplir" on daily_steps;
create policy "pasos propios: cumplir" on daily_steps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── El cálculo de la racha ───────────────────────────────────────────────
-- Una sola definición para la app y para el bot. Si cada uno calculara la suya,
-- el comodín tarde o temprano se aplicaría distinto y la app diría "7 días" y
-- el bot "5".
--
-- Camina hacia atrás desde hoy:
--   · hoy no se juzga: si todavía no se cumplió, el día no terminó y se arranca
--     a contar desde ayer;
--   · un día activo suma uno;
--   · un día sin actividad usa el comodín de SU semana (lunes a domingo). El
--     día salvado no suma, pero tampoco corta;
--   · un segundo día sin actividad en una semana que ya usó su comodín, corta;
--   · no se camina más atrás del primer día activo de la persona: sin este
--     límite, una cuenta nueva "salvaría" semanas en las que ni existía.
--
-- Devuelve el detalle día por día, porque un número de racha que no se puede
-- abrir es un puntaje, no un dato.
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
  con_paso  date[];
  por_wpp   date[];
  cuenta    int := 0;
  usadas    date[] := '{}';
  semana    date;
  detalle   jsonb := '[]'::jsonb;
  clave     text;
begin
  select coalesce(array_agg(day), '{}') into con_paso
  from daily_steps
  where user_id = p_user and completed_at is not null;

  -- `created_at`, no `occurred_at`: la racha mide si apareciste ese día. Quien
  -- hoy le cuenta al bot "ayer gasté 5.000" apareció HOY.
  select coalesce(array_agg(distinct (created_at at time zone zona)::date), '{}') into por_wpp
  from transactions
  where user_id = p_user and source = 'whatsapp';

  select min(x) into primero from unnest(con_paso || por_wpp) as x;

  if primero is null then
    return jsonb_build_object('dias', 0, 'hoyCumplido', false, 'comodinDisponible', true, 'detalle', '[]'::jsonb);
  end if;

  d := case when hoy = any(con_paso) or hoy = any(por_wpp) then hoy else hoy - 1 end;

  while d >= primero loop
    if d = any(con_paso) then
      cuenta := cuenta + 1;
      select step_key into clave from daily_steps where user_id = p_user and day = d;
      detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'paso', 'paso', clave);
    elsif d = any(por_wpp) then
      cuenta := cuenta + 1;
      detalle := detalle || jsonb_build_object('dia', d, 'tipo', 'whatsapp');
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

  -- Si la racha se cortó, los comodines que se "gastaron" caminando hacia atrás
  -- no salvaron nada: se sacan del detalle para no mostrar días salvados de una
  -- racha que ya no existe.
  while jsonb_array_length(detalle) > 0 and detalle -> -1 ->> 'tipo' = 'comodin' loop
    detalle := detalle - (jsonb_array_length(detalle) - 1);
  end loop;

  return jsonb_build_object(
    'dias', cuenta,
    'hoyCumplido', hoy = any(con_paso) or hoy = any(por_wpp),
    -- Se mira el detalle YA RECORTADO y no la lista de semanas usadas: un
    -- comodín que se gastó caminando hacia atrás pero no salvó ninguna racha
    -- no está "usado" para la persona. Ejemplo: faltó lunes y martes, volvió
    -- el miércoles. Su racha nueva es de 1 día y todavía no usó nada.
    'comodinDisponible', not exists (
      select 1 from jsonb_array_elements(detalle) e
      where e ->> 'tipo' = 'comodin'
        and date_trunc('week', (e ->> 'dia')::date::timestamp)::date = date_trunc('week', hoy::timestamp)::date
    ),
    'detalle', detalle
  );
end;
$$;

-- La función interna no la ejecuta nadie directo: sólo las dos de abajo.
revoke all on function _calcular_racha(uuid) from public, anon, authenticated;

-- Para la app: siempre la racha de quien pregunta. No recibe usuario, así que
-- no hay forma de pedir la de otra persona.
create or replace function mi_racha()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select _calcular_racha(auth.uid());
$$;

revoke all on function mi_racha() from public, anon;
grant execute on function mi_racha() to authenticated;

-- Para el bot: la racha de una persona puntual ("llevás 5 días"). Sólo
-- service_role: si el navegador pudiera llamarla, cualquiera vería la racha de
-- cualquiera pasando un id.
create or replace function racha_de(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select _calcular_racha(p_user);
$$;

revoke all on function racha_de(uuid) from public, anon, authenticated;
grant execute on function racha_de(uuid) to service_role;
