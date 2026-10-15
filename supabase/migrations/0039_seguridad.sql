-- ─────────────────────────────────────────────────────────────────────────
-- 0039 · Seguridad: los agujeros S1 a S5 de DEBT.md.
--
-- Se corre A MANO en el SQL editor de Supabase, después de la 0038. Se puede
-- volver a correr sin problema (drop if exists, create or replace).
--
-- La app ya está preparada para las dos situaciones: con la 0039 corrida y
-- sin correr. Lo que depende de algo nuevo de acá (la RPC `sumar_actividad`)
-- tiene una vuelta atrás en `src/app/api/v2/index.ts` si la función no existe.
--
-- Qué hace:
--   S1 · `exchange_rates`: saca el insert anónimo. La cotización la escribe
--        sólo `api/dolar.ts` con la service role (SUPABASE_SERVICE_ROLE_KEY
--        en Vercel). La lectura sigue pública.
--   S2 · `group_members`: nadie se cambia el rol ni la actividad desde el
--        cliente. La actividad sube por `sumar_actividad`, atómica. Y entrar a
--        un grupo pasa sólo por las funciones (`unirse_a_grupo`, `crear_grupo`),
--        no por un insert directo que se saltea el código y el freno de S4.
--   S3 · `group_expense_splits`: el `user_id` de un reparto tiene que ser
--        miembro del grupo.
--   S4 · `unirse_a_grupo`: máximo 10 códigos equivocados por hora por persona.
--   S5 · `feedback` gana su policy de UPDATE, y varias tablas su policy de
--        DELETE de dueña (para el futuro "borrar mi cuenta").
-- ─────────────────────────────────────────────────────────────────────────


-- ── S1) exchange_rates: sin insert anónimo ───────────────────────────────
-- Con esta policy, cualquiera con la clave pública (que está en el bundle de
-- la app, o sea, cualquiera) podía insertar un dólar a $1 o a $1.000.000, y
-- `api/dolar.ts` lo devolvía como la cotización vigente durante una hora. La
-- service role saltea RLS, así que no necesita ninguna policy para escribir.
drop policy if exists "exchange_rates anon insert" on exchange_rates;


-- ── S2) group_members: rol y actividad no se tocan desde el cliente ──────
-- La policy de UPDATE de la 0022 ("la actividad propia se actualiza sola")
-- dejaba que cada miembro se pusiera `role = 'owner'` o `activity = 99999`.
-- Lo único que se actualiza de una membresía es la actividad, y eso pasa a la
-- función de abajo. Entonces el cliente no necesita UPDATE en esta tabla.
--
-- Primero la función y después el revoke: si el script se cortara a la mitad,
-- mejor que quede la función nueva con el permiso viejo que al revés (la app
-- usa la función si existe, y si no, el update directo).
create or replace function sumar_actividad(grupo uuid, n int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  nueva int;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;
  -- Se suma de a poco: la actividad es cuánto registrás, y un registro es uno.
  -- El tope corta que alguien llame la función con n = 1000000.
  if n is null or n < 1 or n > 10 then
    raise exception 'la actividad se suma de a poco';
  end if;

  -- Un solo update: el lock de la fila hace que dos sumas a la vez se sumen
  -- las dos (el leer y escribir de antes desde el cliente se pisaba).
  update group_members
     set activity = activity + n
   where group_id = grupo and user_id = uid
  returning activity into nueva;

  if nueva is null then
    raise exception 'no sos parte de ese grupo';
  end if;
  return nueva;
end;
$$;

comment on function sumar_actividad(uuid, int) is
  'Suma n (1 a 10) a la actividad de quien llama en ese grupo, atómico. Es la única forma de cambiar la actividad: el cliente no tiene UPDATE en group_members (0039).';

revoke all on function sumar_actividad(uuid, int) from public;
grant execute on function sumar_actividad(uuid, int) to authenticated;

-- Sin policy de UPDATE y sin el privilegio: las dos cosas. La policy sola
-- haría que el update "ande" con cero filas, en silencio; el revoke hace que
-- falle con un error claro.
drop policy if exists "miembros: editar lo mio" on group_members;
revoke update on group_members from anon, authenticated;

-- Entrar a un grupo con un insert directo se salteaba el código de
-- invitación (alcanzaba con saber el id del grupo, por ejemplo después de
-- haber salido) y dejaba elegir `role = 'owner'`. Las dos vías reales,
-- `crear_grupo` y `unirse_a_grupo`, son SECURITY DEFINER y no necesitan esta
-- policy.
drop policy if exists "miembros: entrar yo" on group_members;


-- ── S3) group_expense_splits: el reparto es para alguien del grupo ───────
-- Sin esto, quien pagó podía cargarle una parte a cualquier usuaria de la base
-- (con saber su id), y esa deuda le aparecería a ella. Un trigger y no una
-- condición en la policy: cubre insert y update, y también lo que escriba el
-- bot con la service role.
create or replace function validar_reparto_de_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from group_members m
     where m.group_id = new.group_id and m.user_id = new.user_id
  ) then
    raise exception 'esa persona no es parte del grupo';
  end if;
  return new;
end;
$$;

revoke all on function validar_reparto_de_miembro() from public;

drop trigger if exists repartos_solo_miembros on group_expense_splits;
create trigger repartos_solo_miembros
  before insert or update of user_id, group_id on group_expense_splits
  for each row execute function validar_reparto_de_miembro();


-- ── S4) unirse_a_grupo: un freno a los intentos ──────────────────────────
-- El código es FINA- más 5 caracteres de 32 (unos 33 millones). Probar al
-- azar no es realista, pero sin freno tampoco hay nada que lo impida, y un
-- contador de fallidos es lo que permite ver si alguien está probando. Mismo
-- criterio que la 0027: el freno va sobre los intentos FALLIDOS, así que la
-- persona que tipea bien su código nunca lo siente.
create table if not exists group_join_attempts (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  ok          boolean not null,
  created_at  timestamptz not null default now()
);

create index if not exists group_join_attempts_idx
  on group_join_attempts (user_id, created_at desc);

alter table group_join_attempts enable row level security;
-- Sin policies: nadie la lee desde el cliente. Sólo la función de abajo.

create or replace function unirse_a_grupo(codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  gid      uuid;
  fallidos int;
begin
  if uid is null then
    raise exception 'hay que estar logueada para entrar a un grupo';
  end if;

  -- Diez códigos equivocados en una hora y se corta. Alguien que se equivoca
  -- tipeando no llega nunca; un script que prueba, enseguida.
  select count(*) into fallidos
    from group_join_attempts
   where user_id = uid and not ok and created_at > now() - interval '1 hour';
  if fallidos >= 10 then
    raise exception 'demasiados intentos, esperá un rato';
  end if;

  select id into gid from groups where code = upper(trim(codigo));
  if gid is null then
    insert into group_join_attempts (user_id, ok) values (uid, false);
    return null;
  end if;

  insert into group_members (group_id, user_id, role)
  values (gid, uid, 'member')
  on conflict (group_id, user_id) do nothing;

  insert into group_join_attempts (user_id, ok) values (uid, true);
  return gid;
end $$;

revoke all on function unirse_a_grupo(text) from public;
grant execute on function unirse_a_grupo(text) to authenticated;


-- ── S5) Policies que faltaban ────────────────────────────────────────────
-- Feedback: sin policy de UPDATE, corregir una respuesta fallaba en silencio
-- (RLS no da error, devuelve cero filas).
drop policy if exists "feedback owner update" on feedback;
create policy "feedback owner update" on feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DELETE de dueña en las tablas que no la tenían. Hoy la app no borra nada de
-- esto, pero "borrar mi cuenta" (o "borrar mis datos") lo va a necesitar, y
-- sin la policy el borrado devolvería cero filas sin avisar. Cada una borra
-- sólo lo suyo. `to_regclass` para no fallar en una base a la que le falte
-- alguna tabla.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'feedback',
    'investment_profiles',
    'daily_steps',
    'notification_prefs',
    'recommendations',
    'recommendation_memory',
    'reports'
  ]) loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on %I', t || ' owner delete', t);
      execute format(
        'create policy %I on %I for delete using (auth.uid() = user_id)',
        t || ' owner delete', t
      );
    end if;
  end loop;
end $$;

-- Que la API vea la función nueva sin esperar a que recargue sola.
notify pgrst, 'reload schema';
