-- PR — Permitir 'restaurants' como categoría en variable_expense_estimates.
-- Separamos "Cafeterías" y "Restaurantes" en el onboarding de gastos variables,
-- así que syncProfileTables ahora inserta filas con category='restaurants'.
-- Sin esto, ese INSERT falla el CHECK (se loguea pero no rompe la app).
--
-- Correr una vez en el SQL editor de Supabase.

alter table variable_expense_estimates
  drop constraint if exists variable_expense_estimates_category_check;

alter table variable_expense_estimates
  add constraint variable_expense_estimates_category_check
  check (category in ('entertainment', 'delivery', 'supermarket', 'cafeterias', 'restaurants'));
