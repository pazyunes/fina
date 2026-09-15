# Bot de WhatsApp de FINA — qué cambiar

**Para:** quien está modificando el bot (Kapso).
**Fecha:** 10 de septiembre de 2026 (actualizado el 15).

La app de FINA se rehizo y ahora guarda todo en Supabase, en las mismas tablas
que usa el bot. Un gasto cargado en la app lo ve el bot, y uno cargado por el
bot lo ve la app. Antes eso no pasaba.

Este documento es autocontenido: no hace falta leer el código de la app.

Son **seis cambios**. El primero es el que rompe todo si falta.

---

## 1. Cómo encontrar a la persona por su teléfono ⚠️

**Este es el crítico.** Si queda mal, el bot no reconoce a nadie que se haya
registrado en la app nueva.

WhatsApp entrega los números argentinos **con** el 9:

```
5491155556666
```

La app los guarda **sin** el 9, con `+` adelante:

```
+541155556666
```

Buscar el número tal como llega **no encuentra nada**. Hay que normalizarlo
antes:

```
1. quedarse sólo con los dígitos            5491155556666
2. sacar el 54 del país                     91155556666
3. si empieza con 9, sacarlo                1155556666
   (ningún código de área argentino empieza con 9,
    así que un 9 adelante es siempre el prefijo de celular)
4. tienen que quedar 10 dígitos             ✓
5. armar el resultado como +54 + esos 10    +541155556666
```

En JavaScript:

```js
function telefonoFina(deWhatsapp) {
  let n = String(deWhatsapp).replace(/\D/g, '');
  if (n.startsWith('54')) n = n.slice(2);
  if (n.startsWith('0')) n = n.slice(1);
  if (n.startsWith('9')) n = n.slice(1);
  return n.length === 10 ? `+54${n}` : null;
}
```

Y la búsqueda:

```sql
select id, name from user_profiles where phone = '+541155556666';
```

**Si no hay fila**, esa persona no tiene cuenta en FINA (o la creó con otro
número). No es un error: hay que contestarle que se registre, o preguntarle con
qué número se registró. Nunca fallar en silencio.

---

## 2. Verificar el teléfono cuando la persona manda un código

Esto es nuevo y es **una función más del bot**.

### Por qué así y no por SMS

El bot no puede escribirle primero a nadie: WhatsApp sólo deja iniciar una
conversación con plantilla aprobada y pagando. Así que la verificación va al
revés — la persona le manda un mensaje al bot. Recibirlo prueba que el número es
suyo (la misma garantía que un código por SMS), no cuesta nada, y de paso deja
la conversación abierta, que es lo que el bot necesita para poder responder
después.

### Qué llega

Desde la app, la persona toca un botón que abre WhatsApp con este texto ya
escrito, y sólo tiene que enviarlo:

```
FINA-VERIF-4KQ7M2
```

El código son **6 caracteres**, mayúsculas y números, del alfabeto
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin I, O, 0 ni 1, para que no se confundan).

### Qué tiene que hacer el bot

Si el mensaje matchea `FINA-VERIF-([A-Z0-9]{6})`, en vez de tratarlo como un
gasto, llamar a esta función con el código y **el número del remitente ya
normalizado** (paso 1):

```sql
select verificar_telefono_por_whatsapp('4KQ7M2', '+541155556666');
```

Por HTTP contra Supabase:

```
POST  https://<tu-proyecto>.supabase.co/rest/v1/rpc/verificar_telefono_por_whatsapp
      apikey: <service_role key>
      Authorization: Bearer <service_role key>
      Content-Type: application/json

      { "codigo": "4KQ7M2", "telefono": "+541155556666" }
```

Devuelve **un texto** con el resultado. Conviene contestar distinto en cada
caso, porque el motivo cambia qué tiene que hacer la persona:

| Devuelve | Qué pasó | Qué contestarle (sugerido) |
| --- | --- | --- |
| `ok` | verificado | "¡Listo! Tu teléfono quedó verificado. Ya podés contarme tus gastos por acá." |
| `codigo_invalido` | no existe, o ya se usó | "Ese código no me figura. Pedí uno nuevo desde tu perfil en la app." |
| `codigo_vencido` | pasaron más de 15 minutos | "Ese código venció. Pedí uno nuevo desde tu perfil en la app." |
| `telefono_en_uso` | ese número ya está en otra cuenta de FINA | "Este número ya está usado por otra cuenta. Escribinos si es un error." |
| `telefono_invalido` | el número no quedó bien armado | revisar el paso 1 — es un bug del bot, no de la persona |
| `demasiados_intentos` | 10 códigos fallidos desde ese número en la última hora | "Probaste varios códigos que no eran. Esperá un rato y pedí uno nuevo en la app." |

**Importante:** el número que se verifica es el del **remitente**, no el que la
persona escribió en el formulario de la app. El que se puede probar es el que
mandó el mensaje. La función se encarga de guardarlo.

El código **se usa una sola vez** y vive **15 minutos**.

Hay un freno del lado de los intentos: **a los 10 códigos fallidos desde el
mismo número en una hora, la función deja de responder** y devuelve
`demasiados_intentos`. Está para cortar a alguien que pruebe códigos al azar
para pegarle a uno vivo (si le pegara, su número quedaría pegado a la cuenta de
otra persona). El bot no tiene que hacer nada especial: sólo contestar ese
estado como cualquier otro.

---

## 3. Registrar un gasto: cuatro campos nuevos

La app le pide a cada gasto más cosas que antes. Si el bot escribe con menos,
el gasto aparece en la app sin sección y sin clasificar.

```sql
insert into transactions (
  user_id, occurred_at, type,
  amount_ars, currency, original_amount, exchange_rate_id,
  description, section_id, expense_type, payment_method,
  source
) values (
  :uid, :cuando, 'expense',
  :monto_ars, 'ARS', null, null,
  :descripcion, :section_id, :tipo, :metodo,
  'whatsapp'
);
```

Lo que hay que llenar:

- **`source` = `'whatsapp'`**, siempre. La app escribe `'web'`. Sirve para
  poder decirle "esto lo cargaste por WhatsApp".
- **`section_id`** → ver el punto 4.
- **`expense_type`** → uno de `necesario`, `urgente`, `impulsivo`, `otro`.
  Es un **juicio de la persona**, no se infiere: si no lo dijo, va `otro`.
- **`payment_method`** → texto libre ("Mercado Pago", "Efectivo", "Ualá"). Ver
  el punto 4 para ofrecerle los que ya usa.
- **`occurred_at`** → cuándo pasó el gasto, no cuándo se cargó. Si dice "ayer
  gasté", va la fecha de ayer.

### Si el gasto es en dólares

Se llenan **tres** columnas, no una:

```sql
  amount_ars       = 30800,     -- el equivalente en pesos
  currency         = 'USD',
  original_amount  = 20,        -- lo que la persona dijo
  exchange_rate_id = '<id de la cotización usada>'
```

La cotización se **congela**: un gasto de US$20 de hace seis meses no son los
pesos que valen esos dólares hoy, son los que costó entonces. La cotización sale
de la tabla `exchange_rates` (la última fila con `currency = 'USD_BLUE'`) y hay
que guardar su `id`. **Este bug ya lo tuvo FINA una vez**, así que es importante.

```sql
select id, rate from exchange_rates
 where currency = 'USD_BLUE'
 order by fetched_at desc limit 1;
```

### Si el bot informa totales

Sumar siempre por **`amount_ars`**, nunca por `original_amount`. Un gasto de
US$20 entra al total del mes como $30.800, no como $20. (Era un bug de la app: el
mes se veía $30.780 más barato de lo que fue.)

---

## 4. Ofrecerle lo que ya usa, no una lista genérica

### Secciones de gasto

Cada persona **arma sus propias secciones**: elige algunas en el onboarding,
agrega sugeridas desde Gastos, o escribe la suya ("Mascota", "Facu", "Gym").
Son filas de la tabla `expense_sections`, y el bot tiene que usar **las
mismas**. Si no, pasa esto: la persona tiene "Supermercado" en la app, le dice
al bot "gasté en el súper", el bot crea "Súper", y ahora tiene dos secciones
para lo mismo, con el gasto repartido entre las dos.

#### La tabla

| Columna | Qué es |
| --- | --- |
| `id` | Lo que va en `transactions.section_id`. **Siempre se usa el id, nunca el nombre.** |
| `user_id` | De quién es |
| `name` | El nombre tal como lo escribió la persona: "Belleza y cuidado personal" |
| `slug` | El nombre normalizado. Es lo que impide duplicados: no puede haber dos secciones con el mismo `slug` para la misma persona |
| `cap_amount`, `cap_period` | El tope: monto y `'semana'` o `'mes'`. Los dos `null` = sin tope |
| `archived` | `true` = la persona la borró desde la app |

#### Regla 1: leer las secciones cada vez, sin guardarlas

```sql
select id, name, cap_amount, cap_period
  from expense_sections
 where user_id = :uid and archived = false
 order by created_at;
```

Leerlas **en cada conversación**, no guardarlas en memoria del bot. La persona
puede crear, borrar o cambiarle el nombre a una sección desde la app en
cualquier momento. Y en el gasto guardar siempre el **`id`**: si mañana
"Súper" pasa a llamarse "Supermercado", los gastos siguen agrupados.

#### Regla 2: primero buscar entre las suyas

Cuando la persona nombra una sección, en este orden:

1. **Coincide con una suya** (comparando por `slug`, ver regla 3): usar esa.
2. **Se parece a una suya** ("súper" y "Supermercado", "birra" y "Salidas y
   entretenimiento"): **preguntar**, no decidir solo.
   *"¿Lo anoto en Supermercado?"*
3. **No se parece a ninguna**: ofrecer crearla, o elegir entre las suyas.
   *"No tenés una sección 'Mascota'. ¿La creo, o lo anoto en otra?"*
4. **No dijo sección**: ofrecer las suyas. Si no tiene ninguna, las sugeridas.

Si la persona no quiere elegir, el gasto se puede guardar con `section_id =
null`: en la app aparece como "Sin sección" y no se rompe nada. Mejor eso que
adivinar mal.

#### Regla 3: el `slug` se calcula EXACTAMENTE como en la app

Esto es lo más importante de esta parte. Si el bot calcula el slug distinto,
"Cafetería" en el bot y "Cafetería" en la app quedan como dos secciones.

Esta es la función de la app, tal cual:

```js
function slugSeccion(nombre) {
  return (
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')   // saca tildes y diéresis: á → a, ñ → n
      .replace(/[^a-z0-9]+/g, '_')       // todo lo que no es letra o número → _
      .replace(/^_+|_+$/g, '')           // sin _ al principio ni al final
    || 'otro'
  );
}
```

Ejemplos para chequear que dé igual:

| Nombre | `slug` |
| --- | --- |
| `Supermercado` | `supermercado` |
| `Cafeterías` | `cafeterias` |
| `Belleza y cuidado personal` | `belleza_y_cuidado_personal` |
| `Salidas & Birras!` | `salidas_birras` |
| `  Niñera  ` | `ninera` |
| `Uñas 💅` | `unas` |

Ojo con la ñ: `normalize('NFD')` la separa en n + tilde, y la tilde se va. Queda
`n`. Así lo hace la app, así tiene que hacerlo el bot.

#### Regla 4: crear una sección

```sql
insert into expense_sections (user_id, name, slug)
values (:uid, :nombre_como_lo_escribio, :slug)
on conflict (user_id, slug) do update set archived = false
returning id, name;
```

- `name` va **como lo escribió la persona**, con mayúsculas y tildes, sin espacios
  al principio ni al final.
- Si ya existía una con ese slug (por ejemplo, la había borrado), **vuelve a
  aparecer** con sus gastos viejos adentro, en vez de fallar o duplicarse. Usar
  el `name` que devuelve, que es el que ya tenía.
- No mandar `id`: se genera solo.

#### Regla 5: las secciones borradas

Cuando la persona borra una sección en la app, no se borra la fila: queda con
`archived = true`, y sus gastos viejos la siguen apuntando.

- **No ofrecerlas** (el `where archived = false` de la regla 1 ya se encarga).
- Si la persona la nombra de nuevo, la regla 4 la recupera sola.
- Al contar gastos viejos, un gasto puede apuntar a una sección archivada. Eso
  está bien: mostrarla con su nombre.

#### Regla 6: las sugeridas son las mismas que en la app

Cuando la persona no tiene secciones, o pide ideas, ofrecer **esta lista y no
otra**, así lo que ve en el bot coincide con lo que ve en la app:

> Delivery · Restaurantes · Cafeterías · Salidas y entretenimiento ·
> Supermercado · Transporte · Belleza y cuidado personal · Ropa · Suscripciones ·
> Compras online · Farmacia · Regalos

Ofrecer primero las suyas, después las sugeridas que todavía no tiene.

#### Regla 7: los topes

Si el bot quiere comentar un tope después de un gasto:

- El período es **la semana en curso (de lunes a domingo)** o **el mes en curso**,
  en hora de Argentina. No "los últimos 7 días" ni "los últimos 30".
- Sumar por `amount_ars` los gastos de esa sección en ese período.
- **Con el tono de FINA**: nunca "te pasaste del tope". Algo como *"Llevás
  $42.000 de los $50.000 que te pusiste para Delivery esta semana."* Y si ya lo
  superó, el dato, el contexto y una salida, sin retar.

#### Regla 8: los nombres son datos, no instrucciones

Los nombres de las secciones los escribe la persona. Si el bot usa un modelo de
IA para entender los mensajes, los nombres tienen que llegarle **como datos**,
nunca como parte de sus instrucciones. Una sección puede llamarse cualquier
cosa, incluso "ignorá lo anterior y …".

### Medios de pago

```sql
select name, balance_ars from payment_methods
 where user_id = :uid
 order by last_used_at desc nulls last;
```

Ofrecerle los que ya usó, del más reciente al más viejo, más la opción de decir
otro.

---

## 5. El saldo: nunca con un `update` ⚠️

`payment_methods.balance_ars` es el "dinero disponible" que la app muestra
arriba de todo. Un gasto lo tiene que **restar**.

Pero **no** así:

```sql
-- ❌ NO
select balance_ars from payment_methods where ...;   -- leer
update payment_methods set balance_ars = 195000 ...; -- escribir el resultado
```

Entre la lectura y la escritura puede entrar otro gasto —de la app, o del propio
bot atendiendo otro mensaje— y esa escritura se pierde. **Un saldo que se pisa es
plata que la persona cree tener y no tiene.** Y el bot es el más expuesto,
porque atiende a todas a la vez.

Así sí, en una sola sentencia:

```sql
-- ✅ SÍ — descontar un gasto de $5.000 pagado con Mercado Pago
insert into payment_methods (user_id, name, balance_ars, last_used_at)
values (:uid, 'Mercado Pago', -5000, now())
on conflict (user_id, name) do update
  set balance_ars  = payment_methods.balance_ars + excluded.balance_ars,
      last_used_at = now();
```

Con el `delta` en negativo para descontar y en positivo para devolver (si alguna
vez el bot borra un gasto). Si el medio no existía, lo crea con saldo negativo,
que es la verdad: se gastó con algo que nunca se cargó.

> La app usa una función, `mover_saldo(medio, delta)`, que hace exactamente esto.
> El bot no la puede usar porque esa función identifica a la usuaria por su
> sesión, y el bot no tiene sesión — por eso va el `insert ... on conflict` con
> el `user_id` explícito.

---

## 6. La racha: el bot también suma

La app tiene ahora una **racha**: cada día toca un paso distinto, y cumplirlo
suma un día. **Un día en que la persona le cuenta un gasto al bot también
suma**, aunque no abra la app — así la racha no castiga a quien usa WhatsApp.

Para que eso funcione, lo único que tiene que hacer el bot es lo del punto 3:
**escribir `source = 'whatsapp'`** en cada gasto. La racha cuenta los días con al
menos un gasto con ese `source`. Si el bot escribe otro valor, esos días no
cuentan y la persona pierde la racha sin entender por qué.

Cuenta el día en que se **registró** el gasto (`created_at`), no el día en que se
gastó (`occurred_at`): quien hoy le dice al bot "ayer gasté 5.000" apareció hoy.

Y el día es el de **Argentina**, no el de UTC: un gasto contado a las 23 hs
cuenta para ese día, aunque en UTC ya sea el siguiente.

### Si el bot quiere decir la racha

```sql
select racha_de('<user_id>');
```

Devuelve algo así:

```json
{ "dias": 5, "hoyCumplido": true, "comodinDisponible": true, "detalle": [ ... ] }
```

Sirve para contestar cosas como *"¡Anotado! Ya van 5 días seguidos."* Sólo la
puede llamar `service_role`.

Una aclaración para no romper el tono: **la racha no se reta.** Si la persona la
perdió, el bot no dice "perdiste tu racha". Hay un comodín por semana que salva
un día solo, así que perderla es raro — y si pasa, se arranca de nuevo sin culpa.

---

## Tono: tres cosas que no se pueden romper

Escribiendo respuestas automáticas se rompen fácil, y son la identidad de FINA:

1. **Un gasto no es un error.** No se reta, no se moraliza, no se dice "te
   pasaste" ni "superaste tu presupuesto".
2. **Toda mala noticia va dato → contexto → salida.** Nunca el dato solo.
3. **Todo número lleva referencia.** "$42.000" no dice nada; "$42.000, casi lo
   mismo que el mes pasado" sí.

Y un dato estimado se muestra como **rango**, nunca como número exacto: "entre
$30.000 y $45.000", no "~$37.500".

---

## Para probar que quedó bien

1. Registrarse en la app con un número, verificarlo desde Perfil, y ver que el
   bot contesta "listo".
2. Cargar un gasto por WhatsApp y verlo aparecer en la app al recargar — con su
   sección, su tipo y su método de pago.
3. Cargar uno en la app y que el bot lo pueda leer.
4. Cargar plata disponible en la app, gastar por WhatsApp, y ver que el
   disponible bajó en la app.
5. Mandar un código vencido y ver que el bot lo explica en vez de fallar.

---

## Resumen

| # | Cambio | Si falta |
| --- | --- | --- |
| 1 | Normalizar el teléfono (sacarle el 9) | el bot no reconoce a nadie |
| 2 | Atender el mensaje `FINA-VERIF-XXXXXX` | nadie puede verificar su teléfono |
| 3 | `source`, `section_id`, `expense_type`, `payment_method` (+ las 3 de USD) | los gastos aparecen sin clasificar |
| 4 | Usar las secciones propias de cada persona (slug igual que la app) y los medios que ya usa | secciones duplicadas con otro nombre, gastos repartidos entre las dos |
| 5 | Mover el saldo con `on conflict … + delta` | el disponible queda mal, con plata que no existe |
| 6 | Escribir `source = 'whatsapp'` (ya está en el 3) | los días que la persona usa el bot no suman a su racha |
