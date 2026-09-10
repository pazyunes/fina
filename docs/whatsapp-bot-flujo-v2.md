# Adaptar el bot de WhatsApp al flujo v2

**Fecha:** 2026-09-10 (actualizado cuando la app quedó cableada)
**Estado del flujo v2:** conectado a Supabase. El onboarding crea la cuenta de
verdad y las siete pantallas leen y escriben en las tablas.
**Para quién:** quien tenga que tocar el bot.

---

## Lo primero, porque cambia todo lo demás

**El flujo v2 ya escribe en Supabase.** Dejó de vivir en el `localStorage` del
navegador: ahora hay usuarias reales en `auth.users`, con su fila en
`user_profiles` y su teléfono cargado.

Lo que eso habilita: **el bot y la app escriben en el MISMO lugar.** Un gasto
que la persona carga por WhatsApp aparece en la app, y uno que carga en la app
lo ve el bot. Eso era imposible antes.

**Las migraciones 0020 a 0025 ya están corridas**, y el flujo se probó de punta
a punta contra la base real: alta de cuenta, teléfono, perfil, secciones,
gastos en pesos y en dólares con la cotización congelada, objetivos con
contribuciones, perfil inversor, aportes, grupo con código, foto a Storage y
saldo por medio de pago. O sea que las tablas de las que habla este documento
existen y tienen datos.

Lo que falta es del lado del bot:

1. **Normalizar el teléfono igual que la app** (§3.1). Es lo más importante de
   este documento: si se hace mal, el bot no reconoce a nadie que se haya
   registrado en el flujo nuevo.
2. **Escribir con las columnas nuevas** (§3.1.b y §3.2): sección, tipo de
   gasto, método de pago, y `source = 'whatsapp'`. Si escribe sin ellas, el
   gasto aparece en la app sin sección y sin clasificar.
3. **Mover el saldo con `mover_saldo`** y no con un `update` (§3.1.b).
4. **Sumar por `amount_ars`** si informa totales, no por el monto que se tipeó
   (§3.1.b).

---

## 1. Qué captura el flujo v2

### 1.1 El onboarding, paso por paso

Quince pantallas, una pregunta por pantalla. Las de opción única avanzan solas.

| # | Pregunta | Dónde queda hoy | Forma |
| --- | --- | --- | --- |
| 1 | (intro, sin pregunta) | — | — |
| 2 | ¿Cómo te llamamos? | `fina_v2_nombre` | `string` |
| 3 | ¿Con qué género te identificás? | `fina_v2_perfil_onboarding` | `femenino / masculino / otro + texto / prefiero_no_decir` |
| 4 | ¿Qué edad tenés? | idem | `18-24 / 25-34 / 35-44 / 45-54 / 55-64 / 65+` |
| 5 | ¿Qué querés lograr con tu plata? | idem → `meta` | `invertir / ahorrar / objetivo / no_claro` |
| 6 | ¿En qué andás? | idem | `trabaja / estudia / ambas / ninguna` |
| 7 | ¿Dónde vivís? | idem → `zona` | `CABA / GBA / Otra provincia / Fuera de Argentina / Prefiero no decir` |
| 8 | ¿De dónde vienen tus ingresos? | idem → `ingresos` | `string[]`, multi + libre |
| 9 | ¿Con qué regularidad? | idem → `estabilidadIngresos` | 4 opciones + libre |
| 10 | ¿Se te hace tedioso el control? | (no se persiste) | `si / no` |
| 11-13 | Rama según la meta | ver abajo | — |
| 14 | (intermedia, sin pregunta) | — | — |
| 15 | ¿Cómo conociste FINA? | idem → `comoConocio` | 5 opciones + libre |
| — | Términos | `fina_v2_terminos_aceptados` | `boolean` |
| — | Mail + contraseña + teléfono | **nada** (es de mentira) | — |

**Ramas según la meta:**

- `invertir` → tres pantallas de perfil de riesgo → `fina_v2_inversiones_perfil`
  `{ porQue, reaccion, yaInvierte }`
- `objetivo` → definir el objetivo → se crea ya cargado en
  `fina_v2_objetivos_state`
- `ahorrar` y `no_claro` → sin pantallas extra

> ⚠️ **El login del onboarding v2 es una maqueta.** Pide mail, contraseña y
> teléfono, valida el formato y acepta cualquier código de verificación de 4 a 6
> dígitos. **No crea ningún usuario y no manda ningún SMS.** Cuando esto se
> conecte de verdad, el teléfono es el dato que le importa al bot (ver §3.1).

### 1.2 Lo que se carga después, usando la app

| Qué | Clave | Forma relevante |
| --- | --- | --- |
| Gastos | `fina_v2_gastos_state` | `{ categorias, gastos, disponible, reserva, topes, metodosPago }` |
| Objetivos | `fina_v2_objetivos_state` | array de objetivos con sus contribuciones |
| Inversiones | `fina_v2_inversiones_state` | perfil + aportes |
| Reserva | `fina_v2_reserva` | `number` |
| Nivel financiero | `fina_v2_nivel_financiero` | 4 opciones |
| Foto de perfil | `fina_v2_foto` | data URL en base64 |
| Grupo | `fina_v2_grupo` | **demo**, no hay backend de grupos |

**Un gasto en v2:**

```ts
{
  id: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  descripcion: string;
  categoriaId: string;      // slug de la sección
  tipo: 'necesario' | 'urgente' | 'impulsivo' | 'otro';
  ts: number;               // epoch ms
  metodoPago?: string;      // "Mercado Pago", "Efectivo", texto libre…
}
```

**Un aporte de inversión en v2** (el más delicado, ver §3.3):

```ts
{
  id: string;
  monto: number;            // lo que la persona tipeó
  moneda?: 'ARS' | 'USD';   // en qué lo cargó
  cotizacion?: number;      // el blue del día, si fue en USD
  montoArs?: number;        // el equivalente CONGELADO a esa cotización
  instrumentoId: string;
  ts: number;
}
```

---

## 2. Las tablas del v2 (ya escritas: migraciones 0020-0024)

Esta sección explica **por qué** el esquema quedó como quedó: qué de lo viejo
se pudo reusar, qué hubo que agregar, y cuál fue el problema difícil (los
grupos). Si sólo querés la lista de lo que hay que correr, saltá a §2.5.

### 2.1 Lo que YA sirve (más de lo que parecía)

`transactions` es una base mejor de lo que se ve a primera vista:

```sql
transactions (
  id, user_id, occurred_at, type ('expense'|'income'),
  amount_ars, currency ('ARS'|'USD'), original_amount, exchange_rate_id,
  category, merchant, description,
  source ('whatsapp'|'web'|'manual'),
  metadata jsonb, created_at
)
```

Tres cosas que ya están resueltas ahí:

- **`source` ya distingue de dónde entró el gasto**: `whatsapp` vs `web`. Es
  exactamente lo que hace falta para que la app y el bot escriban en el mismo
  lugar sin pisarse.
- **`original_amount` + `exchange_rate_id` ya son el patrón de cotización
  congelada.** Es la misma solución que el v2 usa para los aportes en dólares,
  y ya está en el esquema: guarda el monto original, la moneda y a qué
  cotización se convirtió. **No hay que inventarlo, hay que reusarlo.**
- **`occurred_at` separado de `created_at`**: cuándo pasó el gasto vs cuándo se
  cargó. El bot lo necesita para "ayer gasté…".

### 2.2 Lo que hubo que agregar

Esta tabla es el análisis que originó las migraciones: la columna **Estado**
dice cómo estaba el esquema *antes*, y **Solución** lo que quedó. Todo lo de
acá está resuelto en 0020-0024.

| Concepto del v2 | Estado antes | Solución |
| --- | --- | --- |
| Tipo de gasto (`necesario / urgente / impulsivo / otro`) | faltaba | columna en `transactions`, o `metadata`. Como se filtra y se grafica, mejor columna |
| Método de pago | faltaba | columna en `transactions` + lista de medios por usuario |
| Secciones propias | **chocaba** (ver 2.3) | tabla `expense_sections` por usuario |
| Tope por sección | faltaba | `monto` + `periodo` (`semana`/`mes`) |
| Dinero disponible | faltaba | saldo por usuario y por medio de pago |
| Contribuciones a un objetivo | faltaba | `goals` guarda el objetivo, no los aportes → tabla `goal_contributions` con fecha, monto, moneda y `kind` (`paid`/`saved`) |
| `goals` vs el objetivo del v2 | **parcial** | tenía `amount_ars` + `timeframe_months`, los dos `not null`. El v2 necesita horizonte en texto, moneda, y un modo de monto que admita "todavía no sé" → los dos `not null` se relajaron (0021) y se agregaron `amount_mode` + `amount_min_ars` (0024) |
| Aportes de inversión | faltaba | no son `expense` ni `income`: tabla propia, reusando `exchange_rate_id` |
| Perfil de riesgo | faltaba | `investment_profiles`, con `completed_at` para saber si terminó el quiz |
| Nivel financiero | faltaba | `user_profiles.financial_level` |
| Zona, convivencia, cómo conoció | faltaba | columnas en `user_profiles` (0023). El resto de las respuestas del cuestionario, que se leen en bloque, van a `onboarding_v2` jsonb (0024) |
| Género `otro` con texto | **chocaba** | el `check` de `user_profiles.gender` solo admite `femenino/masculino/prefiero_no_decir` |
| Edad | **chocaba** | `user_profiles.age` es `int`; el v2 pregunta rangos |
| **Grupos y gastos en conjunto** | **faltaba todo, y era el más grande** | ver 2.4 |

### 2.3 El choque de las categorías

Las categorías del esquema son un **conjunto cerrado de 13**:
`beauty, cafeterias, delivery, entertainment, gym, health, housing, other,
restaurants, subscriptions, supermarket, therapy, transport`.
Hay un `check` en `variable_expense_estimates.category` y una función
`fina_canon_category(raw)` que mapea texto libre a uno de esos con regex.

**El v2 deja escribir cualquier sección.** Si alguien crea "Mascota",
`fina_canon_category` la manda a `'other'` y se pierde la distinción: en la app
ve "Mascota" y en cualquier análisis del servidor ve "otros". Hay que decidir
una de dos:

1. **Secciones libres por usuario** (tabla propia) y el canon queda solo para
   que el bot adivine a qué sección existente mandar un gasto. Es lo que pide el
   diseño del v2.
2. Mantener el conjunto cerrado y **sacar del v2** la posibilidad de escribir
   secciones. Contradice el flujo que acabamos de construir.

### 2.4 Los grupos no son una tabla más: rompen el modelo de acceso

Esto es lo más importante de todo el documento.

**Todas las policies de RLS de hoy son de dueño único.** Sin excepción:

```sql
using (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

Un grupo necesita exactamente lo contrario: que **Ana pueda leer filas cuyo
`user_id` es de Sofi**. Eso no se arregla con una columna — es un modelo de
acceso distinto. Lo que hace falta:

- `groups` y `group_members` (con rol y estado de invitación).
- Que los gastos en conjunto sepan a qué grupo pertenecen y **cómo se reparten**
  entre miembros: un gasto de $30.000 pagado por Ana y dividido entre tres no es
  un gasto de $30.000 para cada una. Eso es una tabla de repartos
  (`quién debe cuánto de qué gasto`), y con eso aparecen los saldos entre
  personas.
- **Policies nuevas basadas en pertenencia**, del estilo
  `exists (select 1 from group_members gm where gm.group_id = t.group_id and gm.user_id = auth.uid())`.
  Escribirlas mal es una filtración de datos financieros entre usuarias, así que
  esto se prueba con dos cuentas reales antes de salir.
- Decidir qué ve un miembro: ¿solo los gastos del grupo, o también los
  personales de las demás? La respuesta obvia es "solo los del grupo", y el
  esquema tiene que hacerla imposible de violar, no solo improbable.

Y ojo: **los grupos del v2 hoy son una demo**. Viven en el `localStorage` de un
solo navegador, con miembros de ejemplo. No hay invitaciones reales, no hay dos
personas compartiendo nada. Lo que está construido es la idea, no la función.

### 2.5 Entonces, ¿qué migró?

Todo lo de arriba, en seis migraciones (**0020 a 0025**), que ya están
**corridas** en la base de producción:

| Migración | Qué agrega |
| --- | --- |
| 0020 | `expense_sections` (con tope por período), `payment_methods` (con saldo), y las columnas del v2 en `transactions`: `expense_type`, `payment_method`, `section_id` |
| 0021 | `goal_contributions`, `investment_profiles`, `investment_contributions`. Relaja `goals` para objetivos sin monto |
| 0022 | `groups`, `group_members`, `group_expense_splits`, `transactions.group_id`, y el **modelo de acceso nuevo** (`es_miembro_de`, `unirse_a_grupo`) |
| 0023 | Lo que el onboarding pregunta: género "otro", edad por rango, zona, nivel financiero, reserva, `avatar_path` |
| 0024 | `transactions.original_amount` (vuelve), `goals.description`/`amount_mode`/`amount_min_ars`, `user_profiles.onboarding_v2`, `investment_profiles.completed_at`, la vista `group_member_names`, la función `crear_grupo`, el bucket `avatars`, y los checks de moneda ampliados |
| 0025 | `mover_saldo(medio, delta)`: mueve el saldo de un medio de pago de forma atómica. **Es la que tiene que usar el bot** para descontar un gasto (ver §3.1.b) |

El detalle de cada una y qué probar después está en
`supabase/README-migraciones-v2.md`.

Ninguna borra ni renombra nada: los checks que se tocan se **amplían**, las
columnas nuevas son nullables o con default, y la policy nueva en
`transactions` **se suma** a la que ya había (las policies del mismo comando se
combinan con OR). La app vieja tiene que seguir funcionando igual.

## 3. Lo que el bot tiene que saber

### 3.1 La identidad es el teléfono, y hay UNA forma canónica

El onboarding v2 **ya guarda el teléfono**. Lo pide en el último paso, junto con
el mail y la contraseña, y lo escribe en `user_profiles.phone`.

**La forma canónica es `+54` + 10 dígitos, SIN el 9 de celular.**

Está en `src/app/lib/telefono.ts`, que es el único lugar donde la app normaliza
un teléfono (lo usan el login viejo y el onboarding nuevo). La regla completa:

```
1. quedarse sólo con los dígitos
2. si empieza con 0, sacarlo         (formato local: 011…)
3. si empieza con 9, sacarlo         (ningún código de área argentino
                                      empieza con 9, así que un 9 adelante
                                      es siempre el prefijo de celular)
4. tienen que quedar 10 dígitos      (área + abonado)
5. prefijar +54
```

O sea: `11 5555-6666`, `9 11 5555-6666` y `011 5555-6666` son **el mismo
teléfono**, y los tres se guardan como `+541155556666`. Eso es lo que hace
posible el índice único de `user_profiles.phone`.

> **Esto es lo que el bot tiene que hacer y es fácil de errar.** WhatsApp
> entrega los números argentinos **con** el 9: `5491155556666`. Buscar ese
> string tal cual en `user_profiles.phone` **no encuentra a nadie**. Hay que
> sacarle el `54`, sacarle el `9`, y volver a armar `+54` + los 10 dígitos.

**El teléfono no está verificado.** Se pide y se guarda como *declarado*: la
pantalla que pedía un código por SMS se sacó porque aceptaba cualquier número de
4 dígitos, o sea que no verificaba nada. `phone_verified_at` sigue en `null`
para todas. Dos consecuencias para el bot:

- Dos personas podrían haber puesto un número que no es el suyo. El índice único
  evita el duplicado, no la mentira.
- Un número que escribe al bot y **no** está en `user_profiles` es alguien que
  todavía no tiene cuenta, o que la creó con otro número. Hay que tratarlo con
  un alta o con un "no te reconozco, ¿me confirmás el mail con el que te
  registraste?", nunca con un error.

### 3.1.b Qué escribe el bot y con qué `source`

`transactions.source` distingue de dónde salió cada gasto y tiene tres valores:
`whatsapp`, `web` y `manual`. La app escribe **siempre** `web`; el bot tiene que
escribir **siempre** `whatsapp`. La app usa ese campo para poder decir "esto lo
cargaste por WhatsApp".

Un gasto cargado por el bot, con las columnas del v2:

```sql
insert into transactions (
  user_id, occurred_at, type, amount_ars, currency, original_amount,
  exchange_rate_id, description, section_id, expense_type, payment_method, source
) values (
  :uid, :cuando, 'expense', :monto_ars, 'ARS', null,
  null, :descripcion, :section_id, :tipo, :metodo, 'whatsapp'
);
```

- `section_id` sale de `expense_sections` **de esa usuaria** (`where user_id =
  :uid and archived = false`). Si no matchea ninguna, se puede crear una nueva o
  dejar `null` — la app muestra los gastos sin sección, no se rompe.
- `expense_type` acepta `necesario`, `urgente`, `impulsivo`, `otro`. Es un
  juicio de la persona: si no lo dijo, va `otro`. **No inferirlo.**
- `payment_method` es texto libre a propósito. Los que ya usó están en
  `payment_methods` de esa usuaria, ordenados por `last_used_at desc`.
- **Un gasto en dólares llena tres columnas**, no una: `original_amount` con lo
  que la persona dijo (20), `amount_ars` con el equivalente (30.800) y
  `exchange_rate_id` con la cotización que se usó. Es el patrón de §3.3.
- **Todo lo que SUMA en la app usa `amount_ars`**, nunca `original_amount`. Es
  la regla que hace que un gasto de US$20 entre al total del mes como $30.800 y
  no como $20 (era un bug real: el mes se veía $30.780 más barato). Si el bot
  informa totales, tiene que sumar igual.
- **El saldo se mueve con `mover_saldo(medio, delta)`, nunca con un `update`.**
  Ese saldo es el "dinero disponible" que la app muestra arriba, y un gasto lo
  tiene que restar (`delta` negativo). La función está en la migración 0025 y
  existe justamente por el bot: un `select` del saldo, restar en memoria y un
  `update` pierde escrituras si entra otro gasto en el medio, y el bot es el
  más expuesto a eso porque escribe para todas las usuarias a la vez. La
  función suma el delta dentro de una sola sentencia, así dos gastos
  simultáneos se restan los dos.

  ```sql
  -- descontar un gasto de $5.000 pagado con Mercado Pago
  select mover_saldo('Mercado Pago', -5000);
  -- y si el bot alguna vez borra un gasto, devolver la plata:
  select mover_saldo('Mercado Pago', 5000);
  ```

  Ojo: `mover_saldo` usa `auth.uid()`, así que desde el bot (que va con
  `service_role` y sin sesión de usuaria) hay que hacer el mismo
  `insert ... on conflict do update set balance_ars = payment_methods.balance_ars + delta`
  con el `user_id` explícito. Lo que **no** se puede hacer es el read-modify-write.
  También crea el medio si no existía, con saldo negativo — que es la verdad:
  se gastó con algo que nunca se cargó.

El bot escribe con la `service_role` key, que **saltea RLS**. O sea que las
policies no lo protegen de escribir en la fila equivocada: el `user_id` correcto
es responsabilidad del bot.

### 3.2 Registrar un gasto por chat: qué preguntar ahora

El flujo v2 le pide al gasto **cuatro cosas** más el monto. Si el bot registra
gastos con menos, los dos lados van a mostrar datos distintos.

| Dato | ¿El bot lo puede inferir? | Si no |
| --- | --- | --- |
| Monto | sí, del mensaje | preguntar |
| Descripción | sí, del mensaje ("gasté 5000 en el súper") | usar el tipo como texto |
| Sección | se puede sugerir por la descripción, contra las secciones que la persona **ya tiene** | ofrecer las suyas primero, después las sugeridas, y dejar crear una |
| Tipo | **no**. Es un juicio de la persona | preguntar, o dejar `otro` |
| Método de pago | **no** | ofrecer los medios que ya usó, del más reciente al más viejo, más "otro" |

El orden importa: la app ofrece **primero las secciones que ya tenés** y después
las sugeridas. El bot debería hacer lo mismo, para que no aparezcan dos
secciones que significan lo mismo con nombres distintos.

### 3.3 La regla que no se puede romper: la cotización se congela

Cuando se carga un aporte en dólares, se guarda **el monto, la moneda y la
cotización de ese día**, más el equivalente en pesos calculado con esa
cotización. No se guarda solo el monto convertido.

**Por qué:** un aporte de US$100 de hace seis meses no son los pesos que valen
esos dólares hoy, son los que se pusieron entonces. Si se guarda solo el
convertido, el aporte se desfasa solo cada vez que se mueve el dólar. **Este bug
ya lo tuvo esta app** — está documentado en `src/app/Main.tsx`: *"los montos en
USD cargados con el dólar viejo se ven desfasados (bug: me cambió los valores)"*.

Si el bot va a aceptar montos en dólares, tiene que guardar la cotización igual.
La cotización sale de `/api/dolar` (Vercel Function → dolarapi blue → cachea en
`exchange_rates`), y esa tabla ya existe: `incomes.exchange_rate_id` la
referencia. Conviene reusar ese mecanismo, no pedir el dólar por otro lado.

### 3.4 Tono: lo que el bot no puede decir

Está en `docs/tono-del-bot.md` y en `src/styles/frontend.md`, pero estas tres son
las que más fácil se rompen escribiendo respuestas automáticas:

- **Un gasto no es un error.** No se pinta de alerta, no se reta, no se dice
  "te pasaste" ni "superaste tu presupuesto".
- **Toda mala noticia va dato → contexto → salida.** Nunca el dato solo.
- **Todo número lleva referencia.** `$42.000` no dice nada; *"$42.000, casi lo
  mismo que el mes pasado"* sí.
- **Un dato estimado se muestra como rango**, nunca como número exacto: *"entre
  $30.000 y $45.000"*, no *"~$37.500"*.

### 3.5 Un tope es por período

Al comparar contra un tope hay que mirar **el período de ese tope** (semana o
mes en curso), no todo el historial. Era un bug real de la app: un tope de
"$25.000 por mes" se comparaba contra todos los gastos de siempre, así que a los
pocos meses cualquier sección quedaba excedida para siempre. Ya está corregido
en la app; el bot no debería repetirlo.

---

## 4. Orden para conectar el bot

Del lado de la app ya está todo: capa `api/`, reemplazo de `localStorage`,
login real, teléfono guardado, y las migraciones corridas. Lo que queda es del
lado del bot:

1. **Cambiar la resolución de identidad del bot** para que normalice el teléfono
   como en §3.1. Es el cambio que, si falta, hace que el bot no reconozca a
   nadie que se haya registrado en el flujo nuevo.
2. **Agregar las columnas nuevas al insert de gastos** (§3.1.b): `section_id`,
   `expense_type`, `payment_method`, y `source = 'whatsapp'`. Y las tres de un
   gasto en dólares.
3. **Descontar el saldo con la suma atómica** (§3.1.b), nunca con un
   read-modify-write.
4. **Ofrecer las secciones que la persona YA tiene** antes de sugerir otras
   (§3.2), leyendo `expense_sections`.
5. **Ofrecer los medios de pago que ya usó**, de `payment_methods` ordenado por
   `last_used_at desc`.
6. **Probar el ida y vuelta**: cargar un gasto por WhatsApp y verlo aparecer en
   la app al recargar; cargar uno en la app y que el bot lo pueda leer.

---

## 5. Cosas sueltas que conviene saber

- **La app está cerrada al público.** Ver `src/app/mantenimiento.ts`: con
  `APP_CERRADA = true` toda ruta muestra "Volvemos pronto". Para entrar,
  `/?ver=fina`. **No es seguridad**, es un cartel: lo que protege los datos son
  las policies de RLS.
- **El repo no tenía typecheck y ahora sí.** `npm run typecheck` tiene que pasar
  antes de cualquier PR. `npm run build` **no** valida tipos: usa esbuild, que
  borra las anotaciones sin chequearlas.
- **Los grupos son reales.** El grupo es una fila en `groups`, el código lo
  genera la base y es único, y quien lo recibe entra desde su propio teléfono.
  Es el único lugar donde una usuaria ve datos de otra, y está contenido: las
  policies de la 0022 dejan ver sólo a quienes comparten grupo, y de ellas sólo
  el nombre y la actividad. **La actividad es cuánto REGISTRÁS, nunca cuánto
  gastás.** Si el bot alguna vez suma actividad, tiene que respetar eso.
- **Ninguna moneda salvo ARS y USD se puede pasar a pesos.** FINA tiene una sola
  cotización, la del dólar blue. Un objetivo en euros lleva su cuenta en euros y
  `goal_contributions.amount_ars` queda en `null`, que significa "no se puede
  saber" — distinto de cero. Si el bot lee esa columna, tiene que manejar el
  `null`.
- **La app avisa cuando algo no se guardó.** Hay una banda arriba de todas las
  pantallas con el mensaje de Supabase, y se queda hasta que la escritura salga
  bien. No hay guardados silenciosos: la regla es que un guardado que falla en
  silencio es peor que uno que falla, porque la persona sigue confiando en un
  número que no existe. Conviene que el bot tenga el mismo criterio.
