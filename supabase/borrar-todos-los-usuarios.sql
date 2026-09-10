-- ─────────────────────────────────────────────────────────────────────────
-- BORRAR TODOS LOS USUARIOS Y SUS DATOS
--
-- ⚠️  ESTO NO SE PUEDE DESHACER. No hay papelera. Si el proyecto no tiene
--     Point-in-Time Recovery activado (los planes free/pro básico NO lo
--     tienen), los datos no vuelven de ninguna forma.
--
-- Correrlo a mano en el SQL editor de Supabase, en ESTE orden, leyendo el
-- resultado de cada paso antes de seguir. No es un script para automatizar.
--
-- Antes de empezar: Supabase → Database → Backups → descargar un backup, o
-- al menos correr el PASO 0 y guardarte los números.
-- ─────────────────────────────────────────────────────────────────────────


-- ── PASO 0 — Ver qué hay, ANTES de borrar nada ───────────────────────────
-- Corré esto solo y mirá los números. Si algo no cierra con lo que esperabas,
-- parar acá.
select 'auth.users'                  as tabla, count(*) from auth.users
union all select 'reports',                     count(*) from reports
union all select 'user_profiles',               count(*) from user_profiles
union all select 'incomes',                     count(*) from incomes
union all select 'fixed_expenses',              count(*) from fixed_expenses
union all select 'variable_expense_estimates',  count(*) from variable_expense_estimates
union all select 'goals',                       count(*) from goals
union all select 'transactions',                count(*) from transactions
union all select 'user_preferences',            count(*) from user_preferences
union all select 'feedback',                    count(*) from feedback
order by 1;


-- ── PASO 1 — `reports` primero, y esto es OBLIGATORIO ────────────────────
-- Todas las tablas cuelgan de auth.users con `on delete cascade` MENOS
-- `reports`: su FK se declaró sin cláusula ON DELETE (ver migración
-- 0002_reports_auth.sql línea 10), así que el default es NO ACTION y
-- PostgreSQL va a RECHAZAR el borrado de usuarios con un error de foreign key
-- mientras existan informes apuntando a ellos.
--
-- Se borran los informes enteros, incluidos los anónimos viejos (user_id null),
-- porque la idea es empezar de cero.
delete from reports;


-- ── PASO 2 — Los usuarios ────────────────────────────────────────────────
-- Con esto se van en cascada: user_profiles, incomes, fixed_expenses,
-- variable_expense_estimates, goals, transactions, user_preferences y feedback.
delete from auth.users;


-- ── PASO 3 — Comprobar que quedó vacío ───────────────────────────────────
-- Todos los count tienen que dar 0. `exchange_rates` NO se toca a propósito:
-- son cotizaciones del dólar, no datos de nadie, y sirven de historial.
select 'auth.users'                  as tabla, count(*) from auth.users
union all select 'reports',                     count(*) from reports
union all select 'user_profiles',               count(*) from user_profiles
union all select 'incomes',                     count(*) from incomes
union all select 'fixed_expenses',              count(*) from fixed_expenses
union all select 'variable_expense_estimates',  count(*) from variable_expense_estimates
union all select 'goals',                       count(*) from goals
union all select 'transactions',                count(*) from transactions
union all select 'user_preferences',            count(*) from user_preferences
union all select 'feedback',                    count(*) from feedback
order by 1;

select count(*) as cotizaciones_que_se_conservan from exchange_rates;


-- ─────────────────────────────────────────────────────────────────────────
-- LO QUE ESTO **NO** BORRA
--
-- · Lo que cada persona tenga guardado en SU navegador. El flujo v2 guarda
--   todo en localStorage (claves `fina_v2_*`), así que quien haya usado la
--   app v2 va a seguir viendo sus datos en su celular después de este borrado.
--   No hay forma de limpiarlo desde el servidor.
--
-- · Los usuarios de otros proveedores de auth, si hubiera (Google, etc.).
--   `delete from auth.users` los incluye, pero conviene mirar la lista en
--   Authentication → Users antes y después.
--
-- · Nada de Storage. Si en algún momento se suben fotos de perfil a Supabase
--   Storage (hoy no: van en base64 en localStorage), hay que vaciarlo aparte.
-- ─────────────────────────────────────────────────────────────────────────
