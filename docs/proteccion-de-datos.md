# Protección de datos personales en FINA

**Ley 25.326 (Argentina) aplicada a lo que FINA hace hoy.**
Última revisión: 22 de septiembre de 2026.

Este documento describe qué datos trata FINA, con qué base legal, quién los
procesa, qué medidas de seguridad hay implementadas y qué falta. Sirve para la
presentación de la materia, para responder preguntas de un jurado y como lista
de tareas del equipo.

> No es asesoramiento legal. Antes de salir a producción con usuarias fuera del
> círculo de prueba, conviene que un abogado revise la política de privacidad y
> los contratos con proveedores.

---

## 1. Quiénes somos frente a la ley

| Rol | Quién | Qué implica |
| --- | --- | --- |
| **Titular del dato** | Cada persona que usa FINA | Puede pedir acceso, rectificación, actualización y supresión (arts. 14 a 16) |
| **Responsable del archivo** | FINA (el equipo) | Decide qué datos se recolectan y para qué. Tiene todas las obligaciones de los arts. 4 a 9 |
| **Encargados del tratamiento** | Supabase, Vercel, Anthropic, Kapso/WhatsApp | Tratan datos por instrucción nuestra. Deben guardar confidencialidad y no pueden cederlos (art. 25) |

**FINA es responsable, no encargado**: definimos la finalidad (ayudar a la
persona a ver y ordenar su plata) y los medios. No trabajamos por instrucción de
un tercero.

---

## 2. Qué datos trata FINA

### 2.1 Los que la persona nos da

| Dato | Dónde se guarda | Para qué | ¿Obligatorio? |
| --- | --- | --- | --- |
| Mail y contraseña | `auth.users` (Supabase Auth) | Crear la cuenta y entrar | Sí: sin cuenta no hay app |
| Nombre | `user_profiles.name` | Hablarle por su nombre | Sí, en el onboarding |
| Teléfono | `user_profiles.phone` | Que el bot de WhatsApp la reconozca | No: la app funciona sin registrar gastos por WhatsApp |
| Edad (rango), género, zona, convivencia | `user_profiles` | Ajustar el acompañamiento | No: el onboarding se puede saltear |
| Fuente y estabilidad de ingresos, nivel financiero declarado | `user_profiles` | Personalizar recomendaciones | No |
| Gastos e ingresos (monto, moneda, descripción, medio de pago, fecha) | `transactions` | El corazón de la app | Sí, si quiere usarla |
| Saldos por medio de pago | `payment_methods` | Mostrar el dinero disponible | No |
| Secciones y topes | `expense_sections` | Organizar los gastos | No |
| Objetivos y registros de ahorro | `goals`, `goal_contributions` | Seguimiento de objetivos | No |
| Gastos fijos y sus vencimientos | `recurring_expenses` | Avisar antes de que venza | No |
| Perfil inversor (respuestas del quiz) y aportes | `investment_profiles`, `investment_contributions` | Sugerencias de inversión | No |
| Grupos y participación | `groups`, `group_members` | Objetivos compartidos | No |
| Foto de perfil | Supabase Storage | Avatar | No |

### 2.2 Los que se generan solos

| Dato | Dónde | Para qué |
| --- | --- | --- |
| Paso del día y racha | `daily_steps` | El hábito diario |
| Recomendaciones generadas y si las marcó como hechas o útiles | `recommendations`, `recommendation_checks`, `recommendation_memory` | Que las siguientes sean mejores |
| Suscripción a avisos del navegador y preferencias | `push_subscriptions`, `notification_prefs`, `notification_log` | Mandar los avisos y no repetirlos |
| Códigos e intentos de verificación de teléfono | `phone_verifications`, `phone_verification_attempts` | Verificar el número y frenar abusos |

### 2.3 Datos sensibles

**FINA no recolecta datos sensibles** en el sentido del art. 2 (origen racial o
étnico, opiniones políticas, convicciones religiosas, salud o vida sexual).

Dos advertencias igual:

1. **La información financiera no es "sensible" por ley, pero es íntima.** Un
   listado de gastos dice dónde estuvo alguien, qué consume y con quién. Se
   trata con el mismo cuidado que un dato sensible.
2. **El texto libre puede traer lo que sea.** La descripción de un gasto y los
   mensajes al bot los escribe la persona: puede aparecer el nombre de una
   clínica o de una farmacia. No se muestran a nadie más que a ella y no se usan
   para segmentar.

### 2.4 Menores

FINA apunta a gente joven, incluidos adolescentes desde los 16. Hoy **no se pide
la edad exacta ni consentimiento de una persona adulta responsable**. Ver
pendientes (§7).

---

## 3. Base legal: el consentimiento (art. 5)

El consentimiento se pide **en la misma pantalla en la que se crea la cuenta**:
hay una casilla que dice "Acepto los términos y condiciones y la política de
privacidad", y sin tildarla no se crea la cuenta. Queda registrado el momento
exacto en `user_profiles.terms_accepted_at`.

Eso cubre el requisito de que sea **libre, expreso e informado**… **siempre que
los textos enlazados existan y digan lo que pasa de verdad**. Hoy no están
publicados: es el pendiente más urgente (§7).

**Información previa (art. 6).** Lo que hay que decirle antes de que acepte:
quiénes somos, para qué pedimos cada dato, que responder es optativo salvo mail y
contraseña, qué pasa si no responde (la app funciona igual, con menos
personalización), quiénes tratan los datos por nosotras y cómo ejercer sus
derechos.

---

## 4. Principios, y cómo se cumplen hoy

| Principio | Cómo lo cumple FINA |
| --- | --- |
| **Finalidad** (art. 4.3) | Los datos se usan para mostrarle a la persona su propia plata y darle sugerencias. No se venden ni se ceden |
| **Minimización** (art. 4.1) | El onboarding se puede saltear entero; el teléfono es optativo; no se pide DNI, dirección, CBU ni acceso a cuentas bancarias |
| **Calidad y exactitud** (art. 4.4) | Todo se puede editar o borrar desde la app. Cada dato muestra su estado de confianza (confirmado, declarado, estimado, por descubrir), así no se presenta como certeza lo que es una estimación |
| **Conservación limitada** (art. 4.7) | Pendiente: hoy no hay plazo de retención definido (§7) |
| **Seguridad y confidencialidad** (arts. 9 y 10) | Ver §5 |
| **Derechos del titular** (arts. 14 a 16) | Ver §6 |

**Sobre la publicidad dentro de la app (modelo B2B2C).** El plan es recomendar
comercios. Para que sea lícito: la empresa **no recibe datos personales**, sino
que FINA muestra su oferta a quien corresponda. Si en algún momento se le pasara
a la empresa cualquier dato que identifique a la persona, eso es una **cesión** y
necesita consentimiento específico e informado (art. 11).

---

## 5. Seguridad de los datos (art. 9)

El art. 9 pide medidas técnicas y organizativas para evitar adulteración,
pérdida, consulta o tratamiento no autorizado, y **poder detectar desvíos**.
Esto es lo que hay hoy en el código:

### Lo que ya está

- **Aislamiento por usuaria (RLS).** Todas las tablas con datos personales tienen
  Row Level Security activada, con políticas que permiten leer y escribir sólo
  las filas propias (`user_id = auth.uid()`). Una usuaria no puede leer los datos
  de otra aunque manipule la aplicación: el filtro lo aplica la base, no la app.
- **Nada de claves en el navegador.** La app usa la clave pública (anon) de
  Supabase, que sin sesión no puede leer nada. La clave `service_role`, que
  saltea RLS, vive sólo en variables de entorno del servidor (Vercel) y se usa en
  dos funciones: los avisos programados y el bot.
- **Secretos fuera del repositorio.** `ANTHROPIC_API_KEY`, `VAPID_PRIVATE_KEY`,
  `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` son variables de entorno; ninguna
  se expone al navegador (las que empiezan con `VITE_` sí se exponen, y por eso
  ahí sólo hay claves públicas).
- **Las tareas programadas están autenticadas.** La función que manda avisos sólo
  responde si Vercel le manda `Authorization: Bearer <CRON_SECRET>`.
- **Transporte cifrado.** Todo va por HTTPS (Vercel y Supabase).
- **Contraseñas.** Las maneja Supabase Auth con hash; FINA nunca las ve ni las
  guarda. El reseteo es por link al mail, con vencimiento.
- **Verificación del teléfono sin SMS.** Se verifica el número desde el que la
  persona le escribe al bot, con un código de un solo uso que vence, y con freno
  a los diez intentos fallidos por hora (`phone_verification_attempts`).
- **Un teléfono, una cuenta.** Índice único sobre `user_profiles.phone`: nadie
  puede quedarse con el número de otra persona.
- **Borrados verificados.** Al borrar un gasto o un objetivo, la app confirma que
  la fila se borró de verdad antes de decir que se borró; si RLS lo impide,
  revierte y avisa. Un borrado que falla en silencio es un dato que sigue vivo.
- **Cierre de sesión.** Cierra la sesión de Supabase, borra la suscripción a
  avisos de ese dispositivo y limpia los datos guardados en el navegador, para
  que el próximo que use ese teléfono no vea nada.
- **La IA recibe lo mínimo.** La función de recomendaciones corre con la sesión
  de la persona (no con `service_role`), así que sólo puede leer los datos de
  ella; a Anthropic se le manda un resumen agregado (totales por sección,
  porcentajes, rachas), no el listado de gastos con sus descripciones.

### Lo que falta

Ver §7. Lo más importante: **no hay registro de auditoría** que permita
"detectar desviaciones", como pide el art. 9.1, ni procedimiento escrito ante un
incidente.

---

## 6. Derechos de la persona (arts. 14 a 16)

| Derecho | Cómo se ejerce hoy |
| --- | --- |
| **Acceso** | La app muestra todo lo que FINA sabe de ella: gastos, ingresos, objetivos, perfil, avisos. Falta poder **descargarlo** en un archivo |
| **Rectificación y actualización** | Todo se edita desde la app: perfil, gastos, objetivos, topes, teléfono |
| **Supresión** | Parcial: se puede borrar cada gasto, objetivo, registro o la suscripción a avisos. **Falta borrar la cuenta entera desde la app**: hoy hay que pedirlo por mail y lo hace el equipo a mano |
| **Gratuidad y plazos** | La ley da 10 días corridos para el acceso y 5 días hábiles para rectificar o suprimir. Hoy no hay un circuito formal que garantice esos plazos |

Contacto para ejercer derechos: **fina.edfinanciera@gmail.com**.

---

## 7. Pendientes, por orden de urgencia

1. **Publicar la política de privacidad y los términos, y enlazarlos desde la
   casilla del registro.** Hoy se acepta un texto que no está publicado: el
   consentimiento queda flojo. Tiene que incluir todo lo del art. 6.
2. **Corregir la frase "Tu información es privada — no la compartimos con
   nadie"** de la primera pantalla. Es casi cierta, pero no del todo: hay
   encargados que tratan los datos (Supabase, Vercel, Anthropic, Kapso/WhatsApp).
   Decirlo bien: "no vendemos ni cedemos tus datos; los proveedores que usamos
   sólo los tratan por instrucción nuestra".
3. **Botón "borrar mi cuenta"** en Perfil, que borre todo en cascada y cierre la
   sesión. Es el derecho de supresión, y hoy depende de que alguien lo haga a mano.
4. **Contratos con los encargados.** Revisar y guardar los DPA de Supabase,
   Vercel, Anthropic y Kapso, y verificar dónde están los servidores: si los
   datos salen del país, es **transferencia internacional** (art. 12) y requiere
   que el país tenga nivel adecuado de protección o cláusulas contractuales.
5. **Registrar la base de datos ante la AAIP** (Agencia de Acceso a la
   Información Pública), como pide el art. 21. Es un trámite gratuito.
6. **Definir plazos de retención** (art. 4.7): cuánto se guardan los datos de una
   cuenta inactiva, cuánto los códigos de verificación (hoy no se borran), cuánto
   el historial de avisos.
7. **Auditoría mínima** (art. 9.1): registrar accesos con `service_role`,
   borrados de cuenta y errores de permisos, para poder detectar un desvío.
8. **Edad.** Definir la edad mínima y qué se hace con menores de esa edad. Si se
   acepta gente de 13 a 16, hace falta consentimiento de quien ejerza la
   responsabilidad parental.
9. **Exportar mis datos** en un archivo, para cerrar el derecho de acceso.
10. **Procedimiento ante incidentes**: qué se hace y a quién se avisa si se filtra
    o se pierde información.

---

## 8. El artículo 32 (delito penal) y por qué nos importa

El Código Penal (según la reforma que trajo la ley) castiga con prisión de un mes
a dos años a quien **acceda a sabiendas e ilegítimamente a un banco de datos
personales**, o **revele información registrada en él** estando obligado a
guardar el secreto.

Traducido a FINA: quien tenga la clave `service_role` puede leer los datos de
todas las personas. Por eso esa clave no está en el repositorio, no se comparte
por chat y sólo la usan dos funciones del servidor. Mirar los datos de una
usuaria por curiosidad no es una travesura: es el art. 32.

---

## 9. Resumen para el pitch

> FINA trata datos íntimos —lo que alguien gasta, lo que gana, lo que quiere
> lograr— y por eso el diseño arranca por ahí: pedimos lo mínimo, nunca movemos
> plata, no pedimos claves bancarias, cada persona sólo puede ver lo suyo (lo
> garantiza la base, no la app), la inteligencia artificial recibe un resumen sin
> descripciones, y todo lo que se carga se puede editar o borrar. Lo que falta lo
> tenemos escrito y priorizado: política de privacidad publicada, borrado de
> cuenta en un toque y registro de la base ante la AAIP.
