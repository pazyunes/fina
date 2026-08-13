-- 0019 — RPC para saber si un email ya tiene cuenta.
--
-- Usado en el flujo de "Olvidé mi contraseña": si el email no está
-- registrado, el botón pasa de "Enviar link" a "Crear cuenta" en vez de
-- mostrar siempre el mismo mensaje genérico. Decisión de producto: se
-- prioriza la UX sobre ocultar si un email existe (mismo trade-off que
-- phone_in_use en 0011). Solo expone un booleano, nunca datos de la cuenta.
--
-- auth.users no es consultable con la anon key, así que necesitamos una
-- función security-definer (corre con privilegios del owner) para mirarla.
--
-- Correr una vez en el SQL editor de Supabase.

create or replace function email_in_use(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(p_email)
  );
$$;

grant execute on function email_in_use(text) to anon, authenticated;
