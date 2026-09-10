# Rediseño del sandbox v2 — Dirección C, «una cosa por pantalla»

**Fecha:** 2026-09-07
**Rama:** `dev`
**Punto de partida:** `dc216b4f`
**Alcance:** las 7 pantallas de `src/app/components/onboarding-v2/`

---

## 1. El problema

El pedido fue tirar el diseño entero —distribución, encajonamiento de textos y
botones— y conservar solo Baloo 2 en los títulos. Al medir la app se confirmó que
el encajonamiento y el apagamiento **son el mismo problema**, no dos.

Contraste WCAG de cada superficie contra el papel `#FAF7F1`:

| Superficie | Hex | Saturación | Contraste |
| --- | --- | --- | --- |
| tarjeta | `#FFFFFF` | 0.0% | 1.07 |
| chip / tinte | `#F1EBDF` | 7.5% | 1.11 |
| banda lila | `#EEE7F6` | 6.1% | 1.13 |
| separador | `#E7DFD1` | 9.5% | 1.24 |

Ninguna llega a 1.25. Cada vez que hizo falta jerarquía se metió un contenedor
tintado; como el tinte no separa, se agregó otro encima. De ahí las 65 cajas
redondeadas del sandbox y la sensación de app apagada.

Los acentos que sí tienen vida —lima 64%, star 66%, naranja 69%— casi no
aparecen en el onboarding. La app usa solo la mitad muerta de su propia paleta.

Síntomas observados en el flujo real a 375px:

1. La pantalla de género mete **dos preguntas con dos `<h1>` del mismo tamaño**.
2. Los chips envuelven ragged (3 + 2, 3 + 3): no hay grilla.
3. 40-60% de pantalla muerta con el CTA huérfano abajo.
4. El `Continuar` deshabilitado no tiene relleno: **no se lee como control**.
   Es un defecto de accesibilidad, no solo estético.

## 2. La decisión

Se elige la **dirección C**: una pregunta por pantalla. Es la única de las tres
evaluadas que ataca el flujo y no el estilo, y por lo tanto la única que corta el
ciclo en el origen — si hay una sola cosa por pantalla, no hay nada que encajonar.

Se descartaron:

- **A «el trazo»** (cero contenedores, jerarquía puramente tipográfica): más
  elegante, pero no toca el flujo — el vacío del 40% vuelve apenas una pantalla
  tenga poco contenido.
- **B «campos de color»** (bandas saturadas de ancho completo): arregla el color
  y deja intacta la distribución, que fue lo primero que se señaló.

De A se toma la superficie (cero cajas salvo una excepción); de B, el criterio de
color acotado al estado seleccionado y al momento de valor.

## 3. Decisiones fijas

| Decisión | Valor | Razón |
| --- | --- | --- |
| Títulos | Baloo 2 | Pedido explícito. Ya existe en `tokens.css` como `--fina-display`; lo tapaba el override a Outfit de `shared.tsx`. |
| Acento | `#7626B3` | 7.28:1 sobre papel y 7.78:1 con texto blanco, contra 4.89:1 y 5.23:1 del `#7E5DA8`. Más vivo **y** más accesible. |
| Sistema de color | `frontend.md` | Papel cálido, lima, star, naranja, tokens `-texto` con contraste medido. |
| Cuerpo | Figtree | Sin cambios. |
| Montos | IBM Plex Mono, `tabular-nums` | Regla 5 de `CLAUDE.md`. |

## 4. El sistema

### 4.1 Superficie

**Una sola tarjeta elevada en toda la app:** «tu próximo paso» en Home. Todo lo
demás vive directo sobre el papel, separado por aire y por una hairline de
contraste real (objetivo ≥ 1.5, hoy 1.24).

Los tres recursos de separación, en orden de preferencia:

1. **Aire** — el separador por defecto.
2. **Hairline de 1px** — cuando hay una lista de ítems homogéneos.
3. **Relleno de color pleno** — solo para el estado seleccionado y el momento
   de valor (un objetivo que avanza, en lima).

Fuera de esa lista no se agregan contenedores.

### 4.2 Jerarquía

La jerarquía sale de la escala tipográfica y del peso, nunca de una caja.

| Rol | Familia | Tamaño |
| --- | --- | --- |
| Título de pantalla | Baloo 2 800 | 30px mobile / 34px desktop |
| Título de sección | Baloo 2 700 | 17px |
| Cuerpo | Figtree 400 | 15px |
| Apoyo | Figtree 400 | 13px, tinta-media |
| Contador / label | IBM Plex Mono | 10.5px, tracking `.12em`, mayúscula |

Un solo `<h1>` por pantalla. Sin excepción — es la regla que fuerza el split.

### 4.3 Flujo del onboarding

- **Una pregunta por pantalla.** Se parten `generoEdad` → `genero` + `edad`, y
  `perfilInversor` → `invReaccion` + `invYaInvierte`. El flujo pasa de 16 a 18
  pasos posibles.
- **Auto-avance en opción única.** Tocás la respuesta y avanza (con ~180ms de
  delay para que se vea el estado seleccionado). Esto elimina el `Continuar`
  huérfano, que era la mitad del problema visual.
- **El CTA sobrevive solo** donde hace falta: multi-selección, campos de texto,
  términos y login.
- **Grilla de 2 columnas que se llena** para las opciones cortas; lista de filas
  de ancho completo para las opciones largas. Nunca más wrap ragged.
- **Contador `Pregunta N de M`** en vez de la barra segmentada por sección, que
  no comunicaba cuánto falta.
- La opción de escape («prefiero no decir», «saltar por ahora») baja a un botón
  fantasma con borde, no a un link subrayado suelto.

### 4.4 Accesibilidad

Se mantiene todo el checklist de `frontend.md §11`, con dos correcciones:

- El botón deshabilitado lleva relleno propio y `aria-disabled`, para que se lea
  como control.
- El auto-avance anuncia el cambio de paso con `aria-live="polite"` y respeta
  `prefers-reduced-motion`.

## 5. Capas de implementación

| Capa | Qué | Archivos |
| --- | --- | --- |
| 1 · Fundación | Baloo 2 en display, violeta vivo, hairline con contraste, primitivos `Titulo` / `OpcionesGrid` / `OpcionesLista` / `Contador` | `shared.tsx` |
| 2 · Onboarding | Split de pantallas, auto-avance, grilla, nuevo shell | `OnboardingV2.tsx` |
| 3 · Pantallas | Des-encajonar Home, Gastos, Objetivos, Inversiones, Grupos, Perfil | las 6 restantes |

Cada capa cierra con `npm run build` en verde y push a `dev` para que quede
visible en el preview de Vercel.

## 6. Qué NO entra

- No se toca la app real (`src/app/components/` fuera de `onboarding-v2/`).
- No se toca la lógica de persistencia ni el contrato de `localStorage`: es un
  rediseño de presentación, no un refactor funcional.
- No se implementa modo oscuro (`frontend.md §12.4` lo deja abierto).
- No se resuelve el conflicto entre `tokens.css` (Manual v2.0) y `frontend.md`
  a nivel repo: el sandbox v2 sigue a `frontend.md` con el violeta vivo, y la
  contradicción queda documentada para resolverla aparte.
