-- ─────────────────────────────────────────────────────────────────────────
-- 0045 · La tabla de gastos fijos, para la base donde la 0034 no se corrió.
--
-- En la base de la app (oct 2026) no existía `recurring_expenses`: cada gasto
-- fijo que se cargaba se rechazaba al guardarse y la app lo sacaba de la
-- lista. Unir medios de pago (0038) también falla sin esta tabla.
--
-- Es la tabla de la 0034. El check de `notification_log` no se pisa con el de
-- la 0034 (lo dejaba sin 'plazo', de la 0041): se amplía a todos los tipos que
-- usa la app. Ampliar no puede fallar con las filas que ya hay, y sin
-- 'vencimiento' el aviso de un gasto fijo por vencer no se puede anotar.
--
-- ADITIVA E IDEMPOTENTE: se puede correr aunque la 0034 o la 0041 ya se hayan
-- corrido, y la 0041 se puede correr después.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists recurring_expenses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  description     text not null check (length(trim(description)) > 0),
  amount          numeric not null check (amount > 0),
  currency        text not null default 'ARS' check (currency in ('ARS', 'USD')),
  section_id      uuid references expense_sections (id) on delete set null,
  expense_type    text check (expense_type is null or expense_type in ('necesario', 'urgente', 'impulsivo', 'otro')),
  payment_method  text,
  frequency       text not null check (frequency in ('semanal', 'quincenal', 'mensual', 'anual')),
  next_due        date not null,
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

-- La preferencia para apagar el aviso de vencimientos (Perfil).
alter table notification_prefs add column if not exists vencimientos boolean not null default true;

-- Los tipos de aviso que se anotan: los de siempre, más vencimiento y plazo.
alter table notification_log drop constraint if exists notification_log_tipo_check;
alter table notification_log add constraint notification_log_tipo_check
  check (tipo in ('paso', 'racha', 'separar', 'resumen', 'vencimiento', 'plazo', 'registro'));

-- Que la API vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';
