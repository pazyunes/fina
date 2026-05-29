# Supabase Live Profile Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the seven relational tables described in `docs/superpowers/specs/2026-05-28-supabase-schema-redesign-design.md` and backfill them from the existing `reports.user_data` jsonb, without changing any user-facing behavior in the web app.

**Architecture:** Two pure-SQL Supabase migrations. `0003_live_profile.sql` defines six new tables (`user_profiles`, `incomes`, `fixed_expenses`, `variable_expense_estimates`, `goals`, `transactions`), their indexes, RLS policies, a shared `updated_at` trigger, and a trigger on `auth.users` that auto-creates a `user_profiles` row at signup. `0004_backfill_from_reports.sql` parses the latest `reports.user_data` jsonb per authenticated user and inserts into the new tables idempotently. The web app stays on the old jsonb path until a separate follow-up plan flips the new code on.

**Tech Stack:** Postgres 15 on Supabase, `pgcrypto` extension for `gen_random_uuid()`. Migrations are pasted into the Supabase SQL editor exactly the way `0001_exchange_rates.sql` and `0002_reports_auth.sql` already are — no Supabase CLI, no local Postgres. Verification is by SQL inspection; no test framework is added in this plan.

**Scope:** This plan covers **Phase 0 (schema) and Phase 1 (backfill)** from the spec. Phase 2 (app dual-write behind `VITE_USE_LIVE_PROFILE`) and Phase 3 (`/perfil` CRUD over the live tables) will be a separate follow-up plan once these migrations are in production and validated. Phase 4 (WhatsApp bot) is out of scope of every plan in this thread.

**Branch:** `feat/pr5-supabase-schema-redesign` (already created and tracking the spec). All commits in this plan land there, then get fast-forwarded to `main` and pushed (the user has standing instructions to push every change for Vercel previews — but since this plan touches no Vite code, no preview deploy is triggered).

---

## Pre-flight checklist

Before starting any task:

- [ ] **Confirm branch.** Run `git -C "/Users/mariapazyunes/Documents/GitHub/fina1/Fina" branch --show-current` — expected: `feat/pr5-supabase-schema-redesign`. If not, run `git checkout feat/pr5-supabase-schema-redesign`.
- [ ] **Have Supabase access.** You need to be logged into the Supabase dashboard for project `pazyunes/fina` with permissions to use the SQL editor. The previous migrations (`0001`, `0002`) were applied that way.
- [ ] **Know what's in production today.** Run this in the Supabase SQL editor and keep the numbers handy — every later verification step references them:

  ```sql
  -- "Census" of what exists today, before any change.
  select
    (select count(*) from auth.users)                                                   as total_users,
    (select count(*) from reports)                                                       as total_reports,
    (select count(*) from reports where user_id is not null)                             as reports_with_user,
    (select count(distinct user_id) from reports where user_id is not null)              as distinct_users_with_reports,
    (select count(*) from reports where user_id is null)                                 as anonymous_reports;
  ```

  Save the four numbers somewhere local (a comment in the migration file is fine). The backfill expects `distinct_users_with_reports` rows in `user_profiles` with a non-null `name` and matching `incomes`/`fixed_expenses`/etc. counts.

- [ ] **Skim the jsonb shape.** Run:

  ```sql
  select user_data
  from reports
  where user_id is not null
  order by created_at desc
  limit 3;
  ```

  Confirm the keys match what `0004` assumes (see Task 3 step 1 for the full list). If `goals[]` or `freelanceIncome` look different from the spec, **stop and tell the user before continuing** — the backfill SQL needs to be adjusted.

---

## Task 1: Write `0003_live_profile.sql`

**Files:**
- Create: `Fina/supabase/migrations/0003_live_profile.sql`

- [ ] **Step 1: Create the file with the full schema, RLS policies, and triggers**

The whole migration goes in one file. It's long, but it's a single logical unit (a re-runnable schema deployment), so a single commit is appropriate. Every statement uses `if not exists` / `or replace` so re-running is safe.

Write this exactly:

```sql
-- PR5 — Live profile schema (Phase 0).
-- Adds 6 relational tables keyed by auth.users.id so that the FINA web app
-- (anon key + RLS) and the future WhatsApp bot (service role behind an
-- Edge Function) can do granular CRUD over the same profile data. The
-- existing reports table is unchanged — it stays as an immutable
-- historical snapshot of each generated informe.
--
-- Correr una vez en el SQL editor de Supabase. Idempotente: cada CREATE
-- usa IF NOT EXISTS, los TRIGGER se DROPpean antes y los CREATE POLICY se
-- DROPpean antes, así que re-correrlo no rompe nada.

create extension if not exists pgcrypto;

-- ── Shared updated_at trigger ─────────────────────────────────────────
-- Used by every table that has updated_at to keep it in sync on UPDATE.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1) user_profiles ──────────────────────────────────────────────────
-- One row per auth user. id = auth.users.id (1:1). Personal data, banks,
-- and the WhatsApp phone live here.
create table if not exists user_profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  name              text,
  age               int,
  gender            text check (gender in ('femenino','masculino','prefiero_no_decir')),
  lives_alone       boolean,
  works_or_studies  text check (works_or_studies in ('works','studies','both','neither')),
  banks             text[] not null default '{}',
  phone             text,
  phone_verified_at timestamptz,
  income_type       text check (income_type in ('fixed','freelance','both')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Unique non-null phones so WhatsApp lookup is O(1) but multiple users can
-- still have NULL phone (most users until phone-link UX ships).
create unique index if not exists user_profiles_phone_unique
  on user_profiles (phone) where phone is not null;

drop trigger if exists user_profiles_set_updated_at on user_profiles;
create trigger user_profiles_set_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

-- Auto-create a user_profiles row whenever a new auth.users row appears.
-- Keeps the 1:1 invariant without app-side coordination.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into user_profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 2) incomes ────────────────────────────────────────────────────────
-- Each row is one source of income. One row for sueldo fijo; up to three
-- rows (period = month1|month2|month3) for freelance.
create table if not exists incomes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  type              text not null check (type in ('fixed','freelance')),
  source            text not null,
  period            text check (period in ('month1','month2','month3')),
  amount_ars        numeric not null,
  currency          text not null default 'ARS' check (currency in ('ARS','USD')),
  original_amount   numeric,
  exchange_rate_id  uuid references exchange_rates (id),
  range_label       text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists incomes_user_id_idx on incomes (user_id);

drop trigger if exists incomes_set_updated_at on incomes;
create trigger incomes_set_updated_at
  before update on incomes
  for each row execute function set_updated_at();

-- ── 3) fixed_expenses ─────────────────────────────────────────────────
-- Each recurring monthly expense. The six named categories each get one
-- row; installments[] and subscriptions[] each get one row per item.
create table if not exists fixed_expenses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  category          text not null check (category in (
    'housing','health','beauty','therapy','gym','transport',
    'subscription','installment','other'
  )),
  merchant          text,
  amount_ars        numeric not null,
  currency          text not null default 'ARS' check (currency in ('ARS','USD')),
  original_amount   numeric,
  exchange_rate_id  uuid references exchange_rates (id),
  metadata          jsonb not null default '{}'::jsonb,
  active            boolean not null default true,
  not_paying        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists fixed_expenses_user_id_idx       on fixed_expenses (user_id);
create index if not exists fixed_expenses_user_category_idx on fixed_expenses (user_id, category);

drop trigger if exists fixed_expenses_set_updated_at on fixed_expenses;
create trigger fixed_expenses_set_updated_at
  before update on fixed_expenses
  for each row execute function set_updated_at();

-- ── 4) variable_expense_estimates ─────────────────────────────────────
-- The averages from onboarding (frequency × amount per week). Distinct
-- from the actual transactions table — these feed the report's "estimado"
-- column; the libro contable feeds "real".
create table if not exists variable_expense_estimates (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  category            text not null check (category in ('entertainment','delivery','supermarket')),
  weekly_frequency    int not null check (weekly_frequency >= 0),
  average_amount_ars  numeric not null check (average_amount_ars >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, category)
);

drop trigger if exists variable_expense_estimates_set_updated_at on variable_expense_estimates;
create trigger variable_expense_estimates_set_updated_at
  before update on variable_expense_estimates
  for each row execute function set_updated_at();

-- ── 5) goals ──────────────────────────────────────────────────────────
create table if not exists goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  amount_ars        numeric not null,
  timeframe_months  int not null check (timeframe_months > 0),
  status            text not null default 'active'
    check (status in ('active','achieved','cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists goals_user_id_idx on goals (user_id);

drop trigger if exists goals_set_updated_at on goals;
create trigger goals_set_updated_at
  before update on goals
  for each row execute function set_updated_at();

-- ── 6) transactions (libro contable) ──────────────────────────────────
-- Append-mostly. See spec section 1.6 for the occurred_at inference rule
-- that the bot/web must follow when inserting.
create table if not exists transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  occurred_at       timestamptz not null,
  type              text not null check (type in ('expense','income')),
  amount_ars        numeric not null,
  currency          text not null default 'ARS' check (currency in ('ARS','USD')),
  original_amount   numeric,
  exchange_rate_id  uuid references exchange_rates (id),
  category          text,
  merchant          text,
  description       text,
  source            text not null check (source in ('whatsapp','web','manual')),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists transactions_user_occurred_at_idx
  on transactions (user_id, occurred_at desc);
create index if not exists transactions_user_type_occurred_at_idx
  on transactions (user_id, type, occurred_at desc);
create index if not exists transactions_user_category_occurred_at_idx
  on transactions (user_id, category, occurred_at desc);

-- ── RLS — same owner-only shape on every new table ────────────────────
-- Each user reads/inserts/updates/deletes only their own rows. The
-- service role bypasses RLS, which is how the WhatsApp Edge Function
-- (built in a separate project) will eventually write.
alter table user_profiles enable row level security;

drop policy if exists "user_profiles owner read"   on user_profiles;
drop policy if exists "user_profiles owner insert" on user_profiles;
drop policy if exists "user_profiles owner update" on user_profiles;
drop policy if exists "user_profiles owner delete" on user_profiles;

create policy "user_profiles owner read"   on user_profiles for select using   (auth.uid() = id);
create policy "user_profiles owner insert" on user_profiles for insert with check (auth.uid() = id);
create policy "user_profiles owner update" on user_profiles for update using   (auth.uid() = id) with check (auth.uid() = id);
create policy "user_profiles owner delete" on user_profiles for delete using   (auth.uid() = id);

-- The other five tables all key off user_id and share the same policies.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'incomes',
    'fixed_expenses',
    'variable_expense_estimates',
    'goals',
    'transactions'
  ]) loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "%s owner read"   on %I', t, t);
    execute format('drop policy if exists "%s owner insert" on %I', t, t);
    execute format('drop policy if exists "%s owner update" on %I', t, t);
    execute format('drop policy if exists "%s owner delete" on %I', t, t);

    execute format('create policy "%s owner read"   on %I for select using   (auth.uid() = user_id)', t, t);
    execute format('create policy "%s owner insert" on %I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s owner update" on %I for update using   (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s owner delete" on %I for delete using   (auth.uid() = user_id)', t, t);
  end loop;
end $$;
```

- [ ] **Step 2: Commit and push**

```bash
cd "/Users/mariapazyunes/Documents/GitHub/fina1/Fina"
git add supabase/migrations/0003_live_profile.sql
git commit -m "PR5: 0003_live_profile.sql — schema, indexes, RLS, triggers

Six new tables (user_profiles, incomes, fixed_expenses,
variable_expense_estimates, goals, transactions) keyed by auth.users.id.
RLS owner-only on every table; service role bypasses for the future
WhatsApp Edge Function. Trigger on auth.users autoinserts a
user_profiles row on signup. updated_at is kept in sync by a shared
trigger function.

Migration is idempotent: re-running it is a no-op.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/pr5-supabase-schema-redesign
```

---

## Task 2: Apply `0003_live_profile.sql` to Supabase and verify

**Files:** none (operates on the live Supabase project).

- [ ] **Step 1: Open the SQL editor in the Supabase dashboard for the FINA project, paste the entire contents of `Fina/supabase/migrations/0003_live_profile.sql`, and run it.**

Expected: "Success. No rows returned." All `CREATE` / `ALTER` / `DROP` statements succeed without errors.

If you get an error like "relation `exchange_rates` does not exist", make sure `0001_exchange_rates.sql` and `0002_reports_auth.sql` have already been applied (they should be — that's the prod baseline from PR3).

- [ ] **Step 2: Verify all six tables exist with the expected columns**

In the SQL editor, run each of these and confirm the output:

```sql
-- Tables — should return exactly 6 rows: user_profiles, incomes,
-- fixed_expenses, variable_expense_estimates, goals, transactions
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('user_profiles','incomes','fixed_expenses',
                     'variable_expense_estimates','goals','transactions')
order by table_name;
```

Expected: 6 rows.

```sql
-- Spot-check user_profiles columns
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_profiles'
order by ordinal_position;
```

Expected columns (in order): `id, name, age, gender, lives_alone, works_or_studies, banks, phone, phone_verified_at, income_type, created_at, updated_at`.

```sql
-- Spot-check transactions indexes
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'transactions'
order by indexname;
```

Expected: at least `transactions_pkey`, `transactions_user_category_occurred_at_idx`, `transactions_user_occurred_at_idx`, `transactions_user_type_occurred_at_idx`.

- [ ] **Step 3: Verify RLS is on and the four policies exist on every new table**

```sql
-- One row per (table, policy). Should be 24 rows total: 6 tables × 4 policies.
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('user_profiles','incomes','fixed_expenses',
                    'variable_expense_estimates','goals','transactions')
order by tablename, policyname;
```

Expected: 24 rows.

```sql
-- Confirm RLS is enabled (rowsecurity = true) on all six.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('user_profiles','incomes','fixed_expenses',
                  'variable_expense_estimates','goals','transactions');
```

Expected: 6 rows, all with `relrowsecurity = true`.

- [ ] **Step 4: Verify the signup trigger by checking that every existing auth.user has a user_profiles row**

The trigger only fires on FUTURE inserts to `auth.users`, but we want to backfill rows for users who signed up before this migration. Step 1 of Task 4 does that explicitly. For now, just count:

```sql
select
  (select count(*) from auth.users)     as users,
  (select count(*) from user_profiles)  as profiles;
```

At this point `profiles` will typically be 0 — that's expected, the trigger hasn't run for anyone yet. The backfill in Task 4 brings it to match `users`.

- [ ] **Step 5: Tell the user the result**

Report back to the user with the four numbers from Step 2/3/4. If everything matches, proceed to Task 3. If anything is off, stop and surface the discrepancy.

---

## Task 3: Write `0004_backfill_from_reports.sql`

**Files:**
- Create: `Fina/supabase/migrations/0004_backfill_from_reports.sql`

- [ ] **Step 1: Confirm the jsonb shape by sampling a few rows**

Before writing the backfill, run this in Supabase to see what the actual jsonb looks like:

```sql
select jsonb_object_keys(user_data) as top_level_keys
from reports
where user_id is not null
order by created_at desc
limit 1;
```

Expected keys (from the codebase as of PR4): `name, age, email, gender, livesAlone, worksOrStudies, monthlyIncome, incomeRange, incomeCurrency, incomeOriginalAmount, incomeType, freelanceIncome, banks, expenses, transportDetails, housingCurrency, housingOriginalAmount, therapyDetails, installments, subscriptions, entertainmentFrequency, entertainmentAmount, deliveryFrequency, deliveryAmount, supermarketFrequency, supermarketAmount, goals, exchangeRate`.

Also sample the goals shape specifically — the spec doesn't pin it down and the code path that wrote it predates PR3:

```sql
select user_data->'goals'
from reports
where user_id is not null
  and user_data->'goals' is not null
  and jsonb_array_length(user_data->'goals') > 0
limit 3;
```

The backfill SQL below assumes goals are objects with keys `title`, `amount`, `timeframe`. **If the keys differ, stop and adjust the goals INSERT in step 2 before continuing.** Common alternatives in this codebase: `name` instead of `title`, `months` instead of `timeframe`.

- [ ] **Step 2: Create the backfill migration file**

Write this exactly. Every INSERT is guarded so re-running the file inserts nothing the second time.

```sql
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

-- ── goals ──────────────────────────────────────────────────────────────
-- Assumes goals[] items have keys {title, amount, timeframe}. If the
-- sampling in Task 3 step 1 showed different keys, this SELECT is the
-- ONLY thing to adjust.
insert into goals (user_id, title, amount_ars, timeframe_months, status)
select
  lr.user_id,
  goal->>'title',
  (goal->>'amount')::numeric,
  (goal->>'timeframe')::int,
  'active'
from _latest_report lr
cross join lateral jsonb_array_elements(coalesce(lr.user_data->'goals','[]'::jsonb)) as goal
where coalesce(goal->>'title','') <> ''
  and not exists (
    select 1 from goals g
    where g.user_id = lr.user_id
      and g.title = goal->>'title'
  );

commit;
```

- [ ] **Step 3: Commit and push**

```bash
cd "/Users/mariapazyunes/Documents/GitHub/fina1/Fina"
git add supabase/migrations/0004_backfill_from_reports.sql
git commit -m "PR5: 0004_backfill_from_reports.sql — explode user_data jsonb

For each authenticated user, picks their latest reports row and parses
user_data into user_profiles, incomes (fixed + 3 freelance months if
applicable), fixed_expenses (6 named categories + installments[] +
subscriptions[]), variable_expense_estimates (3 categories) and goals.

All INSERTs are guarded so the migration is idempotent. Anonymous
reports from before PR3 are skipped.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/pr5-supabase-schema-redesign
```

---

## Task 4: Apply `0004_backfill_from_reports.sql` and verify

**Files:** none.

- [ ] **Step 1: Run the backfill in Supabase**

Paste the entire contents of `0004_backfill_from_reports.sql` into the Supabase SQL editor and execute. Expected: "Success. No rows returned." All inserts wrapped in `begin;` / `commit;` so the whole backfill is atomic — if anything fails it rolls back and you can fix the SQL without partial data.

- [ ] **Step 2: Count vs expected**

```sql
-- distinct_users_with_reports from the pre-flight should equal user_profiles
-- with name set, since every user with a report had at least a name.
select
  (select count(*) from user_profiles)                          as profiles_total,
  (select count(*) from user_profiles where name is not null)   as profiles_named,
  (select count(distinct user_id) from reports
     where user_id is not null)                                 as users_with_reports,
  (select count(*) from incomes)                                as incomes_total,
  (select count(*) from fixed_expenses)                         as fixed_expenses_total,
  (select count(*) from variable_expense_estimates)             as variable_estimates_total,
  (select count(*) from goals)                                  as goals_total;
```

Expected:
- `profiles_total` ≥ `users_with_reports`. Equals `auth.users` total minus deleted-user races.
- `profiles_named` = `users_with_reports`.
- `incomes_total` between 1 and 4 per user (1 for 'fixed', up to 3 month rows for freelance).
- `fixed_expenses_total` ≥ `users_with_reports` (every user has at least one positive expense; most have several).
- `variable_estimates_total` between 0 and 3 per user.
- `goals_total` ≥ 0 (some users may not have set any).

- [ ] **Step 3: Spot-check one user end to end**

Pick any user_id that has data in the new tables:

```sql
select user_id
from incomes
order by created_at desc
limit 1;
```

Take that uuid and run:

```sql
-- Replace <UUID> with the value from above.
select 'profile' as kind, jsonb_build_object('name', name, 'age', age, 'income_type', income_type, 'banks', banks) as data
from user_profiles where id = '<UUID>'
union all
select 'incomes', to_jsonb(i.*) from incomes i where user_id = '<UUID>'
union all
select 'fixed_expenses', to_jsonb(fe.*) from fixed_expenses fe where user_id = '<UUID>'
union all
select 'var_estimates', to_jsonb(ve.*) from variable_expense_estimates ve where user_id = '<UUID>'
union all
select 'goals', to_jsonb(g.*) from goals g where user_id = '<UUID>'
order by kind;
```

Now run this to see the original jsonb for the same user:

```sql
select user_data
from reports
where user_id = '<UUID>'
order by created_at desc
limit 1;
```

Manually compare:
- name/age/gender/livesAlone/banks/incomeType match.
- monthlyIncome jsonb = sum of incomes(amount_ars) for that user (within rounding).
- expenses.housing / health / beauty / therapy / gym / transport each appear as a fixed_expenses row with `merchant IS NULL` and matching amount.
- installments[] items appear as fixed_expenses with `category = 'installment'`, merchant = name, metadata->>'remaining' = remainingInstallments.
- subscriptions[] items appear as fixed_expenses with `category = 'subscription'`.
- entertainmentFrequency/Amount/delivery.../supermarket... → variable_expense_estimates rows.
- goals[] items → goals rows.

- [ ] **Step 4: Re-run the backfill once to prove idempotency**

Paste `0004_backfill_from_reports.sql` into the SQL editor a SECOND time. Expected: success, no errors. Then re-run the count from Step 2 — every count must be identical to the first run.

- [ ] **Step 5: Report results to the user**

Tell the user:
- The pre-flight numbers (from the checklist) vs. the post-backfill numbers.
- The user_id you spot-checked and a sentence saying everything matched (or detailing what didn't).
- Confirmation that re-running was idempotent.

If anything didn't match, surface it and stop — do not move on without the user's call.

---

## Task 5: Document the rollback runbook

**Files:**
- Modify: `Fina/supabase/migrations/0003_live_profile.sql` (append a comment block at the bottom)

This isn't code — it's a comment block at the bottom of the migration so the rollback SQL lives next to the migration itself, the way `0001` documents its strict-RLS alternative as a comment.

- [ ] **Step 1: Append this comment block to the end of `0003_live_profile.sql`**

```sql

-- ── Rollback runbook (DO NOT RUN unless you mean it) ─────────────────
-- This block intentionally has no executable statements. Each line is a
-- statement you would run manually in the SQL editor to fully undo this
-- migration. It assumes Phase 2 (app dual-write) has NOT shipped yet —
-- once the app starts writing to these tables, rolling back loses data.
--
-- 1) Drop the auth.users trigger first so new signups don't try to
--    insert into a table that's about to disappear:
--    drop trigger if exists on_auth_user_created on auth.users;
--    drop function if exists handle_new_user();
--
-- 2) Drop the six new tables (CASCADE drops indexes, policies, triggers):
--    drop table if exists transactions cascade;
--    drop table if exists goals cascade;
--    drop table if exists variable_expense_estimates cascade;
--    drop table if exists fixed_expenses cascade;
--    drop table if exists incomes cascade;
--    drop table if exists user_profiles cascade;
--
-- 3) Drop the shared trigger function (only after all tables that used it
--    are gone):
--    drop function if exists set_updated_at();
--
-- Reports table is unchanged by 0003/0004, so the rollback returns the
-- database to its post-0002 state exactly.
```

- [ ] **Step 2: Commit and push**

```bash
cd "/Users/mariapazyunes/Documents/GitHub/fina1/Fina"
git add supabase/migrations/0003_live_profile.sql
git commit -m "PR5: document rollback runbook in 0003

Adds an as-comment runbook at the bottom of 0003_live_profile.sql so the
rollback SQL lives next to the migration, matching the pattern 0001 uses
for its strict-RLS alternative. Phase 2 has not shipped yet, so this
rollback is fully safe; it stops being safe once the app starts
dual-writing to the new tables.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/pr5-supabase-schema-redesign
```

- [ ] **Step 3: Fast-forward `main` and push (per the user's standing instructions)**

These three commits don't change anything the Vite build sees, so the production Vercel deploy will be a no-op, but pushing keeps `main` consistent with the SQL the user is going to run in Supabase.

```bash
cd "/Users/mariapazyunes/Documents/GitHub/fina1/Fina"
git checkout main
git merge --ff-only feat/pr5-supabase-schema-redesign
git push origin main
git checkout feat/pr5-supabase-schema-redesign
```

If the user wants to keep these migration files out of `main` until Phase 2 is also ready, ASK BEFORE running this step — the alternative is to leave them on the feature branch and merge later.

---

## What comes next (out of scope of this plan)

After this plan is executed and validated, the next plan covers:

- **Phase 2:** Web app dual-write behind `VITE_USE_LIVE_PROFILE`. Adds a `lib/profile.ts` with `loadLiveProfile()` and per-step `save*Step()` helpers. The onboarding handlers call the helpers in addition to the existing jsonb path.
- **Phase 3:** `/perfil` gains a "Mi situación financiera" accordion that does CRUD over `incomes`, `fixed_expenses`, `goals` directly. Editing there does not generate a new report.
- **Phone-link step.** A new `/phone-link` onboarding step after `/personal-data` captures `user_profiles.phone` and runs the verification flow.

Each of those is large enough to warrant its own plan. We write them after this one is in production.
