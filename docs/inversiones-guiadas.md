# Inversiones guiadas

Rama `inversiones-guiadas`. Reemplaza las recomendaciones por perfil (fijas, a mano) de
la pantalla de Inversiones v2 por recomendaciones armadas con datos de mercado de hoy,
un paso a paso por proveedor, un registro específico por tipo de inversión y seguimiento.

## Cómo funciona

```
fuentes públicas ─► api/mercado.ts ─► src/app/api/v2/mercado.ts ─► useMercado ─► motor ─► pantalla
                       (cache 5 min)        (cache 5 min)
```

- **`api/_mercado/fuentes.ts`** baja cada fuente por separado; si una falla se anota en
  `fallas` y el resto sale igual. Un dato que no se pudo traer conserva el anterior CON SU
  FECHA ORIGINAL; la regla de vigencia (`lib/inversiones/mercadoTipos.ts`, `LIMITE_DIAS`)
  decide si todavía sirve.
- **`lib/inversiones/motor.ts`** calcula el rendimiento REAL (después de inflación) de cada
  opción y recomienda. Compara contra la inflación MÁS ALTA entre la de los últimos 3 meses
  (INDEC), la esperada a 12 meses (REM) y lo que subió la UVA en el último mes. Para ahorrar
  o crecer, si todas las opciones de un producto rinden menos que la inflación, no se
  recomienda. Para tener plata a mano se permite una que pierda sólo si no hay otra mejor.
  Un dato vencido saca la opción de la lista.
- **`lib/inversiones/cuanto.ts`**: cuánto poner, a partir del PEOR de los últimos 3 meses
  (no el promedio), y el colchón de 3 meses de gastos.
- **`lib/inversiones/guias.ts`**: 12 pasos a paso (proveedor × producto) con datos de hoy.
- **`lib/inversiones/registro.ts`**: un formulario por tipo, con validaciones que avisan y
  no bloquean, y el armado desde una captura.
- **`lib/inversiones/seguimiento.ts`**: las "Novedades" de Mis inversiones.

## Fuentes (verificadas el 21/10/2026)

| Dato | Fuente | Nota |
| --- | --- | --- |
| Inflación mensual, UVA, plazo fijo por banco, cuentas de billeteras, letras, riesgo país, fondos | ArgentinaDatos | API **comunitaria**, no oficial |
| TAMAR, BADLAR, inflación esperada (REM) | BCRA, API de estadísticas **v4** | La v3 fue dada de baja (410) |
| Dólar | DolarAPI | |
| Precios de CEDEARs | data912 | comunitaria |

CAFCI bloquea las consultas automáticas (403). El histórico por fecha de ArgentinaDatos
trae sólo algunos fondos, no los nuestros. Por eso el rendimiento de 7 y 30 días de los
fondos lo arma FINA con sus propias fotos diarias (ver abajo); mientras no haya historia
se usa "ayer contra hoy" con un rango ancho.

## Para dejarlo andando

1. Correr `supabase/migrations/0039_inversiones_guiadas.sql` en el SQL Editor de Supabase.
   Sin eso la app anda, pero registrar una inversión específica avisa que falta la base, y
   el avance del paso a paso queda sólo en el dispositivo.
2. En Vercel, definir `SUPABASE_SERVICE_ROLE_KEY` para que `/api/mercado` guarde una foto
   por día en `market_snapshots`. Sin esa variable anda igual, pero no hay historia de 7 y
   30 días de los fondos ni respaldo entre reinicios. Se usa service_role a propósito: si
   cualquiera pudiera escribir esa tabla podría envenenar el respaldo.
3. `ANTHROPIC_API_KEY` ya existe (la usa `/api/recomendaciones`); `/api/leer-captura` usa la misma.
4. En local, `npm run dev` ahora sirve `/api/mercado` (plugin en `vite.config.ts`, sólo dev).

## Hay que verificar a mano

- **Los 12 paso a paso** se escribieron con información pública y NO se pudieron probar
  abriendo cada app. Cada guía lista en `porVerificar` lo que hay que confirmar. En cada
  paso hay un botón "No lo encuentro" que guarda el comentario en la tabla `feedback`
  (contexto `guia:<proveedor>:<producto>:<paso>`).
- Que el rendimiento de la cuenta de Mercado Pago venga del fondo Mercado Fondo.
- La lectura de capturas con capturas reales de cada app.

## Pendiente

Ver el cierre de la conversación en la que se armó: avisos fuera de la app (WhatsApp/push),
conexión con Objetivos, más proveedores y fondos, y la revisión legal (CNV).
