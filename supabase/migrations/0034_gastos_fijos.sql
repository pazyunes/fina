-- ─────────────────────────────────────────────────────────────────────────
-- 0034 — Gastos fijos: alquiler, gimnasio, suscripciones.
--
-- Un gasto fijo es un gasto que se repite: cuánto, en qué sección, con qué se
-- paga, cada cuánto (semanal, quincenal, mensual, anual) y cuándo es el próximo
-- pago.
--
-- NO se registra solo. Cuando llega la fecha, la app (y un aviso a las 10 hs)
-- le recuerda a la persona que vence, y con un toque en "Ya lo pagué" se
-- registra como un gasto más y la fecha pasa al próximo período. Si se
-- registrara solo, el disponible bajaría por algo que todavía no se pagó.
--
-- La tabla `fixed_expenses` (0003) es de la app vieja: el cuestionario de
-- gastos fijos, sin fecha ni frecuencia. No se usa para esto.
--
-- ADITIVA. Correr después de 0033.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists recurring_expenses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  description     text not null check (length(trim(description)) > 0),
  -- Lo que la persona tipeó, en su moneda. Al registrarlo se pasa a pesos con
  -- la cotización de ESE día, igual que cualquier gasto.
  amount          numeric not null check (amount > 0),
  currency        text not null default 'ARS' check (currency in ('ARS', 'USD')),
  section_id      uuid references expense_sections (id) on delete set null,
  expense_type    text check (expense_type is null or expense_type in ('necesario', 'urgente', 'impulsivo', 'otro')),
  payment_method  text,
  frequency       text not null check (frequency in ('semanal', 'quincenal', 'mensual', 'anual')),
  -- Próximo pago, en días de Argentina.
  next_due        date not null,
  -- Para mensual y anual: el día del mes en que vence. Si un mes es más corto
  -- (un 31 en abril) vence el último día, y al mes siguiente vuelve al 31 en vez
  -- de quedarse corrido.
  anchor_day      smallint check (anchor_day is null or anchor_day between 1 and 31),
  active          boolean not null default true,
  last_paid_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists recurring_expenses_user_idx on recurring_expenses (user_id, next_due) where active;

alter table recurring_expenses enable row level security;

drop policy if exists "fijos propios: leer" on recurring_expenses;
create policy "fijos propios: leer" on recurring_expenses
  for select using (auth.uid() = user_id);

drop policy if exists "fijos propios: crear" on recurring_expenses;
create policy "fijos propios: crear" on recurring_expenses
  for insert with check (auth.uid() = user_id);

drop policy if exists "fijos propios: editar" on recurring_expenses;
create policy "fijos propios: editar" on recurring_expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fijos propios: borrar" on recurring_expenses;
create policy "fijos propios: borrar" on recurring_expenses
  for delete using (auth.uid() = user_id);


-- ── Aviso de vencimientos ────────────────────────────────────────────────
alter table notification_prefs add column if not exists vencimientos boolean not null default true;

alter table notification_log drop constraint if exists notification_log_tipo_check;
alter table notification_log add constraint notification_log_tipo_check
  check (tipo in ('paso', 'racha', 'separar', 'resumen', 'vencimiento'));
