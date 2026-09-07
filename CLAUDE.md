# FINA

App de finanzas personales. Hace **visible** la plata de gente joven que nunca tuvo
educación financiera. No la administra, no la juzga. El registro de gastos entra por
WhatsApp; la app devuelve claridad, objetivos y descuentos.

Stack: React + TypeScript + Vite.

## Antes de tocar el frontend

**Leé `docs/frontend.md` completo antes de escribir o modificar cualquier cosa en `src/`.**
Ahí están las reglas de identidad visual, los tokens, el sistema de estados de confianza y
las convenciones de código. No improvises color, tipografía ni estructura de carpetas: ya
están decididas.

## Reglas que no se negocian

1. **Cero hex sueltos.** Todo color, espacio y radio sale de `styles/tokens.css`.
2. **Los cuatro colores de marca son de relleno, no de texto.** Cada uno tiene su token
   `-texto` para cuando tiene que ir en tipografía.
3. **Un gasto no es un error.** Los gastos se muestran neutrales, nunca en color de alerta.
   La app no reta, no ordena y no moraliza el consumo.
4. **Todo dato declara su estado de confianza** (confirmado / declarado / estimado / por
   descubrir). Un dato estimado se muestra como rango, nunca como número exacto.
5. **Todo monto en cifras tabulares** (`font-variant-numeric: tabular-nums`).
6. **Ningún componente hace `fetch` directo.** Todo pasa por `api/`.
7. **Sin `any`.**

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # build de producción — tiene que pasar antes de cualquier PR
npm run lint
```

## Antes de abrir un PR

Pasá el checklist de `docs/frontend.md` §13.
