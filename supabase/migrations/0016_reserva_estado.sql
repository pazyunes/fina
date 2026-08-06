-- 0016 — Estado de la reserva general, para que el bot avise si los gastos se
-- la comen. La reserva la setea la usuaria en el informe y se guarda en
-- reports.user_data->>'reserveArs'. El disponible del mes está en
-- reports.analysis->>'available'.
--
-- Devuelve (todo en ARS):
--   reserve           → cuánto apartó
--   available         → disponible del mes
--   spent_period      → gastos registrados en el período en curso
--   free              → available − reserve (lo que puede gastar sin tocar la reserva)
--   consumed_reserve  → cuánto de la reserva ya se comió (0 si todavía no la tocó)
--
-- El bot: tras registrar un gasto, llama a reserva_estado(user_id); si
-- consumed_reserve > 0, avisa "usaste $consumed_reserve de tu reserva".

create or replace function reserva_estado(p_user_id uuid)
returns table (
  reserve          numeric,
  available        numeric,
  spent_period     numeric,
  free             numeric,
  consumed_reserve numeric
)
language plpgsql
security definer
as $$
declare
  v_reset_day      integer;
  v_periodo_inicio date;
  v_hoy            date := current_date;
  v_reserve        numeric := 0;
  v_available      numeric := 0;
  v_spent          numeric := 0;
begin
  select coalesce(income_reset_day, 1) into v_reset_day
  from user_profiles where id = p_user_id;
  if v_reset_day is null then v_reset_day := 1; end if;

  if extract(day from v_hoy) >= v_reset_day then
    v_periodo_inicio := date_trunc('month', v_hoy) + (v_reset_day - 1) * interval '1 day';
  else
    v_periodo_inicio := date_trunc('month', v_hoy) - interval '1 month' + (v_reset_day - 1) * interval '1 day';
  end if;

  select coalesce((user_data ->> 'reserveArs')::numeric, 0),
         coalesce((analysis  ->> 'available')::numeric, 0)
    into v_reserve, v_available
  from reports where user_id = p_user_id;

  select coalesce(sum(amount_ars), 0) into v_spent
  from transactions
  where user_id = p_user_id
    and type = 'expense'
    and occurred_at >= v_periodo_inicio::timestamptz;

  reserve          := v_reserve;
  available        := v_available;
  spent_period     := v_spent;
  free             := greatest(v_available - v_reserve, 0);
  consumed_reserve := greatest(v_spent - greatest(v_available - v_reserve, 0), 0);
  return next;
end;
$$;
