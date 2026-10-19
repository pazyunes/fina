-- 0043: lo que ya sabés que vas a gastar, separado de los objetivos de ahorro.
-- Idempotente: se puede correr más de una vez. Correr después de 0042.
--
-- Una misma tabla (`goals`) para las dos cosas, porque las dos funcionan igual
-- por debajo: plata que se aparta y deja de estar libre para gastar. Lo que
-- cambia es para qué es:
--
--   · 'ahorro': un objetivo (un viaje, un colchón). La plata apartada sigue
--     siendo de la persona hasta que decida usarla.
--   · 'gasto': algo que ya se sabe que se va a pagar (la psicóloga, una cuota).
--     Al pagarlo se registra el gasto y se libera lo apartado, así lo libre no
--     baja dos veces. Si se repite todos los meses, vuelve a empezar.
--
-- Lo apartado sale de los registros que ya existen (`goal_contributions`):
-- 'saved' es plata apartada; en un gasto, 'paid' es lo que ya se usó para
-- pagarlo.

alter table goals add column if not exists purpose text not null default 'ahorro';
alter table goals add column if not exists repeats text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'goals_purpose_check') then
    alter table goals add constraint goals_purpose_check check (purpose in ('ahorro', 'gasto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goals_repeats_check') then
    alter table goals add constraint goals_repeats_check check (repeats is null or repeats in ('mensual'));
  end if;
end $$;
