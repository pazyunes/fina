# Migraciones del flujo v2: qué correr y en qué orden

Las migraciones se corren a mano en el SQL editor de Supabase; no hay CLI ni nada que las
corra solo al desplegar. Las de la v2 van de la 0020 a la 0041.

**Estado:** de la 0020 a la 0038 están corridas en la base real. La 0020 a la 0025 se
probaron de punta a punta el 10 de septiembre de 2026 (alta de cuenta, teléfono, perfil,
secciones, gastos en pesos y en dólares, objetivos con contribuciones, perfil inversor,
aportes, grupo con código, foto a Storage y saldo por medio de pago); las siguientes se
fueron corriendo a medida que entraba cada función. **La 0039, la 0040 y la 0041 están pendientes de
correr a mano** (ver las notas de cada una en la tabla). La app funciona con o sin ellas.

Lo de abajo queda como referencia de qué hace cada una y qué verificar si alguna vez hay que
rehacer la base. Para borrar todos los usuarios y empezar de cero está
`supabase/borrar-todos-los-usuarios.sql`, con los pasos y la verificación adentro.

---

## Las migraciones: qué son y en qué orden

Veintidós archivos, de la 0020 a la 0041. **Correlos en orden**, uno por uno, leyendo el
resultado antes de pasar al siguiente.

| Orden | Archivo | Qué agrega |
| --- | --- | --- |
| 1 | `0020_v2_secciones_gastos.sql` | Secciones propias con tope, medios de pago con saldo, y las columnas que le faltaban a `transactions` (tipo de gasto, método, sección) |
| 2 | `0021_v2_objetivos_inversiones.sql` | Contribuciones a objetivos, perfil de riesgo, aportes de inversión. Relaja `goals` para admitir objetivos sin monto y en dólares |
| 3 | `0022_v2_grupos.sql` | **La delicada.** Grupos, membresías, competencias y gastos en conjunto con repartos, y el modelo de acceso nuevo |
| 4 | `0023_v2_perfil.sql` | Lo que el onboarding v2 pregunta y no entraba: género "otro", edad por rango, zona, nivel financiero, reserva |
| 5 | `0024_v2_huecos.sql` | Los huecos que aparecieron al cablear la app de verdad (ver abajo) |
| 6 | `0025_mover_saldo.sql` | `mover_saldo(medio, delta)`: mueve el saldo de un medio de pago de forma atómica. Apareció probando el alta real, el gasto descontaba en la pantalla y no en la base |
| 7 | `0026_verificar_telefono_whatsapp.sql` | Verificar el teléfono mandándole un código al bot de WhatsApp, en vez de por SMS |
| 8 | `0027_limites_verificacion.sql` | Corrige dónde va el freno de la verificación: el tope de la 0026 trababa a la persona honesta y no al ataque |
| 9 | `0028_paso_del_dia_y_racha.sql` | Un paso distinto por día, y la racha que se arma cumpliéndolo, con un comodín por semana, y contando los días que se registra por WhatsApp |
| 10 | `0029_recomendaciones.sql` | La IA de FINA: recomendaciones del día, la semana y el mes, el paso del día elegido para cada persona y un plan por objetivo. Dónde se guardan (cada cosa se genera una sola vez, así se paga una vez) y la memoria con la que el modelo va conociendo a cada persona. Se puede volver a correr sin problema. Necesita `ANTHROPIC_API_KEY` en Vercel |
| 11 | `0030_notificaciones.sql` | Notificaciones de la app: en qué dispositivos las activó cada persona, qué avisos quiere (paso del día, racha) y cuáles se mandaron, para no repetir. Necesita las claves VAPID, `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` en Vercel |
| 12 | `0031_avisos_separar_y_resumen.sql` | Dos avisos nuevos: "día de separar" (el día que la persona cobra) y el resumen de la semana (los lunes). Guarda qué día cobra cada una |
| 13 | `0032_recomendaciones_hechas.sql` | Las recomendaciones de "Para vos" se pueden tachar: guarda cuáles marcó cada persona en cada día, semana y mes, para mostrarle otra y para que la IA aprenda de lo que hace |
| 14 | `0033_ingresos.sql` | Ingresos: la plata que entra se guarda en `transactions` como `income`, desde la app y desde el bot, y agrega de dónde vino (sueldo, freelance, venta, regalo, reintegro, otro) |
| 15 | `0034_gastos_fijos.sql` | Gastos fijos (alquiler, gimnasio, suscripciones) con frecuencia y próximo pago, y el aviso de vencimiento. No se registran solos: se confirman con "Ya lo pagué" |
| 16 | `0035_pagos_mixtos.sql` | Pagar un gasto con más de un medio: `transactions.payment_methods` (jsonb) con el detalle de cada parte. Un gasto con un solo medio sigue usando `payment_method` |
| 17 | `0036_otro_escribible.sql` | "Otro" se puede escribir: `expense_type_other` e `income_source_other` guardan lo que la persona escribió, sin abrir los checks de `expense_type` e `income_source` |
| 18 | `0037_cargas_de_saldo.sql` | Tabla `balance_loads`: cada carga de "Ya la tenía" con su fecha y su medio, para que el dinero disponible sea de cada mes. El saldo sigue moviéndose con `mover_saldo`; el bot también tiene que insertar acá (ver `docs/bot-ingresos.md`) |
| 19 | `0038_unir_medios.sql` | `unir_medios(origen, destino)`: une dos medios de pago en uno (o renombra uno) en una sola transacción, moviendo saldo, gastos, ingresos, pagos divididos, gastos fijos y cargas |
| 20 | `0039_seguridad.sql` | Seguridad (DEBT S1 a S5): saca el insert anónimo de `exchange_rates` (la cotización la escribe `api/dolar.ts` con `SUPABASE_SERVICE_ROLE_KEY`); en `group_members` nadie se cambia rol ni actividad desde el cliente y la actividad sube con `sumar_actividad`; los repartos de un gasto de grupo sólo para miembros; tope de 10 códigos equivocados por hora en `unirse_a_grupo`; policy de UPDATE en `feedback` y de DELETE de dueña en varias tablas. Antes de correrla, cargar `SUPABASE_SERVICE_ROLE_KEY` en Vercel; si no, el dólar se sigue mostrando pero no se guarda |
| 21 | `0040_movimientos_atomicos.sql` | DEBT D3: registrar, editar y borrar un gasto o un ingreso, cada uno en una sola transacción de la base (la fila y los saldos de los medios juntos). La app las usa si existen y, si no, sigue con las varias llamadas de antes |
| 22 | `0041_reserva.sql` | Asegura la columna `reserve_ars` de `user_profiles` (la reserva, que vuelve en Objetivos) y suma el tipo `plazo` a `notification_log`, para el aviso de plazo de un objetivo. Sin ella el aviso de plazo no sale; nada se rompe |

<!-- Migraciones nuevas: agregar la fila al final de la tabla de arriba, con el número de orden siguiente. -->

### Qué trae la 0024 y por qué

La escribí después, cuando conecté la app: son las cosas que no se veían
leyendo el esquema y sí al hacer que las pantallas escribieran.

1. **`transactions.original_amount` vuelve.** La 0009 la había borrado con un
   argumento correcto para entonces: era un espejo que nadie leía, porque el
   monto en dólares vivía en `reports.user_data` (jsonb). El flujo v2 no usa
   ese jsonb, lee las tablas directo. Si cargás "20 USD", el número que
   tipeaste tiene que poder recuperarse tal cual, no reconstruirse dividiendo
   por una cotización que ya cambió.
2. **Objetivos: `description`, `amount_mode` y `amount_min_ars`.** El objetivo
   tiene un "por qué", y el monto puede ser exacto, un rango, o "todavía no
   sé". Un objetivo sin monto guarda `null`, no `0`: $0 sería un objetivo
   gratis.
3. **Los checks de moneda se amplían a ocho monedas.** Esto era un bug que iba
   a explotar en producción: el selector de Objetivos ofrece peso, dólar, euro,
   real, peso chileno, uruguayo, libra y peso mexicano, y la 0021 dejó el check
   en ARS/USD. Cualquier objetivo en euros fallaba en el insert. Además
   `goal_contributions.amount_ars` pasa a nullable: FINA tiene una sola
   cotización (dólar blue), así que un aporte en euros no se puede pasar a
   pesos, `null` ahí significa "no se puede saber", que es distinto de cero.
4. **`user_profiles.onboarding_v2` (jsonb).** Las diez respuestas del
   cuestionario que la app lee siempre juntas y nunca filtra. Van a un jsonb y
   no a diez columnas porque el cuestionario cambia seguido.
5. **`investment_profiles.completed_at`.** Distingue "contestó las dos
   preguntas del onboarding" de "hizo el quiz completo". Sin esto no se sabe si
   al entrar a Inversiones hay que abrir el quiz o el resultado.
6. **La vista `group_member_names`.** Un ranking sin nombres no es un ranking,
   y `user_profiles` es owner-only. La vista expone **exactamente un dato de
   más**: el nombre de pila de quienes comparten grupo con vos. El filtro vive
   dentro de la vista, no en el cliente.
7. **El bucket `avatars`.** Con policies por carpeta: cada persona escribe sólo
   en `<su-id>/`.

### Cómo correrlas

Supabase → SQL Editor → pegar el contenido del archivo → Run. Una por vez.

Están escritas para ser **idempotentes**: `if not exists`, `drop policy if
exists` antes de cada `create policy`. Si una se corre dos veces no rompe nada.

---

## Por qué son seguras de correr

De la 0020 a la 0038 son **aditivas**:

- No hay un solo `drop table` ni `drop column`. Nada de lo que existe se borra ni se
  renombra.
- Las columnas nuevas son **nullable o con default**, así que las filas viejas siguen siendo
  válidas.
- Los checks que se modifican (`gender`, los de `goals`, las monedas) se **amplían**: lo que
  hoy entra sigue entrando, y ahora entra más.
- Los `drop not null` de `goals` **relajan**: un objetivo con monto sigue siendo válido, y
  ahora también uno sin monto.
- La policy nueva en `transactions` **se suma** a la que ya había. Las policies de un mismo
  comando se combinan con OR: cada persona sigue viendo sus gastos y ahora ve también los
  del grupo.

La 0039 es la excepción: **saca permisos** a propósito (el insert anónimo en
`exchange_rates`, cambiarse el rol en `group_members`). Por eso antes de correrla hay que
tener `SUPABASE_SERVICE_ROLE_KEY` cargada en Vercel. La 0040 sólo agrega funciones.

La app vieja (v1) ya no existe en el código; sus tablas (`reports`, `incomes`,
`fixed_expenses`, `variable_expense_estimates`, `user_preferences`) siguen en la base y
estas migraciones no las tocan.

---

## Lo que hay que probar sí o sí después de la 0022

Los grupos son lo único acá que **puede filtrar datos entre usuarias**. Todo lo
demás, si está mal, muestra un número raro; esto muestra la plata de otra
persona.

Se prueba con **dos cuentas reales**, no con una:

```sql
-- Con la sesión de ANA, después de que Sofi cargó gastos personales:
select count(*) from transactions;
-- Tiene que dar SOLO los gastos de Ana + los del grupo.
-- Si aparece un gasto personal de Sofi (group_id null), la policy está mal
-- y hay que parar todo.
```

Cosas concretas a verificar:

1. Ana **no** ve los gastos personales de Sofi.
2. Ana **sí** ve los gastos del grupo que cargó Sofi.
3. Ana **no** puede inventar un reparto sobre un gasto de Sofi.
4. Ana **no** ve grupos de los que no es miembro (ni buscando por nombre).
5. Sofi **no** puede meter a Ana en un grupo sin que Ana entre por el código.
6. Salir del grupo y confirmar que Ana deja de ver lo del grupo.

---

## Después de correrlas: qué probar en la app

En este orden, porque cada paso depende del anterior.

1. **Crear una cuenta.** Entrá al onboarding, contestá todo y creá la cuenta con
   un mail de prueba. Al terminar tenés que caer en Home con tu nombre arriba.
   - Si Supabase te pide confirmar el mail, vas a ver la pantalla "Confirmá tu
     mail". Tus respuestas quedaron guardadas y se suben cuando entrés.
   - Si querés evitar ese paso mientras probás: Supabase → Authentication →
     Providers → Email → apagá **Confirm email**.
2. **Que el nombre y las secciones estén en la base.** En el SQL editor:
   ```sql
   select name, phone, main_goal, terms_accepted_at from user_profiles order by created_at desc limit 1;
   select name, slug from expense_sections order by created_at;
   ```
   El teléfono tiene que estar como `+54` + 10 dígitos, **sin el 9**.
3. **Cargar plata disponible y un gasto.** Después:
   ```sql
   select description, amount_ars, currency, original_amount, expense_type, payment_method, source
   from transactions where type = 'expense' order by occurred_at desc limit 5;
   ```
   `source` tiene que decir `web`. Un gasto en dólares tiene que tener
   `original_amount` con lo que tipeaste y `amount_ars` con el equivalente.
4. **Recargar la página.** Todo tiene que seguir ahí. Esta es la prueba de que
   dejó de vivir en el navegador.
5. **Abrirla en otro dispositivo** (o una ventana privada) e iniciar sesión con
   la misma cuenta. Tiene que aparecer lo mismo. Antes esto no pasaba.
6. **Un objetivo y un aporte de inversión.** Mismo criterio.
7. **Grupos, con dos cuentas de verdad** (ver la sección de arriba sobre la 0022, es la
   única parte que puede filtrar datos entre personas).

Si algo no se guarda, la app **te lo dice**: aparece una banda arriba con
"Algo no se guardó" y el mensaje de Supabase. No hay guardados silenciosos.

---

## La verificación del teléfono, y por qué no es un SMS

La pantalla que pedía un código de 4 dígitos se sacó: aceptaba cualquier número,
o sea que no verificaba nada y encima le hacía creer a la persona que su
teléfono estaba validado.

En vez de un SMS, **el que verifica es el bot** (migración 0026): desde Perfil
la persona pide un código, la app le abre WhatsApp con el código ya escrito, y
al enviarlo el bot confirma que el número es suyo.

Tres razones para esto y no un OTP por SMS:

- Un SMS cuesta plata por mensaje y en Argentina las operadoras filtran, así que
  una parte no llega.
- Abre la puerta al fraude de *SMS pumping*: alguien dispara miles de códigos a
  números premium y la cuenta la pagás vos.
- Y no resuelve el problema de fondo: **el bot no puede escribirle primero a
  nadie.** WhatsApp sólo deja iniciar una conversación con plantilla aprobada y
  pagando. Con el teléfono verificado por SMS, la persona igual nunca le habló
  al bot. Verificando por WhatsApp, la conversación queda abierta.

Del lado del bot hay que agregar un caso: si el mensaje matchea
`FINA-VERIF-([A-Z0-9]{6})`, llamar a `verificar_telefono_por_whatsapp`. Está
todo en `docs/bot-cambios-a-hacer.md`, punto 2.
