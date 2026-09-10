-- ─────────────────────────────────────────────────────────────────────────
-- 0023 — Flujo v2: lo que el onboarding nuevo pregunta y no entraba.
--
-- ADITIVA, con dos AMPLIACIONES de checks existentes. Ampliar un check es
-- compatible hacia atrás: lo que hoy entra sigue entrando, y ahora entra más.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1) Género: entra "otro" con texto libre ──────────────────────────────
-- El check viejo solo admitía femenino/masculino/prefiero_no_decir, así que
-- quien elegía "Otro" en el onboarding v2 hacía fallar el insert.
alter table user_profiles drop constraint if exists user_profiles_gender_check;
alter table user_profiles
  add constraint user_profiles_gender_check
  check (gender is null or gender in ('femenino','masculino','otro','prefiero_no_decir'));

alter table user_profiles
  add column if not exists gender_other text;

-- Si el género es "otro", el texto es lo que la persona escribió. Si no, no
-- debería haber texto colgando.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_gender_other_check') then
    alter table user_profiles
      add constraint user_profiles_gender_other_check
      check (gender_other is null or gender = 'otro');
  end if;
end $$;


-- ── 2) Edad: el v2 pregunta un RANGO, no un número ───────────────────────
-- `age int` se conserva (la usa el flujo viejo). Se agrega el rango, que es lo
-- que el v2 realmente sabe: nadie contestó "tengo 27", contestó "25 a 34".
-- Guardar 27 cuando la persona dijo un rango sería inventar precisión.
alter table user_profiles
  add column if not exists age_range text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_age_range_check') then
    alter table user_profiles
      add constraint user_profiles_age_range_check
      check (age_range is null or age_range in ('18-24','25-34','35-44','45-54','55-64','65+'));
  end if;
end $$;


-- ── 3) El resto de lo que pregunta el onboarding v2 ──────────────────────
alter table user_profiles
  add column if not exists zone            text,
  add column if not exists cohabitation    text[] not null default '{}',
  add column if not exists income_sources  text[] not null default '{}',
  add column if not exists income_stability text,
  add column if not exists main_goal       text,
  add column if not exists how_found_us    text,
  add column if not exists financial_level text,
  add column if not exists terms_accepted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_main_goal_check') then
    alter table user_profiles
      add constraint user_profiles_main_goal_check
      check (main_goal is null or main_goal in ('invertir','ahorrar','objetivo','no_claro'));
  end if;
end $$;


-- ── 4) Reserva ("alcancía") ──────────────────────────────────────────────
-- Existe `reserva_estado()` del flujo viejo, pero el v2 la trata como un saldo
-- propio que la persona va sumando. Va en user_profiles porque es un solo
-- número por usuaria, no una lista.
alter table user_profiles
  add column if not exists reserve_ars numeric not null default 0 check (reserve_ars >= 0);


-- ── 5) Foto de perfil ────────────────────────────────────────────────────
-- El v2 la guarda como data URL en base64 en localStorage. Eso NO va a una
-- columna: una foto en base64 en cada fila hincha la tabla y viaja entera en
-- cada consulta del perfil. Cuando se conecte, va a Supabase Storage y acá
-- queda solo la ruta.
alter table user_profiles
  add column if not exists avatar_path text;
