# Migraciones del flujo v2 — qué correr y en qué orden

**Nadie corrió estas migraciones todavía.** Yo no tengo acceso a tu Supabase.

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

Cuatro archivos nuevos. **Correlos en orden**, uno por uno, leyendo el
resultado antes de pasar al siguiente.

| Orden | Archivo | Qué agrega |
| --- | --- | --- |
| 1 | `0020_v2_secciones_gastos.sql` | Secciones propias con tope, medios de pago con saldo, y las columnas que le faltaban a `transactions` (tipo de gasto, método, sección) |
| 2 | `0021_v2_objetivos_inversiones.sql` | Contribuciones a objetivos, perfil de riesgo, aportes de inversión. Relaja `goals` para admitir objetivos sin monto y en dólares |
| 3 | `0022_v2_grupos.sql` | **La delicada.** Grupos, membresías, competencias y gastos en conjunto con repartos — y el modelo de acceso nuevo |
| 4 | `0023_v2_perfil.sql` | Lo que el onboarding v2 pregunta y no entraba: género "otro", edad por rango, zona, nivel financiero, reserva |

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

## Y esto es lo que TODAVÍA falta después de las migraciones

Correr las cuatro migraciones **no hace que la app nueva funcione de verdad.**
Crea el lugar donde guardar; falta que la app lo use. Hoy el flujo v2 guarda
todo en `localStorage` y no hace una sola consulta a Supabase.

En orden, lo que queda:

1. **Capa `api/`** para el v2 (regla 6 de `CLAUDE.md`: ningún componente hace
   `fetch` directo). Una función por operación: crear sección, registrar gasto,
   sumar aporte, etc.
2. **Reemplazar los `load/save` de `localStorage`** en
   `src/app/components/onboarding-v2/shared.tsx` por esas llamadas. Son 38 usos.
3. **Conectar el login de verdad.** Hoy el del v2 es una maqueta: pide mail,
   contraseña y teléfono, valida el formato, acepta cualquier código de
   verificación y **no crea ningún usuario**. Sin esto no hay `auth.uid()`, y
   sin `auth.uid()` ninguna de las policies de arriba puede funcionar.
4. **Guardar el teléfono**, que es como el bot identifica a la persona.
5. **Grupos de verdad**: invitación, entrar por código, ranking con datos de
   las dos personas. Hoy es una demo en un solo navegador.
6. **Foto de perfil a Storage**, en vez de base64 en el navegador.
7. **Adaptar el bot**, recién cuando todo lo anterior esté.

El paso 3 es el que bloquea todo lo demás: sin usuarios reales en el flujo
nuevo, las tablas quedan vacías por más que existan.
