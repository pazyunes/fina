-- ─────────────────────────────────────────────────────────────────────────
-- 0022 — Flujo v2: grupos, competencias y gastos en conjunto.
--
-- ⚠️  ESTA ES LA MIGRACIÓN DELICADA, y no por las tablas.
--
-- Todas las policies de RLS que existían hasta acá son de DUEÑO ÚNICO:
--     using (auth.uid() = user_id)
-- Un grupo necesita lo contrario: que Ana pueda leer filas cuyo `user_id` es
-- de Sofi. Eso no es una columna más, es otro modelo de acceso — y escribirlo
-- mal es una filtración de datos financieros entre usuarias.
--
-- Las tres reglas que sigue este archivo:
--   1. Un miembro ve el GRUPO y lo que se comparte en el grupo. NUNCA los
--      gastos personales de las demás.
--   2. La pertenencia se resuelve con una función SECURITY DEFINER, no con un
--      subselect dentro de la policy de la propia tabla: eso da recursión
--      infinita en RLS (una policy sobre group_members que consulta
--      group_members).
--   3. Cada tabla lleva su policy de UPDATE. Sin ella los updates fallan EN
--      SILENCIO: RLS no da error, devuelve 0 filas afectadas.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1) Grupos ────────────────────────────────────────────────────────────
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  -- Código de invitación. Es lo único por lo que se entra a un grupo, así que
  -- va único y en mayúsculas para que no haya dos iguales con distinto case.
  code        text not null unique check (code = upper(code)),
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── 2) Membresías ────────────────────────────────────────────────────────
create table if not exists group_members (
  group_id    uuid not null references groups (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','member')),
  -- "Competencias": la actividad con la que se compite es CUÁNTO REGISTRÁS,
  -- no cuánto gastás ni cuánto ahorrás. Competir por gastar menos sería
  -- moralizar el consumo, que es justo lo que la app no hace.
  activity    int not null default 0 check (activity >= 0),
  joined_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on group_members (user_id);

-- ── 3) La función de pertenencia ─────────────────────────────────────────
-- SECURITY DEFINER a propósito: corre con los permisos del dueño de la función
-- y por eso puede leer group_members SIN volver a pasar por RLS. Si esta
-- consulta viviera dentro de la policy de group_members, se llamaría a sí
-- misma y Postgres cortaría por recursión infinita.
--
-- search_path fijo y revoke a anon/authenticated: el mismo endurecimiento que
-- ya se aplicó a las otras funciones definer en la migración 0017.
create or replace function es_miembro_de(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

revoke all on function es_miembro_de(uuid) from public;
grant execute on function es_miembro_de(uuid) to authenticated;

alter table groups enable row level security;
alter table group_members enable row level security;

-- Grupos: se ve el grupo si sos miembro. Ni la lista de grupos ajenos, ni
-- buscar por nombre.
drop policy if exists "grupos: leer los mios" on groups;
create policy "grupos: leer los mios" on groups
  for select using (es_miembro_de(id));

drop policy if exists "grupos: crear" on groups;
create policy "grupos: crear" on groups
  for insert with check (auth.uid() = created_by);

-- Renombrar el grupo: solo quien lo creó.
drop policy if exists "grupos: editar" on groups;
create policy "grupos: editar" on groups
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "grupos: borrar" on groups;
create policy "grupos: borrar" on groups
  for delete using (auth.uid() = created_by);

-- Membresías: un miembro ve a sus compañeras (hace falta para el ranking).
drop policy if exists "miembros: leer los del grupo" on group_members;
create policy "miembros: leer los del grupo" on group_members
  for select using (es_miembro_de(group_id));

-- Entrar a un grupo: cada una se agrega a SÍ MISMA. Así nadie mete a otra
-- persona en un grupo sin que ella lo pida.
drop policy if exists "miembros: entrar yo" on group_members;
create policy "miembros: entrar yo" on group_members
  for insert with check (auth.uid() = user_id);

-- La actividad propia se actualiza sola; la de las demás no se toca.
drop policy if exists "miembros: editar lo mio" on group_members;
create policy "miembros: editar lo mio" on group_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Salir del grupo: cada una a sí misma. La dueña puede sacar a alguien.
drop policy if exists "miembros: salir" on group_members;
create policy "miembros: salir" on group_members
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid())
  );


-- ── 4) Gastos en conjunto ────────────────────────────────────────────────
-- Un gasto del grupo sigue siendo una fila de `transactions` (de quien pagó),
-- con `group_id`. Lo que NO alcanza es eso solo: un gasto de $30.000 que pagó
-- Ana y se divide entre tres no son $30.000 para cada una. El reparto va
-- aparte, una fila por persona, y de ahí salen los saldos entre ellas.
alter table transactions
  add column if not exists group_id uuid references groups (id) on delete set null;

create index if not exists transactions_group_idx on transactions (group_id, occurred_at desc);

create table if not exists group_expense_splits (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references transactions (id) on delete cascade,
  group_id        uuid not null references groups (id) on delete cascade,
  -- A quién le toca esta parte.
  user_id         uuid not null references auth.users (id) on delete cascade,
  amount_ars      numeric not null check (amount_ars > 0),
  -- Si ya se lo devolvió a quien pagó.
  settled_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (transaction_id, user_id)
);

create index if not exists group_expense_splits_pendientes_idx
  on group_expense_splits (group_id, user_id) where settled_at is null;

alter table group_expense_splits enable row level security;

-- Los repartos del grupo los ven todos los miembros: es la única forma de que
-- el saldo entre personas sea verificable por las dos partes.
drop policy if exists "repartos: leer los del grupo" on group_expense_splits;
create policy "repartos: leer los del grupo" on group_expense_splits
  for select using (es_miembro_de(group_id));

-- Crear un reparto: solo sobre un gasto propio, y solo dentro de un grupo del
-- que sos miembro. Las dos condiciones juntas — con una sola, cualquier
-- miembro podría inventar deudas sobre gastos ajenos.
drop policy if exists "repartos: crear sobre gasto propio" on group_expense_splits;
create policy "repartos: crear sobre gasto propio" on group_expense_splits
  for insert with check (
    es_miembro_de(group_id)
    and exists (
      select 1 from transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );

-- Marcar como saldado: quien pagó el gasto (confirma que le devolvieron) o
-- quien debe (avisa que pagó). Las dos partes, nadie más.
drop policy if exists "repartos: saldar" on group_expense_splits;
create policy "repartos: saldar" on group_expense_splits
  for update using (
    auth.uid() = user_id
    or exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())
  ) with check (
    auth.uid() = user_id
    or exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())
  );

drop policy if exists "repartos: borrar" on group_expense_splits;
create policy "repartos: borrar" on group_expense_splits
  for delete using (
    exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())
  );


-- ── 5) Los gastos del grupo se ven entre miembros ────────────────────────
-- OJO: `transactions` ya tiene su policy de lectura de dueño único, de la
-- migración 0003. Las policies de un mismo comando se combinan con OR, así que
-- ESTA SE SUMA: cada una sigue viendo sus gastos, y ADEMÁS los del grupo.
--
-- La condición es `group_id is not null and es_miembro_de(group_id)`: sin el
-- `is not null`, un gasto personal (group_id null) quedaría visible según cómo
-- evalúe la función, y eso sería exactamente la filtración que hay que evitar.
drop policy if exists "gastos del grupo: leer entre miembros" on transactions;
create policy "gastos del grupo: leer entre miembros" on transactions
  for select using (group_id is not null and es_miembro_de(group_id));


-- ── 6) Unirse por código ─────────────────────────────────────────────────
-- Para entrar a un grupo hace falta LEER el grupo por su código, pero la
-- policy de lectura exige ser miembro — y todavía no lo sos. Se resuelve con
-- una función definer que resuelve el código y agrega a quien llama.
-- Devuelve el id del grupo, o null si el código no existe.
create or replace function unirse_a_grupo(codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'hay que estar logueada para entrar a un grupo';
  end if;

  select id into gid from groups where code = upper(trim(codigo));
  if gid is null then
    return null;
  end if;

  insert into group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return gid;
end $$;

revoke all on function unirse_a_grupo(text) from public;
grant execute on function unirse_a_grupo(text) to authenticated;
