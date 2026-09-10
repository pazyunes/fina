-- ─────────────────────────────────────────────────────────────────────────
-- 0020 — Flujo v2: secciones propias, topes, medios de pago y disponible.
--
-- ADITIVA. No borra ni renombra nada: la app vieja sigue funcionando igual.
-- Lo único que toca de lo existente son columnas NUEVAS en `transactions`.
--
-- Por qué `transactions` y no una tabla nueva de gastos: ya tiene lo que hace
-- falta —`occurred_at` separado de `created_at`, `source` que distingue
-- whatsapp/web (que es justo lo que permite que la app y el bot escriban en el
-- mismo lugar), y `original_amount` + `exchange_rate_id`, que son el patrón de
-- cotización congelada. Duplicarlo sería tener dos verdades sobre un gasto.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1) Secciones de gasto, propias de cada usuaria ───────────────────────
-- El esquema viejo tiene un conjunto CERRADO de 13 categorías
-- (variable_expense_estimates.category + fina_canon_category). El flujo v2
-- deja escribir cualquier sección, así que las secciones pasan a ser filas.
-- `canon` guarda a qué categoría del conjunto viejo mapea, para que los
-- análisis que ya existen sigan agrupando; `name` es lo que ve la persona.
create table if not exists expense_sections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  slug        text not null,
  canon       text,
  -- Tope. `cap_amount` null = sin tope. El período importa: un tope es "por
  -- semana" o "por mes", nunca contra todo el historial.
  cap_amount  numeric check (cap_amount is null or cap_amount > 0),
  cap_period  text check (cap_period is null or cap_period in ('semana','mes')),
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug),
  -- Un tope sin período (o al revés) no significa nada.
  check ((cap_amount is null) = (cap_period is null))
);

create index if not exists expense_sections_user_idx on expense_sections (user_id) where not archived;

alter table expense_sections enable row level security;

drop policy if exists "secciones propias: leer" on expense_sections;
create policy "secciones propias: leer" on expense_sections
  for select using (auth.uid() = user_id);

drop policy if exists "secciones propias: crear" on expense_sections;
create policy "secciones propias: crear" on expense_sections
  for insert with check (auth.uid() = user_id);

-- Sin esta policy los updates fallan EN SILENCIO: RLS no da error, devuelve
-- 0 filas afectadas. Es el bug más fácil de no ver de todo Supabase.
drop policy if exists "secciones propias: editar" on expense_sections;
create policy "secciones propias: editar" on expense_sections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "secciones propias: borrar" on expense_sections;
create policy "secciones propias: borrar" on expense_sections
  for delete using (auth.uid() = user_id);


-- ── 2) Medios de pago ────────────────────────────────────────────────────
-- Son los medios con los que la persona carga plata y paga. Se guardan para
-- poder ofrecer los que YA usó, del más reciente al más viejo, en vez de una
-- lista genérica. Texto libre a propósito: "Ualá" no está en ninguna lista.
create table if not exists payment_methods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  -- Saldo disponible en ese medio. Es el "dinero disponible" del v2, pero
  -- separado por medio, que es lo que permite contestar "¿de dónde salió?".
  balance_ars   numeric not null default 0,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists payment_methods_user_reciente_idx
  on payment_methods (user_id, last_used_at desc nulls last);

alter table payment_methods enable row level security;

drop policy if exists "medios propios: leer" on payment_methods;
create policy "medios propios: leer" on payment_methods
  for select using (auth.uid() = user_id);

drop policy if exists "medios propios: crear" on payment_methods;
create policy "medios propios: crear" on payment_methods
  for insert with check (auth.uid() = user_id);

drop policy if exists "medios propios: editar" on payment_methods;
create policy "medios propios: editar" on payment_methods
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "medios propios: borrar" on payment_methods;
create policy "medios propios: borrar" on payment_methods
  for delete using (auth.uid() = user_id);


-- ── 3) `transactions` gana lo que le falta del v2 ────────────────────────
alter table transactions
  -- Clasificación que eligió la persona. NO es un juicio: la app muestra los
  -- gastos neutrales, nunca en color de alerta.
  add column if not exists expense_type text,
  -- Con qué lo pagó. Texto, no FK: el medio puede haberse borrado y el gasto
  -- histórico igual tiene que seguir diciendo con qué se pagó.
  add column if not exists payment_method text,
  add column if not exists section_id uuid references expense_sections (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_expense_type_check'
  ) then
    alter table transactions
      add constraint transactions_expense_type_check
      check (expense_type is null or expense_type in ('necesario','urgente','impulsivo','otro'));
  end if;
end $$;

create index if not exists transactions_section_idx on transactions (section_id);
create index if not exists transactions_user_fecha_idx on transactions (user_id, occurred_at desc);


-- ── 4) `source` acepta el bot y la app nueva ─────────────────────────────
-- Ya admitía 'whatsapp' | 'web' | 'manual'. Se deja igual: 'whatsapp' es el
-- bot y 'web' es la app. No hace falta tocarlo — queda anotado para que nadie
-- lo "arregle" agregando valores que después nadie filtra.


-- ── 5) `updated_at` automático ───────────────────────────────────────────
-- set_updated_at() ya existe (migración 0003).
drop trigger if exists expense_sections_updated on expense_sections;
create trigger expense_sections_updated before update on expense_sections
  for each row execute function set_updated_at();

drop trigger if exists payment_methods_updated on payment_methods;
create trigger payment_methods_updated before update on payment_methods
  for each row execute function set_updated_at();
