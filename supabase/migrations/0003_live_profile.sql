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

begin;

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
  phone             text check (phone is null or phone ~ '^\+[1-9][0-9]{1,14}$'),
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
  updated_at        timestamptz not null default now(),
  check (
    (type = 'fixed'     and period is null) or
    (type = 'freelance' and period is not null)
  )
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
  -- Any category may be USD (e.g. USD-priced subscriptions), not only housing.
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
  weekly_frequency    int not null check (weekly_frequency > 0),
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
-- For each of the five tables below, this generates four RLS policies:
--   "<table> owner read", "<table> owner insert",
--   "<table> owner update", "<table> owner delete".
-- They mirror the user_profiles policies above.
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

commit;
