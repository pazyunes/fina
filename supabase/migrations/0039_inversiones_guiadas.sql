-- 0039 — Inversiones guiadas.
--
-- Tres tablas nuevas. No se toca ninguna existente: `investment_contributions`
-- (los aportes de siempre) queda como está y sigue leyéndose.
--
--   1) market_snapshots    — una foto por día de los datos de mercado.
--   2) investment_positions — cada inversión que la persona registra, con sus
--                             datos específicos (banco, tasa, plazo, vencimiento…).
--   3) investment_plans     — por dónde va en el paso a paso de cada inversión.
--
-- La app anda sin correr esto: sin las tablas, el paso a paso guarda su avance
-- en el dispositivo y el registro específico avisa que todavía no está listo.
-- Es idempotente (se puede correr dos veces).

-- ── 1) Fotos diarias del mercado ─────────────────────────────────────────
-- Las escribe SÓLO la función /api/mercado con la service_role key (que se
-- salta RLS). Sin ninguna policy, nadie más puede leerla ni escribirla: si
-- cualquiera pudiera escribir acá, podría envenenar el respaldo de datos con
-- números falsos. Sirve para dos cosas: el rendimiento de 7 y 30 días de los
-- fondos (se calcula con el valor de cuotaparte de días anteriores) y tener un
-- respaldo si todas las fuentes caen a la vez.
create table if not exists market_snapshots (
  day         date primary key,
  data        jsonb not null,
  fetched_at  timestamptz not null default now()
);

alter table market_snapshots enable row level security;


-- ── 2) Inversiones registradas ───────────────────────────────────────────
create table if not exists investment_positions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- Qué es: cuenta_remunerada · fci · plazo_fijo · plazo_fijo_uva · letra · dolar · cedear
  kind              text not null check (kind in (
                      'cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva',
                      'letra', 'dolar', 'cedear')),
  -- Dónde está: 'Mercado Pago', 'Ualá', 'Cocos Capital', 'Balanz', o el banco.
  provider          text not null,

  amount            numeric not null check (amount > 0),
  currency          text not null default 'ARS' check (currency in ('ARS','USD')),
  exchange_rate_id  uuid references exchange_rates (id),
  -- Equivalente en pesos CONGELADO a la cotización del día (mismo criterio que
  -- los aportes: lo que se suma es esto, `amount` es lo que la persona cargó).
  amount_ars        numeric not null check (amount_ars > 0),

  start_date        date not null,
  end_date          date,
  term_days         integer check (term_days is null or term_days > 0),
  -- Tasa nominal anual como FRACCIÓN (0.21 = 21%), tal como la ve la persona en su app.
  rate_tna          numeric check (rate_tna is null or rate_tna >= 0),

  -- Para lo que se compra por unidad: cuotapartes, CEDEARs, letras.
  quantity          numeric check (quantity is null or quantity > 0),
  unit_price        numeric check (unit_price is null or unit_price > 0),

  -- Lo propio de cada tipo que no merece columna (fondo y clase, ticker, tipo de
  -- dólar, si el plazo fijo es precancelable…).
  details           jsonb not null default '{}',

  status            text not null default 'activa' check (status in ('activa','cerrada')),
  -- 'manual' = lo tipeó la persona · 'captura' = lo leímos de una captura y ella lo confirmó.
  source            text not null default 'manual' check (source in ('manual','captura')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  check (currency = 'ARS' or exchange_rate_id is not null),
  check (end_date is null or end_date >= start_date)
);

create index if not exists investment_positions_user_idx
  on investment_positions (user_id, start_date desc);

alter table investment_positions enable row level security;

drop policy if exists "posiciones inversion: leer" on investment_positions;
create policy "posiciones inversion: leer" on investment_positions
  for select using (auth.uid() = user_id);

drop policy if exists "posiciones inversion: crear" on investment_positions;
create policy "posiciones inversion: crear" on investment_positions
  for insert with check (auth.uid() = user_id);

drop policy if exists "posiciones inversion: editar" on investment_positions;
create policy "posiciones inversion: editar" on investment_positions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posiciones inversion: borrar" on investment_positions;
create policy "posiciones inversion: borrar" on investment_positions
  for delete using (auth.uid() = user_id);


-- ── 3) Avance del paso a paso ────────────────────────────────────────────
-- Una fila por persona + producto + dónde lo hace. `done_steps` son los pasos
-- que ya marcó como hechos (índices desde 0).
create table if not exists investment_plans (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product     text not null,
  provider    text not null,
  amount      numeric check (amount is null or amount > 0),
  done_steps  integer[] not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, product, provider)
);

alter table investment_plans enable row level security;

drop policy if exists "plan inversion: leer" on investment_plans;
create policy "plan inversion: leer" on investment_plans
  for select using (auth.uid() = user_id);

drop policy if exists "plan inversion: crear" on investment_plans;
create policy "plan inversion: crear" on investment_plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "plan inversion: editar" on investment_plans;
create policy "plan inversion: editar" on investment_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "plan inversion: borrar" on investment_plans;
create policy "plan inversion: borrar" on investment_plans
  for delete using (auth.uid() = user_id);
