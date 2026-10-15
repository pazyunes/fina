# FINA, backlog de deuda y cambios

Lista viva de lo que hay que hacer. Cada ítem tiene un id para nombrarlo en commits y charlas. Estados: pendiente, a definir (falta decidir qué hacer antes de tocar código), en curso, hecho. Al terminar algo se cambia el estado acá en el mismo commit.

El objetivo que ordena las prioridades: que la persona primero entienda su situación financiera y después la mejore. Se trabaja en ramas (hoy `juaniBranch`), nunca en `main`, y cada push de la rama arma una preview en Vercel.

| Id | Área | Qué | Estado |
| --- | --- | --- | --- |
| B1 | Bug | Las recomendaciones de la IA nunca recibían el dólar: `api/recomendaciones.ts` ordenaba `exchange_rates` por `created_at`, que no existe. Ahora usa `fetched_at`. | hecho |
| B2 | Bug | Después de un error de guardado la app dejaba de traer lo cargado por WhatsApp hasta reintentar. Ahora el freno mira si hay escrituras en cola, no el cartel (`AlmacenProvider.tsx`). | hecho |
| B3 | Bug | Borrar un gasto o ingreso cuando fallaba la lectura previa lo borraba igual y no ajustaba el saldo. Ahora corta (`api/v2/index.ts`). | hecho |
| B4 | Bug | Un gasto con un medio de pago nuevo creaba el medio en la base pero no en pantalla. Ahora se crea en los dos lados (`ajustarMedio` en `acciones.ts`). | hecho |
| B5 | Bug | Editar un aporte en dólares sin cotización lo guardaba en pesos sin avisar, y nunca guardaba el id de la cotización. Ahora convierte igual que el alta y avisa si falta el dólar. | hecho |
| B6 | Regla 6 | Inversiones hacía `fetch` del dólar desde `lib/exchangeRate.ts`. Ahora usa `api/v2/cotizacion.ts`. `lib/exchangeRate.ts` se borra junto con la v1 (L1), porque `Main.tsx` todavía lo importa. | hecho |
| B7 | Bug | La pantalla de prueba de Fini (`/onboarding-v2/fini`) era pública en producción. Ahora sólo existe en `npm run dev`. | hecho |
| S1 | Seguridad (migración) | Cualquiera con la clave pública puede insertar una cotización falsa en `exchange_rates` (policy de 0001). Sacar el insert anónimo y que `api/dolar.ts` escriba con service role. | pendiente |
| S2 | Seguridad (migración) | En `group_members` un miembro puede cambiarse `role` y `activity` (0022). Bloquear esas columnas y que la actividad sume por RPC atómica (hoy `sumarActividad` lee y escribe, y se pisan). | pendiente |
| S3 | Seguridad (migración) | Los splits de gastos de grupo no validan que `user_id` sea miembro del grupo. | pendiente |
| S4 | Seguridad (migración) | `unirse_a_grupo` no tiene límite de intentos y el código es adivinable. | pendiente |
| S5 | Base | `feedback` no tiene policy de UPDATE; faltan policies de DELETE en varias tablas (pensar en borrar cuenta). | pendiente |
| D1 | Datos | Guardados a medias: `registrarGasto`, `editarGasto`, `crearObjetivo`, `sumarContribucion` y `sumarAporte` no deshacen el cambio en pantalla si falla; un gasto insertado con `mover_saldo` fallido no se revierte. | pendiente |
| D2 | Datos | Una sección nueva queda con slug vacío en pantalla hasta recargar (`crearSeccion`). | pendiente |
| L1 | Limpieza | Borrar la v1 muerta (`Main.tsx` y unos 45 archivos, `lib/reports.ts`, `lib/exchangeRate.ts`, `utils/*`) y la consulta a `reports` en cada login (`lib/auth.tsx`). | pendiente |
| L2 | Limpieza | Dependencias sin uso en `package.json` (MUI, emotion, react-dnd, react-slick y otras) y el nombre `@figma/my-make-file`. | pendiente |
| L3 | Diseño | Tres paletas que no coinciden: `frontend.md`, `tokens.css` y `COLORS` en `onboarding-v2/shared.tsx`. Decidir una con diseño. | a definir |
| L4 | Docs | Reescribir `RESUMEN-CHAT.md` para la v2; `.env.example` con las 8 variables; actualizar `supabase/borrar-todos-los-usuarios.sql`; sumar `balance_loads` a `docs/bot-ingresos.md`; corregir `supabase/README-migraciones-v2.md`. | pendiente |
| L5 | Docs | Que el prompt de la IA (`api/_recomendaciones/prompt.ts`) pida la regla de Formato. | pendiente |
| G1 | General | Más jerarquía visual: que cada pantalla lleve la vista a un lugar puntual. Menos letra chica. | a definir |
| G2 | General | Quitar los subtítulos que explican lo que el título debería decir, en todas las pantallas. | pendiente |
| I1 | Inicio, paso del día | Hoy sale de una lista fija de 10 pasos (`api/v2/pasos.ts`) que rota por día; la IA sólo elige entre esos. Que se basen en la situación de la persona, que varíen y que mejoren con el tiempo. | a definir |
| I2 | Inicio, paso del día | Registrar el gasto como recordatorio fijo, con notificación, en vez de ser un paso más. | a definir |
| I3 | Inicio, paso del día | Acortar o sacar la explicación de cómo registrar un gasto. | pendiente |
| I4 | Inicio | Agrandar el fueguito de racha (hoy 16px en `HomeV2.tsx`). | pendiente |
| I5 | Inicio, gráficos | Entra y sale se sale de la pantalla en celulares (6 columnas de 44px mínimo en `IngresosVsGastos.tsx`) y muestra meses vacíos. Mostrar sólo meses con datos y un título que se entienda solo. | pendiente |
| I6 | Inicio, gráficos | Sacar el gráfico Por día. | pendiente |
| I7 | Inicio, objetivos | Los objetivos quedan en el aire: hoy sólo hay un anillo en el carrusel. Recordar que guardes, mostrar qué acción te acerca y avisar plazos (quedan 3 meses y no juntaste nada). Hoy no existe ningún aviso de plazo, ni en la app ni en `api/notificaciones.ts`. | a definir |
| I8 | Inicio | Sacar Tu plata guardada y su botón. | pendiente |
| I9 | Inicio | Sacar Mis competencias hasta diseñar cómo se compite y cuál es el premio. | pendiente |
| I10 | Inicio, recomendación | Se tacha pero no es una tarea (y no se puede destachar). Pasarla a un mensaje simple debajo de las visualizaciones. | pendiente |
| I11 | Inicio | Sumá FINA a tu pantalla de inicio queda, sin subtítulo. | pendiente |
| P1 | Perfil | El nombre está siempre en modo edición. Mostrarlo como texto con un botón Editar. | pendiente |
| GA1 | Gastos | Mucha letra chica. Mostrar menos y usar Ver todos al estilo Mercado Pago (las secciones expandidas no tienen límite). | a definir |
| GA2 | Gastos | Sacar el gráfico de dinero disponible y los medios de pago. Revisar de dónde sale el disponible si se van los medios. | a definir |
| O1 | Objetivos | La pantalla no dice nada. Volver a traer próximos pasos y formas de llegar antes; la lógica vieja está en `utils/goalStrategies.ts` y se puede reusar. | a definir |
| IN1 | Inversiones | Tiene potencial. Bajar la letra chica. | a definir |
| R1 | Retención | Si la persona no tiene nada para hacer, la app no le da nada. Mantener la racha, mejorar las tareas y pensar un juego o actividad para quien quiera quedarse. | a definir |
