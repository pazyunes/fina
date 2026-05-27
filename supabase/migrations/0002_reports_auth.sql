-- PR3 — Historial por usuario.
-- Vincula los informes (`reports`) a un usuario de Supabase Auth sin romper
-- las filas anónimas ya existentes ni el guardado anónimo del onboarding.
-- Correr una vez en el SQL editor de Supabase.

-- 1) Columna para el dueño del informe. Nullable a propósito: las filas viejas
--    y los informes generados sin sesión quedan con user_id = null.
alter table reports
  add column if not exists user_id uuid references auth.users (id);

-- 2) Índice para listar el historial de cada usuario por fecha descendente.
create index if not exists reports_user_id_created_at_idx
  on reports (user_id, created_at desc);

-- 3) RLS: cada usuario solo ve y crea SUS informes; el onboarding anónimo
--    (sin sesión) puede seguir insertando filas con user_id = null.
alter table reports enable row level security;

-- Lectura: solo los propios. Las filas anónimas (user_id null) no son visibles
-- desde el cliente; quedan para analítica interna vía service role.
drop policy if exists "reports owner read" on reports;
create policy "reports owner read"
  on reports for select
  using (auth.uid() = user_id);

-- Inserción: el onboarding anónimo (user_id null) o el usuario logueado
-- guardando su propio informe (auth.uid() = user_id).
drop policy if exists "reports self or anon insert" on reports;
create policy "reports self or anon insert"
  on reports for insert
  with check (user_id is null or auth.uid() = user_id);
