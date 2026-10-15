# FINA, backlog de deuda y cambios

Lista viva de lo que hay que hacer, ordenada por tipo y, dentro de cada tipo, por prioridad. El orden de los tipos es el orden en que se atacan: primero lo que pone en riesgo los datos o la plata de la gente, después lo que hace que la app cumpla su objetivo, después cómo se ve, y al final la limpieza.

El objetivo que ordena todo: que la persona primero entienda su situación financiera y después la mejore. Se trabaja en ramas (hoy `juaniBranch`), nunca en `main`, y cada push de la rama arma una preview en Vercel.

Prioridad: alta (lo próximo que se hace), media (después de las altas de su tipo), baja (cuando haya lugar). Estado: pendiente, a definir (falta decidir qué hacer antes de tocar código), en curso, hecho. Cada ítem conserva su id para nombrarlo en commits y charlas; al terminar uno se pasa a la tabla de hechos en el mismo commit.

## 1. Seguridad

Necesitan una migración SQL que se corre a mano en Supabase.

| Id | Prioridad | Qué | Estado |
| --- | --- | --- | --- |
| S1 | alta | Cualquiera con la clave pública puede insertar una cotización falsa en `exchange_rates` (policy de 0001), y todos los gastos en dólares se guardarían con ese valor. Sacar el insert anónimo y que `api/dolar.ts` escriba con service role. | pendiente |
| S2 | media | En `group_members` un miembro puede cambiarse `role` y `activity` (0022). Bloquear esas columnas y que la actividad sume por RPC atómica (hoy `sumarActividad` lee y escribe, y se pisan). | pendiente |
| S3 | media | Los splits de gastos de grupo no validan que `user_id` sea miembro del grupo. | pendiente |
| S4 | baja | `unirse_a_grupo` no tiene límite de intentos y el código es adivinable. Baja mientras los grupos estén ocultos (I9). | pendiente |
| S5 | baja | `feedback` no tiene policy de UPDATE; faltan policies de DELETE en varias tablas (pensar en borrar cuenta). | pendiente |

## 2. Funcionalidad

Lo que hace que los datos sean confiables y que la app ayude a mejorar la situación de la persona.

| Id | Prioridad | Qué | Estado |
| --- | --- | --- | --- |
| D1 | alta | Guardados a medias: `registrarGasto`, `editarGasto`, `crearObjetivo`, `sumarContribucion` y `sumarAporte` no deshacen el cambio en pantalla si falla; un gasto insertado con `mover_saldo` fallido no se revierte. La persona ve un número que la base no tiene. | pendiente |
| I7 | alta | Inicio, objetivos: hoy sólo hay un anillo en el carrusel. Recordar que guardes, mostrar qué acción te acerca y avisar plazos (quedan 3 meses y no juntaste nada). No existe ningún aviso de plazo, ni en la app ni en `api/notificaciones.ts`. | a definir |
| O1 | alta | Objetivos: la pantalla no dice nada. Volver a traer próximos pasos y formas de llegar antes; la lógica vieja está en `utils/goalStrategies.ts` y se puede reusar. | a definir |
| I1 | alta | Inicio, paso del día: hoy sale de una lista fija de 10 pasos (`api/v2/pasos.ts`) que rota por día; la IA sólo elige entre esos. Que se basen en la situación de la persona, que varíen y que mejoren con el tiempo. | a definir |
| I2 | media | Registrar el gasto como recordatorio fijo, con notificación, en vez de ser un paso más. | a definir |
| GA2 | media | Gastos: sacar el gráfico de dinero disponible y los medios de pago. Antes hay que decidir de dónde sale el disponible si se van los medios. | a definir |
| R1 | media | Retención: si la persona no tiene nada para hacer, la app no le da nada. Mantener la racha, mejorar las tareas y pensar un juego o actividad para quien quiera quedarse. | a definir |
| I10 | media | Inicio, recomendación: se tacha pero no es una tarea (y no se puede destachar). Pasarla a un mensaje simple debajo de las visualizaciones. | pendiente |
| D2 | baja | Una sección nueva queda con slug vacío en pantalla hasta recargar (`crearSeccion`). | pendiente |

## 3. Diseño

Jerarquía, cantidad de texto y detalles visuales.

| Id | Prioridad | Qué | Estado |
| --- | --- | --- | --- |
| I5 | alta | Inicio, gráficos: Entra y sale se sale de la pantalla en celulares (6 columnas de 44px mínimo en `IngresosVsGastos.tsx`) y muestra meses vacíos. Mostrar sólo meses con datos y un título que se entienda solo. | pendiente |
| G1 | alta | Más jerarquía visual: que cada pantalla lleve la vista a un lugar puntual. Menos letra chica. | a definir |
| G2 | alta | Quitar los subtítulos que explican lo que el título debería decir, en todas las pantallas. | pendiente |
| I8 | media | Inicio: sacar Tu plata guardada y su botón. | pendiente |
| I9 | media | Inicio: sacar Mis competencias hasta diseñar cómo se compite y cuál es el premio. | pendiente |
| I6 | media | Inicio, gráficos: sacar el gráfico Por día. | pendiente |
| GA1 | media | Gastos: mucha letra chica. Mostrar menos y usar Ver todos al estilo Mercado Pago (las secciones expandidas no tienen límite). | a definir |
| L3 | media | Tres paletas que no coinciden: `frontend.md`, `tokens.css` y `COLORS` en `onboarding-v2/shared.tsx`. Decidir una con diseño. | a definir |
| I3 | baja | Inicio, paso del día: acortar o sacar la explicación de cómo registrar un gasto. | pendiente |
| I4 | baja | Inicio: agrandar el fueguito de racha (hoy 16px en `HomeV2.tsx`). | pendiente |
| I11 | baja | Inicio: Sumá FINA a tu pantalla de inicio queda, sin subtítulo. | pendiente |
| P1 | baja | Perfil: el nombre está siempre en modo edición. Mostrarlo como texto con un botón Editar. | pendiente |
| IN1 | baja | Inversiones: tiene potencial. Bajar la letra chica. | a definir |

## 4. Limpieza y documentación

No cambian lo que ve la persona, pero bajan el riesgo de romper algo al tocar el código.

| Id | Prioridad | Qué | Estado |
| --- | --- | --- | --- |
| L1 | media | Borrar la v1 muerta (`Main.tsx` y unos 45 archivos, `lib/reports.ts`, `lib/exchangeRate.ts`, `utils/*` salvo lo que se reuse para O1) y la consulta a `reports` en cada login (`lib/auth.tsx`). | pendiente |
| L5 | media | Que el prompt de la IA (`api/_recomendaciones/prompt.ts`) pida la regla de Formato. | pendiente |
| L4 | baja | Reescribir `RESUMEN-CHAT.md` para la v2; `.env.example` con las 8 variables; actualizar `supabase/borrar-todos-los-usuarios.sql`; sumar `balance_loads` a `docs/bot-ingresos.md`; corregir `supabase/README-migraciones-v2.md`. | pendiente |
| L2 | baja | Dependencias sin uso en `package.json` (MUI, emotion, react-dnd, react-slick y otras) y el nombre `@figma/my-make-file`. | pendiente |

## Hechos

| Id | Tipo | Qué | Commit |
| --- | --- | --- | --- |
| B1 | Funcionalidad | Las recomendaciones de la IA nunca recibían el dólar: `api/recomendaciones.ts` ordenaba `exchange_rates` por `created_at`, que no existe. Ahora usa `fetched_at`. | f2addc5 |
| B2 | Funcionalidad | Después de un error de guardado la app dejaba de traer lo cargado por WhatsApp hasta reintentar. Ahora el freno mira si hay escrituras en cola, no el cartel (`AlmacenProvider.tsx`). | f2addc5 |
| B3 | Funcionalidad | Borrar un gasto o ingreso cuando fallaba la lectura previa lo borraba igual y no ajustaba el saldo. Ahora corta (`api/v2/index.ts`). | f2addc5 |
| B4 | Funcionalidad | Un gasto con un medio de pago nuevo creaba el medio en la base pero no en pantalla. Ahora se crea en los dos lados (`ajustarMedio` en `acciones.ts`). | f2addc5 |
| B5 | Funcionalidad | Editar un aporte en dólares sin cotización lo guardaba en pesos sin avisar, y nunca guardaba el id de la cotización. Ahora convierte igual que el alta y avisa si falta el dólar. | f2addc5 |
| B6 | Limpieza | Inversiones hacía `fetch` del dólar desde `lib/exchangeRate.ts`. Ahora usa `api/v2/cotizacion.ts`. El archivo viejo se borra con L1. | f2addc5 |
| B7 | Seguridad | La pantalla de prueba de Fini (`/onboarding-v2/fini`) era pública en producción. Ahora sólo existe en `npm run dev`. | f2addc5 |
