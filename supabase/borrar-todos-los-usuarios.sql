-- -------------------------------------------------------------------------
-- BORRAR TODOS LOS USUARIOS Y SUS DATOS
--
-- ESTO NO SE PUEDE DESHACER una vez confirmado. No hay papelera. Si el
-- proyecto no tiene Point-in-Time Recovery (los planes free y pro básico NO
-- lo tienen), los datos no vuelven de ninguna forma.
--
-- Se corre a mano en el SQL editor de Supabase, en tres partes y leyendo el
-- resultado de cada una antes de seguir. No es un script para automatizar.
--
-- Antes de empezar: Supabase > Database > Backups > descargar un backup, o al
-- menos correr el PASO 0 y guardarte los números.
-- -------------------------------------------------------------------------


-- PASO 0. Ver qué hay, ANTES de borrar nada.
-- Corré sólo este select y mirá los números. Si algo no cierra con lo que
-- esperabas, parar acá. Cuenta sólo las tablas que existen, así no falla si
-- alguna migración (por ejemplo la 0039) todavía no se corrió.
select t as tabla,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %s', t), false, true, '')))[1]::text::bigint as filas
from unnest(array[
  'auth.users',
  -- v2 (lo que usa la app hoy)
  'user_profiles', 'transactions', 'payment_methods', 'balance_loads',
  'expense_sections', 'recurring_expenses', 'goals', 'goal_contributions',
  'investment_profiles', 'investment_contributions', 'daily_steps',
  'recommendations', 'recommendation_checks', 'recommendation_memory',
  'push_subscriptions', 'notification_prefs', 'notification_log',
  'phone_verifications', 'phone_verification_attempts', 'feedback',
  'groups', 'group_members', 'group_expense_splits', 'group_join_attempts',
  -- v1 (la app ya no las lee, pueden tener datos viejos)
  'reports', 'incomes', 'fixed_expenses', 'variable_expense_estimates',
  'user_preferences'
]) as t
where to_regclass(t) is not null
order by 1;

select count(*) as fotos_de_perfil from storage.objects where bucket_id = 'avatars';


-- PASO 1. El borrado, en una sola transacción.
-- Seleccioná desde `begin` hasta `commit` y corré todo junto: o se borra
-- todo, o no se borra nada.
--
-- `reports` va primero y es OBLIGATORIO: su FK a auth.users se declaró sin
-- ON DELETE (migración 0002, línea 10), así que Postgres RECHAZA borrar
-- usuarios mientras haya informes apuntando a ellos. Todas las demás tablas
-- cuelgan de auth.users con `on delete cascade` y se van solas con el
-- segundo delete (directo o a través de groups, transactions, goals, etc.).
-- Se borran también los informes anónimos viejos (user_id null), porque la
-- idea es empezar de cero.
begin;

delete from reports;
delete from auth.users;

commit;
-- Si algo dio error entre begin y commit, no se borró nada: corré
-- `rollback;` y revisá el mensaje antes de reintentar.


-- PASO 2. Comprobar que quedó vacío.
-- Volvé a correr el select del PASO 0: todos los números tienen que dar 0.
-- `exchange_rates` NO se toca a propósito: son cotizaciones del dólar, no
-- datos de nadie, y sirven de historial.
select count(*) as cotizaciones_que_se_conservan from exchange_rates;


-- PASO 3. Las fotos de perfil (Storage). Esto NO lo borra el PASO 1.
-- Las fotos viven en el bucket `avatars` (migración 0024), en una carpeta
-- por persona (`<user_id>/...`). Borrar el usuario no las toca: quedan
-- huérfanas y públicas.
--
-- Cómo vaciarlo: Supabase > Storage > avatars > seleccionar todas las
-- carpetas > Delete. Supabase no deja borrar filas de `storage.objects` con
-- SQL en los proyectos nuevos ("Direct deletion from storage tables is not
-- allowed"): ese delete deja el archivo en el disco. Si tu proyecto es viejo
-- y lo permite, igual conviene usar el panel o la API de Storage, que borran
-- el archivo y la fila juntos.
--
-- Para verificar, este count tiene que dar 0:
select count(*) as fotos_de_perfil from storage.objects where bucket_id = 'avatars';


-- -------------------------------------------------------------------------
-- LO QUE ESTO NO BORRA
--
-- Las fotos de perfil en Storage, salvo que hagas el PASO 3.
--
-- Lo que la persona tenga en su navegador: la sesión guardada de Supabase y
-- las claves locales `fina_v2_*` (la reserva, el PIN de bloqueo, avisos ya
-- vistos, respuestas del onboarding sin cuenta). Al abrir la app con la
-- cuenta borrada la sesión falla y vuelve al inicio, pero esas claves no se
-- pueden limpiar desde el servidor.
--
-- Los usuarios de otros proveedores de auth, si hubiera (Google, etc.).
-- `delete from auth.users` los incluye, pero conviene mirar la lista en
-- Authentication > Users antes y después.
-- -------------------------------------------------------------------------
