-- ─────────────────────────────────────────────────────────────────────────
-- 0037 — Las cargas de "Ya la tenía" guardan fecha.
--
-- "Agregar plata" tiene dos caminos: "Me entró" (un ingreso, que vive en
-- `transactions` con su fecha) y "Ya la tenía" (plata que ya estaba, que no
-- cuenta como ingreso). Ese segundo camino sólo movía el saldo del medio de
-- pago (`mover_saldo`), sin guardar cuándo — así que no se podía saber cuánta
-- plata se cargó en cada mes.
--
-- Esta tabla guarda cada carga con su fecha y el medio, para que "Dinero
-- disponible" pueda ser de cada mes (lo cargado menos lo gastado en ese mes) y
-- cada mes arranque independiente del anterior. NO reemplaza el saldo de
-- `payment_methods`: ese sigue moviéndose con `mover_saldo`.
--
-- Una tabla aparte y no un tercer `type` en `transactions`: ese tiene un check
-- ('expense', 'income') y todo lo que lee movimientos (el bot, los resúmenes,
-- la IA) asume sólo esos dos. Una fila nueva ahí podría colarse en cuentas que
-- no la esperan.
--
-- ADITIVA. Las cargas hechas antes de esta migración no tienen fecha y no
-- figuran en ningún mes. Correr después de 0036.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists balance_loads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  medio        text not null check (length(trim(medio)) > 0),
  amount_ars   numeric not null check (amount_ars > 0),
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists balance_loads_user_idx on balance_loads (user_id, occurred_at desc);

alter table balance_loads enable row level security;

drop policy if exists "cargas propias: leer" on balance_loads;
create policy "cargas propias: leer" on balance_loads
  for select using (auth.uid() = user_id);

drop policy if exists "cargas propias: crear" on balance_loads;
create policy "cargas propias: crear" on balance_loads
  for insert with check (auth.uid() = user_id);

drop policy if exists "cargas propias: editar" on balance_loads;
create policy "cargas propias: editar" on balance_loads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cargas propias: borrar" on balance_loads;
create policy "cargas propias: borrar" on balance_loads
  for delete using (auth.uid() = user_id);
