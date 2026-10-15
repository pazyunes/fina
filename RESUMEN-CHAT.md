# FINA, resumen del proyecto

Documento vivo para ponerse al día rápido: qué es FINA, cómo está armada la app hoy (la v2),
dónde viven los datos y cómo se trabaja y se despliega. Lo pendiente no está acá sino en
`DEBT.md`; las reglas de diseño y de código, en `src/styles/frontend.md`; las reglas que no
se negocian, en `CLAUDE.md`.

## Qué es

App web de finanzas personales para gente joven en Argentina que nunca tuvo educación
financiera. Hace visible la plata, no la administra ni la juzga. Los gastos y los ingresos
entran sobre todo por un bot de WhatsApp (vive en otro repo y escribe en la misma base con
la `service_role` key); la app devuelve claridad, objetivos y recomendaciones. Producción:
https://somosfina.com.ar.

La app vieja (v1: el informe en `/result`, el onboarding de pasos, `reports.user_data`) se
borró del código. Sus direcciones siguen existiendo sólo como redirecciones a la v2, en
`src/app/routes.tsx`, por si alguien las tiene guardadas.

## Stack

Vite + React 18 + TypeScript, como SPA. Ruteo con `react-router` (`createBrowserRouter`).
Tailwind 4, animaciones con `motion/react`, íconos propios en `FinaIcons.tsx` y algunos de
`lucide-react`, avisos con `sonner`. Una sola familia tipográfica, Poppins. Backend en
Supabase (Postgres con RLS, Auth y Storage). Funciones serverless en `api/` sobre Vercel,
con la IA de recomendaciones en Anthropic. Gestor de paquetes: pnpm (`pnpm-lock.yaml`; no
usar `npm install`, que crea un `package-lock.json`).

## Rutas y pantallas

`/` decide: sin sesión va a `/onboarding-v2`, con sesión a `/onboarding-v2/home`
(`RootRedirect.tsx`). El onboarding es la puerta de entrada y crea la cuenta en el último
paso. `/onboarding-v2/entrar` es el login, `/onboarding-v2/terminos` los términos y la
política de privacidad, y `/reset-password` recibe el link del mail de recuperación.

Con sesión, dentro de `V2Layout` (que tiene la puerta de sesión, el menú lateral en
desktop y la barra de abajo en el celular): Home (`/onboarding-v2/home`, el paso del día,
la racha, ingresos y gastos por mes y la recomendación de la IA), Gastos
(`/onboarding-v2/gastos`, gastos e ingresos, secciones con tope, medios de pago con saldo,
gastos fijos), Objetivos, Inversiones (perfil inversor y aportes, sobre fondo oscuro),
Perfil (datos, teléfono verificado por WhatsApp, notificaciones) y Grupos
(`/onboarding-v2/grupos`, hoy fuera del menú). `/onboarding-v2/fini` es el banco de pruebas
del personaje y sólo existe en `npm run dev`. Todos los componentes de estas pantallas están
en `src/app/components/onboarding-v2/`.

`src/app/mantenimiento.ts` tiene una puerta (`APP_CERRADA`) que muestra "Próximamente" a
todo el mundo; hoy está abierta.

## Capa de datos

Ningún componente habla con Supabase ni hace `fetch` directo: todo pasa por
`src/app/api/v2/`. `index.ts` tiene las lecturas y escrituras contra las tablas,
`almacen.ts` y `AlmacenProvider.tsx` guardan en memoria todo lo de la persona (se hidrata
una vez al entrar y las pantallas leen de ahí; las escrituras van a la base y, si fallan,
la pantalla vuelve atrás y aparece una banda de "Algo no se guardó"), `acciones.ts` agrupa
las acciones de la interfaz, `tipos.ts` los tipos, `cotizacion.ts` y `conversion.ts` el
dólar, `recomendaciones.ts` y `pasos.ts` la IA y el paso del día, `notificaciones.ts` las
notificaciones push. La sesión vive en `src/app/lib/auth.tsx` y el cliente de Supabase en
`src/app/lib/supabase.ts`.

Del lado del servidor, en `api/`: `dolar.ts` (cotización del blue, la escribe con service
role), `recomendaciones.ts` (una llamada al modelo por día y por persona),
`notificaciones.ts` (cron de Vercel dos veces por día, ver `vercel.json`) y
`notificacion-prueba.ts`. Las variables de entorno están listadas en `.env.example`.

## Tablas

Lo de cada persona: `user_profiles` (datos y respuestas del onboarding en
`onboarding_v2`), `transactions` (gastos e ingresos, con `type` `expense` o `income`,
`source` `web` o `whatsapp`, pagos divididos en `payment_methods`), `payment_methods`
(medios con su saldo, movido siempre con `mover_saldo`), `balance_loads` (cargas de "Ya la
tenía"), `expense_sections`, `recurring_expenses` (gastos fijos), `goals` y
`goal_contributions`, `investment_profiles` e `investment_contributions`, `daily_steps`
(paso del día y racha), `recommendations`, `recommendation_checks` y
`recommendation_memory`, `push_subscriptions`, `notification_prefs` y `notification_log`,
`phone_verifications` y `phone_verification_attempts`, `feedback`. Grupos: `groups`,
`group_members`, `group_expense_splits` y la vista `group_member_names`. Compartida:
`exchange_rates`. Las fotos de perfil van al bucket `avatars` de Storage.

Quedan tablas de la v1 que la app ya no lee (`reports`, `incomes`, `fixed_expenses`,
`variable_expense_estimates`, `user_preferences`); el bot o datos viejos pueden seguir
teniéndolas, así que no se borran sin revisar antes.

## Migraciones

Están en `supabase/migrations/`, numeradas de 0001 a 0040, y se corren a mano en el SQL
editor de Supabase, una por vez y en orden (no hay CLI). Hasta la 0038 están corridas. La
0039 (seguridad, DEBT S1 a S5) y la 0040 (cada movimiento de plata en una sola transacción,
DEBT D3) están escritas y **pendientes de correr a mano**; antes de la 0039 hay que cargar
`SUPABASE_SERVICE_ROLE_KEY` en Vercel. Qué hace cada una y qué probar después está en
`supabase/README-migraciones-v2.md`. Toda tabla con RLS necesita su policy de UPDATE: si
falta, los updates fallan en silencio.

## Cómo se trabaja y se despliega

Nunca se trabaja directo en `main`. Cada cambio va en una rama (hoy `juaniBranch`); cada
push de la rama arma una preview en Vercel para verlo antes de mergear, y el merge a `main`
es lo que despliega producción. Antes de abrir un PR corren los dos:

```bash
npx -y pnpm@10 install   # sólo la primera vez o si cambió package.json
npm run typecheck        # tsc --noEmit: el build NO chequea tipos
npm run build            # vite build
```

`npm run build` usa esbuild y borra los tipos sin validarlos: un import roto o un `any`
pasan el build en verde. Por eso los dos. Después, el checklist de
`src/styles/frontend.md` §13.

## Backlog

`DEBT.md` en la raíz, ordenado por tipo (seguridad, funcionalidad, diseño, limpieza) y por
prioridad. Cada ítem tiene un id para nombrarlo en commits; al terminarlo se pasa a la
tabla de hechos en el mismo commit.

## Carpetas

```
src/main.tsx                 entrada: monta App y registra el service worker
src/app/App.tsx              puerta de mantenimiento, AuthProvider, router, avisos
src/app/routes.tsx           rutas de la v2 y redirecciones de la v1
src/app/api/v2/              capa de datos (todo lo que toca Supabase)
src/app/components/onboarding-v2/   pantallas y componentes de la v2
src/app/components/          RootRedirect, ResetPassword, Proximamente, WhatsAppFab
src/app/lib/                 supabase, auth, displayCurrency, email, legales, telefono
src/app/utils/goalStrategies.ts     lógica vieja de objetivos, se reusa en Objetivos (O1)
src/styles/                  tokens.css, theme.css, frontend.md
api/                         funciones serverless de Vercel
supabase/                    migraciones y scripts que se corren a mano
docs/                        bot de WhatsApp, protección de datos, tono
```
