-- ─────────────────────────────────────────────────────────────────────────
-- 0033 — Ingresos: la plata que entra, registrada igual desde la app y el bot.
--
-- Un ingreso es un movimiento más de `transactions`, con type = 'income'
-- (la tabla ya lo admitía desde la 0003). Igual que un gasto:
--   · guarda monto, fecha, en qué medio entró (payment_method) y desde dónde se
--     cargó (source: 'web' o 'whatsapp');
--   · mueve el saldo de ese medio en payment_methods, pero SUMANDO.
--
-- Esta migración agrega de dónde vino la plata (`income_source`), para poder
-- mostrar "sueldo" o "freelance" y para que la app y el bot usen las mismas
-- palabras. Es opcional: null = no se dijo.
--
-- La tabla `incomes` (0003) NO se usa para esto: era el ingreso fijo o
-- freelance que se declaraba en el cuestionario de la app vieja, no los
-- movimientos de plata que entra.
--
-- ADITIVA. Correr después de 0032.
-- ─────────────────────────────────────────────────────────────────────────

alter table transactions add column if not exists income_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_income_source_check') then
    alter table transactions
      add constraint transactions_income_source_check
      check (income_source is null or income_source in ('sueldo', 'freelance', 'venta', 'regalo', 'reintegro', 'otro'));
  end if;
end $$;
