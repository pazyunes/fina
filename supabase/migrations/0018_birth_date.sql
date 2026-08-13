-- 0018 — Onboarding ahora pide fecha de nacimiento en vez de edad directa,
-- así la edad se recalcula sola cuando cumple años. `age` queda como mirror
-- derivado (por si algo externo, ej. el bot, todavía lo lee) que se
-- recalcula cada vez que se sincroniza el perfil (ver syncProfileTables en
-- src/app/lib/reports.ts); la fuente de verdad pasa a ser birth_date.

alter table user_profiles
  add column if not exists birth_date date;
