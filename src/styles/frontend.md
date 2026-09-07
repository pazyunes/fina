# FINA — Guía de frontend

> **Leer antes de tocar cualquier cosa del front.** Acá están las decisiones ya tomadas:
> qué puede y qué no puede verse la app (§1–§6), y cómo se escribe el código (§7–§11).
> Si algo que vas a hacer contradice esta guía, ese es el momento de discutirlo — no
> después del PR.
>
> **Jerarquía de fuentes de verdad:** brief de identidad de marca → esta guía → el código.
> Si esta guía y el brief se contradicen, gana el brief y se corrige esta guía.

---

## 1. Qué es FINA (y por qué eso restringe el diseño)

FINA hace **visible** la plata de gente joven que nunca tuvo educación financiera. No la
administra, no la juzga, no la controla. Registrás gastos hablando por WhatsApp y la app
te los devuelve ordenados, con algo para hacer al respecto.

**Posición:** el problema no es de disciplina, es de visibilidad. Nadie decide sobre algo
que no ve.

**Loop del producto:** acompañamiento → visualización → acción.

**Tiene que sentirse:** clara, cercana, honesta, adulta.
**No puede sentirse:** bancaria, decorativa, moralizante, ni como otra fintech violeta.

### Los tres tests que cualquier pantalla nueva tiene que pasar

1. **El círculo de 40px.** ¿El símbolo se reconoce como avatar en la lista de chats de
   WhatsApp? Es la impresión de marca más frecuente de todo el producto.
2. **El dato incierto.** ¿Puede mostrar "todavía no sabemos bien" sin que parezca un error
   ni una app rota? Ver §5.
3. **La vidriera vacía.** ¿La pantalla de alguien del día 1 —sin datos, sin movimientos—
   se ve como una promesa y no como un producto vacío? Ver §10.

---

## 2. Antipatrones: lo que nunca hacemos

### 2.1 Los tells de UI generada por IA

- ❌ **Hero genérico**: contenedor gigante centrado, título flotante, botón con degradado
  morado/azul.
- ❌ **Card grid spam**: seis contenedores blancos idénticos, mismo radio, misma
  `shadow-lg` gris debajo de todo sin importar la jerarquía.
- ❌ **Degradados neón** o washes de color como decoración sin valor semántico.
- ❌ **Iconografía genérica**: íconos de librería dentro de círculos pastel.
- ❌ **Contenido falso**: "Lorem ipsum", "Administrá tus finanzas de forma inteligente",
  montos redondos tipo $1.000,00. Siempre datos realistas y en pesos argentinos.
- ❌ **Chrome de plantilla**: eyebrows en MAYÚSCULAS tracked-out arriba de cada título,
  metadata unida con puntos medios (`A · B · C`), `→` pegado al texto de los botones,
  numeración 01/02/03 en cosas que no son una secuencia.
- ❌ **Motion decorativa**: fade-and-slide-up en cada sección al scrollear, transición en
  hover de cada tarjeta. La animación responde a una acción del usuario o no existe.

> ⚠️ **Riesgo específico nuestro.** "Fondo crema + acento naranja cálido + tipografía
> geométrica" es *exactamente* el cluster estético que produce hoy cualquier IA por
> defecto. El crema lo pide el brief y se queda, así que la distinción tiene que venir de
> otro lado: del trazo fino, del verde lima, de las cifras tabulares y del sistema de
> confianza (§5). Si sacás eso, queda una landing genérica más.

### 2.2 Los tells de la categoría fintech

- ❌ Escudos, candados, solidez, azul institucional, serifas con blasón.
- ❌ Velas japonesas, flechas ascendentes, verde neón sobre negro.
- ❌ Gradiente violeta→lavanda sobre blanco (el uniforme de Nubank y alrededores).
- ❌ Rosa + dorado + mármol + frase motivacional en script ("girl boss finance").

### 2.3 Los tells del coach de austeridad

FINA no moraliza el consumo. Prohibido:

- ❌ Rojo de alerta, semáforos, contadores regresivos, "te pasaste", "superaste tu
  presupuesto".
- ❌ Pintar todos los gastos del color de alerta. **Un gasto no es un error.**
- ❌ Las palabras "deberías", "tenés que", "mal hábito", "gasto hormiga", "vicio".
- ❌ "Felicitaciones" sin un dato atrás.

---

## 3. Sistema visual

### 3.1 Concepto: el trazo fino

*Fina* = línea delgada, precisión sin peso. El desorden de la plata es una maraña; FINA la
convierte en **una línea clara**. La misma línea es tres cosas según dónde aparezca:

| Dónde | Qué es la línea |
| --- | --- |
| Gráficos | la evolución del dato |
| WhatsApp / chat | el hilo de la conversación |
| Objetivos | el camino hacia la meta |

Consecuencia técnica: **iconografía monolineal**, grosor constante, terminaciones
redondeadas, curvas amplias, ningún ángulo agudo. La calidez viene de la geometría, no de
la decoración.

> 📌 **Nota de nombre.** El md anterior decía "trazo Fini" mezclando dos cosas distintas:
> **el trazo fino** es el partido conceptual de la identidad; **Fini** es el personaje
> (§6). No los uses como sinónimos en el código ni en las clases CSS.

### 3.2 Iconografía

- Sprite SVG único, consumido con `<use href="#fi-nombre" />`. Un solo request, un solo
  lugar donde cambiar.
- Grilla de **24×24**, trazo **1.9px**, `stroke-linecap="round"`, `stroke-linejoin="round"`,
  `fill="none"`.
- El trazo hereda el color con `stroke="currentColor"`. Nunca hardcodees el color adentro
  del path.
- A tamaños distintos de 24px se escala el ícono completo (`width`/`height`), no el trazo
  suelto. Por debajo de 20px el 1.9px se ve pesado: usá una variante simplificada, no
  un ícono de 24 achicado.
- Prefijo obligatorio `fi-` en los ids (`fi-objetivo`, `fi-gasto`, `fi-chat`).

### 3.3 Color

**Regla que rompe todo lo anterior si se ignora: los cuatro colores de marca son colores de
relleno, no de texto.** Ninguno tiene contraste suficiente sobre el papel ni soporta texto
blanco encima. Medidos sobre `#FFF4E4`:

| Color | Contraste sobre papel | Sirve para |
| --- | --- | --- |
| `#B0E150` lima | **1.41** | relleno, nunca texto ni ícono fino |
| `#FFC457` star | **1.45** | relleno, nunca texto ni ícono fino |
| `#CB9EFF` lila | **1.96** | relleno, nunca texto ni borde significativo |
| `#FF7B4F` naranja | **2.36** | relleno, nunca texto |
| `#7E5DA8` púrpura | 4.81 ✅ | texto, bordes, foco |

Por eso cada acento tiene **dos tokens**: el de relleno (el hex original) y el `-texto`
(la versión oscura, ≥ 6:1, para cuando ese color tiene que decir algo en tipografía).
Sobre relleno de color, el texto va siempre en `--fina-tinta`, nunca en blanco.

**Roles semánticos:**

| Rol | Token | Uso |
| --- | --- | --- |
| Fondo general | `--fina-papel` | el campo de toda la app |
| Superficie elevada | `--fina-superficie` | tarjetas sobre el papel |
| Bloque hundido | `--fina-hueco` | agrupaciones, listas tintadas |
| Texto principal | `--fina-tinta` | todo el texto y los montos |
| Texto secundario | `--fina-tinta-media` | labels, fechas, unidades |
| Positivo / logro | `--fina-lima` + `--fina-lima-texto` | objetivo que avanza, ahorro, éxito |
| Salida de dinero | `--fina-tinta` (neutral) | **los gastos no se pintan de alerta** |
| Atención real | `--fina-naranja` + `--fina-naranja-texto` | solo cuando hay algo que hacer ya |
| Personaje / destacado | `--fina-star` + `--fina-star-texto` | Fini, medallitas, momentos de marca |
| Estructura | `--fina-lila`, `--fina-purpura` | recuadros, bordes, foco |

> 📌 **Corrección respecto del md anterior.** Ahí `--fina-negative` cubría a la vez
> "salidas de dinero" y "alertas". Eso contradice el atributo *sin juicio*: si cada gasto
> se pinta de naranja, la app está diciendo "esto está mal" cientos de veces por mes. **Un
> gasto es un dato neutral y se muestra en tinta.** El naranja se reserva para cuando hay
> una acción concreta pendiente (un débito automático que se viene, un dato que hay que
> confirmar) — y aun así, el copy nunca reta.

> 📌 **Sobre el púrpura.** El brief marca el violeta como colisión de categoría: el usuario
> argentino no lee "FINA", lee "otra fintech violeta". Se queda, pero **degradado a rol
> estructural**: bordes, recuadros, foco, fondo oscuro. No es el color de marca. El color
> con el que se tiene que recordar la app es el lima en el momento de mayor valor: cuando
> un objetivo avanza.

### 3.4 Tipografía

| Rol | Familia | Detalle |
| --- | --- | --- |
| Títulos y momentos de marca | `Outfit` | pesos 500/600, `letter-spacing: -0.01em` en tamaños grandes |
| Cuerpo y UI | `Figtree` | 400/500/600 |
| Montos y datos | `IBM Plex Mono` | **siempre** con `font-variant-numeric: tabular-nums` |

Reglas duras:

- **Todo número que el usuario pueda comparar va en cifras tabulares.** Columnas de montos,
  totales, progreso. Es la razón principal por la que existe la tercera familia: sin ancho
  fijo de dígito, las columnas de pesos bailan.
- **La tipografía se evalúa primero en la pantalla de números, no en el logo.**
- Sentence case en todo. Nada de labels en MAYÚSCULAS.
- Largo de línea < 70 caracteres en bloques de lectura.

> ⚠️ **Decisión abierta (§12.1).** Outfit es una geométrica redondeada, o sea prima
> hermana de Poppins — que el brief descarta justamente por no aportar distintividad. Y
> Outfit + Figtree son dos sans parecidas, así que el "par con contraste real" que pide el
> brief no está resuelto. Se implementa así porque hay que arrancar, pero está marcado como
> pendiente de revisión con diseño. **Por eso todo va por tokens: cambiarlo tiene que ser
> una línea.**

### 3.5 Forma, espacio y variedad de contenedores

- Escala de espaciado de **4px** (`--space-1` … `--space-10`). Nada de `margin: 13px`.
- Tres radios y no más: `--radius-sm` (6px, chips e inputs), `--radius-md` (14px, tarjetas),
  `--radius-full` (pill, botones y avatares).
- **Un dato central por pantalla.** Jerarquía brutal: el total antes que el desglose.
- **Alterná contenedores.** El antídoto contra el card grid spam es no usar tarjetas para
  todo: listas finas separadas por hairline, bloques tintados en `--fina-hueco`, y tarjeta
  elevada **solo** para lo que de verdad tiene prioridad. Si en una pantalla hay más de
  tres tarjetas elevadas, algo está mal jerarquizado.
- Sombras: existe una sola (`--shadow-card`), suave y cálida. Nada de `shadow-lg` genérica.

---

## 4. Tokens (`styles/tokens.css`)

Fuente de verdad de color, tipografía, espacio y forma. **Ningún componente escribe un hex.**

```css
:root {
  /* ---------- Tipografías ---------- */
  --font-heading: 'Outfit', system-ui, sans-serif;
  --font-body:    'Figtree', system-ui, sans-serif;
  --font-mono:    'IBM Plex Mono', ui-monospace, monospace;

  /* ---------- Superficies ---------- */
  --fina-papel:       #FFF4E4;  /* fondo general */
  --fina-superficie:  #FFFDF7;  /* tarjeta elevada */
  --fina-hueco:       #F6E9D4;  /* bloque tintado / hundido */
  --fina-hairline:    #E8D9C0;  /* separadores */

  /* ---------- Tinta (texto) ---------- */
  --fina-tinta:        #2B2118;  /* 14.5:1 sobre papel — texto y montos */
  --fina-tinta-media:  #5F5346;  /* 6.9:1  — labels, fechas */
  --fina-tinta-suave:  #7A6A58;  /* 4.8:1  — texto auxiliar, mínimo AA */

  /* ---------- Acentos: relleno + texto ---------- */
  --fina-lima:            #B0E150;  /* relleno: éxito, objetivo que avanza */
  --fina-lima-texto:      #41660F;  /* 6.2:1 sobre papel */
  --fina-naranja:         #FF7B4F;  /* relleno: atención accionable */
  --fina-naranja-texto:   #A83208;  /* 6.2:1 sobre papel */
  --fina-star:            #FFC457;  /* relleno: Fini, medallitas, destacados */
  --fina-star-texto:      #7A4F00;  /* 6.6:1 sobre papel */

  /* ---------- Estructura ---------- */
  --fina-lila:         #CB9EFF;  /* relleno de recuadros */
  --fina-lila-borde:   #9A6BD1;  /* 3.6:1 — bordes perceptibles */
  --fina-purpura:      #7E5DA8;  /* 4.8:1 — texto sobre púrpura, foco */
  --fina-noche:        #3D2A55;  /* fondo oscuro; papel encima da 11.6:1 */

  /* ---------- Espacio (escala 4px) ---------- */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

  /* ---------- Forma ---------- */
  --radius-sm: 6px;
  --radius-md: 14px;
  --radius-full: 999px;
  --stroke-icon: 1.9px;
  --shadow-card: 0 2px 8px rgba(74, 59, 42, 0.08);

  /* ---------- Foco ---------- */
  --focus-ring: 0 0 0 3px rgba(126, 93, 168, 0.45);
}

h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
body { font-family: var(--font-body); color: var(--fina-tinta); background: var(--fina-papel); }

/* Todo número comparable */
.monto, [data-numeric] {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

**Nota de migración.** El repo ya tiene `--font-serif` y `--font-sans` apuntando las dos a
Poppins. No conviven dos sistemas: en el mismo PR en que entra `tokens.css` se reemplazan
las referencias viejas. Si querés hacerlo por etapas, dejá los nombres viejos como alias
(`--font-serif: var(--font-heading);`) y borralos cuando no queden usos — pero con fecha,
no "algún día".

**Dark mode.** `--fina-noche` sola no es un modo oscuro, es un color. Un dark mode real
necesita redefinir todo el bloque de superficies y tinta bajo `[data-theme="dark"]`.
Mientras eso no esté hecho, **no hay dark mode** y no se anuncia como si lo hubiera. Está en
§12.4.

---

## 5. El sistema propietario (lo que nos diferencia)

Esto faltaba entero en la versión anterior y es lo más importante del documento: es lo único
que un competidor no puede copiar sin copiar el producto entero. **Cualquier dato que se
muestre en pantalla pasa por acá.**

### 5.1 Estados de confianza del dato

FINA es honesta: dice lo que sabe con la seguridad que tiene, ni más ni menos. Cada dato
tiene uno de cuatro estados, y el estado **se lee en el trazo, no en el color** (así no
gastamos el recurso cromático y funciona en escala de grises).

| Estado | Qué significa | Trazo | Microcopy fijo |
| --- | --- | --- | --- |
| **Confirmado** | Verificado contra una fuente | línea llena, firme | — (sin marca) |
| **Declarado** | Lo dijo el usuario | línea llena, más fina | "según lo que nos contaste" |
| **Estimado** | Lo calculamos nosotras | línea punteada | "estimado" |
| **Por descubrir** | Todavía no lo sabemos | contorno tenue, sin relleno | "todavía no lo sabemos" |

Reglas:

- Un dato **estimado nunca se muestra como número exacto**. Se muestra como rango (§5.2).
- El estado es una prop obligatoria del componente de dato, no un extra opcional. Si el
  backend no lo manda, es un bug del backend, no un default silencioso a "confirmado".
- "Por descubrir" **no es un estado de error**. No usa naranja, no usa ícono de alerta, no
  dice "sin datos". Es una invitación: *"todavía no lo sabemos — contame un par más y te lo
  afinamos"*.

### 5.2 Rangos

Cuando no hay certeza, se dibuja el rango como rango: una barra con extremos, no un número
con asterisco.

- Formato de texto: `"entre $30.000 y $45.000"`. Nunca `"~$37.500"` ni `"$37.500*"`.
- Siempre acompañado de qué lo va a mejorar: *"cuando registres un par más te lo afinamos"*.
- A medida que entran datos, el rango se angosta. Ese angostamiento **es** la visualización
  del aprendizaje; vale la pena animarlo cuando cambia.

### 5.3 Progreso de objetivo

Es el mecanismo de retención principal. Requisito de diseño: **el aporte de una semana es
chico y aun así tiene que leerse como avance.**

- Nunca mostrar solo el porcentaje. Siempre el delta: *"+$4.000 esta semana"*.
- Traducir el avance a tiempo, que es lo que la persona entiende: *"3 semanas menos de
  espera para el viaje"*.
- El lima es de acá. Es el momento de mayor valor de la app y el único lugar donde el color
  puede gritar un poco.

### 5.4 Cómo se dicen las cosas (copy en componentes)

- **Mala noticia:** dato → contexto → salida. Nunca dato solo.
  ✅ *"Este mes delivery se llevó $58.000, casi el doble que en julio. Si querés, te muestro
  tres lugares cerca tuyo más baratos."*
  ❌ *"⚠️ Superaste tu presupuesto de delivery."*
- **Buena noticia:** dato → qué significa para el objetivo.
- **Todo número lleva referencia.** `$42.000` no dice nada; `$42.000, casi lo mismo que el
  mes pasado` sí.
- **Voz:** segunda del singular rioplatense (*vos, tenés, mirá, fijate*); primera del plural
  para la marca (*te mostramos, averiguamos por vos*).
- **Emojis:** máximo uno por mensaje, nunca reemplazando una palabra, **nunca en un dato
  duro**.

---

## 6. Fini (el personaje)

La estrella amarilla (`--fina-star`) es el personaje que acompaña. El brief de identidad
había descartado la ruta de mascota por riesgo de infantilizar justo donde la marca necesita
credibilidad financiera. Como el personaje entró igual, la regla no es prohibirlo sino
**contenerlo**:

- ✅ Fini aparece en momentos de **acompañamiento**: onboarding, estados vacíos, logros,
  avatar del bot, celebración de un objetivo cumplido.
- ❌ Fini **nunca** aparece cerca de un dato. Ni al lado de un monto, ni en el hero de
  "Visión de tu dinero", ni en la lista de movimientos, ni en la sección de inversiones.
- ❌ Fini no habla en primera persona ni tiene diálogo propio. La voz es de FINA, no de un
  bicho.
- ❌ Fini no reacciona a un gasto. No hay Fini triste, Fini preocupada ni Fini sorprendida
  por lo que gastaste — eso es moralizar con otra cara.
- El símbolo de marca y Fini pueden ser parientes, pero **el que tiene que pasar el test de
  40px es el símbolo**, no la ilustración.

---

## 7. Estructura de carpetas

Organizada **por rol técnico**. Dado el nombre de un feature, cualquiera debería adivinar
en qué carpeta vive sin buscar.

```
src/
  main.tsx                 # bootstrap
  App.tsx                  # layout raíz + routing + providers

  api/                     # ÚNICA capa que habla con el backend
    client.ts              #   fetch tipado
    types.ts               #   contrato con el backend (Movimiento, Objetivo, Confianza…)

  context/                 # solo estado verdaderamente global
    SessionContext.tsx

  hooks/                   # lógica reutilizable, SIN JSX
    useMovimientos.ts
    useObjetivo.ts

  components/
    ui/                    #   primitivos: Button, Chip, Sheet, Spinner
    data/                  #   EL SISTEMA PROPIETARIO (§5)
      Monto/               #     monto con cifras tabulares
      EstadoConfianza/     #     los 4 estados
      Rango/               #     "entre $X e $Y"
      ProgresoObjetivo/
    Home/  Objetivos/  Onboarding/  Vidriera/

  pages/                   # una por ruta; orquestan, no calculan
  styles/
    tokens.css             # §4 — fuente de verdad
    base.css               # reset + globales
```

**Regla del co-locado:** lo que cambia junto vive junto. El CSS, los tipos internos y los
subcomponentes de `ProgresoObjetivo` van dentro de su carpeta.

**Dependencias en una sola dirección:** UI → hooks → api. La capa de API no sabe nada de la
UI. Nunca al revés.

---

## 8. Convenciones de nombres

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Componente | `PascalCase` | `ProgresoObjetivo.tsx` |
| Hook | `use` + `camelCase`, archivo `.ts` | `useObjetivo.ts` |
| Context | `PascalCase` + `Context` | `SessionContext.tsx` |
| Helper | `camelCase` | `formatMonto.ts` |
| Tipo / interface | `PascalCase`, sin prefijo `I` | `interface Movimiento` |
| Constante global | `SCREAMING_SNAKE_CASE` | `const MAX_OBJETIVOS = 5` |
| Token CSS de marca | `--fina-*` | `--fina-lima-texto` |
| Token CSS de sistema | `--space-*`, `--radius-*` | `--space-4` |
| Id de ícono en el sprite | `fi-` + `kebab-case` | `#fi-objetivo` |

**Un idioma por capa.** El dominio va en español (`Movimiento`, `Objetivo`, `Confianza`)
porque es el lenguaje del producto y del backend; las palabras técnicas de React quedan en
inglés (`props`, `children`, `onClick`). No mezcles dentro del mismo nombre
(`useObjetivoData` ❌ → `useObjetivo` ✅).

> **Tip:** un hook que no renderiza JSX es `.ts`, no `.tsx`. Si terminó en `.tsx`, mezcló
> lógica con UI.

---

## 9. Componentes, estado y tipado

**Componentes**

- Chico y enfocado. Si pasa de ~150 líneas o necesitás la palabra "y" para describir qué
  hace, partilo.
- **Presentacional vs contenedor.** El contenedor usa hooks y pasa props; el presentacional
  recibe props y no sabe de red. Así se testea y se reusa.
- Props tipadas y explícitas. Nada de `any`.
- Sin lógica de negocio en el JSX: el `return` se lee casi como HTML.
- `key` por `id` de la entidad, nunca por índice.
- **Ningún componente hace `fetch` directo.** Todo pasa por `api/`.

**Estado** — elegí el mecanismo más chico que resuelva el problema.

| Necesidad | Herramienta |
| --- | --- |
| Estado local | `useState` / `useReducer` |
| Estado global real (sesión, perfil) | Context |
| Datos remotos con cache/refetch | TanStack Query |

Context **no** es un cajón de sastre: el estado de un formulario muere donde vive.

**Tipado**

- Tipos compartidos solo en `api/types.ts`. Son el contrato con el backend; no se redefinen
  por componente.
- Prohibido `any`. Si no conocés la forma, `unknown` + checks.
- **Uniones discriminadas para los estados de confianza**, que evitan estados imposibles:
  ```ts
  type Dato =
    | { confianza: 'confirmado'; monto: number }
    | { confianza: 'declarado';  monto: number }
    | { confianza: 'estimado';   min: number; max: number }
    | { confianza: 'por-descubrir' };
  ```
  Así el compilador impide mostrar un número exacto sobre un dato estimado. Ese es
  literalmente el atributo *honesta* codificado en el tipo.
- `as` solo como último recurso: un cast es una promesa que le hacés al compilador.

---

## 10. Estados de red y pantallas vacías

**Todo dato remoto tiene cuatro caras: `loading`, `error`, `empty`, `success`.** Las cuatro
se manejan siempre.

| Situación | Qué hacer |
| --- | --- |
| **Cargando** | Skeleton con la forma del contenido real, en `--fina-hueco`. Nunca un spinner centrado en toda la pantalla. |
| **Error** | Mensaje accionable, en voz de FINA, sin disculpas ni tecnicismos: *"No pudimos traer tus movimientos. Probá de nuevo."* + botón de reintentar. |
| **Vacío (día 1)** | **Es una promesa, no una falla.** Muestra lo que va a haber ahí, en estado "por descubrir", y una sola acción clara para empezar. Acá sí va Fini. |
| **Vacío por filtro** | Distinto del día 1: *"No hay movimientos en septiembre."* + cómo limpiar el filtro. |

- Fallá seguro: si algo se rompe a mitad, conservá lo que ya llegó en pantalla.
- Nunca dejes al usuario adivinando: toda carga tiene feedback, todo error tiene salida.

---

## 11. Accesibilidad y mobile

Mobile-first, siempre. La app se usa parada en el colectivo.

- [ ] Contraste **AA** (4.5:1 texto normal, 3:1 texto grande y controles). Los acentos de
      relleno nunca llevan texto propio salvo en `--fina-tinta`.
- [ ] **Foco visible siempre.** Nunca `outline: none` sin reemplazo; usá `--focus-ring`.
- [ ] Navegable por teclado, orden de tabulación lógico, `Esc` cierra sheets y modales.
- [ ] Targets táctiles **≥ 44px**.
- [ ] `aria-live="polite"` en lo que se actualiza solo (progreso, montos que cambian).
- [ ] El estado de confianza tiene texto accesible, no solo trazo: `aria-label` o texto
      visible. **El trazo punteado no es percibible por un lector de pantalla.**
- [ ] Respetar `prefers-reduced-motion`: sin animación de progreso ni de rangos.
- [ ] Nada de anchos fijos. Probar a 320px de ancho antes de mergear.
- [ ] `inputmode="decimal"` en los campos de monto.

---

## 12. Decisiones abiertas

No son deuda escondida: son cosas decididas provisoriamente para poder avanzar. Revisar con
diseño antes de que se vuelvan caras de cambiar.

1. **Par tipográfico.** Outfit + Figtree no da el contraste real que pide el brief, y Outfit
   arrastra el mismo problema de ubicuidad que Poppins. Evaluar alternativas **sobre la
   pantalla de montos**, no sobre el logo.
2. **Peso del púrpura.** Hoy es estructural (§3.3). Si en la exploración de identidad
   aparece un acento propio que lo reemplace, es un cambio de tokens.
3. **Fini vs. símbolo de marca.** Falta definir si el isotipo del test de 40px es una
   versión reducida de Fini o una marca aparte. Hasta que se decida, no se congela el app
   icon ni el avatar de WhatsApp.
4. **Dark mode.** No existe todavía (§4). Definir el set completo de superficies y tinta
   oscuras antes de anunciarlo.
5. **Co-branding con partners.** Cómo entra el logo y el color de una marca ajena sin
   ensuciar la identidad ni parecer publicidad. Es el modelo de negocio: si se resuelve mal,
   se rompe la confianza que la app promete.

---

## 13. Checklist de PR

**Identidad**
- [ ] Nada de la lista de antipatrones (§2).
- [ ] Cero hex sueltos: todo por tokens.
- [ ] Los gastos se muestran neutrales, no en color de alerta.
- [ ] El copy no reta, no ordena y no felicita sin dato.
- [ ] Fini no está cerca de ningún número.

**Sistema propietario**
- [ ] Todo dato mostrado declara su estado de confianza.
- [ ] Ningún dato estimado se muestra como número exacto.
- [ ] Los montos usan cifras tabulares.

**Código**
- [ ] Archivos en la carpeta correcta; nombres según §8; hooks sin JSX en `.ts`.
- [ ] Ningún componente hace `fetch` directo.
- [ ] Sin `any`; props y hooks tipados.
- [ ] `key` por `id`.

**Estados**
- [ ] Se manejan loading / error / empty / success.
- [ ] El vacío del día 1 se ve como promesa.

**A11y**
- [ ] Foco visible, teclado, contraste AA, targets ≥ 44px.
- [ ] El estado de confianza es percibible sin ver el trazo.
- [ ] Se ve bien a 320px.

**Higiene**
- [ ] Sin `console.log` ni código comentado.

---

## 14. Cómo auditar el front contra esta guía

Para revisar el estado actual sin tocar código todavía:

```
Leé docs/frontend.md como estándar del frontend de FINA. Auditá todo src/ contra esa
guía (secciones 2 a 11) y devolvé un informe, sin modificar nada todavía.

Por cada problema:
  1. Archivo y línea (o carpeta).
  2. Qué regla incumple, citando la sección (ej. "§3.3 color" o "§5.1 confianza").
  3. Severidad: alta / media / baja.
  4. Cómo corregirlo concretamente.

Agrupá por tema: identidad visual, sistema propietario, estructura, nombres, componentes,
estado, tipado, accesibilidad. Ordená por severidad. Al final, un plan por pasos —primero
lo estructural, después lo fino—, pero NO apliques nada hasta que te lo confirme.
```

Cuando quieras que lo aplique: *"Aplicá el plan en un branch nuevo. No cambies
comportamiento ni lógica: es reorganización, no refactor funcional. Actualizá todos los
imports y al terminar corré el build y arreglá lo que rompa."*

Se hace en dos pasos —auditar, confirmar, aplicar— para ver el diagnóstico antes de que
mueva nada y poder revisar el diff con calma.
