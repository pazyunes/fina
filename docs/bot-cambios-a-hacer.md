# Bot de WhatsApp de FINA — qué cambiar

**Para:** quien está modificando el bot (Kapso).
**Fecha:** 10 de septiembre de 2026.

La app de FINA se rehizo y ahora guarda todo en Supabase, en las mismas tablas
que usa el bot. Un gasto cargado en la app lo ve el bot, y uno cargado por el
bot lo ve la app. Antes eso no pasaba.

Este documento es autocontenido: no hace falta leer el código de la app.

Son **cinco cambios**. El primero es el que rompe todo si falta.

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

**Importante:** el número que se verifica es el del **remitente**, no el que la
persona escribió en el formulario de la app. El que se puede probar es el que
mandó el mensaje. La función se encarga de guardarlo.

El código **se usa una sola vez** y vive **15 minutos**. La persona puede pedir
hasta 5 por hora.

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

Cada persona tiene **sus** secciones, que son filas:

```sql
select id, name from expense_sections
 where user_id = :uid and archived = false
 order by created_at;
```

Ofrecerle **primero las suyas** y después sugerencias. Si no, terminan con dos
secciones que significan lo mismo con nombres distintos ("Súper" y
"Supermercado").

Si dice una que no tiene, se puede crear:

```sql
insert into expense_sections (user_id, name, slug)
values (:uid, 'Mascota', 'mascota')
on conflict (user_id, slug) do update set archived = false
returning id;
```

El `slug` es el nombre en minúsculas, sin tildes, con `_` en lugar de espacios.

También se puede dejar `section_id` en `null`: la app muestra los gastos sin
sección, no se rompe.

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
| 4 | Ofrecer las secciones y medios que ya usa | secciones duplicadas con otro nombre |
| 5 | Mover el saldo con `on conflict … + delta` | el disponible queda mal, con plata que no existe |
