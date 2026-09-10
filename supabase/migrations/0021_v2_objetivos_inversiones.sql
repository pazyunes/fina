-- ─────────────────────────────────────────────────────────────────────────
-- 0021 — Flujo v2: contribuciones a objetivos, perfil de riesgo y aportes.
--
-- ADITIVA salvo dos relajaciones en `goals` (quitar NOT NULL y ampliar), que
-- son compatibles hacia atrás: lo que hoy entra, sigue entrando.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1) `goals` se adapta a lo que el v2 pregunta ─────────────────────────
-- Tres desajustes concretos con el flujo nuevo:
--   · el v2 permite un objetivo SIN monto ("todavía no sé"), y
--     `amount_ars` era `not null`
--   · el v2 permite objetivos en dólares
--   · el v2 pregunta el plazo en texto ("Lo antes posible", "enero de 2027"),
--     no en cantidad de meses
alter table goals
  alter column amount_ars drop not null;

alter table goals
  alter column timeframe_months drop not null;

alter table goals
  add column if not exists currency text not null default 'ARS',
  add column if not exists horizon_label text,
  add column if not exists kind text not null default 'individual';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'goals_currency_check') then
    alter table goals add constraint goals_currency_check check (currency in ('ARS','USD'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goals_kind_check') then
    alter table goals add constraint goals_kind_check check (kind in ('individual','grupal'));
  end if;
end $$;


-- ── 2) Contribuciones ────────────────────────────────────────────────────
-- `goals` guardaba el objetivo pero no los aportes, así que el progreso no se
-- podía reconstruir ni mostrar "+$4.000 esta semana", que es justamente el
-- mecanismo de retención de la app.
--
-- `kind` distingue "ya lo pagué" de "lo separé", que en el v2 son dos cosas
-- distintas y suman igual al progreso.
create table if not exists goal_contributions (
  id                uuid primary key default gen_random_uuid(),
  goal_id           uuid not null references goals (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  amount            numeric not null check (amount > 0),
  currency          text not null default 'ARS' check (currency in ('ARS','USD')),
  -- Cotización congelada: un aporte de US$100 de hace seis meses no son los
  -- pesos que valen esos dólares hoy. Mismo patrón que ya usa `incomes`.
  exchange_rate_id  uuid references exchange_rates (id),
  amount_ars        numeric not null check (amount_ars > 0),
  kind              text not null check (kind in ('paid','saved')),
  label             text,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists goal_contributions_goal_idx
  on goal_contributions (goal_id, occurred_at desc);

alter table goal_contributions enable row level security;

drop policy if exists "aportes a objetivo: leer" on goal_contributions;
create policy "aportes a objetivo: leer" on goal_contributions
  for select using (auth.uid() = user_id);

drop policy if exists "aportes a objetivo: crear" on goal_contributions;
create policy "aportes a objetivo: crear" on goal_contributions
  for insert with check (auth.uid() = user_id);

drop policy if exists "aportes a objetivo: editar" on goal_contributions;
create policy "aportes a objetivo: editar" on goal_contributions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "aportes a objetivo: borrar" on goal_contributions;
create policy "aportes a objetivo: borrar" on goal_contributions
  for delete using (auth.uid() = user_id);


-- ── 3) Perfil de riesgo ──────────────────────────────────────────────────
-- Las tres respuestas del mini-quiz de Inversiones. Una fila por usuaria.
create table if not exists investment_profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  horizon         text,
  reaction        text,
  already_invests boolean,
  invests_in      text[] not null default '{}',
  wallets         text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table investment_profiles enable row level security;

drop policy if exists "perfil inversor: leer" on investment_profiles;
create policy "perfil inversor: leer" on investment_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "perfil inversor: crear" on investment_profiles;
create policy "perfil inversor: crear" on investment_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "perfil inversor: editar" on investment_profiles;
create policy "perfil inversor: editar" on investment_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 4) Aportes de inversión ──────────────────────────────────────────────
-- No van en `transactions`: no son ni 'expense' ni 'income'. Es plata que
-- salió de un lado y entró a un instrumento — un movimiento distinto.
create table if not exists investment_contributions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  instrument        text not null,
  amount            numeric not null check (amount > 0),
  currency          text not null default 'ARS' check (currency in ('ARS','USD')),
  exchange_rate_id  uuid references exchange_rates (id),
  -- Equivalente en pesos CONGELADO a la cotización del día de la carga. Es el
  -- que se suma; `amount` es el hecho (lo que la persona tipeó).
  amount_ars        numeric not null check (amount_ars > 0),
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  -- Si fue en dólares, la cotización es obligatoria: sin ella el aporte se
  -- desfasa solo cada vez que se mueve el dólar. Es un bug que esta app ya
  -- tuvo (ver el comentario en src/app/Main.tsx).
  check (currency = 'ARS' or exchange_rate_id is not null)
);

create index if not exists investment_contributions_user_idx
  on investment_contributions (user_id, occurred_at desc);

alter table investment_contributions enable row level security;

drop policy if exists "aportes inversion: leer" on investment_contributions;
create policy "aportes inversion: leer" on investment_contributions
  for select using (auth.uid() = user_id);

drop policy if exists "aportes inversion: crear" on investment_contributions;
create policy "aportes inversion: crear" on investment_contributions
  for insert with check (auth.uid() = user_id);

drop policy if exists "aportes inversion: editar" on investment_contributions;
create policy "aportes inversion: editar" on investment_contributions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "aportes inversion: borrar" on investment_contributions;
create policy "aportes inversion: borrar" on investment_contributions
  for delete using (auth.uid() = user_id);


-- ── 5) Triggers de updated_at ────────────────────────────────────────────
drop trigger if exists investment_profiles_updated on investment_profiles;
create trigger investment_profiles_updated before update on investment_profiles
  for each row execute function set_updated_at();
