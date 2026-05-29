-- PR5 — Backfill live profile tables from reports.user_data (Phase 1).
-- For each authenticated user, picks their LATEST report and parses its
-- user_data jsonb into the new live tables.
--
-- Idempotent: each INSERT is guarded by NOT EXISTS / ON CONFLICT, so
-- re-running this file is safe.
--
-- Anonymous reports (user_id IS NULL, from before PR3) are skipped on
-- purpose. They have no owner to backfill into.
--
-- Correr una vez en el SQL editor de Supabase después de 0003.

begin;

-- ── Latest report per authenticated user ──────────────────────────────
-- Materialized as a temp table because we reference it 6 times below.
drop table if exists _latest_report;
create temporary table _latest_report as
select distinct on (user_id)
  user_id,
  user_data,
  email,
  name,
  created_at
from reports
where user_id is not null
order by user_id, created_at desc;

-- ── Make sure every auth user has a user_profiles row ────────────────
-- The on_auth_user_created trigger only fires on future inserts; existing
-- users need to be seeded once. This is also what makes the next UPDATE
-- safe to run.
insert into user_profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- ── user_profiles: fill personal data from the latest report ──────────
-- COALESCE preserves anything that may have already been written (e.g. a
-- phone value typed in between Task 2 and now).
update user_profiles up
set
  name             = coalesce(up.name,             lr.user_data->>'name'),
  age              = coalesce(up.age,              nullif(lr.user_data->>'age','')::int),
  gender           = coalesce(up.gender,           lr.user_data->>'gender'),
  lives_alone      = coalesce(up.lives_alone,      (lr.user_data->>'livesAlone')::boolean),
  works_or_studies = coalesce(up.works_or_studies, lr.user_data->>'worksOrStudies'),
  banks            = case
                       when array_length(up.banks, 1) is null
                         then array(select jsonb_array_elements_text(coalesce(lr.user_data->'banks','[]'::jsonb)))
                       else up.banks
                     end,
  income_type      = coalesce(up.income_type,      lr.user_data->>'incomeType', 'fixed')
from _latest_report lr
where up.id = lr.user_id;

-- ── incomes: one row for the fixed salary (if applicable) ─────────────
insert into incomes (user_id, type, source, amount_ars, currency, original_amount, range_label)
select
  lr.user_id,
  'fixed',
  'sueldo',
  -- For type='both' the stored monthlyIncome already includes the
  -- freelance average; subtract it back out so the fixed row holds only
  -- the salary portion.
  greatest(
    (lr.user_data->>'monthlyIncome')::numeric
      - coalesce((lr.user_data->'freelanceIncome'->>'monthlyAvgArs')::numeric, 0),
    0
  ),
  coalesce(lr.user_data->>'incomeCurrency','ARS'),
  nullif(lr.user_data->>'incomeOriginalAmount','')::numeric,
  lr.user_data->>'incomeRange'
from _latest_report lr
where coalesce(lr.user_data->>'incomeType','fixed') in ('fixed','both')
  and (lr.user_data->>'monthlyIncome')::numeric > 0
  and not exists (
    select 1 from incomes i
    where i.user_id = lr.user_id and i.type = 'fixed'
  );

-- ── incomes: one row per freelance month ──────────────────────────────
insert into incomes (user_id, type, source, period, amount_ars, currency, original_amount)
select
  lr.user_id,
  'freelance',
  'freelance',
  p.period,
  ((lr.user_data->'freelanceIncome'->p.period)->>'ars')::numeric,
  coalesce((lr.user_data->'freelanceIncome'->p.period)->>'currency','ARS'),
  ((lr.user_data->'freelanceIncome'->p.period)->>'amount')::numeric
from _latest_report lr
cross join (values ('month1'),('month2'),('month3')) as p(period)
where lr.user_data->>'incomeType' in ('freelance','both')
  and lr.user_data->'freelanceIncome'->p.period is not null
  and not exists (
    select 1 from incomes i
    where i.user_id = lr.user_id
      and i.type = 'freelance'
      and i.period = p.period
  );

-- ── fixed_expenses: six named categories ──────────────────────────────
-- Each category becomes one row with merchant = NULL. Skips zero values.
insert into fixed_expenses (user_id, category, amount_ars, currency, original_amount, metadata)
select
  lr.user_id,
  c.cat,
  ((lr.user_data->'expenses')->>c.cat)::numeric,
  case when c.cat = 'housing' then coalesce(lr.user_data->>'housingCurrency','ARS') else 'ARS' end,
  case when c.cat = 'housing' then nullif(lr.user_data->>'housingOriginalAmount','')::numeric else null end,
  case
    when c.cat = 'therapy' and lr.user_data->'therapyDetails' is not null then jsonb_build_object(
      'session_price',      (lr.user_data->'therapyDetails'->>'sessionPrice')::numeric,
      'sessions_per_month', (lr.user_data->'therapyDetails'->>'sessionsPerMonth')::numeric
    )
    else '{}'::jsonb
  end
from _latest_report lr
cross join (values
  ('housing'),('health'),('beauty'),('therapy'),('gym'),('transport')
) as c(cat)
where ((lr.user_data->'expenses')->>c.cat)::numeric > 0
  and not exists (
    select 1 from fixed_expenses fe
    where fe.user_id = lr.user_id
      and fe.category = c.cat
      and fe.merchant is null
  );

-- ── fixed_expenses: installments ──────────────────────────────────────
insert into fixed_expenses (user_id, category, merchant, amount_ars, currency, original_amount, metadata)
select
  lr.user_id,
  'installment',
  inst->>'name',
  (inst->>'monthlyAmount')::numeric,
  coalesce(inst->>'currency','ARS'),
  nullif(inst->>'originalAmount','')::numeric,
  jsonb_build_object('remaining', nullif(inst->>'remainingInstallments','')::int)
from _latest_report lr
cross join lateral jsonb_array_elements(coalesce(lr.user_data->'installments','[]'::jsonb)) as inst
where coalesce(inst->>'name','') <> ''
  and not exists (
    select 1 from fixed_expenses fe
    where fe.user_id = lr.user_id
      and fe.category = 'installment'
      and fe.merchant = inst->>'name'
  );

-- ── fixed_expenses: subscriptions ─────────────────────────────────────
insert into fixed_expenses (user_id, category, merchant, amount_ars)
select
  lr.user_id,
  'subscription',
  sub->>'name',
  (sub->>'cost')::numeric
from _latest_report lr
cross join lateral jsonb_array_elements(coalesce(lr.user_data->'subscriptions','[]'::jsonb)) as sub
where coalesce(sub->>'name','') <> ''
  and not exists (
    select 1 from fixed_expenses fe
    where fe.user_id = lr.user_id
      and fe.category = 'subscription'
      and fe.merchant = sub->>'name'
  );

-- ── variable_expense_estimates ────────────────────────────────────────
-- One INSERT per category. ON CONFLICT (user_id, category) DO NOTHING
-- guards against re-runs.
insert into variable_expense_estimates (user_id, category, weekly_frequency, average_amount_ars)
select lr.user_id, 'entertainment',
       coalesce((lr.user_data->>'entertainmentFrequency')::int, 0),
       coalesce((lr.user_data->>'entertainmentAmount')::numeric, 0)
from _latest_report lr
where coalesce((lr.user_data->>'entertainmentFrequency')::int, 0) > 0
on conflict (user_id, category) do nothing;

insert into variable_expense_estimates (user_id, category, weekly_frequency, average_amount_ars)
select lr.user_id, 'delivery',
       coalesce((lr.user_data->>'deliveryFrequency')::int, 0),
       coalesce((lr.user_data->>'deliveryAmount')::numeric, 0)
from _latest_report lr
where coalesce((lr.user_data->>'deliveryFrequency')::int, 0) > 0
on conflict (user_id, category) do nothing;

insert into variable_expense_estimates (user_id, category, weekly_frequency, average_amount_ars)
select lr.user_id, 'supermarket',
       coalesce((lr.user_data->>'supermarketFrequency')::int, 0),
       coalesce((lr.user_data->>'supermarketAmount')::numeric, 0)
from _latest_report lr
where coalesce((lr.user_data->>'supermarketFrequency')::int, 0) > 0
on conflict (user_id, category) do nothing;

-- ── goals (from user_data.specificGoals[]) ───────────────────────────
-- Reads from `specificGoals`, NOT `goals`. `goals` is a string[] of
-- onboarding category labels with no amount/timeframe; only specificGoals
-- has the measurable data the new goals table models.
insert into goals (user_id, title, amount_ars, timeframe_months, status)
select
  lr.user_id,
  goal->>'title',
  (goal->>'amount')::numeric,
  (goal->>'timeframe')::int,
  'active'
from _latest_report lr
cross join lateral jsonb_array_elements(coalesce(lr.user_data->'specificGoals','[]'::jsonb)) as goal
where coalesce(goal->>'title','') <> ''
  and not exists (
    select 1 from goals g
    where g.user_id = lr.user_id
      and g.title = goal->>'title'
  );

commit;
