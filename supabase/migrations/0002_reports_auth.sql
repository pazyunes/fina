-- PR3 — Historial por usuario.
-- Vincula los informes (`reports`) a un usuario de Supabase Auth. El onboarding
-- ahora requiere sesión, así que cada informe nuevo tiene dueño; las filas
-- anónimas viejas se conservan (user_id = null) pero no se pueden crear más.
-- Correr una vez en el SQL editor de Supabase.

-- 1) Columna para el dueño del informe. Nullable solo por las filas históricas
--    anónimas; los informes nuevos siempre llevan user_id (ver policy de insert).
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

-- Inserción: solo el usuario logueado guardando su propio informe. El
-- onboarding exige sesión, así que no se permiten inserciones anónimas.
drop policy if exists "reports self or anon insert" on reports;
drop policy if exists "reports self insert" on reports;
create policy "reports self insert"
  on reports for insert
  with check (auth.uid() = user_id);
