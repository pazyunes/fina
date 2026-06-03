-- PR8c — Permitir 'cafeterias' como categoría en variable_expense_estimates.
-- El enum original en 0003 tenía ('entertainment','delivery','supermarket').
-- En PR6 agregamos la categoría "Cafeterías y restaurantes" al onboarding y a
-- userData.cafeteriasFrequency/Amount, pero nunca actualizamos el CHECK; por
-- eso los INSERTs nuevos a esa tabla con category='cafeterias' fallan.
--
-- Esta migración: reemplaza el CHECK por uno que incluya 'cafeterias'.
--
-- Correr una vez en el SQL editor de Supabase.

begin;

alter table variable_expense_estimates
  drop constraint if exists variable_expense_estimates_category_check;

alter table variable_expense_estimates
  add constraint variable_expense_estimates_category_check
  check (category in ('entertainment', 'delivery', 'supermarket', 'cafeterias'));

commit;

-- ── Rollback ───────────────────────────────────────────────────────────
-- begin;
-- delete from variable_expense_estimates where category = 'cafeterias';
-- alter table variable_expense_estimates drop constraint if exists variable_expense_estimates_category_check;
-- alter table variable_expense_estimates
--   add constraint variable_expense_estimates_category_check
--   check (category in ('entertainment', 'delivery', 'supermarket'));
-- commit;
