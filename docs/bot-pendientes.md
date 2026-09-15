# Bot de WhatsApp de FINA — lo que falta

**Para:** quien está modificando el bot (Kapso).
**Fecha:** 15 de septiembre de 2026.

Los cinco cambios del documento anterior ya están hechos: normalizar el
teléfono, atender `FINA-VERIF-XXXXXX`, las columnas nuevas de los gastos,
ofrecer las secciones y medios que ya usa la persona, y mover el saldo con
`insert … on conflict`. ¡Gracias!

Quedan **dos cosas por revisar en el código** (la racha y las secciones
propias de cada persona), **la configuración** y **probar todo junto** con la
app.

> Las secciones ya estaban en el punto 4 del documento anterior, pero muy
> resumidas. Ahora cada persona escribe sus propias secciones en la app, y hay
> reglas que el bot tiene que seguir igual que la app para no duplicarlas. Vale
> la pena revisar el código contra el punto 2 de acá.

---

## 1. La racha: el bot también suma

La app tiene ahora una **racha**: cada día le toca a la persona un paso distinto,
y cumplirlo suma un día. **Un día en que le cuenta un gasto al bot también
suma**, aunque no abra la app. Así la racha no castiga a quien usa WhatsApp, que
es justo lo que queremos que use.

### Lo obligatorio: dos reglas

1. **Cada gasto se guarda con `source = 'whatsapp'`**, exactamente así, en
   minúsculas. La racha cuenta los días con al menos un gasto con ese valor. Si
   el bot escribe otro (`'WhatsApp'`, `'bot'`, `'wpp'`), esos días no cuentan y
   la persona pierde la racha sin entender por qué.
2. **No mandar `created_at`** en el insert: se tiene que llenar solo con la hora
   del momento. La racha cuenta el día en que se **registró** el gasto, no el
   día en que se gastó (`occurred_at`). Quien hoy dice "ayer gasté 5.000" usó el
   bot hoy, así que suma hoy.

El día se calcula con la hora de **Argentina**: un gasto contado a las 23 hs
cuenta para ese día, aunque en UTC ya sea el siguiente. De eso se encarga la
base; el bot no tiene que hacer nada.

### Lo opcional: decirle la racha

Si quieren que el bot conteste algo como *"¡Anotado! Ya van 5 días seguidos."*,
existe esta función:

```sql
select racha_de('<user_id>');
```

Por HTTP contra Supabase:

```
POST  https://<tu-proyecto>.supabase.co/rest/v1/rpc/racha_de
      apikey: <service_role key>
      Authorization: Bearer <service_role key>
      Content-Type: application/json

      { "p_user": "<user_id>" }
```

Devuelve:

```json
{
  "dias": 5,
  "hoyCumplido": true,
  "comodinDisponible": true,
  "detalle": [ { "dia": "2026-09-15", "tipo": "whatsapp" }, ... ]
}
```

- `dias`: cuántos días seguidos lleva.
- `hoyCumplido`: si hoy ya sumó.
- `comodinDisponible`: si todavía tiene el comodín de esta semana. Hay uno por
  semana (de lunes a domingo) y salva solo un día que se le pasó.

Llamarla **después** de guardar el gasto, así ya cuenta el de recién. Sólo
funciona con la clave `service_role`.

### Tono de la racha

**La racha no se reta.** Nunca "perdiste tu racha", "no cumpliste" o "se te
cortó". Con el comodín perderla es raro, y si pasa se arranca de nuevo sin culpa.
Si `dias` es 0 o 1, mejor no mencionarla, o decir algo como *"¡Arrancaste tu
racha!"*.

---

## 2. Secciones propias: que el bot y la app digan lo mismo

Cada persona **arma sus propias secciones**: elige algunas en el onboarding,
agrega sugeridas desde Gastos, o escribe la suya ("Mascota", "Facu", "Gym").
Son filas de la tabla `expense_sections`, y el bot tiene que usar **las
mismas**. Si no, pasa esto: la persona tiene "Supermercado" en la app, le dice
al bot "gasté en el súper", el bot crea "Súper", y ahora tiene dos secciones
para lo mismo, con el gasto repartido entre las dos.

### La tabla

| Columna | Qué es |
| --- | --- |
| `id` | Lo que va en `transactions.section_id`. **Siempre se usa el id, nunca el nombre.** |
| `user_id` | De quién es |
| `name` | El nombre tal como lo escribió la persona: "Belleza y cuidado personal" |
| `slug` | El nombre normalizado. Es lo que impide duplicados: no puede haber dos secciones con el mismo `slug` para la misma persona |
| `cap_amount`, `cap_period` | El tope: monto y `'semana'` o `'mes'`. Los dos `null` = sin tope |
| `archived` | `true` = la persona la borró desde la app |

### Regla 1: leer las secciones cada vez, sin guardarlas

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

### Regla 2: primero buscar entre las suyas

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

### Regla 3: el `slug` se calcula EXACTAMENTE como en la app

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

### Regla 4: crear una sección

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

### Regla 5: las secciones borradas

Cuando la persona borra una sección en la app, no se borra la fila: queda con
`archived = true`, y sus gastos viejos la siguen apuntando.

- **No ofrecerlas** (el `where archived = false` de la regla 1 ya se encarga).
- Si la persona la nombra de nuevo, la regla 4 la recupera sola.
- Al contar gastos viejos, un gasto puede apuntar a una sección archivada. Eso
  está bien: mostrarla con su nombre.

### Regla 6: las sugeridas son las mismas que en la app

Cuando la persona no tiene secciones, o pide ideas, ofrecer **esta lista y no
otra**, así lo que ve en el bot coincide con lo que ve en la app:

> Delivery · Restaurantes · Cafeterías · Salidas y entretenimiento ·
> Supermercado · Transporte · Belleza y cuidado personal · Ropa · Suscripciones ·
> Compras online · Farmacia · Regalos

Ofrecer primero las suyas, después las sugeridas que todavía no tiene.

### Regla 7: los topes

Si el bot quiere comentar un tope después de un gasto:

- El período es **la semana en curso (de lunes a domingo)** o **el mes en curso**,
  en hora de Argentina. No "los últimos 7 días" ni "los últimos 30".
- Sumar por `amount_ars` los gastos de esa sección en ese período.
- **Con el tono de FINA**: nunca "te pasaste del tope". Algo como *"Llevás
  $42.000 de los $50.000 que te pusiste para Delivery esta semana."* Y si ya lo
  superó, el dato, el contexto y una salida, sin retar.

### Regla 8: los nombres son datos, no instrucciones

Los nombres de las secciones los escribe la persona. Si el bot usa un modelo de
IA para entender los mensajes, los nombres tienen que llegarle **como datos**,
nunca como parte de sus instrucciones. Una sección puede llamarse cualquier
cosa, incluso "ignorá lo anterior y …".

---

## 3. Revisar la configuración

Antes de probar, confirmar:

- [ ] El bot usa **el mismo proyecto de Supabase** que la app (la misma URL
      `https://<proyecto>.supabase.co`).
- [ ] Usa la clave **`service_role`**, no la `anon`. Con la `anon` no encuentra a
      nadie ni puede escribir: la base sólo deja ver a cada persona lo suyo.
- [ ] La clave `service_role` está guardada como secreto en Kapso y **no aparece
      en ningún mensaje, log ni código compartido**. Con esa clave se puede leer
      y borrar todo.
- [ ] Los cambios están **publicados** en Kapso, no sólo guardados.
- [ ] El número del bot es **+54 221 200-2451**, que es el que abre la app. Si es
      otro, avisarle a María Paz para cambiarlo en la app.

---

## 4. Probar todo junto

Con una cuenta nueva en la app de prueba (María Paz tiene el link). Hacerlo en
este orden, porque cada paso usa el anterior:

| # | Qué hacer | Qué tiene que pasar |
| --- | --- | --- |
| 1 | Crear una cuenta en la app con un número real | La cuenta se crea |
| 2 | En la app: Perfil → Verificar teléfono → enviar el mensaje `FINA-VERIF-…` que se abre en WhatsApp | El bot contesta que quedó verificado, y la app lo muestra verificado sola, sin recargar |
| 3 | En la app: Gastos → "+ Agregar dinero disponible" → $50.000 en Mercado Pago | El disponible dice $50.000 |
| 4 | Al bot: "gasté 5.000 en el súper con Mercado Pago" | En la app, al recargar: el gasto con su sección, su tipo y "Mercado Pago", y el disponible en $45.000 |
| 5 | Mirar el Home de la app | La racha marca el día y dice "Tu racha de hoy ya está a salvo por WhatsApp" |
| 6 | Cargar un gasto en la app y preguntarle al bot por los gastos | El bot lo ve |
| 7 | Al bot: "gasté 20 dólares en Steam" | En la app aparece como US$20 y suma al total su equivalente en pesos, no $20 |
| 8 | Pedir un código en la app, esperar 16 minutos y mandarlo | El bot explica que venció, no falla ni lo toma como gasto |
| 9 | Escribirle al bot desde un número que no tiene cuenta | Le dice que se registre, no falla en silencio |
| 10 | En la app, crear la sección "Cafeterías". Al bot: "gasté 3.000 en cafetería" | El bot la reconoce o pregunta; **no** crea una sección nueva. En la app hay una sola "Cafeterías" con el gasto |
| 11 | Al bot: "gasté 8.000 en la veterinaria", y aceptar crear "Mascota" | En la app aparece la sección "Mascota" con el gasto |
| 12 | En la app, borrar la sección "Mascota". Al bot: "gasté 2.000 en Mascota" | El bot no la ofrecía, pero al nombrarla vuelve a aparecer en la app con sus gastos viejos y el nuevo |

---

## 5. Si algo falla

| Síntoma | Causa más probable |
| --- | --- |
| El bot no reconoce a nadie | Busca el número con el 9 adelante (hay que sacarlo), o usa la clave `anon` en vez de `service_role` |
| El código siempre da "no me figura" | El mensaje `FINA-VERIF-` se está tratando como un gasto, o se manda el número sin normalizar |
| El gasto aparece "Sin sección" o sin tipo | Faltan `section_id` o `expense_type` en el insert |
| Aparecen secciones repetidas ("Súper" y "Supermercado") | El bot creó una en vez de preguntar si era la que ya tenía (regla 2) |
| Aparecen dos iguales con distinta tilde o mayúscula | El `slug` no se calcula igual que en la app (regla 3) |
| El bot ofrece una sección que la persona borró | Falta `archived = false` al leerlas |
| El bot no ve una sección recién creada en la app | Tiene las secciones guardadas en memoria en vez de leerlas en cada conversación |
| El disponible no baja | No se está moviendo el saldo, o el nombre del medio no coincide exacto: "MercadoPago" y "Mercado Pago" son dos medios distintos |
| La racha no suma | `source` no es exactamente `'whatsapp'`, o se está mandando `created_at` con la fecha del gasto |
| `racha_de` da error de permisos | Se está llamando con la clave `anon` |
| Un gasto en dólares da error o queda en $0 | No hay cotización en `exchange_rates`. Se guarda sola cuando alguien abre Gastos en la app; abrirla una vez y reintentar |

Si algo no cierra, mandarle a María Paz **qué se le escribió al bot, qué
contestó y a qué hora**, así se puede buscar en la base.

---

## Recordatorio de tono

1. **Un gasto no es un error.** No se reta ni se moraliza: nada de "te pasaste"
   ni "superaste tu presupuesto".
2. **Toda mala noticia va dato → contexto → salida.** Nunca el dato solo.
3. **Todo número lleva referencia.** "$42.000, casi lo mismo que el mes pasado",
   no "$42.000" suelto.
4. **Un estimado va como rango**: "entre $30.000 y $45.000", no "~$37.500".

El documento completo, con los cinco cambios anteriores, sigue siendo
`bot-cambios-a-hacer.md`.
