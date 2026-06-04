-- Cleanup — eliminar las columnas `original_amount` del modelo normalizado.
--
-- Eran un espejo write-only: las escribía syncProfileTables pero NADIE las lee.
-- El "monto original en USD" que muestra la UI sale de reports.user_data (jsonb),
-- no de estas columnas. syncProfileTables ya dejó de escribirlas (commit que
-- acompaña esta migración), así que las dropeamos de las 3 tablas que las tenían.
--
-- Correr una vez en el SQL editor de Supabase.

alter table incomes        drop column if exists original_amount;
alter table fixed_expenses drop column if exists original_amount;
alter table transactions   drop column if exists original_amount;
