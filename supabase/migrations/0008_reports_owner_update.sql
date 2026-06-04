-- PR (fix) — Permitir que cada usuario ACTUALICE su propio informe.
--
-- Bug: editar ingresos/gastos/metas desde /perfil mostraba el valor nuevo en
-- pantalla pero al recargar volvía el viejo. Causa: la tabla `reports` tenía
-- RLS con policies de SELECT (0002) e INSERT (0002) pero NINGUNA de UPDATE.
-- Con RLS activo y sin policy de update, el `UPDATE reports SET user_data=...`
-- de updateReportData() afecta 0 filas y NO devuelve error (gotcha de
-- Postgres/Supabase) → reports.user_data nunca cambiaba. Las tablas
-- normalizadas (incomes, fixed_expenses, ...) sí se actualizaban porque 0003
-- les dio CRUD completo, lo que confundía: "en Supabase el valor cambia".
--
-- Fix: agregar la policy de UPDATE, dueño-solo, igual que el resto del modelo.
--
-- Correr una vez en el SQL editor de Supabase.

drop policy if exists "reports owner update" on reports;
create policy "reports owner update"
  on reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
