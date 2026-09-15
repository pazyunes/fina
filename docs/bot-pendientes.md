# Bot de WhatsApp de FINA — lo que falta

**Para:** quien está modificando el bot (Kapso).
**Fecha:** 15 de septiembre de 2026.

Los cinco cambios del documento anterior ya están hechos: normalizar el
teléfono, atender `FINA-VERIF-XXXXXX`, las columnas nuevas de los gastos,
ofrecer las secciones y medios que ya usa la persona, y mover el saldo con
`insert … on conflict`. ¡Gracias!

Queda **un cambio chico** (la racha), **revisar la configuración** y **probar
todo junto** con la app.

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

## 2. Revisar la configuración

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

## 3. Probar todo junto

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

---

## 4. Si algo falla

| Síntoma | Causa más probable |
| --- | --- |
| El bot no reconoce a nadie | Busca el número con el 9 adelante (hay que sacarlo), o usa la clave `anon` en vez de `service_role` |
| El código siempre da "no me figura" | El mensaje `FINA-VERIF-` se está tratando como un gasto, o se manda el número sin normalizar |
| El gasto aparece "Sin sección" o sin tipo | Faltan `section_id` o `expense_type` en el insert |
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
