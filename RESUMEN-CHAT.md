# FINA — Resumen del proyecto y de los cambios

> Documento vivo para entender qué es FINA, cómo está armado, cómo se
> despliega y qué se fue trabajando. Pensado también para que alguien nuevo
> (ej. una colaboradora) se ponga al día rápido.

---

## 1. Qué es FINA

App web de finanzas personales para mujeres en Argentina. Deployada en Vercel:

- **Producción:** https://somosfina.com.ar (y `fina-ashen.vercel.app`)
- La app te arma un **informe financiero** a partir de un onboarding, te muestra
  un **presupuesto por categoría**, **objetivos de ahorro**, una sección de
  **inversiones** y un **perfil** editable.
- Hay (aparte, ya funcionando) un **chatbot de WhatsApp** que registra gastos e
  ingresos en tiempo real y escribe en la misma base de datos (Supabase). Vive en
  un server/repo aparte y se conecta con la `service_role` key (saltea RLS).

---

## 2. Stack técnico

- **Frontend:** Vite + React + TypeScript (SPA).
- **Ruteo:** react-router (`createBrowserRouter`, layouts con `Outlet`).
- **UI:** Tailwind CSS, componentes propios en `src/app/components/ui`,
  animaciones con `motion/react`, íconos `lucide-react`, gráficos `recharts`.
- **Backend:** Supabase (Postgres + RLS + Auth con anon key).
- **Deploy:** Vercel, conectado al repo de GitHub. **Cada push a `main`
  redeploya solo.**

### Cómo correr y buildear (local)

```bash
cd Fina
npm install                 # solo la primera vez
./node_modules/.bin/vite build   # build de producción (esbuild)
```

> El build usa esbuild: ignora imports sin usar y errores de tipos. Si compila,
> está OK para deployar.

---

## 3. Cómo se despliega (GitHub → Vercel)

1. Hacés un cambio en el código.
2. Commit + push a la rama `main`.
3. Vercel detecta el push y **redeploya automáticamente** en 1-2 minutos.
4. Queda online en https://somosfina.com.ar

**Convención del proyecto:** se commitea y pushea a `main` después de cada
cambio (la preview de Vercel es la forma de verlo).

---

## 4. Modelo de datos (Supabase)

- La **fuente de verdad** de las lecturas es `reports.user_data` (un JSONB con
  todo lo del onboarding). El análisis también se guarda como JSONB.
- Al escribir, se **espeja** a tablas normalizadas (para el bot y reportes).
- **RLS:** toda tabla con Row Level Security necesita una policy de UPDATE, si
  no los updates fallan en silencio.
- Las **migraciones SQL se corren a mano** en el panel de Supabase (no hay CLI).

---

## 5. Features principales (estado actual)

### Onboarding
- Pasos: datos personales, contexto, actividad, banco, gastos fijos, servicios,
  hábitos, objetivos, preferencias → informe.
- **Gastos variables** (los que trackea el bot y se muestran como barras):
  Salidas, Delivery, Cafeterías, Restaurantes, Supermercado, Belleza, Terapia,
  Transporte. El resto son **fijos** (se descuentan solos el día que entra la plata).
- **Delivery se ingresa "por mes"** (mucha gente no pide todas las semanas). Por
  debajo se guarda en frecuencia semanal (÷4.33), igual que entretenimiento, así
  el resto de los cálculos no cambian.

### Informe / Presupuesto (`BudgetTracker`)
- Cada categoría variable arranca con su **tope mensual** y baja a medida que el
  bot registra gastos.
- **Primer mes (arranque a mitad de mes):** hay un tramo violeta-clarito de
  "referencia" = lo que ya venías gastando antes de arrancar. **Ya está
  descontado del "te queda"** (el número y la barra son coherentes).

### Objetivos (`ObjetivosPage`)
- Donut con % logrado, monto/plazo, y un recuadro guía.
- El recuadro se **genera en vivo**: respeta el toggle ARS/USD y descuenta lo que
  ya separaste (usa lo que *falta*, no el total).
- Podés agregar objetivos, marcar "¿ya pagaste?/¿ya separaste?" y sumar aportes.
- **Reserva general** (`reserveArs`): plata que apartás, no atada a un objetivo.

### Inversiones (`InversionesPage`)
- Perfil de riesgo, panel "Tu plata hoy" (patrimonio), nudge "Tu plata parada"
  (lo que pierde tu ahorro contra la inflación), proyección y explicador para
  quien nunca invirtió.
- **Personalizado según el banco/app de la persona**: si usás Ualá, te
  recomienda Ualá. En la lista muestra "✓ Desde tu {app}".
- Guía "¿Cómo lo hago?" en 3 pasos. El botón para **abrir la app aparece recién
  al final**, después de leer el paso a paso (para no irte sin saber qué hacer).

### Perfil
- Columna centrada, datos financieros editables (`/editar/*`), ahorro e inversión
  con toggle ARS/USD, cupones.

### Encuestas de feedback
- Pop-ups con escala de 4 emojis (par, obligatoria). Aparecen al terminar el
  onboarding y **al salir** de Objetivos e Inversiones.
- Cada encuesta muestra un **chip con el nombre de la pantalla** que se evalúa,
  para que no parezca "siempre lo mismo".

### Otros
- Recuperación de contraseña (flujo nativo de Supabase).
- Emails de marca (Resend SMTP + logo de FINA).
- Toggle de moneda ARS/USD global (`useMoney` / `DisplayCurrencyToggle`).

---

## 6. Cambios de esta sesión (resumen)

1. **Inversiones coherentes con el banco de la persona** (destacar su app, botón
   "Abrir", "✓ Desde tu {app}").
2. **Guía de inversión:** abrir la app recién después del paso a paso.
3. **Presupuesto:** "te queda" descuenta el tramo de referencia.
4. **Encuestas:** chip con el nombre de la pantalla.
5. **Objetivos:** recuadro en vivo (respeta USD y descuenta lo ya separado); se
   arreglaron números absurdos (ej. "$281 millones") que venían de un texto viejo.
6. **Delivery** pasa a "por mes"; **Restaurantes** → "Restaurantes / comidas".

---

## 7. Temas abiertos / pendientes

- **Ingresos a lo largo del mes:** hoy el modelo asume un ingreso mensual fijo
  con un "día que se renueva la plata". Para quien cobra de a poco durante el mes,
  se propuso: que el bot registre ingresos en vivo y mostrar "entró este mes vs.
  estimado". **Decisión pendiente:** si el disponible se basa en la plata que ya
  entró (realista, crece durante el mes) o se mantiene sobre un estimado.
- **Deep-links a apps en el celular:** por ahora los botones "Abrir" van al sitio
  web (siempre funciona). Se puede intentar abrir la app instalada, pero es frágil.
- **Migraciones SQL pendientes de correr en Supabase:** `0015_feedback.sql`,
  `0016_reserva_estado.sql`.
- Ideas ofrecidas y no empezadas: conectar inversión con un objetivo, destacar UNA
  opción "para arrancar", desacoplar el monto de ahorro del toggle "¿ahorrás?".

---

## 8. Estructura rápida de carpetas

```
Fina/
  src/app/
    components/     # pantallas y UI (Result, ObjetivosPage, InversionesPage, ...)
    onboarding/     # pasos del onboarding (steps.ts)
    lib/            # supabase, auth, reports, displayCurrency, feedback, ...
    utils/          # financialAnalyzer, goalStrategies
    types.ts        # tipos de UserData / FinancialAnalysis
    routes.tsx      # definición de rutas
  public/           # logos, íconos, og-image
  supabase/         # migraciones SQL (se corren a mano)
```
