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
- **`lib/inversiones/guias.ts`**: los pasos a paso (proveedor × producto) con datos de hoy.
- **`lib/inversiones/registro.ts`**: un formulario por tipo, con validaciones que avisan y
  no bloquean, y el armado desde una captura.
- **`lib/inversiones/seguimiento.ts`**: las "Novedades" de Mis inversiones.

## Cómo se ve (decisiones de producto)

- **La lista de inversiones muestra todas** y marca con un cartelito verde "Recomendado" las que hoy
  convienen. Arriba, la persona puede decir cuánto quiere invertir y en cuánto tiempo lo quiere sacar
  (o elegir directo una inversión). El monto y el plazo cambian qué se recomienda (por ejemplo, con
  $10.000 un CEDEAR no alcanza).
- **Al tocar una inversión empieza el flujo** (`FlujoInversion.tsx`): "Aprendé en 2 minutos" (4 pantallas:
  la primera es el **glosario necesario**, después qué es / cuánto rinde / cuándo la sacás) → dónde hacerlo (las opciones una al lado de la otra, con un mini
  comentario sólo si las distingue) → con cuánto empezar → los pasos numerados, que se pueden recorrer
  para adelante y para atrás.
- **Lo que se decide al empezar es lo mismo que se pregunta al registrar** (`lib/inversiones/limites.ts`
  y `previosParaRegistro` en `guias.ts`): cuenta y fondo piden un monto; plazo fijo, monto y días;
  CEDEAR, cuál y cuántos (se compran enteros, con su precio y mínimo); dólar, pesos o dólares. El
  registro llega ya completado y la persona sólo corrige lo que salió distinto. Los tickers, fondos y
  bancos son listas predeterminadas; los campos numéricos no aceptan letras; cada monto dice en qué
  moneda es y su mínimo/máximo.
- **El texto fijo** de cada inversión vive en `lib/inversiones/catalogo.ts`; **el "cuánto rinde"** (porcentaje
  + un ejemplo con plata) se arma con datos de hoy en `lib/inversiones/rinde.ts`. Toda palabra técnica lleva
  su aclaración entre paréntesis y está en el glosario.
- **Un proveedor que hoy rinde menos que la inflación no se ofrece** si hay otro que no (hoy Mercado
  Pago y Naranja X quedan afuera de "cuenta remunerada").
- **Se recomienda sólo lo conocido**: cuenta remunerada, fondo común (money market), plazo fijo (y UVA),
  dólar y CEDEARs. Las letras del Tesoro siguen en el motor pero no se ofrecen.
- **Si no se sabe cuánto le sobra a la persona, no se dice nada.**
- **Las novedades viven dentro de cada inversión** ("Mis inversiones" → tocar una): qué pasa hoy con esa
  inversión, novedades (vencimientos, cuánto va ganando), y **noticias del día** (`/api/noticias`).
  Arriba, cómo se reparte la plata y un recordatorio de que la evolución día a día se ve en la app de
  cada proveedor.
- **Cerrar o borrar una inversión** pide confirmación y se puede deshacer unos segundos.
- En Mercado Pago el rendimiento está en **Inversiones → Mercado Fondo**, no en "Reservas" (que no rinde).

## Noticias

`api/noticias.ts` baja los titulares de Ámbito, Infobae, iProfesional y BBC Mundo (RSS públicos), se
queda con los que tienen que ver con cada tipo de inversión (o con algo que mueve a todas, como una
guerra o el petróleo) y, si hay `ANTHROPIC_API_KEY`, un modelo elige hasta 3 y las explica en una o dos
frases. Reglas: sólo se apoya en el titular, no da órdenes ni promete qué va a pasar, y cada explicación
se revisa en código. Cada noticia lleva su fuente y enlace. Sin clave, muestra sólo los titulares
relevantes con su enlace. Se cachea 30 minutos por tipo. **La parte con el modelo no se pudo probar sin
la clave.**

## Calidad de los datos: chequeos, alertas y tests

**Dos fuentes para cada dato crítico** (`api/_mercado/chequeos.ts`): el dólar contra Bluelytics, la
inflación contra el INDEC publicado en datos.gob.ar, los precios de CEDEARs (BYMA) contra otra fuente,
las tasas de plazo fijo contra el promedio del BCRA, y que cada tasa sea verosímil y no esté vieja.
Una alerta **grave** (dos fuentes que discrepan mucho) saca de las recomendaciones lo que depende de ese
dato; un **aviso** sólo se registra. En inflación, si las fuentes difieren se usa la más alta.

**Dónde te avisa** (`api/_mercado/alertas.ts`): una notificación en tu celular o compu (la misma
tecnología que ya usa la app), una vez por día y por dato. Para activarla hay que definir en Vercel
`ALERTAS_USER_ID` con tu id de usuaria (Supabase → Authentication → Users) y tener las notificaciones
activadas en la app. Además quedan anotadas en `data_alerts` (migración 0040) y se ven en
`/api/estado-datos?clave=<CRON_SECRET>`, que arma todo de cero y muestra qué fuentes respondieron y
cuán fresco está cada dato.

**Billeteras y fondos: lo declaran las personas.** No tienen API pública con su tasa, así que el dato real es
lo que cada persona ve en su app. Se anota cuando registra una inversión o desde el paso a paso ("¿Qué tasa te
muestra la app?"), en `declared_rates` (migración 0041). Se usa la **mediana de los últimos 7 días, sólo si
declararon al menos 3 personas distintas** (`lib/inversiones/declaradas.ts`): como respaldo cuando la tasa
publicada falta o está vieja, y como chequeo (si lo declarado se aleja de lo publicado, te llega un aviso).

**Cuando un dato falla, la persona sólo ve "Hubo un error al traer los datos. Probá de nuevo más tarde."**, con
un botón para reintentar. No se le cuenta qué fuente falló ni se le muestra nada a medias
(`lib/inversiones/estadoDatos.ts`). Las fuentes opcionales (S&P 500, índices por rubro, letras, riesgo país)
no bloquean. El detalle queda en los logs de Vercel, en `data_alerts` y te llega por notificación.

**Cada recomendación queda registrada** (sin datos personales): junto con la foto diaria de mercado se
guarda qué se habría recomendado hoy a cada perfil (`recomendadoHoy` en `market_snapshots`). Dentro de
un mes se puede mirar qué pasó con eso.

**Inflación personal** (`lib/inversiones/inflacionPersonal.ts`, `ipc.ts`): con las secciones donde la
persona registra sus gastos, su zona (CABA/GBA o resto del país) y los índices del INDEC por rubro. Se
muestra como estimado y, si es más alta que la oficial, contra esa se compara lo que se recomienda.

**Tests** (sin dependencias nuevas):
- `npm run test:inversiones` — 119 tests de cálculos, reglas y textos, sin red.
- `npm run verificar:datos` — 22 verificaciones con los datos reales de hoy: que cada fuente responda,
  que los números sean verosímiles, que las fuentes coincidan, y que nuestras cuentas den igual que
  hechas aparte.
- `npm run backtest:inversiones` — mira cómo le habría ido a la regla en el pasado (31 meses). Con
  `BACKTEST_DESDE=2025-04` se acota al período más parecido a hoy.

## Fuentes (verificadas el 21/10/2026)

| Dato | Fuente | Nota |
| --- | --- | --- |
| Inflación mensual, UVA, plazo fijo por banco, cuentas de billeteras, letras, riesgo país, fondos | ArgentinaDatos | API **comunitaria**, no oficial |
| TAMAR, BADLAR, inflación esperada (REM) | BCRA, API de estadísticas **v4** | La v3 fue dada de baja (410) |
| Dólar | DolarAPI | |
| Precios de CEDEARs | BYMA Open Data (oficial); data912 sólo como segunda fuente | |
| Índices del INDEC por rubro y región, e inflación oficial (segunda fuente) | datos.gob.ar | oficial; va un mes atrasada |
| Dólar (segunda fuente) | Bluelytics | |
| S&P 500 en dólares, historia de 10 años | Yahoo Finance | **no oficial** |
| Noticias | RSS de Ámbito, Infobae, iProfesional, BBC Mundo | titulares públicos |

CAFCI bloquea las consultas automáticas (403). El histórico por fecha de ArgentinaDatos
trae sólo algunos fondos, no los nuestros. Por eso el rendimiento de 7 y 30 días de los
fondos lo arma FINA con sus propias fotos diarias (ver abajo); mientras no haya historia
se usa "ayer contra hoy" con un rango ancho.

## Para dejarlo andando

1. Correr en el SQL Editor de Supabase, en orden: `0039_inversiones_guiadas.sql`, `0040_alertas_de_datos.sql` y `0041_tasas_declaradas.sql`.
   Sin eso la app anda, pero registrar una inversión específica avisa que falta la base, y
   el avance del paso a paso queda sólo en el dispositivo.
2. En Vercel, definir `SUPABASE_SERVICE_ROLE_KEY` para que `/api/mercado` guarde una foto
   por día en `market_snapshots`. Sin esa variable anda igual, pero no hay historia de 7 y
   30 días de los fondos ni respaldo entre reinicios. Se usa service_role a propósito: si
   cualquiera pudiera escribir esa tabla podría envenenar el respaldo.
3. `ANTHROPIC_API_KEY` ya existe (la usa `/api/recomendaciones`); `/api/leer-captura` usa la misma.
4. En local, `npm run dev` ahora sirve `/api/mercado` (plugin en `vite.config.ts`, sólo dev).

## Hay que verificar a mano

- **Los paso a paso** se escribieron con información pública y NO se pudieron probar abriendo
  cada app. Cada guía lista en `porVerificar` (en `guias.ts`) lo que hay que confirmar.
- Que el rendimiento de la cuenta de Mercado Pago venga del fondo Mercado Fondo.
- La lectura de capturas con capturas reales de cada app.

## Pendiente

Ver el cierre de la conversación en la que se armó: avisos fuera de la app (WhatsApp/push),
conexión con Objetivos, más proveedores y fondos, y la revisión legal (CNV).

## Cuántas recomendaciones y con qué criterio

- Se marcan **entre 2 y 3** (`MIN_RECOMENDADAS` / `MAX_RECOMENDADAS` en `motor.ts`), siempre la mejor de cada rol (caja, ahorro, crecimiento).
- **Desde 24 meses de plazo se compara lo que rinde cada opción al año** (real, sobre la inflación): las que pagan tasa o UVA con su rendimiento real de hoy, los CEDEARs con lo que rindió el S&P 500 en 10 años (dato histórico, no promesa), el dólar no se compara. Si hay al menos tres comparables y una rinde más de 1,5 puntos por año menos que la segunda mejor, **no se recomienda** y dice por qué.
- Con plazo largo y colchón armado, la **caja** (cuenta para tener plata a mano) no entra por ser "la caja". Si todavía no hay colchón, sigue.
- Sólo se compara lo que está en el catálogo. Lo que el mercado usa y hoy no está (obligaciones negociables, bonos CER, fondos de renta fija o CER, acciones) necesita fuente de datos y revisión de un asesor.
