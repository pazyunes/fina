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

La paleta vive en `styles/tokens.css` y su espejo en `COLORS` de
`onboarding-v2/shared.tsx`, que es lo que pinta la app hoy. Los dos tienen los mismos
valores; si cambia uno, cambia el otro en el mismo commit.

**Regla que rompe todo lo anterior si se ignora: los cuatro colores de marca son colores de
relleno, no de texto.** Ninguno tiene contraste suficiente sobre el papel ni soporta texto
blanco encima. Por eso cada uno tiene su token `-suave` (superficie) y su `-texto` (la
versión oscura, 6:1 o más, para cuando ese color tiene que decir algo en tipografía o en un
ícono fino). Sobre relleno de color, el texto va siempre en `--fina-tinta`, nunca en blanco.

| Color de marca | Relleno | Texto | Sirve para |
| --- | --- | --- | --- |
| Lima | `--fina-lima` `#B0E150` | `--fina-lima-texto` `#41660F` | valor, éxito, objetivo que avanza |
| Star | `--fina-star` `#FFC457` | `--fina-star-texto` `#7A4F00` | Fini, medallitas, destacados |
| Naranja | `--fina-naranja` `#FF7B4F` | `--fina-naranja-texto` `#A83208` | atención accionable |
| Lila | `--fina-lila` `#CB9EFF` | `--fina-lila-texto` (violeta oscuro) | recuadros |

El lima tiene además `--fina-lima-dato` (`#5C8A18`) para marcas de datos, como el relleno
de un anillo o una barra de progreso: el lima de marca contra su propio riel casi no se
distingue (1.35:1) y éste llega a 3.6:1.

El violeta (`--fina-violeta`, `#7626B3`) es el acento de interfaz: botones, progreso, foco y
estado elegido. Es el único color de acento que sí funciona como texto (7.28:1 sobre papel)
y que soporta texto blanco encima. Tiene `--fina-violeta-suave` para bandas y recuadros y
`--fina-violeta-oscuro` para texto sobre lila y fondos plenos.

**Roles semánticos:**

| Rol | Token | Uso |
| --- | --- | --- |
| Fondo general | `--fina-papel` | el campo de toda la app |
| Superficie elevada | `--fina-superficie` | tarjetas sobre el papel |
| Bloque hundido | `--fina-hueco` | agrupaciones, listas tintadas |
| Separador | `--fina-hairline` | líneas decorativas |
| Borde de control | `--fina-borde-control` | inputs y botones secundarios (3:1, WCAG 1.4.11) |
| Texto principal | `--fina-tinta` | todo el texto y los montos |
| Texto secundario | `--fina-tinta-media`, `--fina-tinta-suave` | labels, fechas, unidades |
| Acción e interacción | `--fina-violeta` | botones, foco, progreso, lo elegido |
| Positivo / logro | `--fina-lima` + `--fina-lima-texto` | objetivo que avanza, ahorro, éxito |
| Salida de dinero | `--fina-gastos` (igual a tinta, neutral) | **los gastos no se pintan de alerta** |
| Atención real | `--fina-naranja` + `--fina-naranja-texto` | solo cuando hay algo que hacer ya |
| Personaje / destacado | `--fina-star` + `--fina-star-texto` | Fini, medallitas, momentos de marca |
| Distinguir secciones de gastos | `--fina-purpura`, `--fina-azul`, `--fina-magenta`, `--fina-lila` | sólo para que dos secciones no se confundan; no dicen nada bueno ni malo |
| Inversiones | `--fina-noche` y familia | la sección vive sobre fondo oscuro, sin ruido de color |

**Un gasto es un dato neutral y se muestra en tinta.** Si cada gasto se pintara de naranja
o de rojo, la app estaría diciendo "esto está mal" cientos de veces por mes. En la paleta no
hay rojo: el naranja se reserva para cuando hay una acción concreta pendiente (un débito
automático que se viene, un dato que hay que confirmar), y aun así el copy nunca reta.
`--destructive` (borrar algo, un error de formulario) usa `--fina-naranja-texto` y nunca se
aplica a un monto gastado.

El color con el que se tiene que recordar la app es el lima en el momento de mayor valor:
cuando un objetivo avanza. El violeta organiza la interfaz, pero no es lo que se recuerda.

### 3.4 Tipografía

**Una sola familia: `Poppins`**, para títulos, texto, botones y montos (decisión de diseño,
octubre 2026; reemplaza a Baloo 2 + Figtree + IBM Plex Mono). La jerarquía sale del tamaño
y del peso, no de cambiar de familia.

| Rol | Peso | Detalle |
| --- | --- | --- |
| Títulos y momentos de marca | 600/700 | `letter-spacing: -0.01em` en tamaños grandes |
| Cuerpo y UI | 400/500 | |
| Montos y datos | 500/600 | **siempre** con `font-variant-numeric: tabular-nums` |

Reglas duras:

- **Todo número que el usuario pueda comparar va en cifras tabulares.** Columnas de montos,
  totales, progreso. Sin ancho fijo de dígito, las columnas de pesos bailan. Poppins tiene
  cifras tabulares; se activan con `tabular-nums` (la clase `font-mono` de Tailwind hoy
  también resuelve a Poppins).
- No se suma otra familia. Si algo necesita destacarse, se usa tamaño o peso.
- **La tipografía se evalúa primero en la pantalla de números, no en el logo.**
- Sentence case en todo. Nada de labels en MAYÚSCULAS.
- Largo de línea < 70 caracteres en bloques de lectura.

> **Decisión tomada (§12.1).** El brief pedía un par con contraste y descartaba Poppins
> por ubicua; se probaron Outfit y después Baloo 2 + Figtree + IBM Plex Mono. Diseño
> eligió volver a Poppins como familia única, porque tres familias se leían como tres
> apps distintas. Todo sigue yendo por tokens (`--fina-font` en `tokens.css` y `FONTS` en
> `onboarding-v2/shared.tsx`): cambiarla sigue siendo una línea.

### 3.5 Forma, espacio y variedad de contenedores

- Escala de espaciado de **4px** (`--space-1` … `--space-10`). Nada de `margin: 13px`.
- Radios sólo de la escala de `tokens.css`: `--fina-r-xs` (8px), `--fina-r-sm` (12px),
  `--fina-r-md` (18px), `--fina-r-lg` (24px) y `--fina-r-full` (pill, botones y avatares).
- **Un dato central por pantalla.** Jerarquía brutal: el total antes que el desglose.
- **Cada pantalla tiene un objetivo, y la vista va ahí primero.** Antes de diseñar,
  escribí en una línea qué tiene que entender o hacer la persona en esa pantalla. Ese
  elemento es el más grande, el de más peso y el único con color de acento; todo lo demás
  es secundario en tamaño, peso y color. Si dos cosas compiten por la mirada, una de las
  dos baja o se va. El objetivo de fondo de toda la app: que la persona primero entienda
  su situación financiera y después la mejore.
- **Mostrar menos.** Una lista larga muestra los primeros ítems y un "Ver todos" (como
  Mercado Pago), no todo de una. Letra chica sólo para lo que de verdad es secundario.
- **Lo importante, sin scrollear.** En un celular de 375px, lo principal de cada pantalla
  se ve completo al abrirla. Tamaños de referencia: título de pantalla 26px, título de
  sección 18px, texto 14 a 15px, dato principal 26 a 32px. Si algo no entra, se achica o
  se va otra cosa, no se agranda la pantalla.
- **Inicio es un tablero de entradas.** Lo que tiene su propia pantalla aparece en Inicio
  como un botón o una fila compacta (título, una línea, a lo sumo una barrita) que lleva
  ahí; el detalle vive en su pantalla. Ejemplo: el recordatorio de sumarle a un objetivo
  es una fila que abre Objetivos con ese objetivo, no el plan completo en Inicio. La idea
  es que el recorrido entre pantallas sea fluido, no que Inicio lo cuente todo.
- **Bloques sólo para botones o para lo prioritario.** Un bloque (fondo tintado, borde o
  tarjeta) que contiene texto se usa únicamente para un botón o para la feature
  prioritaria de la pantalla. Todo lo demás va plano, sobre el papel. Lo plano no quiere
  decir pegado: las secciones y los textos se separan con aire y con líneas planas
  (hairline de 1px en `--fina-hairline`, de lado a lado, sin caja ni redondeo), para que
  la pantalla no se lea como un párrafo gigante. Si en una pantalla hay más de tres
  bloques, algo está mal jerarquizado. Los modales y los paneles que se abren encima no
  cuentan: son superficies, no bloques dentro de la pantalla.
- Sombras: existe una sola (`--shadow-card`), suave y cálida. Nada de `shadow-lg` genérica.

---

## 4. Tokens (`styles/tokens.css`)

Fuente de verdad de color, tipografía, espacio y forma. **Ningún componente escribe un hex.**

```css
:root {
  /* Superficies */
  --fina-papel:          #FAF7F1;  /* fondo general, casi blanco, apenas cálido */
  --fina-superficie:     #FFFFFF;  /* tarjeta elevada */
  --fina-hueco:          #EEE4D2;  /* bloque tintado / hundido */
  --fina-hairline:       #D6CBB8;  /* separador, 1.5:1 sobre papel */
  --fina-borde-control:  #998769;  /* borde de control, 3.26:1 */
  --fina-marco:          #EFEAE0;  /* marco de la pantalla en desktop */

  /* Tinta (texto) */
  --fina-tinta:        #2B2118;  /* 14:1 sobre papel, texto y montos */
  --fina-tinta-media:  #5F5346;  /* 6.9:1, labels, fechas */
  --fina-tinta-suave:  #7A6A58;  /* texto auxiliar, mínimo AA */

  /* Acento de interfaz */
  --fina-violeta:         #7626B3;  /* botones, progreso, foco; 7.28:1 */
  --fina-violeta-suave:   #E4D5F5;  /* bandas y recuadros */
  --fina-violeta-oscuro:  #5C1B8E;  /* texto sobre lila, fondos plenos */

  /* Marca: relleno + suave + texto */
  --fina-lima:     #B0E150;  --fina-lima-suave:     #EAF5D0;  --fina-lima-texto:     #41660F;
  --fina-lima-dato: #5C8A18; /* marcas de datos: anillos, barras */
  --fina-star:     #FFC457;  --fina-star-suave:     #FFEECB;  --fina-star-texto:     #7A4F00;
  --fina-naranja:  #FF7B4F;  --fina-naranja-suave:  #FFE3D6;  --fina-naranja-texto:  #A83208;
  --fina-lila:     #CB9EFF;  --fina-lila-borde:     #9A6BD1;  --fina-lila-texto:     var(--fina-violeta-oscuro);

  /* Hues de apoyo para distinguir secciones de gastos */
  --fina-purpura: #7E5DA8;  --fina-purpura-suave: #EEE7F6;
  --fina-azul:    #3D6FF5;  --fina-azul-suave:    #E2EAFF;
  --fina-magenta: #C23FA8;  --fina-magenta-suave: #F9E1F2;

  /* Secciones: gastos es neutral */
  --fina-gastos:      var(--fina-tinta);         --fina-gastos-suave:      #F1EBDF;
  --fina-objetivos:   var(--fina-lima-texto);    --fina-objetivos-suave:   var(--fina-lima-suave);
  --fina-inversiones: var(--fina-purpura);       --fina-inversiones-suave: var(--fina-purpura-suave);
  --fina-grupos:      var(--fina-star-texto);    --fina-grupos-suave:      var(--fina-star-suave);

  /* Noche (Inversiones) */
  --fina-noche:          #3D2A55;
  --fina-noche-tarjeta:  #4A3663;
  --fina-sobre-noche:    var(--fina-papel);

  /* Tipografía: una sola familia */
  --fina-font: "Poppins", ui-sans-serif, system-ui, sans-serif;

  /* Espacio (escala 4px) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

  /* Forma */
  --fina-r-xs: 8px;  --fina-r-sm: 12px;  --fina-r-md: 18px;  --fina-r-lg: 24px;
  --fina-r-full: 999px;
  --stroke-icon: 1.9px;
  --shadow-card: 0 2px 8px rgba(43, 33, 24, 0.08);
  --focus-ring: 0 0 0 3px rgba(118, 38, 179, 0.45);
}
```

`theme.css` mapea estos tokens a las variables genéricas que usan Tailwind y los
componentes de `ui/` (`--background`, `--primary`, `--destructive`, `--chart-*`,
`--font-sans`) y no tiene hex propios. Los nombres del manual anterior (`--fina-blanco`,
`--fina-gris`, `--fina-linea`, `--fina-tinte`, `--fina-violeta-100`) siguen en `tokens.css`
como alias; no se usan en código nuevo.

**Dark mode.** `--fina-noche` y su familia son el fondo de Inversiones, no un modo oscuro.
Un dark mode real necesita redefinir todo el bloque de superficies y tinta bajo
`[data-theme="dark"]`. Mientras eso no esté hecho, **no hay dark mode** y no se anuncia como
si lo hubiera. Está en §12.4.

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
| **Declarado** | Lo dijo el usuario | sin marca visible | (sin texto: lo que cargó la persona es su dato; decidido oct 2026) |
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
- **Sin emojis** (ver §5.5).
- **Sin subtítulos explicativos.** Un título se tiene que entender solo. Si necesita una
  bajada en letra chica para explicar qué es ("Lo que te entró contra lo que gastaste"),
  el problema es el título: se cambia el título y se borra la bajada. Tampoco se explica
  lo que se sobreentiende (cómo se usa un botón, qué es un gráfico).

### 5.5 Formato

Aplica a todo texto: copy de la app, textos que genera la IA (el prompt de
`api/_recomendaciones/prompt.ts` lo tiene que pedir), notificaciones, docs, commits.

- No usar guiones largos, comillas rizadas, viñetas Unicode decorativas ni emojis.
- No usar subtítulos, encabezados intermedios ni etiquetas de sección salvo que se pidan
  explícitamente. Texto continuo, directo y sin divisiones artificiales.

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
| Token CSS de sistema | `--space-*`, `--fina-r-*` | `--space-4` |
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

1. **Tipografía.** Resuelto: Poppins como familia única (§3.4). Si se revisa, evaluar
   **sobre la pantalla de montos**, no sobre el logo.
2. **Peso del violeta.** Hoy es el acento de interfaz y el lima es el color de valor (§3.3). Si en la exploración de identidad
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
- [ ] Se sabe cuál es el objetivo de la pantalla y la vista va ahí primero.
- [ ] Ningún título necesita un subtítulo que lo explique.
- [ ] Los bloques con texto son botones o lo prioritario; el resto va plano, separado por
      aire y hairline (§3.5).
- [ ] Sin guiones largos, comillas rizadas, emojis ni viñetas decorativas (§5.5).
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
Leé src/styles/frontend.md como estándar del frontend de FINA. Auditá todo src/ contra esa
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
