# FINA

App de finanzas personales. Hace **visible** la plata de gente joven que nunca tuvo
educación financiera. No la juzga. El registro de gastos entra por WhatsApp; la app
devuelve claridad, objetivos y descuentos.

FINA es una acompañante, no una herramienta: entra en el mundo de cada persona, le habla
según lo que sabe y de a poco se va encargando de más cosas (registrar gastos, proponer
pasos para los objetivos, encontrar beneficios, sugerir inversiones y movimientos) mientras
la persona aprende desde su propia situación. Delegar no es desentenderse: el usuario sigue
siendo responsable de registrar sus gastos y cumplir sus objetivos. Más adelante, FINA suma
una comunidad donde la gente se sienta segura. La regla 11 convierte esto en criterio de
decisión.

El objetivo a largo plazo es que con el tiempo FINA conozca a cada persona perfectamente.
Así la persona potencia su situación, aprende y deja de cargar con la preocupación de no
estar ocupándose de sus finanzas, porque FINA ya se ocupa con ella. Cada funcionalidad
tiene que acercar a ese punto: más conocimiento de la persona, más tareas que FINA asume y
más aprendizaje para quien la usa.

Stack: React 18 + TypeScript + Vite, Supabase (Postgres, Auth, Storage) y funciones en `api/`
sobre Vercel. Paquetes con pnpm (`npx -y pnpm@10 install`); no usar `npm install`, que crea
un `package-lock.json`. Resumen de cómo está armada la app en `RESUMEN-CHAT.md`.

## Antes de tocar el frontend

**Leé `src/styles/frontend.md` completo antes de escribir o modificar cualquier cosa en `src/`.**
Ahí están las reglas de identidad visual, los tokens, el sistema de estados de confianza y
las convenciones de código. No improvises color, tipografía ni estructura de carpetas: ya
están decididas.

## Reglas que no se negocian

1. **Cero hex sueltos.** Todo color, espacio y radio sale de `styles/tokens.css` (o de
   `COLORS` en `onboarding-v2/shared.tsx`, que es su espejo con los mismos valores).
2. **Los cuatro colores de marca son de relleno, no de texto.** Cada uno tiene su token
   `-texto` para cuando tiene que ir en tipografía.
3. **Un gasto no es un error.** Los gastos se muestran neutrales, nunca en color de alerta.
   La app no reta, no ordena y no moraliza el consumo.
4. **Todo dato declara su estado de confianza** (confirmado / declarado / estimado / por
   descubrir). Un dato estimado se muestra como rango, nunca como número exacto.
5. **Todo monto en cifras tabulares** (`font-variant-numeric: tabular-nums`).
6. **Ningún componente hace `fetch` directo.** Todo pasa por `src/app/api/v2/`.
7. **Sin `any`.**
8. **Jerarquía.** Cada pantalla tiene un objetivo y un solo punto que se lleva la vista
   primero, y lo importante se ve sin scrollear. Nada de subtítulos que expliquen lo que
   el título ya debería decir.
9. **Inicio es un tablero de entradas, no un resumen de todo.** Lo que tiene su pantalla
   (objetivos, gastos, inversiones) aparece en Inicio como un botón o fila compacta que
   lleva a esa pantalla, donde está el detalle. El flujo es ir de una pantalla a otra, no
   leer todo en Inicio.
10. **Formato** (aplica a todo: textos de la app, textos que genera la IA, docs, commits y
   respuestas). No usar guiones largos, comillas rizadas, viñetas Unicode decorativas ni
   emojis. No usar subtítulos, encabezados intermedios ni etiquetas de sección salvo
   pedido explícito. Texto continuo, directo y sin divisiones artificiales. Detalle en
   `src/styles/frontend.md` §5.5.
11. **Toda decisión se justifica por la línea de FINA.** Esta regla manda sobre cualquier
   elección de diseño o de implementación que no esté resuelta por las anteriores. Antes de
   decidir, se responden tres preguntas: ¿hace más fácil una tarea tediosa?, ¿deja el dato
   más visible?, ¿ayuda a que la situación de la persona mejore con el tiempo? Si la
   respuesta a las tres es no, no se hace. En el frente, al abrir la app se entiende en
   segundos cómo viene la situación financiera, y tocar cualquier punto lleva a la pantalla
   donde está el detalle. En el backend, las recomendaciones no son fijas: parten de un
   análisis del progreso de cada persona (qué mejoró, qué se estancó, qué objetivos avanzan)
   y se vuelven más personalizadas a medida que FINA tiene más datos e historia de ella. Una
   recomendación que se le daría igual a cualquier usuario no cumple esta regla.
12. **Los botones abren pantallas, no despliegan hacia abajo.** Un botón que lleva a hacer
   algo (cargar un gasto o un ingreso, crear un objetivo) abre una pantalla nueva o una hoja
   aparte encima de la pantalla (`onboarding-v2/Hoja.tsx`), no un formulario que se
   despliega debajo mezclado con el resto. Lo que sí se despliega en el lugar es texto para
   leer ("Cómo hacerlo", por qué te toca un paso). Detalle en `src/styles/frontend.md` §3.5.
13. **Textos: claridad antes que cantidad.** Antes de escribir o cambiar cualquier texto de la
   app (títulos, botones, descripciones, consejos, avisos, lo que escribe la IA), leé
   `src/styles/textos.md` completo. Primero se decide si hace falta texto; si hace falta, lo
   mínimo para que se entienda en una sola lectura, verdadero según cómo funciona FINA y
   natural en Argentina. Nunca texto para llenar espacio ni para que la pantalla parezca más
   cálida.
14. **Ningún push le hace perder datos ni confianza a la persona.** Todo lo que ya registró
   (gastos, ingresos, saldos, objetivos y sus aportes, topes, gastos fijos, racha, perfil)
   se sigue viendo igual después de cada cambio. Un cambio en cómo se lee o se calcula un
   dato no le cambia de golpe un número que ya conoce (su dinero disponible, su racha, lo
   que lleva juntado): si la cuenta tiene que cambiar, se charla antes y se migra lo
   guardado. Los cambios se ven, pero a la vista son sutiles: lo nuevo entra con el mismo
   lenguaje visual (colores, tipografía, formas, lugar de las cosas), de a una cosa por vez,
   y al abrir la app la persona la sigue reconociendo como suya. Nada de rediseños de golpe,
   y si algo se mueve o se saca, lo que hacía sigue a mano. Antes de cada push se pasa el
   chequeo de "Antes de pushear", más abajo.

## Backlog

Lo pendiente está en `DEBT.md`, en la raíz (por ahora, sólo en la rama `juaniBranch`). Al
terminar un ítem, se marca ahí.

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción, tiene que pasar antes de cualquier PR
npm run typecheck  # tsc --noEmit, tiene que pasar antes de cualquier PR
```

> **`npm run build` NO chequea tipos.** Vite compila con esbuild, que borra
> las anotaciones sin validarlas: un import que falta o una comparación
> imposible pasan el build en verde y explotan recién en el navegador. La regla
> 7 ("sin `any`") tampoco la valida nadie sin `typecheck`. Corré los dos.
>
> No hay linter configurado. Si alguna vez se agrega, va acá.

## Antes de pushear

Cada push, a cualquier rama, pasa por estos chequeos además de `typecheck` y `build`
(regla 14). Si alguno falla, no se pushea hasta entender por qué.

1. **Migraciones:** aditivas e idempotentes (`if not exists`, columnas nuevas con default),
   sin `drop` ni `rename` de nada que tenga datos. La app sigue andando antes y después de
   correrlas, como `cargarTodo` en `src/app/api/v2/index.ts`, que carga igual aunque
   falte una tabla nueva. El bot de WhatsApp escribe
   en las mismas tablas desde otro repo: una columna `not null` sin default o un check más
   estricto le rompe los inserts.
2. **Lo ya guardado se sigue leyendo:** si cambia la forma de un dato (un jsonb como
   `onboarding_v2`, una clave de `localStorage`, los valores que acepta un check), la app
   sigue entendiendo la forma anterior.
3. **Los números no cambian solos:** con una cuenta de prueba con datos, se compara la
   preview contra producción. El dinero disponible, los totales del mes, la racha y el
   avance de cada objetivo tienen que dar lo mismo.
4. **El cambio se ve, pero sutil:** al abrir la preview, la app se reconoce igual. Lo nuevo
   usa los tokens y componentes que ya existen, cambia una cosa por vez y nada importante
   salta de lugar. Si un botón o una pantalla se mueve o se saca, lo que hacía sigue a mano
   en otro lugar.

## Antes de abrir un PR

Pasá el checklist de `src/styles/frontend.md` §13.

Nunca se trabaja directo en `main`: cada cambio va en una rama, y el push de la rama
genera una preview en Vercel para verlo antes de mergear.
