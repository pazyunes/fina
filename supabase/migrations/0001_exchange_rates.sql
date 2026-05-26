-- 2.3a — Historial de cotizaciones (Opción B).
-- Correr una vez en el SQL editor de Supabase.

create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null,           -- 'USD_BLUE'
  rate numeric not null,            -- valor de venta
  source text not null default 'dolarapi',
  fetched_at timestamptz default now()
);

create index if not exists exchange_rates_currency_fetched_at_idx
  on exchange_rates (currency, fetched_at desc);

-- La Vercel Function /api/dolar usa la anon key (reusa VITE_SUPABASE_ANON_KEY
-- del lado servidor). Habilitamos RLS con políticas públicas: la cotización del
-- blue es información pública y no sensible.
alter table exchange_rates enable row level security;

drop policy if exists "exchange_rates anon read" on exchange_rates;
create policy "exchange_rates anon read"
  on exchange_rates for select
  using (true);

drop policy if exists "exchange_rates anon insert" on exchange_rates;
create policy "exchange_rates anon insert"
  on exchange_rates for insert
  with check (true);

-- Alternativa más estricta: en vez de las políticas de arriba, dejar RLS sin
-- políticas y que la function use la SERVICE_ROLE key (requiere agregar esa env
-- var en Vercel). Para este MVP usamos la anon key.
