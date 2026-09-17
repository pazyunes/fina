# Bot de WhatsApp de FINA — ingresos

**Para:** quien está modificando el bot (Kapso).
**Fecha:** 17 de septiembre de 2026.

La app ahora muestra los ingresos: un gráfico de **lo que entra contra lo que
sale** y la lista de ingresos de cada mes. Para que un ingreso contado por
WhatsApp aparezca ahí, y sume al dinero disponible, el bot tiene que guardarlo
**exactamente igual que la app**.

Antes de empezar, pedile a María Paz que corra la migración
`0033_ingresos.sql`: agrega la columna `income_source` que usa este documento.

---

## 1. Dónde se guarda un ingreso

En **`transactions`**, la misma tabla de los gastos, con **`type = 'income'`**.

> ⚠️ **No usar la tabla `incomes`.** Es de la app vieja: guardaba el ingreso
> fijo que la persona declaraba en un cuestionario, no la plata que le entra.
> Lo que se guarde ahí no aparece en ningún lado de la app nueva.
>
> Si hasta ahora el bot guardaba los ingresos en `incomes`, avisale a María Paz:
> esos ingresos hay que pasarlos a `transactions` para que se vean.

```sql
insert into transactions (
  user_id, occurred_at, type,
  amount_ars, currency, original_amount, exchange_rate_id,
  description, payment_method, income_source,
  source
) values (
  :uid, :cuando, 'income',
  :monto_ars, 'ARS', null, null,
  :descripcion, :medio, :fuente,
  'whatsapp'
);
```

| Columna | Qué va |
| --- | --- |
| `type` | **`'income'`**, siempre |
| `source` | **`'whatsapp'`**, siempre |
| `occurred_at` | Cuándo entró la plata. Si dice "ayer cobré", la fecha de ayer |
| `amount_ars` | El monto en pesos |
| `payment_method` | **En qué medio entró**: "Mercado Pago", "Banco Nación", "Efectivo"… Se ofrecen los que ya usa (ver punto 3). Si no lo dice, `'Efectivo'` |
| `income_source` | **De dónde vino.** Uno de: `sueldo`, `freelance`, `venta`, `regalo`, `reintegro`, `otro`. Si no se sabe, `null` |
| `description` | Opcional, lo que la persona dijo ("aguinaldo", "le vendí la bici a Juli"). Nunca una variable sin completar |
| `section_id`, `expense_type` | **`null`**: son de los gastos |

### De dónde vino: cómo elegir `income_source`

Mismas palabras que la app. Si no está claro, preguntar o dejar `null`, pero no
inventar.

| Si dice algo como… | `income_source` |
| --- | --- |
| "cobré", "me pagaron el sueldo", "aguinaldo" | `sueldo` |
| "me pagaron un trabajo", "una changa", "un cliente me pagó" | `freelance` |
| "vendí…", "me compraron…" | `venta` |
| "me regalaron", "me mandó mi vieja" | `regalo` |
| "me devolvieron", "reintegro", "cashback" | `reintegro` |
| cualquier otra cosa | `otro` |

### Si el ingreso es en dólares

Igual que los gastos, **tres columnas**: `amount_ars` (el equivalente en pesos),
`currency = 'USD'`, `original_amount` (los dólares que dijo) y
`exchange_rate_id` (el id de la última fila de `exchange_rates` con
`currency = 'USD_BLUE'`).

---

## 2. El ingreso suma al dinero disponible

El "dinero disponible" de la app es la suma de `payment_methods.balance_ars`.
Un gasto **resta** del medio con el que se pagó; un ingreso **suma** al medio
donde entró. Con la misma sentencia de siempre, **nunca** con un `update`:

```sql
insert into payment_methods (user_id, name, balance_ars, last_used_at)
values (:uid, :medio, :monto_ars, now())       -- monto POSITIVO
on conflict (user_id, name) do update
  set balance_ars  = payment_methods.balance_ars + excluded.balance_ars,
      last_used_at = now();
```

`:medio` tiene que ser **el mismo texto** que se guardó en
`transactions.payment_method`. "MercadoPago" y "Mercado Pago" son dos medios
distintos.

---

## 3. Ofrecer los medios que ya usa

```sql
select name from payment_methods
 where user_id = :uid
 order by last_used_at desc nulls last;
```

*"¿Dónde te entró? ¿Mercado Pago, Banco Nación u otro?"*

---

## 4. "Plata que ya tenía" NO es un ingreso

En la app, al cargar plata, la persona elige entre **"Me entró"** (un ingreso)
y **"Ya la tenía"** (por ejemplo, cargar lo que tiene en el banco la primera
vez). El bot tiene que hacer la misma diferencia:

| Si dice… | Qué hacer |
| --- | --- |
| "cobré 450.000", "me pagaron 80 lucas" | **Ingreso**: el `insert` en `transactions` (punto 1) **y** sumar al saldo (punto 2) |
| "tengo 200.000 en el banco", "en Mercado Pago tengo 50.000" | **Sólo saldo**: el punto 2, **sin** guardar nada en `transactions` |

Si no queda claro, preguntar: *"¿Te entró ahora o es plata que ya tenías?"*

Si "ya la tenía" se guardara como ingreso, el gráfico mostraría que ese mes le
entró todo lo que tenía ahorrado.

---

## 5. Si la persona quiere borrar un ingreso

Borrar la fila **y** sacarle esa plata al medio (monto **negativo**):

```sql
delete from transactions where id = :id and user_id = :uid and type = 'income';

insert into payment_methods (user_id, name, balance_ars, last_used_at)
values (:uid, :medio, -:monto_ars, now())
on conflict (user_id, name) do update
  set balance_ars  = payment_methods.balance_ars + excluded.balance_ars,
      last_used_at = now();
```

---

## 6. Qué contestar

Corto y sin retar. Si informa totales, **sumar por `amount_ars`**.

- ✅ *"¡Anotado! Te entraron $450.000 en Mercado Pago."*
- ✅ *"Este mes ya te entraron $530.000."*
- ❌ Nada de juzgar si es poco o mucho, ni comparar con lo que gastó en tono de
  reto ("gastaste más de lo que ganás").

---

## 7. Para probar

| # | Qué hacer | Qué tiene que pasar en la app |
| --- | --- | --- |
| 1 | Al bot: "cobré 450.000 en Mercado Pago" | En **Gastos → Lo que entra y lo que sale**: "Entró" sube $450.000, aparece en "Ingresos de este mes" como *Sueldo · Mercado Pago · por WhatsApp*, y el **dinero disponible** sube $450.000 |
| 2 | Al bot: "me regalaron 20 dólares" | Aparece como regalo, en pesos al blue de hoy |
| 3 | Al bot: "en el banco tengo 100.000" | El **dinero disponible** sube $100.000, pero **"Entró" no cambia** |
| 4 | En la app, borrar el ingreso del paso 1 (tachito) | Desaparece de la lista y el disponible baja $450.000 |
| 5 | En la app, "+ Agregar plata" → "Me entró" → $30.000 | El bot, si informa lo que entró en el mes, lo incluye |

## Resumen

| # | Cambio | Si falta |
| --- | --- | --- |
| 1 | Guardar en `transactions` con `type = 'income'` y `source = 'whatsapp'` (no en `incomes`) | El ingreso no aparece en la app |
| 1 | `income_source` con las mismas palabras | Aparece como "Ingreso" sin decir de dónde vino |
| 2 | Sumar al saldo del medio con `on conflict … + monto` | El dinero disponible no refleja lo que entró |
| 4 | Distinguir "me entró" de "ya la tenía" | El gráfico muestra ingresos que no existieron |
