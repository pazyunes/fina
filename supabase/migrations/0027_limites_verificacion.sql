-- ─────────────────────────────────────────────────────────────────────────
-- 0027 — Los límites de la verificación del teléfono, en el lugar correcto.
--
-- La 0026 puso un tope de 5 códigos por hora por usuaria. Dos problemas:
--
-- 1) ES DEMASIADO POCO. El código vive 15 minutos, así que en una hora entran
--    cuatro vencimientos naturales. Alguien que abre la pantalla, se
--    distrae, vuelve y el código venció, y repite, quema los cinco sin hacer
--    nada raro — y queda sin la única forma que tiene de verificar su
--    teléfono. Un freno que traba a la persona honesta y no al ataque es un
--    freno mal puesto.
--
-- 2) NO FRENA LO QUE HABÍA QUE FRENAR. Limitar cuántos códigos se PIDEN no
--    protege contra el ataque real, que es del otro lado: mandarle al bot
--    códigos al azar hasta pegarle a uno vivo. Si eso funcionara, el número
--    del atacante quedaría pegado a la cuenta de otra persona. Cuántos
--    códigos pida la dueña de la cuenta no cambia nada de eso.
--
--    (Para dimensionarlo: 6 caracteres de un alfabeto de 32 son unos 1.100
--    millones de combinaciones, así que adivinar no es realista. Pero el
--    freno va del lado de los INTENTOS igual, porque es ahí donde vive el
--    riesgo, y porque un contador de intentos fallidos es lo que después
--    permite darse cuenta de que alguien está probando.)
--
-- Entonces:
--   · pedir un código: freno anti-machaque (uno cada 20 segundos) + un techo
--     por hora que ninguna persona real alcanza;
--   · verificar un código: freno de verdad, por intentos fallidos.
--
-- ADITIVA. Correr después de 0026.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Intentos de verificación ─────────────────────────────────────────────
-- Una fila por llamada del bot. Sirve para el freno y para poder mirar si
-- alguien está probando códigos al azar.
create table if not exists phone_verification_attempts (
  id          bigserial primary key,
  -- El número desde el que llegó el mensaje. No hay user_id porque cuando el
  -- código es inválido no se sabe de quién era.
  phone       text not null,
  result      text not null,
  created_at  timestamptz not null default now()
);

create index if not exists phone_verification_attempts_idx
  on phone_verification_attempts (phone, created_at desc);

alter table phone_verification_attempts enable row level security;
-- Sin policies: nadie la lee desde el cliente. Sólo service_role, que saltea
-- RLS, y las funciones definer de abajo.


-- ── Pedir un código ──────────────────────────────────────────────────────
create or replace function pedir_codigo_telefono(telefono text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  abc     text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin I, O, 0, 1
  nuevo   text;
  ultimo  timestamptz;
  cuantos int;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;

  -- Anti-machaque: uno cada 20 segundos. Frena el doble toque y un script,
  -- sin molestar a nadie que esté esperando un mensaje de WhatsApp.
  select max(created_at) into ultimo
  from phone_verifications where user_id = uid;
  if ultimo is not null and ultimo > now() - interval '20 seconds' then
    raise exception 'esperá unos segundos antes de pedir otro';
  end if;

  -- Techo por hora, alto a propósito: está para cortar un bucle, no para
  -- disciplinar a la persona. Con el código venciendo cada 15 minutos, veinte
  -- por hora es mucho más de lo que puede necesitar alguien de verdad.
  select count(*) into cuantos
  from phone_verifications
  where user_id = uid and created_at > now() - interval '1 hour';
  if cuantos >= 20 then
    raise exception 'demasiados intentos, esperá un rato';
  end if;

  update phone_verifications
     set consumed_at = now()
   where user_id = uid and consumed_at is null;

  nuevo := (
    select string_agg(substr(abc, 1 + floor(random() * length(abc))::int, 1), '')
    from generate_series(1, 6)
  );

  insert into phone_verifications (user_id, code, phone_claimed, expires_at)
  values (uid, nuevo, telefono, now() + interval '15 minutes');

  return nuevo;
end;
$$;

revoke all on function pedir_codigo_telefono(text) from public;
grant execute on function pedir_codigo_telefono(text) to authenticated;


-- ── Verificar (la llama el BOT) ──────────────────────────────────────────
-- Gana un estado nuevo: 'demasiados_intentos'. Éste es el freno que importa.
create or replace function verificar_telefono_por_whatsapp(codigo text, telefono text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fila     phone_verifications;
  tel      text := trim(telefono);
  dueno    uuid;
  fallidos int;
  estado   text;
begin
  if tel !~ '^\+[1-9][0-9]{1,14}$' then
    -- No se registra el intento: el número ni siquiera está bien formado, así
    -- que no hay a quién contárselo. Es un bug del bot, no un ataque.
    return 'telefono_invalido';
  end if;

  -- Diez fallidos por hora desde el mismo número y se corta. Alguien probando
  -- códigos al azar necesita millones de intentos; con esto no llega a mil.
  select count(*) into fallidos
  from phone_verification_attempts
  where phone = tel and result <> 'ok' and created_at > now() - interval '1 hour';
  if fallidos >= 10 then
    insert into phone_verification_attempts (phone, result) values (tel, 'demasiados_intentos');
    return 'demasiados_intentos';
  end if;

  select * into fila
  from phone_verifications
  where code = upper(trim(codigo)) and consumed_at is null
  order by created_at desc
  limit 1;

  if fila.id is null then
    estado := 'codigo_invalido';
  elsif fila.expires_at < now() then
    estado := 'codigo_vencido';
  else
    -- El índice único de user_profiles.phone ya impediría el duplicado, pero
    -- rebotaría con un error de constraint. Mejor contestarlo con un estado
    -- que el bot pueda explicar.
    select id into dueno from user_profiles
     where phone = tel and id <> fila.user_id;

    if dueno is not null then
      estado := 'telefono_en_uso';
    else
      update user_profiles
         set phone = tel,
             phone_verified_at = now()
       where id = fila.user_id;

      update phone_verifications
         set consumed_at = now()
       where id = fila.id;

      estado := 'ok';
    end if;
  end if;

  insert into phone_verification_attempts (phone, result) values (tel, estado);
  return estado;
end;
$$;

revoke all on function verificar_telefono_por_whatsapp(text, text) from public, anon, authenticated;
grant execute on function verificar_telefono_por_whatsapp(text, text) to service_role;

comment on function verificar_telefono_por_whatsapp(text, text) is
  'La llama el bot con el código del mensaje y el número del remitente. Verifica el número del REMITENTE, que es el único que se puede probar. Corta a los 10 intentos fallidos por hora desde el mismo número.';
