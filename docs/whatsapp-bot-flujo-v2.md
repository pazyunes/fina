# Adaptar el bot de WhatsApp al flujo v2

**Fecha:** 2026-09-10
**Estado del flujo v2:** rediseñado y funcionando, **sin backend**.
**Para quién:** quien tenga que tocar el bot, y quien tenga que escribir las
migraciones que hoy no existen.

---

## Lo primero, porque cambia todo lo demás

**El flujo v2 no guarda nada en Supabase.** Todo vive en el `localStorage` del
navegador de cada persona. Verificado: los archivos de
`src/app/components/onboarding-v2/` tienen **cero** referencias a `supabase`, a
`api/` y a `lib/auth` — 38 usos de `localStorage` y nada más.

Consecuencias directas:

- **No hay migraciones nuevas que correr.** `main` y `dev` tienen exactamente
  las mismas 19 migraciones. El rediseño no agregó ni una tabla ni una columna.
- **El bot todavía no puede leer ni escribir nada del flujo v2.** No hay dónde.
  Un gasto registrado en la app v2 vive en el celular de esa persona y el bot no
  lo ve; un gasto que el bot registre no aparece en la app v2.
- **La app real sigue intacta.** El onboarding viejo (`/personal-data`,
  `/activity`, …) sigue escribiendo en `reports.user_data` y en las tablas
  normalizadas, como siempre. El bot que existe hoy sigue funcionando contra eso.

O sea: **el trabajo de backend del flujo v2 está entero por hacer.** Este
documento existe para que ese trabajo y el del bot se diseñen juntos, en vez de
descubrir el desfasaje después.

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

## 2. Lo que el flujo v2 tiene y el esquema actual no

Esto es la lista de migraciones que **habría que escribir** cuando el v2 pase a
ser la app real. Hoy no existe ninguna.

| Concepto del v2 | ¿Está en el esquema? | Qué falta |
| --- | --- | --- |
| Gasto individual con fecha | **No.** Hoy hay `transactions`, pero el onboarding viejo guarda *estimaciones* en `variable_expense_estimates`, no gastos sueltos | revisar si `transactions` alcanza; le falta `metodo_pago` y el `tipo` del v2 |
| Secciones de gasto propias | **No.** Las categorías del esquema son fijas | tabla `expense_sections` por usuario |
| Tope por sección | **No** | `monto` + `periodo` (`semana`/`mes`) por sección |
| Método de pago | **No** | en el gasto, y una lista de medios por usuario |
| Dinero disponible | **No** | y el método con el que entró |
| Objetivos con contribuciones | **Parcial.** Existe `goals` | contribuciones con fecha, tipo (`pagué`/`separé`) y moneda |
| Aportes de inversión | **No** | y con la cotización congelada (§3.3) |
| Perfil de riesgo | **No** | `porQue`, `reaccion`, `yaInvierte` |
| Nivel financiero | **No** | 4 valores |
| Reserva / alcancía | **Parcial.** Hay `reserva_estado()` | revisar si sirve |
| Grupos | **No** | es una demo entera, sin backend |
| Género `otro` con texto libre | **No.** El check de `user_profiles.gender` solo admite `femenino/masculino/prefiero_no_decir` | ampliar el check |
| Edad por rango | **No.** `user_profiles.age` es un `int` | el v2 pregunta rangos, no edad exacta |
| Zona, convivencia, cómo conoció | **No** | |

> **Ojo con `user_profiles`.** Dos campos del v2 no entran en el esquema actual
> tal como está: el género `otro` (el `check` lo rechaza) y la edad, que en v2
> es un rango y en la tabla es un entero. Si se conecta sin migrar, esos dos
> insert fallan.

---

## 3. Lo que el bot tiene que saber

### 3.1 La identidad sigue siendo el teléfono

El bot identifica a la persona por su número. Eso no cambia:
`user_profiles.phone` existe, con `check` de formato E.164
(`^\+[1-9][0-9]{1,14}$`) y `phone_verified_at`.

**Lo que cambia es que el onboarding v2 todavía no lo guarda.** Hoy pide el
teléfono y lo tira. Cuando se conecte, el bot no puede asumir que toda persona
que usó la app v2 tenga teléfono cargado: hay que manejar el caso "número
desconocido" con un alta, no con un error.

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

## 4. Orden sugerido para conectar todo

1. **Definir el esquema del v2** con la tabla de §2 en la mano. Es el paso que
   desbloquea todo lo demás.
2. **Escribir las migraciones**, con su policy de RLS. Recordar: *cada tabla con
   RLS necesita su policy de `UPDATE` o los updates fallan en silencio.*
3. **Reemplazar `localStorage` por la capa `api/`** en el sandbox v2. Hoy no
   pasa por ahí, y la regla 6 de `CLAUDE.md` dice que ningún componente hace
   `fetch` directo.
4. **Conectar el login de verdad** y guardar el teléfono.
5. **Recién ahí, adaptar el bot**, que va a poder leer y escribir lo mismo que la
   app.

Hacerlo al revés — tocar el bot antes de que exista el esquema — es escribir
contra una forma que todavía no está decidida.

---

## 5. Cosas sueltas que conviene saber

- **La app está cerrada al público.** Ver `src/app/mantenimiento.ts`: con
  `APP_CERRADA = true` toda ruta muestra "Volvemos pronto". Para entrar,
  `/?ver=fina`. **No es seguridad**, es un cartel: lo que protege los datos son
  las policies de RLS.
- **El repo no tenía typecheck y ahora sí.** `npm run typecheck` tiene que pasar
  antes de cualquier PR. `npm run build` **no** valida tipos: usa esbuild, que
  borra las anotaciones sin chequearlas.
- **Los grupos son una demo.** Viven en el `localStorage` de un solo navegador.
  No hay forma de que dos personas compartan un grupo. Mostrarlo como algo que
  ya funciona sería mentir.
- **El JSON de `localStorage` se castea sin validar.** Un registro viejo o mal
  formado renderiza `undefined` en pantalla. Cuando esto pase a Supabase,
  validar en el borde.
