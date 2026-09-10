# Migraciones del flujo v2 — qué correr y en qué orden

**Nadie corrió estas migraciones todavía.** Yo no tengo acceso a tu Supabase.

La app **ya está cableada contra Supabase**: el onboarding crea la cuenta de
verdad y las siete pantallas leen y escriben en estas tablas. O sea que hasta
que no corras las migraciones, la app nueva va a mostrar errores de guardado —
no porque esté mal, sino porque las tablas no existen todavía.

> **Estado al 10 de septiembre de 2026: las seis están corridas y el flujo se
> probó de punta a punta contra la base real** (alta de cuenta, teléfono,
> perfil, secciones, gastos en pesos y en dólares, objetivos con
> contribuciones, perfil inversor, aportes, grupo con código, foto a Storage y
> saldo por medio de pago). Lo de abajo queda como referencia de qué hace cada
> una y qué verificar si alguna vez hay que rehacer la base.

---

## Lo primero: el borrado de usuarios, ¿funcionó?

Corré **solo esto** en el SQL editor y mirá el resultado:

```sql
select 'auth.users' as tabla, count(*) from auth.users
union all select 'reports', count(*) from reports
union all select 'user_profiles', count(*) from user_profiles
order by 1;
```

- **Todo en 0** → funcionó, no hay nada más que hacer.
- **`auth.users` con filas** → no borró. Las dos causas probables, en orden:
  1. **Se corrió solo el PASO 0.** El archivo abre con un `select` de conteo. Si
     en el editor quedó seleccionada esa parte, o se ejecutó solo el primer
     statement, no se borró nada — el paso 0 justamente no borra, cuenta.
  2. **Falló el paso 2 por foreign key** y el error pasó desapercibido. Pasa si
     el paso 1 (`delete from reports`) no se corrió: `reports.user_id` no tiene
     `on delete cascade`, así que Postgres rechaza el borrado con
     `violates foreign key constraint`.

En cualquiera de los dos casos, la solución es la misma: correr los pasos 1 y 2
**juntos y en orden**.

```sql
delete from reports;
delete from auth.users;
```

Y verificar de nuevo con el select de arriba.

> Recordá lo que **no** borra: lo que cada persona tenga en el `localStorage` de
> su navegador. El flujo v2 guarda todo ahí, así que quien probó la app va a
> seguir viendo sus datos en su celular.

---

## Las migraciones: qué son y en qué orden

Ocho archivos nuevos. **Correlos en orden**, uno por uno, leyendo el
resultado antes de pasar al siguiente.

| Orden | Archivo | Qué agrega |
| --- | --- | --- |
| 1 | `0020_v2_secciones_gastos.sql` | Secciones propias con tope, medios de pago con saldo, y las columnas que le faltaban a `transactions` (tipo de gasto, método, sección) |
| 2 | `0021_v2_objetivos_inversiones.sql` | Contribuciones a objetivos, perfil de riesgo, aportes de inversión. Relaja `goals` para admitir objetivos sin monto y en dólares |
| 3 | `0022_v2_grupos.sql` | **La delicada.** Grupos, membresías, competencias y gastos en conjunto con repartos — y el modelo de acceso nuevo |
| 4 | `0023_v2_perfil.sql` | Lo que el onboarding v2 pregunta y no entraba: género "otro", edad por rango, zona, nivel financiero, reserva |
| 5 | `0024_v2_huecos.sql` | Los huecos que aparecieron al cablear la app de verdad (ver abajo) |
| 6 | `0025_mover_saldo.sql` | `mover_saldo(medio, delta)`: mueve el saldo de un medio de pago de forma atómica. Apareció probando el alta real — el gasto descontaba en la pantalla y no en la base |
| 7 | `0026_verificar_telefono_whatsapp.sql` | Verificar el teléfono mandándole un código al bot de WhatsApp, en vez de por SMS |
| 8 | `0027_limites_verificacion.sql` | Corrige dónde va el freno de la verificación: el tope de la 0026 trababa a la persona honesta y no al ataque |

### Qué trae la 0024 y por qué

La escribí después, cuando conecté la app: son las cosas que no se veían
leyendo el esquema y sí al hacer que las pantallas escribieran.

1. **`transactions.original_amount` vuelve.** La 0009 la había borrado con un
   argumento correcto para entonces: era un espejo que nadie leía, porque el
   monto en dólares vivía en `reports.user_data` (jsonb). El flujo v2 no usa
   ese jsonb — lee las tablas directo. Si cargás "20 USD", el número que
   tipeaste tiene que poder recuperarse tal cual, no reconstruirse dividiendo
   por una cotización que ya cambió.
2. **Objetivos: `description`, `amount_mode` y `amount_min_ars`.** El objetivo
   tiene un "por qué", y el monto puede ser exacto, un rango, o "todavía no
   sé". Un objetivo sin monto guarda `null`, no `0`: $0 sería un objetivo
   gratis.
3. **Los checks de moneda se amplían a ocho monedas.** Esto era un bug que iba
   a explotar en producción: el selector de Objetivos ofrece peso, dólar, euro,
   real, peso chileno, uruguayo, libra y peso mexicano, y la 0021 dejó el check
   en ARS/USD. Cualquier objetivo en euros fallaba en el insert. Además
   `goal_contributions.amount_ars` pasa a nullable: FINA tiene una sola
   cotización (dólar blue), así que un aporte en euros no se puede pasar a
   pesos — `null` ahí significa "no se puede saber", que es distinto de cero.
4. **`user_profiles.onboarding_v2` (jsonb).** Las diez respuestas del
   cuestionario que la app lee siempre juntas y nunca filtra. Van a un jsonb y
   no a diez columnas porque el cuestionario cambia seguido.
5. **`investment_profiles.completed_at`.** Distingue "contestó las dos
   preguntas del onboarding" de "hizo el quiz completo". Sin esto no se sabe si
   al entrar a Inversiones hay que abrir el quiz o el resultado.
6. **La vista `group_member_names`.** Un ranking sin nombres no es un ranking,
   y `user_profiles` es owner-only. La vista expone **exactamente un dato de
   más**: el nombre de pila de quienes comparten grupo con vos. El filtro vive
   dentro de la vista, no en el cliente.
7. **El bucket `avatars`.** Con policies por carpeta: cada persona escribe sólo
   en `<su-id>/`.

### Cómo correrlas

Supabase → SQL Editor → pegar el contenido del archivo → Run. Una por vez.

Están escritas para ser **idempotentes**: `if not exists`, `drop policy if
exists` antes de cada `create policy`. Si una se corre dos veces no rompe nada.

---

## Por qué esto no rompe la app vieja

Todas son **aditivas**. Concretamente:

- **No hay un solo `drop table` ni `drop column`.** Nada de lo que existe se
  borra ni se renombra.
- Las columnas nuevas son **nullable o con default**, así que las filas viejas
  siguen siendo válidas.
- Los dos checks que se modifican (`gender` y los de `goals`) se **amplían**:
  lo que hoy entra sigue entrando, y ahora entra más.
- Los dos `drop not null` de `goals` **relajan**: un objetivo con monto sigue
  siendo válido, y ahora también uno sin monto.
- La policy nueva en `transactions` **se suma** a la que ya había. Las policies
  de un mismo comando se combinan con OR: cada usuaria sigue viendo sus gastos
  y ahora ve también los del grupo.

Después de correrlas, la app vieja (`/login`, `/personal-data`, `/result`)
tiene que funcionar exactamente igual. Si algo falla ahí, es un bug de estas
migraciones y hay que avisar, no seguir.

---

## Lo que hay que probar sí o sí después de la 0022

Los grupos son lo único acá que **puede filtrar datos entre usuarias**. Todo lo
demás, si está mal, muestra un número raro; esto muestra la plata de otra
persona.

Se prueba con **dos cuentas reales**, no con una:

```sql
-- Con la sesión de ANA, después de que Sofi cargó gastos personales:
select count(*) from transactions;
-- Tiene que dar SOLO los gastos de Ana + los del grupo.
-- Si aparece un gasto personal de Sofi (group_id null), la policy está mal
-- y hay que parar todo.
```

Cosas concretas a verificar:

1. Ana **no** ve los gastos personales de Sofi.
2. Ana **sí** ve los gastos del grupo que cargó Sofi.
3. Ana **no** puede inventar un reparto sobre un gasto de Sofi.
4. Ana **no** ve grupos de los que no es miembro (ni buscando por nombre).
5. Sofi **no** puede meter a Ana en un grupo sin que Ana entre por el código.
6. Salir del grupo y confirmar que Ana deja de ver lo del grupo.

---

## Después de correrlas: qué probar en la app

En este orden, porque cada paso depende del anterior.

1. **Crear una cuenta.** Entrá al onboarding, contestá todo y creá la cuenta con
   un mail de prueba. Al terminar tenés que caer en Home con tu nombre arriba.
   - Si Supabase te pide confirmar el mail, vas a ver la pantalla "Confirmá tu
     mail". Tus respuestas quedaron guardadas y se suben cuando entrés.
   - Si querés evitar ese paso mientras probás: Supabase → Authentication →
     Providers → Email → apagá **Confirm email**.
2. **Que el nombre y las secciones estén en la base.** En el SQL editor:
   ```sql
   select name, phone, main_goal, terms_accepted_at from user_profiles order by created_at desc limit 1;
   select name, slug from expense_sections order by created_at;
   ```
   El teléfono tiene que estar como `+54` + 10 dígitos, **sin el 9**.
3. **Cargar plata disponible y un gasto.** Después:
   ```sql
   select description, amount_ars, currency, original_amount, expense_type, payment_method, source
   from transactions where type = 'expense' order by occurred_at desc limit 5;
   ```
   `source` tiene que decir `web`. Un gasto en dólares tiene que tener
   `original_amount` con lo que tipeaste y `amount_ars` con el equivalente.
4. **Recargar la página.** Todo tiene que seguir ahí. Esta es la prueba de que
   dejó de vivir en el navegador.
5. **Abrirla en otro dispositivo** (o una ventana privada) e iniciar sesión con
   la misma cuenta. Tiene que aparecer lo mismo. Antes esto no pasaba.
6. **Un objetivo y un aporte de inversión.** Mismo criterio.
7. **Grupos, con dos cuentas de verdad** (ver la sección de abajo, es la única
   parte que puede filtrar datos entre personas).

Si algo no se guarda, la app **te lo dice**: aparece una banda arriba con
"Algo no se guardó" y el mensaje de Supabase. No hay guardados silenciosos.

---

## La verificación del teléfono, y por qué no es un SMS

La pantalla que pedía un código de 4 dígitos se sacó: aceptaba cualquier número,
o sea que no verificaba nada y encima le hacía creer a la persona que su
teléfono estaba validado.

En vez de un SMS, **el que verifica es el bot** (migración 0026): desde Perfil
la persona pide un código, la app le abre WhatsApp con el código ya escrito, y
al enviarlo el bot confirma que el número es suyo.

Tres razones para esto y no un OTP por SMS:

- Un SMS cuesta plata por mensaje y en Argentina las operadoras filtran, así que
  una parte no llega.
- Abre la puerta al fraude de *SMS pumping*: alguien dispara miles de códigos a
  números premium y la cuenta la pagás vos.
- Y no resuelve el problema de fondo: **el bot no puede escribirle primero a
  nadie.** WhatsApp sólo deja iniciar una conversación con plantilla aprobada y
  pagando. Con el teléfono verificado por SMS, la persona igual nunca le habló
  al bot. Verificando por WhatsApp, la conversación queda abierta.

Del lado del bot hay que agregar un caso: si el mensaje matchea
`FINA-VERIF-([A-Z0-9]{6})`, llamar a `verificar_telefono_por_whatsapp`. Está
todo en `docs/bot-cambios-a-hacer.md`, punto 2.
