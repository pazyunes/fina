-- ─────────────────────────────────────────────────────────────────────────
-- 0036 — "Otro" se puede escribir: tipo de gasto y fuente de ingreso.
--
-- El tipo de gasto (`expense_type`) y la fuente del ingreso (`income_source`)
-- tienen un check con una lista cerrada de valores, y el bot también escribe
-- esas palabras. Abrir esa lista a texto libre rompería el check (y dejaría
-- entrar cualquier cosa a una columna que el resto de la app trata como
-- vocabulario cerrado).
--
-- Por eso el valor sigue siendo 'otro' y lo que la persona escribió va en una
-- columna aparte. Los "recientes" (para volver a elegir lo que ya escribió,
-- como pasa con las secciones) no necesitan tabla: salen de los valores
-- distintos de estas columnas en los movimientos de cada persona, que ya son
-- suyos por las policies de `transactions`.
--
-- ADITIVA: sólo columnas nuevas y nullable. Correr después de 0035.
-- ─────────────────────────────────────────────────────────────────────────

alter table transactions
  add column if not exists expense_type_other text,
  add column if not exists income_source_other text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_expense_type_other_check') then
    alter table transactions
      add constraint transactions_expense_type_other_check
      check (expense_type_other is null or length(trim(expense_type_other)) between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_income_source_other_check') then
    alter table transactions
      add constraint transactions_income_source_other_check
      check (income_source_other is null or length(trim(income_source_other)) between 1 and 40);
  end if;
end $$;

comment on column transactions.expense_type_other is
  'Lo que la persona escribió cuando eligió el tipo "otro". Sólo tiene sentido con expense_type = ''otro''.';
comment on column transactions.income_source_other is
  'Lo que la persona escribió cuando eligió la fuente "otro". Sólo tiene sentido con income_source = ''otro''.';
