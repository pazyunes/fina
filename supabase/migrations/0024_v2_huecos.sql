-- ─────────────────────────────────────────────────────────────────────────
-- 0024 — Los huecos que aparecieron al conectar el flujo v2 de verdad.
--
-- 0020–0023 se escribieron leyendo el esquema. Esta migración es lo que
-- faltaba y sólo se vio al cablear la app contra la base: cuatro cosas
-- concretas, ninguna destructiva.
--
-- ADITIVA. Correr después de 0023.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1) `transactions.original_amount` vuelve ─────────────────────────────
-- La 0009 la borró con un argumento correcto para entonces: era un espejo que
-- nadie leía, porque el monto en dólares vivía en reports.user_data (jsonb).
-- El flujo v2 no usa ese jsonb: lee las tablas normalizadas directo. Si una
-- persona carga "20 USD", el número que tipeó tiene que poder recuperarse tal
-- cual, no reconstruirse dividiendo amount_ars por una cotización que ya
-- cambió. Ese es el patrón de cotización congelada: se guardan los dos montos
-- y el id de la cotización que los une.
alter table transactions
  add column if not exists original_amount numeric
    check (original_amount is null or original_amount > 0);

comment on column transactions.original_amount is
  'Monto tal como lo tipeó la persona cuando currency <> ARS. amount_ars es su equivalente congelado a exchange_rate_id.';

-- ── 2) `goals.description` ───────────────────────────────────────────────
-- En el v2 el objetivo tiene nombre corto ("Viaje a Brasil") y una frase de
-- por qué. Sin esta columna el "por qué" se perdía, que es justo la parte que
-- hace que alguien no abandone el objetivo.
alter table goals
  add column if not exists description text;

-- ── 3) El resto de las respuestas del onboarding ─────────────────────────
-- La 0023 le dio columna propia a las respuestas que se CONSULTAN (género,
-- rango de edad, zona, meta principal, nivel financiero…). Quedan afuera unas
-- diez más —cómo viene el mes, gastos fijos, qué recortaría, cuánto le importa
-- ahorrar/invertir, si le resulta tedioso— que la app lee siempre juntas y
-- nunca filtra ni agrupa por ellas.
--
-- Van a un jsonb en vez de a diez columnas por una razón concreta: el
-- cuestionario cambia seguido. Cada pregunta nueva sería una migración, y una
-- pregunta que se saca dejaría una columna muerta. Lo que se consulta va a
-- columna tipada; lo que se lee en bloque, acá.
alter table user_profiles
  add column if not exists onboarding_v2 jsonb;

comment on column user_profiles.onboarding_v2 is
  'Respuestas del onboarding v2 que se leen en bloque. Lo que se consulta o filtra tiene columna propia.';


-- ── 4) Nombres de las demás miembras de tu grupo ─────────────────────────
-- Un ranking sin nombres no es un ranking. Pero user_profiles es owner-only,
-- así que desde el cliente no se puede leer el nombre de otra persona.
--
-- Esta vista expone EXACTAMENTE un dato de más: el nombre de pila de quienes
-- comparten grupo con vos. Nada de teléfono, edad, ingresos ni gastos. La
-- vista corre con los permisos de su dueño (o sea, saltea la RLS de
-- user_profiles), y lo único que la contiene es el `where`: sin pertenecer al
-- grupo no devuelve ninguna fila. Por eso el filtro está DENTRO de la vista y
-- no se delega al cliente.
create or replace view group_member_names as
select gm.group_id,
       gm.user_id,
       up.name
from group_members gm
join user_profiles up on up.id = gm.user_id
where es_miembro_de(gm.group_id);

revoke all on group_member_names from public, anon;
grant select on group_member_names to authenticated;

comment on view group_member_names is
  'Sólo el nombre de las miembras de los grupos a los que pertenece auth.uid(). El filtro vive en la vista a propósito.';

-- ── 5) Bucket de fotos de perfil ─────────────────────────────────────────
-- Hoy la foto se guarda en base64 en localStorage: no sobrevive a cambiar de
-- teléfono y hace pesado cada arranque. Va a Storage, con la ruta en
-- user_profiles.avatar_path (que agregó la 0023).
--
-- Público en lectura porque es una foto de perfil que se muestra en el ranking
-- del grupo, y una URL firmada por cada avatar en cada render es latencia sin
-- beneficio: la ruta es un uuid, no es adivinable.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Cada persona escribe SOLO dentro de su carpeta `<uid>/…`.
drop policy if exists "avatars: leer" on storage.objects;
create policy "avatars: leer" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars: subir lo mio" on storage.objects;
create policy "avatars: subir lo mio" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: reemplazar lo mio" on storage.objects;
create policy "avatars: reemplazar lo mio" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: borrar lo mio" on storage.objects;
create policy "avatars: borrar lo mio" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
