-- PR6 — Un informe por usuario.
-- A partir de este PR el onboarding es one-shot: cada usuario genera UN solo
-- informe y la app no expone forma de re-generarlo. Garantizamos la regla a
-- nivel DB con un UNIQUE constraint sobre reports.user_id.
--
-- Las filas anónimas históricas (user_id IS NULL, pre-PR3) NO entran en la
-- restricción — Postgres trata cada NULL como distinto, así que pueden seguir
-- conviviendo cuantas se quiera con user_id NULL.
--
-- Correr una vez en el SQL editor de Supabase.

begin;

-- 1) Limpiar duplicados existentes: para cada user_id con más de un informe,
-- conservar SOLO el más reciente (mayor created_at). Resto se borra.
delete from reports r1
using reports r2
where r1.user_id is not null
  and r1.user_id = r2.user_id
  and r1.created_at < r2.created_at;

-- 2) Constraint UNIQUE sobre user_id. Sin alias propio para que figure con
-- el nombre por default y sea descubrible vía \d reports.
alter table reports
  add constraint reports_user_id_unique unique (user_id);

commit;

-- ── Rollback (DO NOT RUN unless you mean it) ──────────────────────────
-- alter table reports drop constraint if exists reports_user_id_unique;
-- (los rows borrados no se recuperan — la limpieza es destructiva por diseño).
