-- ─────────────────────────────────────────────────────────────────────────
-- 0025 — El saldo de un medio de pago se mueve de forma atómica.
--
-- Bug que esto arregla (encontrado probando el alta real contra la base):
-- registrar un gasto descontaba del dinero disponible en la pantalla, pero
-- NO en la base. Al recargar, el disponible volvía a lo de antes. O sea: la
-- pantalla decía $185.000 y la base decía $200.000.
--
-- Y arreglarlo con un "leer el saldo, restar, escribir" desde el cliente
-- tendría un problema peor: entre la lectura y la escritura puede entrar otro
-- gasto —del otro teléfono, o del bot de WhatsApp, que escribe para todas— y
-- ese gasto se pierde. Un saldo que se pisa es plata que la persona cree tener
-- y no tiene.
--
-- Esta función suma un delta al saldo DENTRO de una sola sentencia: el
-- `on conflict do update` lee la fila con el lock puesto, así que dos gastos
-- simultáneos se restan los dos. La app y el bot tienen que usar esto y no un
-- update directo.
--
-- ADITIVA. Correr después de 0024.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function mover_saldo(medio text, delta numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  nombre text := coalesce(nullif(trim(medio), ''), 'Efectivo');
  nuevo  numeric;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;

  insert into payment_methods (user_id, name, balance_ars, last_used_at)
  values (uid, nombre, delta, now())
  on conflict (user_id, name) do update
    set balance_ars  = payment_methods.balance_ars + delta,
        last_used_at = now()
  returning payment_methods.balance_ars into nuevo;

  return nuevo;
end;
$$;

comment on function mover_saldo(text, numeric) is
  'Suma delta al saldo de un medio (negativo para descontar), atómico. Lo crea si no existía. Usarla en vez de un update: un read-modify-write pierde escrituras concurrentes de la app y del bot.';

revoke all on function mover_saldo(text, numeric) from public;
grant execute on function mover_saldo(text, numeric) to authenticated;
-- El bot escribe con service_role, que ya puede ejecutar todo, pero se deja
-- explícito para que quede claro que es la vía compartida.
grant execute on function mover_saldo(text, numeric) to service_role;
