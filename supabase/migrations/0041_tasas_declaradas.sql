-- 0041 — Tasas declaradas por las personas.
--
-- Las billeteras y los fondos no tienen una API pública con su tasa. Mientras tanto,
-- el dato real es lo que cada persona VE en su app. Cuando alguien registra una
-- inversión (o anota la tasa en el paso a paso), esa tasa queda acá.
--
-- Se usa de dos maneras, siempre agregada y nunca individual:
--   · para chequear la tasa publicada: si varias personas declaran algo muy distinto,
--     se le avisa a quien mantiene FINA;
--   · como respaldo: si la tasa publicada falta o está vieja, se usa la MEDIANA de
--     lo declarado en los últimos 7 días, y sólo si hay al menos 3 personas distintas.
--
-- Cada persona sólo ve y escribe lo suyo. El promedio lo calcula el servidor con
-- service_role (/api/mercado) y no guarda quién declaró qué.
--
-- ADITIVA e idempotente.

create table if not exists declared_rates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('cuenta_remunerada', 'fci')),
  -- 'Ualá', 'Mercado Pago', 'Cocos Capital'…
  provider     text not null,
  -- Para fondos: 'Mercado Fondo', 'Cocos Ahorro'…  Vacío en las cuentas.
  fund         text not null default '',
  -- Tasa nominal anual como FRACCIÓN (0.19 = 19%), tal como la ve la persona.
  tna          numeric not null check (tna > 0 and tna < 5),
  declared_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

-- Una declaración por persona, por lugar y por día: declarar dos veces no cuenta doble.
create unique index if not exists declared_rates_una_por_dia
  on declared_rates (user_id, kind, provider, fund, declared_on);

create index if not exists declared_rates_dia_idx on declared_rates (declared_on desc);

alter table declared_rates enable row level security;

drop policy if exists "tasas declaradas: leer las mias" on declared_rates;
create policy "tasas declaradas: leer las mias" on declared_rates
  for select using (auth.uid() = user_id);

drop policy if exists "tasas declaradas: crear" on declared_rates;
create policy "tasas declaradas: crear" on declared_rates
  for insert with check (auth.uid() = user_id);

drop policy if exists "tasas declaradas: editar" on declared_rates;
create policy "tasas declaradas: editar" on declared_rates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasas declaradas: borrar" on declared_rates;
create policy "tasas declaradas: borrar" on declared_rates
  for delete using (auth.uid() = user_id);
