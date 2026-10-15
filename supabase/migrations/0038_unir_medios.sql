-- ─────────────────────────────────────────────────────────────────────────
-- 0038 — Unir dos medios de pago en uno.
--
-- Pasa seguido que el mismo medio queda cargado con dos nombres ("MP" y
-- "Mercado Pago"): el medio es un texto libre, no una fila a la que apunten
-- los movimientos. Unirlos tiene que mover TODO lo que menciona al medio viejo
-- hacia el que queda, y de una sola vez — si se hiciera desde la app en varias
-- llamadas y se cortara en el medio, la plata quedaría repartida entre los dos
-- nombres, que es peor que antes. Por eso es una función: corre en una sola
-- transacción, con la sesión de la persona (nunca toca filas de otra).
--
-- Qué hace con `origen` y `destino`:
--   · suma el saldo del origen al del destino (lo crea si no existía) y borra
--     la fila del origen en `payment_methods`;
--   · pasa a `destino` los gastos e ingresos (`transactions.payment_method`),
--     los pagos divididos (`transactions.payment_methods`, dentro del jsonb),
--     los gastos fijos y las cargas de saldo (`balance_loads`).
--
-- Si `destino` no existe todavía, la función lo crea: unir "MP" con un nombre
-- nuevo sirve también para renombrar.
--
-- ADITIVA: sólo una función. Correr después de 0037.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function unir_medios(origen text, destino text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  o       text := trim(origen);
  d       text := trim(destino);
  saldo_o numeric;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;
  if o = '' or d = '' then
    raise exception 'falta el nombre de un medio';
  end if;
  if o = d then
    raise exception 'los dos medios son el mismo';
  end if;

  select balance_ars into saldo_o from payment_methods where user_id = uid and name = o;

  insert into payment_methods (user_id, name, balance_ars, last_used_at)
  values (uid, d, 0, now())
  on conflict (user_id, name) do nothing;

  update payment_methods
     set balance_ars = balance_ars + coalesce(saldo_o, 0),
         last_used_at = now()
   where user_id = uid and name = d;

  delete from payment_methods where user_id = uid and name = o;

  update transactions set payment_method = d where user_id = uid and payment_method = o;

  update transactions t
     set payment_methods = (
       select jsonb_agg(
         case when e->>'medio' = o then jsonb_set(e, '{medio}', to_jsonb(d)) else e end
         order by n
       )
       from jsonb_array_elements(t.payment_methods) with ordinality as x(e, n)
     )
   where t.user_id = uid
     and t.payment_methods is not null
     and exists (select 1 from jsonb_array_elements(t.payment_methods) e where e->>'medio' = o);

  update recurring_expenses set payment_method = d where user_id = uid and payment_method = o;

  update balance_loads set medio = d where user_id = uid and medio = o;
end;
$$;

comment on function unir_medios(text, text) is
  'Une el medio de pago `origen` en `destino`: suma saldos y pasa todos los movimientos, pagos divididos, gastos fijos y cargas. Una sola transacción, con la sesión de la persona.';

revoke all on function unir_medios(text, text) from public;
grant execute on function unir_medios(text, text) to authenticated;
