-- ─────────────────────────────────────────────────────────────────────────
-- 0040 · Cada movimiento de plata, una sola transacción (DEBT D3).
--
-- Se corre A MANO en el SQL editor de Supabase, después de la 0039 (y de la
-- 0025, 0033, 0035 y 0036, de las que usa columnas y `mover_saldo`). Se puede
-- volver a correr: todo es create or replace.
--
-- Hasta acá, registrar un gasto desde la app eran varias llamadas: insertar la
-- fila y después un `mover_saldo` por medio. Si fallaba el saldo, la app
-- deshacía paso a paso (D1), pero un corte justo mientras deshacía podía
-- dejar un gasto sin descontar, o un saldo descontado sin gasto. Estas
-- funciones hacen todo junto: o queda todo, o no queda nada.
--
--   registrar_gasto(fila)       inserta el gasto y descuenta de cada medio.
--   editar_gasto(id, cambios)   actualiza y corrige los saldos.
--   borrar_gasto(id)            devuelve la plata a cada medio y borra.
--   registrar_ingreso(fila)     inserta el ingreso y suma al medio.
--   editar_ingreso(id, cambios) actualiza y corrige el saldo.
--   borrar_ingreso(id)          le saca la plata al medio y borra.
--
-- Cuánto mover sale de la FILA (la que se guarda, o la que estaba), no de lo
-- que diga el cliente: un gasto dividido mueve cada parte de
-- `payment_methods`; uno común, `amount_ars` del `payment_method`. Un ingreso
-- suma, un gasto resta. Al editar se compara lo de antes con lo de después y se
-- mueve sólo la diferencia de cada medio.
--
-- `fila` y `cambios` van en jsonb con los nombres de las columnas de
-- `transactions`. En `cambios`, una clave que no viene es "no tocar esa
-- columna" y una que viene en null es "dejarla en null", igual que el update
-- que hacía la app.
--
-- Todas son SECURITY DEFINER con search_path fijo, y trabajan sólo sobre filas
-- de auth.uid(): nunca tocan movimientos de otra persona.
--
-- La app las usa si existen. Si esta migración no se corrió, sigue haciendo lo
-- de antes en varias llamadas (ver `src/app/api/v2/index.ts`).
-- ─────────────────────────────────────────────────────────────────────────


-- ── Lo que un movimiento le hace a cada medio ────────────────────────────
-- Una fila por medio, con el delta que el movimiento le aplicó al saldo:
-- negativo para un gasto, positivo para un ingreso. Interna: no se expone.
create or replace function efecto_en_medios(t transactions)
returns table (medio text, delta numeric)
language sql
immutable
set search_path = public
as $$
  -- Dividido: una fila por parte.
  select e->>'medio',
         (case when t.type = 'income' then 1 else -1 end) * (e->>'monto')::numeric
    from jsonb_array_elements(
           case when jsonb_typeof(t.payment_methods) = 'array' then t.payment_methods else '[]'::jsonb end
         ) as e
   where coalesce(trim(e->>'medio'), '') <> ''
  union all
  -- Común: el total, sólo si no hay partes.
  select t.payment_method,
         (case when t.type = 'income' then 1 else -1 end) * t.amount_ars
   where (case when jsonb_typeof(t.payment_methods) = 'array'
               then jsonb_array_length(t.payment_methods) else 0 end) = 0
     and coalesce(trim(t.payment_method), '') <> '';
$$;

revoke all on function efecto_en_medios(transactions) from public, anon, authenticated;


-- ── Validaciones comunes ─────────────────────────────────────────────────
-- Como las funciones son definer, RLS no frena nada: lo que antes chequeaba la
-- policy (o la FK con la sesión) se chequea acá a mano. El grupo se mira sólo
-- al registrar (`con_grupo`): editar no cambia el grupo, y quien ya salió del
-- grupo tiene que poder seguir corrigiendo un gasto viejo.
create or replace function validar_movimiento(t transactions, con_grupo boolean)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if t.amount_ars is null or t.amount_ars < 0 then
    raise exception 'el monto no es válido';
  end if;
  if t.section_id is not null and not exists (
    select 1 from expense_sections s where s.id = t.section_id and s.user_id = t.user_id
  ) then
    raise exception 'esa sección no es tuya';
  end if;
  if con_grupo and t.group_id is not null and not exists (
    select 1 from group_members m where m.group_id = t.group_id and m.user_id = t.user_id
  ) then
    raise exception 'no sos parte de ese grupo';
  end if;
end;
$$;

revoke all on function validar_movimiento(transactions, boolean) from public, anon, authenticated;


-- ── Insertar un movimiento (gasto o ingreso) y mover sus saldos ──────────
create or replace function registrar_movimiento(tipo text, fila jsonb)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  nueva transactions;
  m     record;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;

  insert into transactions (
    id, user_id, occurred_at, type, amount_ars, currency, original_amount,
    exchange_rate_id, description, section_id, expense_type, expense_type_other,
    payment_method, payment_methods, group_id, income_source, income_source_other, source
  ) values (
    coalesce((fila->>'id')::uuid, gen_random_uuid()),
    uid,
    coalesce((fila->>'occurred_at')::timestamptz, now()),
    tipo,
    (fila->>'amount_ars')::numeric,
    coalesce(fila->>'currency', 'ARS'),
    (fila->>'original_amount')::numeric,
    (fila->>'exchange_rate_id')::uuid,
    fila->>'description',
    case when tipo = 'expense' then (fila->>'section_id')::uuid end,
    case when tipo = 'expense' then fila->>'expense_type' end,
    case when tipo = 'expense' then fila->>'expense_type_other' end,
    fila->>'payment_method',
    case when tipo = 'expense'
          and jsonb_typeof(fila->'payment_methods') = 'array'
          and jsonb_array_length(fila->'payment_methods') > 0
         then fila->'payment_methods' end,
    case when tipo = 'expense' then (fila->>'group_id')::uuid end,
    case when tipo = 'income' then fila->>'income_source' end,
    case when tipo = 'income' then fila->>'income_source_other' end,
    -- 'web' = lo cargó la persona en la app. El bot escribe 'whatsapp' y no
    -- pasa por acá.
    'web'
  )
  returning * into nueva;

  perform validar_movimiento(nueva, true);

  for m in select * from efecto_en_medios(nueva) loop
    perform mover_saldo(m.medio, m.delta);
  end loop;

  return nueva;
end;
$$;

revoke all on function registrar_movimiento(text, jsonb) from public, anon, authenticated;


-- ── Editar un movimiento y corregir los saldos ───────────────────────────
create or replace function editar_movimiento(tipo text, mov uuid, cambios jsonb)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  c     jsonb := coalesce(cambios, '{}'::jsonb);
  vieja transactions;
  nueva transactions;
  m     record;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;

  -- `for update`: si otra edición del mismo movimiento entra a la vez, espera
  -- a que ésta termine y calcula su diferencia sobre lo ya guardado.
  select * into vieja from transactions
   where id = mov and user_id = uid and type = tipo
   for update;
  if vieja.id is null then
    raise exception 'no encontramos ese movimiento';
  end if;

  update transactions set
    amount_ars          = case when c ? 'amount_ars'          then (c->>'amount_ars')::numeric          else amount_ars end,
    currency            = case when c ? 'currency'            then coalesce(c->>'currency', 'ARS')      else currency end,
    original_amount     = case when c ? 'original_amount'     then (c->>'original_amount')::numeric     else original_amount end,
    exchange_rate_id    = case when c ? 'exchange_rate_id'    then (c->>'exchange_rate_id')::uuid       else exchange_rate_id end,
    description         = case when c ? 'description'         then c->>'description'                    else description end,
    occurred_at         = case when c ? 'occurred_at'         then (c->>'occurred_at')::timestamptz     else occurred_at end,
    payment_method      = case when c ? 'payment_method'      then c->>'payment_method'                 else payment_method end,
    payment_methods     = case when tipo = 'expense' and c ? 'payment_methods'
                               then case when jsonb_typeof(c->'payment_methods') = 'array'
                                          and jsonb_array_length(c->'payment_methods') > 0
                                         then c->'payment_methods' end
                               else payment_methods end,
    section_id          = case when tipo = 'expense' and c ? 'section_id'         then (c->>'section_id')::uuid else section_id end,
    expense_type        = case when tipo = 'expense' and c ? 'expense_type'       then c->>'expense_type'       else expense_type end,
    expense_type_other  = case when tipo = 'expense' and c ? 'expense_type_other' then c->>'expense_type_other' else expense_type_other end,
    income_source       = case when tipo = 'income' and c ? 'income_source'       then c->>'income_source'       else income_source end,
    income_source_other = case when tipo = 'income' and c ? 'income_source_other' then c->>'income_source_other' else income_source_other end
  where id = mov
  returning * into nueva;

  perform validar_movimiento(nueva, false);

  -- Lo que hace falta mover en cada medio para pasar del efecto viejo al
  -- nuevo. Si no cambió ni el monto ni el medio, no se mueve nada.
  for m in
    select x.medio, sum(x.delta) as delta
      from (
        select medio, delta from efecto_en_medios(nueva)
        union all
        select medio, -delta from efecto_en_medios(vieja)
      ) x
     group by x.medio
    having sum(x.delta) <> 0
  loop
    perform mover_saldo(m.medio, m.delta);
  end loop;

  return nueva;
end;
$$;

revoke all on function editar_movimiento(text, uuid, jsonb) from public, anon, authenticated;


-- ── Borrar un movimiento y devolver su efecto ────────────────────────────
create or replace function borrar_movimiento(tipo text, mov uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  vieja transactions;
  m     record;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;

  select * into vieja from transactions
   where id = mov and user_id = uid and type = tipo
   for update;
  if vieja.id is null then
    raise exception 'no se pudo borrar. Volvé a cargar y probá de nuevo';
  end if;

  for m in select * from efecto_en_medios(vieja) loop
    perform mover_saldo(m.medio, -m.delta);
  end loop;

  delete from transactions where id = mov;
end;
$$;

revoke all on function borrar_movimiento(text, uuid) from public, anon, authenticated;


-- ── Las seis que llama la app ────────────────────────────────────────────
create or replace function registrar_gasto(fila jsonb)
returns transactions
language sql
security definer
set search_path = public
as $$ select registrar_movimiento('expense', fila); $$;

create or replace function editar_gasto(id uuid, cambios jsonb)
returns transactions
language sql
security definer
set search_path = public
as $$ select editar_movimiento('expense', id, cambios); $$;

create or replace function borrar_gasto(id uuid)
returns void
language sql
security definer
set search_path = public
as $$ select borrar_movimiento('expense', id); $$;

create or replace function registrar_ingreso(fila jsonb)
returns transactions
language sql
security definer
set search_path = public
as $$ select registrar_movimiento('income', fila); $$;

create or replace function editar_ingreso(id uuid, cambios jsonb)
returns transactions
language sql
security definer
set search_path = public
as $$ select editar_movimiento('income', id, cambios); $$;

create or replace function borrar_ingreso(id uuid)
returns void
language sql
security definer
set search_path = public
as $$ select borrar_movimiento('income', id); $$;

comment on function registrar_gasto(jsonb) is
  'Inserta un gasto (columnas de transactions en jsonb) y descuenta de cada medio, en una sola transacción.';
comment on function editar_gasto(uuid, jsonb) is
  'Actualiza las columnas que vienen en cambios y mueve en cada medio sólo la diferencia, en una sola transacción.';
comment on function borrar_gasto(uuid) is
  'Devuelve la plata a cada medio y borra el gasto, en una sola transacción.';
comment on function registrar_ingreso(jsonb) is
  'Inserta un ingreso y suma al medio, en una sola transacción.';
comment on function editar_ingreso(uuid, jsonb) is
  'Actualiza el ingreso y mueve en cada medio sólo la diferencia, en una sola transacción.';
comment on function borrar_ingreso(uuid) is
  'Le saca la plata al medio y borra el ingreso, en una sola transacción.';

revoke all on function registrar_gasto(jsonb)         from public;
revoke all on function editar_gasto(uuid, jsonb)      from public;
revoke all on function borrar_gasto(uuid)             from public;
revoke all on function registrar_ingreso(jsonb)       from public;
revoke all on function editar_ingreso(uuid, jsonb)    from public;
revoke all on function borrar_ingreso(uuid)           from public;
grant execute on function registrar_gasto(jsonb)      to authenticated;
grant execute on function editar_gasto(uuid, jsonb)   to authenticated;
grant execute on function borrar_gasto(uuid)          to authenticated;
grant execute on function registrar_ingreso(jsonb)    to authenticated;
grant execute on function editar_ingreso(uuid, jsonb) to authenticated;
grant execute on function borrar_ingreso(uuid)        to authenticated;

-- Que la API vea las funciones nuevas sin esperar a que recargue sola.
notify pgrst, 'reload schema';
