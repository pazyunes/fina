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
- **`lib/inversiones/cartera.ts`**: cómo se reparte la plata según el **plazo** (en qué) y el
  **perfil** (cuánto). Ver "Criterio del asesor" abajo.
- **`lib/inversiones/cuanto.ts`**: cuánto invertir = todo lo que sobró el mes pasado, y si hay un
  gasto cercano que los ingresos no cubren (`hayGastoCercanoSinCubrir`).
- **`lib/inversiones/guias.ts`**: los pasos a paso (proveedor × producto) con datos de hoy.
- **`lib/inversiones/registro.ts`**: un formulario por tipo, con validaciones que avisan y
  no bloquean, y el armado desde una captura.
- **`lib/inversiones/seguimiento.ts`**: las "Novedades" de Mis inversiones.

## Cómo se ve (decisiones de producto)

- **La lista de inversiones muestra todas** y marca con un cartelito verde "Alternativa" las que hoy
  encajan, con la parte de la plata que le toca a cada una ("Para el 50% de tu plata"). Se habla de
  **alternativas**, no de recomendaciones (criterio legal del asesor). Arriba, la persona puede decir
  cuánto quiere invertir (arranca con lo que sobró el mes pasado) y en cuánto tiempo lo quiere sacar.
  El **plazo y el perfil** cambian qué se muestra; el **monto no** (sólo si un CEDEAR físicamente no alcanza).
- **Al tocar una inversión empieza el flujo** (`FlujoInversion.tsx`), de a una pantalla, sin deslizar:
  1. **"Aprendé en 2 minutos"** (`AprendeEn2Min.tsx`): glosario (sólo las palabras difíciles; la inversión se explica en "¿Qué es?") →
     qué es y dónde queda tu plata → cuánto rinde, riesgo y si puede bajar → **qué tenés que saber antes de invertir** (y cuándo conviene
     vender, en letras, bonos y CEDEARs) → cuándo la sacás y quién la garantiza. El título es fijo arriba; la flecha vuelve a la pantalla
     anterior y "Siguiente" está arriba. Al volver desde los pasos se cae en la **última** pantalla, no en la primera.
  2. **Los pasos** (`PasosGuia.tsx`, contenido en `guias.ts`): uno por pantalla, con círculos que se rellenan ("2/6"). El primero es **elegir
     dónde, ahí mismo** (sin pantalla aparte): un menú con los bancos o cuentas de mayor a menor tasa y el que la persona ya usa primero y
     marcado "recomendado", más "ya tengo cuenta / me tengo que crear" (si no tiene, se explica cómo, cuánto lleva y que es una sola vez).
     Cada paso dice sólo CÓMO se hace; no hay "qué lográs con esto". "Sabés que salió bien cuando…" va **sólo** en el paso donde termina la
     operación. Las elecciones (plazo, cuál CEDEAR y cuántos, cuántos dólares, la tasa) se hacen en su paso. El penúltimo es "Antes de finalizar"
     (cómo salir de la inversión) y el último es **anotarla en FINA, adentro del paso**.
  3. **Felicitaciones** al anotar. Si deja los pasos a la mitad queda **"Pendiente"** debajo de las alternativas (se retoma o se cancela).
- **El registro** (`FormularioRegistro.tsx`) es el mismo adentro del paso y suelto: lo ya elegido sale **apagado y bloqueado**; sólo se pide lo
  que no se puede saber de afuera (la tasa del plazo fijo y el extra de la UVA se traen solos cuando el banco los publica; el extra de UVA hoy
  sólo lo publica el Banco Nación). Cada dato dice "También lo encontrás como…" cuando se toca. Se puede subir una **captura o un PDF**
  (`api/leer-captura.ts` los lee con el modelo; el archivo no se guarda; un PDF pesa hasta ~3 MB).
- **Nada de números extremos** (`limites.ts`): hasta US$ 1.000.000 (en pesos, al MEP de hoy), TNA hasta 100%, extra UVA hasta 30%, comisión
  hasta 10%, plazo hasta 1095 días. Lo que pasa el tope no se puede ni escribir.
- **Cuenta remunerada**: ya no es sólo Ualá. Se elige entre todas las cuentas de los datos (Brubank, Naranja X, Mercado Pago, bancos…), de la
  que más rinde a la que menos, y se marca cuáles hoy rinden menos que la inflación (`entidades.ts`).
- **Pantalla de alternativas**: monto chico en pesos o dólares (se pasa al MEP) y plazo en un desplegable, en una línea; el aviso se puede cerrar
  con una ×; sólo se ven las alternativas sugeridas y el resto está detrás de "Ver más"; el perfil se explica sólo si se toca; sin descripciones
  ni "inflación personal" a la vista (igual se usa para comparar).
- **El texto fijo** de cada inversión vive en `lib/inversiones/catalogo.ts`; **el "cuánto rinde"** (porcentaje
  + un ejemplo con plata) se arma con datos de hoy en `lib/inversiones/rinde.ts`. Toda palabra técnica lleva
  su aclaración entre paréntesis y está en el glosario.
- **Un proveedor que hoy rinde menos que la inflación no se ofrece** si hay otro que no (hoy Mercado
  Pago y Naranja X quedan afuera de "cuenta remunerada").
- **Se ofrece**: cuenta remunerada, fondo común (money market), plazo fijo (y UVA), **letras del Tesoro**
  (en los mismos casos que el plazo fijo), dólar (sólo con un objetivo en dólares y el dólar bajo) y
  CEDEARs (los ~400 que operan hoy en BYMA; también se puede anotar una acción argentina).
- **Brokers**: Cocos, Balanz, IOL, Galicia Securities, PPI e IEB para letras, CEDEARs y dólar (los
  precios son los mismos en todos; cambian las comisiones). Los fondos siguen siendo sólo de Cocos y
  Balanz (cada broker tiene los suyos). Los pasos de los brokers nuevos son genéricos y están **por verificar**.
- **Si no se sabe cuánto le sobra a la persona, no se dice nada.**
- **Aviso legal** (`lib/inversiones/legal.ts`, `AvisoLegal.tsx`): "Todas las inversiones pueden generar pérdida de
  capital" y "FINA no garantiza ningún rendimiento", siempre visible en Inversiones, aunque llegue a haber matrícula.
- **"¿Puede bajar mi plata?"** en cada ficha (`puedeBajar` en el catálogo): plazo fijo, cuenta y money market no
  bajan; renta fija y variable sí.
- **Errores comunes a evitar** (comprar y vender seguido, comprar cuando sube y vender cuando cae, asustarse, no
  entender el riesgo, no hacer coincidir plazo e instrumento): cards de clase "Error común" y un aviso antes del
  paso a paso cuando lo elegido no encaja con el plazo dicho (`lib/inversiones/plazo.ts`).
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

## Criterio del asesor (reunión del 22/10/2026)

El plazo decide **en qué**; el perfil, **cuánto**; el monto, nada ("no guiarse por montos"). Cada tramo
arma partes de la plata, y en cada parte la persona elige una alternativa (`cartera.ts`):

Es la tabla armada con su criterio y revisada con Sofía el 23/10/2026. **"A mano"** = plazo fijo, cuenta remunerada y money market (y, a menos de 3 meses, letras cortas). **"Renta fija"** = letras, bonos CER y plazo fijo UVA, siempre con un vencimiento que coincida con el plazo. En cada parte se elige una alternativa.

| Perfil | Menos de 3 meses | 3 a 12 meses | 1 a 3 años | Más de 3 años |
|---|---|---|---|---|
| Conservador | 100% a mano (plazo fijo, cuenta, money market, letras cortas) | 70% a mano + 30% renta fija (letras, bonos CER hasta 12 meses, UVA) | 70% plazo fijo UVA + 30% bonos CER (1 a 3 años) | 80% renta fija (bonos CER de más de 3 años, UVA) + 20% CEDEARs |
| Moderado | 100% a mano | 50% a mano + 50% renta fija | 70% renta fija (UVA, bonos CER 1 a 3 años) + 30% CEDEARs | 50% renta fija + 50% CEDEARs |
| Arriesgado | 100% a mano | 30% a mano + 70% renta fija | 50% renta fija + 50% CEDEARs | 100% CEDEARs (ETF como SPY o QQQ de base) + cuenta como reserva opcional, sin porcentaje |

- **Nunca CEDEARs a menos de 1 año**, ni para el arriesgado: el plazo manda sobre el perfil (el perfil dice cuánto riesgo querés tomar; el plazo, cuánto podés). Esto corrige la tabla original, donde el arriesgado de 3 a 12 meses tenía 50% CEDEARs y contradecía su regla "menos de 1 año, CEDEARs no va". La escalera de CEDEARs es 0% / 30% / 50% (moderado) y 0% / 50% / 100% (arriesgado).
- **El vencimiento coincide con el plazo** (`ventanaDeVencimiento` en `cartera.ts`): a menos de 3 meses sólo letras de hasta 90 días; de 3 a 12 meses, letras y bonos que vencen antes del plazo; de 1 a 3 años, bonos de 1 a 3 años; a más de 3 años, bonos de 3 a ~5,5 años. Sin plazo dicho, la ventana es amplia y el arriesgado se trata como moderado.
- La **cuenta remunerada** no es renta fija: sirve para tener plata a mano, no para plazos de más de un año.
- Se muestran **todas** las alternativas de cada parte (no hay tope de dos o tres), y cada una dice qué parte le toca ("Para el 50% de tu plata · renta fija").
- Los **bonos CER** son un tipo nuevo de inversión registrable: hace falta correr la migración `0043_bonos_cer.sql`.
- Dentro de cada parte se ordena por lo que se espera que rinda **por año sobre la inflación** (`puntajeAnual`): el centro del rango a plazos cortos y, a más plazo (hasta 24 meses), la peor tasa; la UVA pierde peso por su rezago de ~3 meses; los CEDEARs, con lo que rindió el S&P 500 en 10 años en dólares (histórico, no promesa). **El tope de la cuenta ya no desplaza**: es un dato que se informa.
- Para ahorrar o fijar un plazo (UVA, renta fija), no se ofrece lo que pierde contra la inflación si hay otra opción igual de disponible que no. La plata a mano (plazo fijo, cuenta, fondo) se muestra completa aunque hoy rinda menos, con su aviso.
- Una parte sin datos (por ejemplo, sin CEDEARs) pasa su porcentaje a las demás.
- **Cuánto invertir**: todo lo que sobró el mes pasado, no un porcentaje ni tres meses de espera. Si además hay plata ahorrada, también se puede sumar.
- **Sin reserva por las dudas**: sólo si en los próximos 30 días hay gastos fijos que superan lo que ingresa por mes, se suma la mejor opción para tener plata disponible.
- **Dólar**: no es una inversión. Sólo aparece con un objetivo en dólares sin juntar y si el MEP subió menos que la inflación en el último mes ("bajo").
- **Comisión de CEDEARs**: es un % de lo operado, no pesos.
- **Fondos comunes**: al registrar se pide el tipo (money market, renta fija, renta variable, mixto). La tasa sólo se pide en el money market; renta fija o variable sube y baja.
- Sólo se compara lo que está en el catálogo. Lo que el mercado usa y hoy no está (obligaciones negociables, bonos CER, fondos de renta fija o CER) necesita fuente de datos.

### Seguro de depósitos, CAFCI, bonos y ONs (22/10/2026)

- **Seguro de depósitos**: $50.000.000 por persona y por banco, vigente desde el 01/04/2026 (Comunicación "A" 8407 del BCRA, 05/03/2026; verificado en el PDF de SEDESA). Está en una sola constante (`TOPE_SEGURO_DEPOSITOS`, `catalogo.ts`) que usan los textos del plazo fijo, el glosario y las cards. Si el BCRA lo actualiza, se cambia ahí.
- **CAFCI**: su API directa responde `403 "Route not allowed"` (bloqueo del servidor, no de headers; `api.cafci.org.ar` pide credenciales). Los datos de CAFCI ya llegan por **ArgentinaDatos** (es la misma fuente que usa comparatasas.ar) y es lo que usa la app: fondos de dinero, y también los de renta fija y variable existen ahí si hace falta sumarlos. dolarhoy.com no publica una API de fondos.
- **Bonos CER**: ArgentinaDatos publica `/v1/finanzas/bonos-cer` con precio y **TIR real** (lo que rinden sobre la inflación). Se estima su rendimiento como UVA 30 días + TIR, igual que el plazo fijo UVA. No se toman los que vencen en menos de 3 meses (la TIR es ruidosa) ni los de más de 2 años (para plazos de meses).
- **Obligaciones negociables**: no están. BYMA da el precio y el vencimiento pero no el cupón ni la TIR, y casi todas son en dólares; sin cupones no se puede calcular el rendimiento sin inventarlo. Hace falta una fuente que publique su TIR.

### Dudas que quedan para el asesor

- **Conservador a más de 3 años**: su tabla dice 10% CEDEARs y sus notas "70 y 30". Quedó en 20% (`PESO_CEDEAR`), el punto medio.
- **Arriesgado de 3 a 12 meses y 1 a 3 años**: ahí la tabla es de Sofía (30% a mano + 70% renta fija; 50/50), no de él; hay que mostrársela.
- **"Dólar bajo"**: hoy es "subió menos que la inflación en 30 días". Si él usa otra vara (brecha, promedio histórico), cambiarla en `dolarEstaBajo`.
- **Cuenta remunerada**: dijo que "depende de cada billetera" (condiciones de Ualá y compañía): hay que revisar billetera por billetera que el texto de las condiciones sea el correcto.
- **Modelo de negocio**: confirmó que cobrarle a las marcas "es el modelo correcto" (como dolarhoy.com, que está pautado). Pendiente decidir cómo se muestra lo pautado.
- **Legal**: sigue abierto el encuadre con la CNV ("tiene que estar filtrado por alguien matriculado").

## Mini lecciones (cards)

- Debajo de las alternativas: cards que se deslizan para el costado (se asoma la siguiente). 25 lecciones de cuatro clases: diferencias ("Diferencia entre TNA y TEA"), conceptos ("¿Qué es la inflación?"), mitos y errores comunes. Contenido en `lib/inversiones/aprender.ts`; los ejemplos con plata dicen "de juguete" y tienen test de cuentas.
- Cada una se marca con "Ya lo aprendí" (y se puede desmarcar). **Cada 5 aprendidas se completa una racha** (`rachaDeAprendizaje`). No está ligada a la racha diaria de pasos: ésa mide algo que se hace, y un botón la inflaría.
- **Máximo 5 por día** (`LIMITE_DIARIO`, día de Argentina): con 5 marcadas hoy, el botón dice "Mañana seguís"; ver y leer las cards no tiene límite. Desmarcar una de hoy libera un lugar. El límite se aplica en la app (no hay regla en la base): se cuenta con el día en que se marcó cada una (`learned_at`).
- Se guarda en el dispositivo siempre y en `learned_cards` (migración 0042) para que pase de un dispositivo a otro; sin la migración andan igual.
- El orden se arma al entrar (lo que se recomienda hoy y falta aprender, primero; lo aprendido, al final) y no cambia después.
