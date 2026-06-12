-- 0012 — Completa las categorías permitidas en variable_expense_estimates.
-- Hasta ahora el CHECK solo aceptaba 5 categorías (entertainment, delivery,
-- supermarket, cafeterias, restaurants). Agregamos las 7 que faltaban para
-- cubrir las 12 categorías del modelo (las mismas que usa BudgetCat / el bot):
-- vivienda, salud, belleza, terapia, gimnasio, transporte, suscripciones.
-- Nombres canónicos en inglés para mantener consistencia con el resto del código.

alter table variable_expense_estimates
  drop constraint if exists variable_expense_estimates_category_check;

alter table variable_expense_estimates
  add constraint variable_expense_estimates_category_check
  check (category in (
    'entertainment',  -- salidas
    'delivery',
    'supermarket',    -- supermercado
    'cafeterias',     -- cafeterías
    'restaurants',    -- restaurantes
    'housing',        -- vivienda
    'health',         -- salud
    'beauty',         -- belleza
    'therapy',        -- terapia
    'gym',            -- gimnasio
    'transport',      -- transporte
    'subscriptions'   -- suscripciones
  ));
