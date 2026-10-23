# FINA, backlog de deuda y cambios

Lista viva de lo que hay que hacer, ordenada por tipo y, dentro de cada tipo, por prioridad. El orden de los tipos es el orden en que se atacan: primero lo que pone en riesgo los datos o la plata de la gente, después lo que hace que la app cumpla su objetivo, después cómo se ve, y al final la limpieza.

El objetivo que ordena todo: que la persona primero entienda su situación financiera y después la mejore. Se trabaja en ramas (hoy `juaniBranch`), nunca en `main`, y cada push de la rama arma una preview en Vercel.

Prioridad: alta (lo próximo que se hace), media (después de las altas de su tipo), baja (cuando haya lugar). Estado: pendiente, a definir (falta decidir qué hacer antes de tocar código), en curso, a revisar (hecho con una propuesta que hay que validar en la preview), hecho. Cada ítem conserva su id para nombrarlo en commits y charlas; al terminar uno se pasa a la tabla de hechos en el mismo commit.

## Pasos manuales pendientes

Cosas que el código ya soporta pero que tiene que hacer una persona con acceso.

| Id | Qué | Estado |
| --- | --- | --- |
| M1 | Cargar `SUPABASE_SERVICE_ROLE_KEY` en Vercel (Production y Preview). Sin eso, cuando se corra 0039 la cotización del dólar deja de guardarse (se sigue mostrando, pero sin id). | pendiente |
| M2 | Correr a mano en Supabase, en orden: `supabase/migrations/0039_seguridad.sql`, `0040_movimientos_atomicos.sql` y `0041_reserva.sql` (después de M1). La app funciona igual sin ellas: usa el camino viejo hasta que existan. Sin la 0041 no sale el aviso de plazo de objetivos. | pendiente |
| M5 | Correr a mano en Supabase `supabase/migrations/0044_proximo_paso_y_racha.sql`, antes de mergear a main la rama `inicio-a-produccion`. Crea la tabla del próximo paso y cambia la racha a días con un gasto anotado desde el día en que se corre; los días anteriores se siguen contando con la regla vieja, así nadie ve cambiar su racha. La 0042 ya no toca la racha: correrla después no cambia nada. Para confirmar que se corrió: `select to_regclass('public.next_steps') is not null`. | a confirmar |
| M6 | Correr a mano en Supabase `supabase/migrations/0043_objetivos_y_gastos_que_vienen.sql` (después de la 0042). Separa los gastos que se vienen de los objetivos de ahorro. Sin ella, todo se lee como objetivo de ahorro y crear un gasto que se viene falla. | pendiente |
| M3 | Confirmar en Vercel que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están habilitadas para Preview. | hecho (All Environments) |
| M4 | Subir `juaniBranch` a GitHub (`git push -u origin juaniBranch`) desde una terminal donde GitHub pida login; desde la sesión de Claude no se puede iniciar sesión. Después, cada push actualiza la preview. | hecho |

## 1. Seguridad

Todo lo de seguridad conocido está resuelto en la migración 0039 (ver hechos); falta correrla (M2).

## 2. Funcionalidad

| Id | Prioridad | Qué | Estado |
| --- | --- | --- | --- |
| I7 | alta | Inicio, objetivos: bloque Tus objetivos en Inicio (el más relevante, cuánto avanzó esta semana, aviso de plazo con salida en rango y un botón) y notificación de plazo a los 90, 30 y 7 días, una vez por semana como mucho. Propuesta hecha: validar en la preview. | a revisar |
| O1 | alta | Objetivos: Próximo paso y Formas de llegar antes (hasta 3, con tus secciones, gastos fijos y ritmo; impacto en tiempo como rango). Propuesta hecha: validar en la preview. | a revisar |
| I1 | alta | Paso del día personalizado: pasos que nombran tu sección u objetivo, tres niveles que se desbloquean con los días de uso (5 y 15), sin repetir en 7 días. La IA elige entre esos. Propuesta hecha: validar. | a revisar |
| I2 | media | Registrar gastos es un recordatorio fijo en Inicio (¿Anotaste lo de hoy?, se oculta cuando ya hay un gasto hoy) y la notificación de la tarde lo prioriza. Ya no es un paso del día. | a revisar |
| R1 | media | Pregunta del día: 35 preguntas de plata para Argentina, una por día, con explicación y conteo de aciertos. No suma a la racha. Se guarda sólo en el navegador. | a revisar |
| R2 | baja | Si R1 funciona, guardar las respuestas de la pregunta del día en la base (hoy en localStorage) y pensar si suma a la racha. | a definir |
| O2 | baja | Formas de llegar antes no tiene ¿Te sirvió?; sumarlo para aprender qué opciones sirven. | pendiente |
| I13 | baja | Paso Anotá lo que te entró este mes: lleva a Gastos pero no abre el formulario de ingreso (no tiene acción para abrirlo). | pendiente |
| D4 | media | Editar sólo el monto de un gasto en dólares no actualiza `original_amount`: `editarGasto` en `acciones.ts` manda la moneda sólo si cambió la moneda. | pendiente |
| D2 | baja | Una sección nueva queda con slug vacío en pantalla hasta recargar (`crearSeccion`). | pendiente |

## 3. Diseño

| Id | Prioridad | Qué | Estado |
| --- | --- | --- | --- |
| G2 | baja | Sin subtítulos explicativos: hecho en todas las pantallas principales; falta revisar `VerificarTelefono`, `AvisosFina` y el onboarding. | pendiente |
| L3b | baja | Confirmar con diseño la variante de texto del lila: hoy `--fina-lila-texto` apunta al violeta oscuro porque `COLORS` no tenía una propia. | a revisar |

## 4. Limpieza y documentación

| Id | Prioridad | Qué | Estado |
| --- | --- | --- | --- |
| L7 | baja | El bundle pesa unos 900 kB (avisa el build). Partir por pantalla con import dinámico. | pendiente |

## Hechos

| Id | Tipo | Qué | Commit |
| --- | --- | --- | --- |
| B1 | Funcionalidad | Las recomendaciones de la IA nunca recibían el dólar: `api/recomendaciones.ts` ordenaba `exchange_rates` por `created_at`, que no existe. Ahora usa `fetched_at`. | f2addc5 |
| B2 | Funcionalidad | Después de un error de guardado la app dejaba de traer lo cargado por WhatsApp hasta reintentar. Ahora el freno mira si hay escrituras en cola, no el cartel (`AlmacenProvider.tsx`). | f2addc5 |
| B3 | Funcionalidad | Borrar un gasto o ingreso cuando fallaba la lectura previa lo borraba igual y no ajustaba el saldo. Ahora corta (`api/v2/index.ts`). | f2addc5 |
| B4 | Funcionalidad | Un gasto con un medio de pago nuevo creaba el medio en la base pero no en pantalla. Ahora se crea en los dos lados (`ajustarMedio` en `acciones.ts`). | f2addc5 |
| B5 | Funcionalidad | Editar un aporte en dólares sin cotización lo guardaba en pesos sin avisar, y nunca guardaba el id de la cotización. Ahora convierte igual que el alta y avisa si falta el dólar. | f2addc5 |
| B6 | Limpieza | Inversiones hacía `fetch` del dólar desde `lib/exchangeRate.ts`. Ahora usa `api/v2/cotizacion.ts`. | f2addc5 |
| B7 | Seguridad | La pantalla de prueba de Fini (`/onboarding-v2/fini`) era pública en producción. Ahora sólo existe en `npm run dev`. | f2addc5 |
| I3 | Diseño | Inicio, paso del día: sin bajada. Queda Tu paso de hoy, el título del paso y el botón. | Inicio: más limpio |
| I4 | Diseño | Inicio: fueguito de racha de 16 a 28px y número de 20 a 26px. | Inicio: más limpio |
| I5 | Diseño | Inicio: el gráfico de ingresos y gastos ya no se sale de la pantalla, arranca en el primer mes con datos y se llama Ingresos y gastos por mes. Te pasaste por pasó a Salió de más. | Inicio: más limpio |
| I6 | Diseño | Inicio: se sacó el gráfico Por día. | Inicio: más limpio |
| I8 | Diseño | Inicio: se sacó Tu plata guardada; Completá tu perfil queda solo. Ver I12. | Inicio: más limpio |
| I9 | Diseño | Inicio: se sacó Mis competencias. | Inicio: más limpio |
| I10 | Funcionalidad | Inicio: la recomendación ya no se tacha; es un mensaje debajo de los gráficos. | Inicio: más limpio |
| I11 | Diseño | Inicio: Sumá FINA a tu pantalla de inicio (y el aviso de vencimientos) sin bajada. En el onboarding la explicación queda. | Inicio: más limpio |
| D1 | Funcionalidad | Guardados a medias: en la base, si falla el saldo se deshace lo hecho; en pantalla, las acciones vuelven atrás si la base no guardó. | D1 y P1 |
| P1 | Diseño | Perfil: el nombre se ve como texto con un botón Editar. | D1 y P1 |
| T1 | Diseño | Una sola familia tipográfica: Poppins en toda la app. | Tipografía única |
| S1 | Seguridad | 0039: sin insert anónimo en `exchange_rates`; `api/dolar.ts` escribe con service role (M1). | Etapa 1 |
| S2 | Seguridad | 0039: un miembro ya no puede cambiarse `role` ni `activity`; la actividad suma por la RPC atómica `sumar_actividad`. También se cerró que cualquiera con el id de un grupo pudiera entrar sin código y como dueño. | Etapa 1 |
| S3 | Seguridad | 0039: un split de gasto de grupo sólo puede ser de un miembro del grupo. | Etapa 1 |
| S4 | Seguridad | 0039: `unirse_a_grupo` corta después de 10 códigos fallidos por hora. | Etapa 1 |
| S5 | Seguridad | 0039: policy de UPDATE en `feedback` y de DELETE propias en las tablas que no tenían. | Etapa 1 |
| D3 | Funcionalidad | 0040: registrar, editar y borrar gasto o ingreso en una sola transacción de la base. Mientras 0040 no esté corrida, la app usa el camino viejo, que ahora deshace lo hecho también al editar un ingreso y al borrar. | Etapa 1 |
| L1 | Limpieza | Se borró la v1: 109 archivos (Main.tsx, 47 componentes, 47 de `components/ui`, libs y utils sin uso) y la consulta a `reports` en cada login. | Etapa 1 |
| L2 | Limpieza | Dependencias: quedan 11; se fueron MUI, emotion, radix, recharts y otras. El paquete se llama `fina` y react está en dependencies. | Etapa 1 |
| L3 | Diseño | Una paleta: `tokens.css` es espejo de `COLORS` (lo que pinta la app); gastos neutrales, sin rojo; sin hex en `theme.css`; `frontend.md` §3.3 y §4 documentan lo real. | Etapa 1 |
| L4 | Docs | `RESUMEN-CHAT.md` reescrito para la v2; `.env.example` con las 8 variables; script de borrado con transacción; `balance_loads` en `docs/bot-ingresos.md`; README de migraciones al día. | Etapa 1 |
| GA1 | Diseño | Gastos: listas de hasta 5 con Ver todos (`VerTodos.tsx`); nada importante debajo de 14px. | Etapa 1 |
| GA2 | Diseño | Gastos: el dinero disponible es el dato principal, grande y arriba; salen la torta y los medios de pago. Los medios se editan y unen desde Perfil (`MediosDePago.tsx`). | Etapa 1 |
| G1 | Diseño | Jerarquía: Gastos lleva al disponible, Inversiones a la recomendación para tu perfil, Perfil a tu foto y nombre. Una sola tarjeta elevada por pantalla. | Etapa 1 |
| IN1 | Diseño | Inversiones: menos letra chica; lo proyectado se muestra como rango estimado, no como número exacto. | Etapa 1 |
| GA3 | Diseño | El tipo de gasto Impulsivo se muestra como Gusto (el valor guardado no cambia). | Etapa 1 |
| I12 | Funcionalidad | La reserva vuelve como Plata apartada arriba de Objetivos, guardada en la base (`user_profiles.reserve_ars`, ya existía desde 0023), con sumar y sacar. | Etapa 2 |
| G3 | Diseño | Sin etiquetas en mayúsculas en las pantallas de la v2. | Etapa 2 |
| L5 | Docs | El prompt de la IA pide la regla de Formato y `tono.ts` limpia guiones largos, comillas rizadas y emojis de lo generado. | Etapa 2 |
| L6 | Limpieza | `goalStrategies.ts` reescrito para la v2 (lo usan Objetivos, Inicio y el aviso de plazo); se borró `types.ts` de la v1. | Etapa 2 |
| F1 | Docs | Textos visibles sin guiones largos (onboarding, entrar, avisos). | Etapa 2 |
| GA4 | Funcionalidad | Gastos, gráfico principal: un anillo con lo que te entró en el período repartido en secciones y, en lima, lo que te queda (el disponible, que se arma solo con lo que registrás). Sin entradas registradas, muestra sólo cómo se reparten tus gastos y ofrece sumar lo que te entró. | Gastos: anillo y medios |
| C1 | Diseño | Sale "según lo que nos contaste" de toda la app: el estado declarado ya no lleva marca visible (guía §5.1). | Ajustes de la preview 1 |
| C2 | Diseño | La invitación a avisos dice ¿Querés que FINA te mande recordatorios y avisos? | Ajustes de la preview 1 |
| C3 | Funcionalidad | La pregunta del día es un botón pegado al paso del día que abre un panel; la primera vez del día se abre sola, con Ahora no. Ya no ocupa Inicio. | Ajustes de la preview 1 |
| C4 | Diseño | Regla nueva: Inicio es un tablero de entradas (CLAUDE.md 9 y guía §3.5). El bloque de objetivos pasa a ser una fila compacta que abre Objetivos con ese objetivo. | Ajustes de la preview 1 |
| C5 | Diseño | Letra más chica en toda la app (366 tamaños: de 15px para arriba baja 1 a 6px; 14 y menos queda igual) y menos aire en Inicio, para ver lo importante sin scrollear. Regla con tamaños de referencia en la guía §3.5. | Ajustes de la preview 1 |
| GA5 | Diseño | Gastos: nuevo gráfico Con qué pagaste este mes (barras por medio, un gasto dividido suma a cada medio su parte), debajo, fuera del dato principal. | Gastos: anillo y medios |
