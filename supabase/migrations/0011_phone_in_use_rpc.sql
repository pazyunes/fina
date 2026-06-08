-- PR — Evitar dos cuentas con el mismo teléfono.
--
-- Ya existe el índice único parcial user_profiles_phone_unique (migración 0003),
-- que impide DOS filas con el mismo phone. Pero el signup crea la cuenta de Auth
-- antes de escribir user_profiles, así que para bloquear ANTES de crear la cuenta
-- necesitamos poder consultar si un teléfono ya está en uso sin pasar por RLS.
--
-- Esta función security-definer devuelve true/false y es ejecutable por anon
-- (en el form de registro) y authenticated. Solo expone un booleano, no datos.
--
-- Correr una vez en el SQL editor de Supabase.

create or replace function phone_in_use(p_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from user_profiles where phone = p_phone);
$$;

grant execute on function phone_in_use(text) to anon, authenticated;
