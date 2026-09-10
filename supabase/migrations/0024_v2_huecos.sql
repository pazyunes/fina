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

-- ── 2) Objetivos: el "por qué" y el monto que todavía no se sabe ─────────
-- En el v2 el objetivo tiene nombre corto ("Viaje a Brasil") y una frase de
-- por qué. Sin `description` el "por qué" se perdía, que es justo la parte que
-- hace que alguien no abandone el objetivo.
alter table goals
  add column if not exists description text;

-- El v2 no obliga a poner un monto exacto: se puede decir "entre tanto y
-- tanto" o "todavía no sé". Eso NO es lo mismo que un objetivo de $0, y la
-- diferencia importa para el §5 de la guía (un dato estimado se muestra como
-- rango, nunca como número exacto).
--   amount_mode = 'exacto'      → amount_ars es el monto
--   amount_mode = 'rango'       → amount_min_ars .. amount_ars
--   amount_mode = 'desconocido' → todavía no lo sabe (amount_ars null)
--   amount_mode = null          → nunca se preguntó (viene del onboarding)
alter table goals
  add column if not exists amount_min_ars numeric check (amount_min_ars is null or amount_min_ars >= 0),
  add column if not exists amount_mode text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'goals_amount_mode_check') then
    alter table goals
      add constraint goals_amount_mode_check
      check (amount_mode is null or amount_mode in ('exacto','rango','desconocido'));
  end if;
end $$;

-- ── 3) Un objetivo puede estar en la moneda en la que se paga ────────────
-- El selector de moneda de Objetivos ofrece ocho monedas (peso, dólar, euro,
-- real, peso chileno, uruguayo, libra, peso mexicano), pero la 0021 dejó el
-- check en ARS/USD: cualquier objetivo en euros o reales fallaba en el insert.
-- Un pasaje a Brasil se paga en reales y el objetivo tiene que poder decirlo.
alter table goals drop constraint if exists goals_currency_check;
alter table goals
  add constraint goals_currency_check
  check (currency in ('ARS','USD','EUR','BRL','CLP','UYU','GBP','MXN'));

alter table goal_contributions drop constraint if exists goal_contributions_currency_check;
alter table goal_contributions
  add constraint goal_contributions_currency_check
  check (currency in ('ARS','USD','EUR','BRL','CLP','UYU','GBP','MXN'));

-- El progreso de un objetivo se calcula EN SU PROPIA MONEDA (juntaste 400 de
-- 1.200 euros), así que no hace falta convertir para que la pantalla funcione.
-- Y no se puede: FINA tiene una sola cotización, la del dólar blue. Antes esta
-- columna era `not null`, o sea que un aporte en euros obligaba a inventar un
-- equivalente en pesos. Ahora null significa algo preciso: "no hay cotización
-- para esta moneda", que es distinto de cero.
alter table goal_contributions alter column amount_ars drop not null;
alter table goal_contributions drop constraint if exists goal_contributions_amount_ars_check;
alter table goal_contributions
  add constraint goal_contributions_amount_ars_check
  check (amount_ars is null or amount_ars > 0);

comment on column goal_contributions.amount_ars is
  'Equivalente en pesos congelado a exchange_rate_id. null = la moneda del aporte no tiene cotización en FINA (sólo hay dólar blue).';

comment on column goals.amount_ars is
  'El monto objetivo, EN LA MONEDA de la columna `currency` (el nombre quedó del esquema viejo). Con amount_mode = rango, el techo del rango.';


-- ── 4) El resto de las respuestas del onboarding ─────────────────────────
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


-- ── 5) El quiz de inversiones se terminó o no ────────────────────────────
-- Sin esto no hay forma de distinguir "contestó las dos preguntas del
-- onboarding" de "hizo el quiz completo": el perfil inversor existe en los dos
-- casos. Y la diferencia decide qué pantalla se abre — quien ya lo terminó no
-- tiene que volver a hacerlo cada vez que entra.
alter table investment_profiles
  add column if not exists completed_at timestamptz;


-- ── 6) Nombres de las demás miembras de tu grupo ─────────────────────────
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

-- ── 7) Bucket de fotos de perfil ─────────────────────────────────────────
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
