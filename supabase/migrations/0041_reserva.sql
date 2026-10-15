-- 0041: plata apartada (la reserva) y avisos de plazo de objetivos.
-- DEBT I12 e I7. Idempotente: se puede correr más de una vez.
--
-- ── 1) Reserva ───────────────────────────────────────────────────────────
-- La reserva ya tiene columna: `user_profiles.reserve_ars`, de la 0023 (ya
-- corrida). La app la lee con el perfil (`leerPerfil`) y la escribe con
-- `guardarReserva` en src/app/api/v2/index.ts. No se crea otra columna con otro
-- nombre: dos columnas para el mismo número serían dos verdades.
-- Esto sólo la re-asegura para una base donde la 0023 no hubiera llegado a
-- correr entera.
alter table user_profiles
  add column if not exists reserve_ars numeric not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_reserve_ars_check') then
    alter table user_profiles
      add constraint user_profiles_reserve_ars_check check (reserve_ars >= 0);
  end if;
end $$;

-- ── 2) Avisos de plazo ───────────────────────────────────────────────────
-- Un tipo más en el registro de avisos: 'plazo' ("Quedan 30 días para el viaje
-- y todavía no le sumaste nada"). Lo arma api/_notificaciones/plazos.ts; el
-- registro es el mismo de siempre, uno por persona, tipo y día, y el aviso se
-- manda como mucho una vez por semana.
alter table notification_log drop constraint if exists notification_log_tipo_check;
alter table notification_log add constraint notification_log_tipo_check
  check (tipo in ('paso', 'racha', 'separar', 'resumen', 'vencimiento', 'plazo'));
