-- 0013 — Corrige tickets_disponibles para que el bot calcule IGUAL que la app.
--
-- Había 4 diferencias entre la función SQL del bot y el cálculo del informe:
--
--   1) MATCHEO DE CATEGORÍAS (el bug grave). El JOIN hacía
--        t.category = vee.category
--      pero variable_expense_estimates.category está en inglés ('supermarket')
--      y el bot escribe las transactions en español ('Supermercado'). Nunca
--      matcheaban → gastado_periodo = 0 SIEMPRE → el bot ignoraba lo gastado y
--      siempre devolvía el tope completo de tickets.
--      Fix: normalizamos t.category con fina_canon_category() (misma lógica que
--      mapTxnCategory de la app) antes de joinear.
--
--   2) DÍA DE REINICIO. La función lee user_profiles.income_reset_day, pero la
--      app lo guardaba sólo en auth user_metadata → la columna quedaba NULL →
--      COALESCE = 1. Si la usuaria cambiaba el día, el bot seguía con el 1.
--      Fix: agregamos la columna y la app ahora la espeja (ver IncomeResetControl).
--
--   3) TICKET PROMEDIO. La función usaba siempre average_amount_ars (el estimado
--      del onboarding). La app usa el promedio REAL (gastado/cantidad) una vez
--      que hay transacciones en el período.
--      Fix: misma lógica acá.
--
--   4) PRORRATEO DEL PRIMER PERÍODO. Si el onboarding cae a mitad de período, la
--      app reduce el tope proporcionalmente. La función no lo hacía.
--      Fix: leemos onboardingDate de reports.user_data y prorrateamos igual.

-- ── Día de reinicio en user_profiles (espejo de user_metadata.incomeResetDay) ──
alter table user_profiles
  add column if not exists income_reset_day integer
  check (income_reset_day is null or income_reset_day between 1 and 28);

-- ── Normalizador de categorías (misma lógica que mapTxnCategory en la app) ──
create or replace function fina_canon_category(raw text)
returns text
language sql
immutable
as $$
  select case
    when raw is null                                                  then 'other'
    when lower(raw) ~ 'entreten'                                      then 'entertainment'
    when lower(raw) ~ 'deliver|pedido|rappi'                          then 'delivery'
    when lower(raw) ~ 'cafe|cafeter'                                  then 'cafeterias'
    when lower(raw) ~ 'restaur'                                       then 'restaurants'
    when lower(raw) ~ 'super|mercado|almac'                           then 'supermarket'
    when lower(raw) ~ 'vivienda|alquiler|hogar|expensas'             then 'housing'
    when lower(raw) ~ 'salud|prepaga|m[eé]dic'                        then 'health'
    when lower(raw) ~ 'belleza|peluquer|manicur'                      then 'beauty'
    when lower(raw) ~ 'terapia|psico'                                 then 'therapy'
    when lower(raw) ~ 'gimnasio|gym'                                  then 'gym'
    when lower(raw) ~ 'nafta|combust|sube|transp|colectiv|uber|taxi|cabify' then 'transport'
    when lower(raw) ~ 'suscrip|streaming'                             then 'subscriptions'
    else 'other'
  end
$$;

-- ── Función corregida ──
create or replace function tickets_disponibles(p_user_id uuid)
returns table (
  category_name        text,
  tope_mensual         numeric,
  gastado_periodo      numeric,
  restante             numeric,
  ticket_promedio      numeric,
  salidas_disponibles  integer
)
language plpgsql
security definer
as $$
declare
  v_reset_day       integer;
  v_periodo_inicio  date;
  v_hoy             date := current_date;
  v_onboarding      date;
  v_prorate         numeric := 1;
begin
  select coalesce(income_reset_day, 1) into v_reset_day
  from user_profiles where id = p_user_id;
  if v_reset_day is null then v_reset_day := 1; end if;

  -- Inicio del período según el día de reinicio.
  if extract(day from v_hoy) >= v_reset_day then
    v_periodo_inicio := date_trunc('month', v_hoy) + (v_reset_day - 1) * interval '1 day';
  else
    v_periodo_inicio := date_trunc('month', v_hoy) - interval '1 month' + (v_reset_day - 1) * interval '1 day';
  end if;

  -- Prorrateo del primer período (igual que la app): si el onboarding cayó
  -- dentro del período en curso, reducimos el tope por los días ya pasados.
  select (user_data->>'onboardingDate')::date into v_onboarding
  from reports where user_id = p_user_id;
  if v_onboarding is not null and v_onboarding >= v_periodo_inicio then
    v_prorate := greatest(1 - (v_onboarding - v_periodo_inicio) / 30.0, 0);
  end if;

  return query
  with gastos as (
    select fina_canon_category(t.category) as cat,
           sum(t.amount_ars)               as gastado,
           count(*)                        as n
    from transactions t
    where t.user_id = p_user_id
      and t.type = 'expense'
      and t.occurred_at >= v_periodo_inicio::timestamptz
    group by 1
  ),
  calc as (
    select
      vee.category                                                          as cat,
      round((vee.weekly_frequency * vee.average_amount_ars * 4.33 * v_prorate)::numeric, 2) as tope,
      coalesce(g.gastado, 0)::numeric                                       as gastado,
      greatest(vee.weekly_frequency * vee.average_amount_ars * 4.33 * v_prorate - coalesce(g.gastado, 0), 0) as restante,
      case when coalesce(g.n, 0) > 0
           then g.gastado / g.n
           else vee.average_amount_ars
      end                                                                   as ticket
    from variable_expense_estimates vee
    left join gastos g on g.cat = vee.category
    where vee.user_id = p_user_id
  )
  -- Calificamos todo con calc.* para evitar ambigüedad con las columnas OUT del
  -- RETURNS TABLE (ej: 'restante' existe como columna del CTE y como columna de
  -- salida). Sin el calc., Postgres tira "column reference is ambiguous".
  select
    calc.cat,
    calc.tope,
    calc.gastado,
    round(calc.restante::numeric, 2),
    round(calc.ticket::numeric, 2),
    greatest(0, floor(calc.restante / nullif(calc.ticket, 0)))::integer
  from calc;
end;
$$;
