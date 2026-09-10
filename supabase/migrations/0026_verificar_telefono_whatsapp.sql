-- ─────────────────────────────────────────────────────────────────────────
-- 0026 — Verificar el teléfono con el propio bot de WhatsApp.
--
-- POR QUÉ ASÍ Y NO POR SMS.
--
-- El teléfono es la llave con la que el bot reconoce a una persona, así que
-- hay que probar que el número es suyo. Lo obvio sería un OTP por SMS, pero:
--
--   · cuesta plata por mensaje y en Argentina las operadoras filtran, así que
--     una parte no llega;
--   · abre la puerta al fraude de "SMS pumping" (alguien dispara miles de
--     códigos a números premium y la cuenta la pagás vos);
--   · y no resuelve el problema de fondo: el bot NO puede escribirle primero a
--     nadie. WhatsApp sólo deja iniciar una conversación con una plantilla
--     aprobada y pagando. O sea que con el teléfono verificado por SMS, la
--     persona igual nunca le habló al bot y el bot igual no puede hablarle.
--
-- Recibir un mensaje de WhatsApp de un número prueba que la persona controla
-- ese número —la misma garantía que un OTP— y además deja la conversación
-- abierta, que es lo que el bot necesita para poder responder después.
--
-- EL FLUJO:
--   1. La app pide un código con `pedir_codigo_telefono()`.
--   2. La app abre WhatsApp con ese código ya escrito (link wa.me).
--   3. La persona toca enviar.
--   4. El bot recibe el mensaje, ve el código, y llama a
--      `verificar_telefono_por_whatsapp(codigo, telefono_del_remitente)`.
--   5. La app, que está esperando, ve `phone_verified_at` y sigue.
--
-- El número que se verifica es el del REMITENTE, no el que la persona tipeó en
-- el formulario: el que se puede probar es el que mandó el mensaje.
--
-- ADITIVA. Correr después de 0025.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists phone_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  code        text not null,
  -- El número que la persona escribió en el formulario. Es informativo: si al
  -- final manda el mensaje desde otro, se verifica el otro. Sirve para poder
  -- avisarle "verificamos este número, que no es el que habías puesto".
  phone_claimed text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz
);

create index if not exists phone_verifications_code_idx
  on phone_verifications (code) where consumed_at is null;
create index if not exists phone_verifications_user_idx
  on phone_verifications (user_id, created_at desc);

alter table phone_verifications enable row level security;

-- Cada una ve SOLO sus propios códigos. Nadie escribe directo: se pide con la
-- función de abajo, que es la que controla el ritmo y la unicidad.
drop policy if exists "codigos propios: leer" on phone_verifications;
create policy "codigos propios: leer" on phone_verifications
  for select using (auth.uid() = user_id);


-- ── Pedir un código ──────────────────────────────────────────────────────
-- Devuelve el código para mostrarlo en pantalla. Invalida los anteriores: en
-- todo momento hay UNO vivo, así no queda un código viejo dando vueltas que
-- también sirva.
create or replace function pedir_codigo_telefono(telefono text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  abc    text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin I, O, 0, 1
  nuevo  text;
  cuantos int;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;

  -- Freno: cinco por hora. Sin esto, un script podría llenar la tabla, y con
  -- códigos de 6 caracteres el volumen empieza a importar para adivinarlos.
  select count(*) into cuantos
  from phone_verifications
  where user_id = uid and created_at > now() - interval '1 hour';
  if cuantos >= 5 then
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
-- Devuelve un estado en texto para que el bot pueda contestar distinto en cada
-- caso, en vez de un booleano que no dice por qué falló:
--
--   'ok'                → verificado
--   'codigo_invalido'   → no existe o ya se usó
--   'codigo_vencido'    → pasaron los 15 minutos
--   'telefono_en_uso'   → ese número ya está en otra cuenta de FINA
--
-- Locked a service_role: la llama el bot, no el navegador. Si esto fuera
-- ejecutable desde el cliente, cualquiera podría verificar un teléfono que no
-- es suyo pasando el número a mano — que es exactamente lo que se quiere
-- evitar.
create or replace function verificar_telefono_por_whatsapp(codigo text, telefono text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fila  phone_verifications;
  tel   text := trim(telefono);
  dueno uuid;
begin
  if tel !~ '^\+[1-9][0-9]{1,14}$' then
    return 'telefono_invalido';
  end if;

  select * into fila
  from phone_verifications
  where code = upper(trim(codigo)) and consumed_at is null
  order by created_at desc
  limit 1;

  if fila.id is null then
    return 'codigo_invalido';
  end if;
  if fila.expires_at < now() then
    return 'codigo_vencido';
  end if;

  -- El índice único de user_profiles.phone ya impediría el duplicado, pero
  -- rebotaría con un error de constraint. Mejor contestarlo con un estado que
  -- el bot pueda explicar.
  select id into dueno from user_profiles
   where phone = tel and id <> fila.user_id;
  if dueno is not null then
    return 'telefono_en_uso';
  end if;

  update user_profiles
     set phone = tel,
         phone_verified_at = now()
   where id = fila.user_id;

  update phone_verifications
     set consumed_at = now()
   where id = fila.id;

  return 'ok';
end;
$$;

revoke all on function verificar_telefono_por_whatsapp(text, text) from public, anon, authenticated;
grant execute on function verificar_telefono_por_whatsapp(text, text) to service_role;

comment on function verificar_telefono_por_whatsapp(text, text) is
  'La llama el bot de WhatsApp con el código del mensaje y el número del remitente. Verifica el número del REMITENTE, que es el único que se puede probar.';
