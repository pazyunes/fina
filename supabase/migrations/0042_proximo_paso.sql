-- 0042: el próximo paso. La racha por días con gastos quedó en la 0044.
-- Idempotente: se puede correr más de una vez. Correr después de 0041. Si ya
-- se corrió la 0044, la tabla de abajo ya existe y esto no cambia nada.
--
-- ANTES (0028): un paso distinto por día, que se cumplía solo mirando los
-- datos, y la racha contaba los días con el paso cumplido o con un gasto
-- contado por WhatsApp.
--
-- AHORA (decisión oct 2026): en Inicio hay UN próximo paso grande ("Abrí una
-- cuenta donde tu plata rinda", "Hacé tu primera inversión") que queda hasta
-- que la persona marca que lo hizo, y la racha cuenta los días en que anotó al
-- menos un gasto, en la app o por WhatsApp. Registrar lo del día es lo que
-- sostiene todo lo demás; el próximo paso es lo que hace avanzar.
--
-- `daily_steps` no se borra: tiene la historia de los pasos de cada día. Deja
-- de escribirse.

-- ── 1) Los pasos grandes que la persona marcó como hechos ────────────────
-- Una fila por paso hecho. Se marca a mano porque estos pasos pasan afuera de
-- la app (abrir una cuenta en un banco, invertir), donde FINA no los puede ver.
-- El catálogo vive en la app: src/app/api/v2/proximoPaso.ts.
create table if not exists next_steps (
  user_id      uuid not null references auth.users (id) on delete cascade,
  step_key     text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, step_key)
);

alter table next_steps enable row level security;

drop policy if exists "proximos pasos propios: leer" on next_steps;
create policy "proximos pasos propios: leer" on next_steps
  for select using (auth.uid() = user_id);

drop policy if exists "proximos pasos propios: marcar" on next_steps;
create policy "proximos pasos propios: marcar" on next_steps
  for insert with check (auth.uid() = user_id);

-- Para "Me equivoqué, todavía no lo hice".
drop policy if exists "proximos pasos propios: desmarcar" on next_steps;
create policy "proximos pasos propios: desmarcar" on next_steps
  for delete using (auth.uid() = user_id);


-- ── 2) La racha ──────────────────────────────────────────────────────────
-- Ya no está acá. La pasó a días con un gasto anotado la 0044
-- (0044_proximo_paso_y_racha.sql), que se corre con la subida de Inicio y
-- además respeta la fecha del cambio: los días anteriores se siguen contando
-- con la regla de la 0028, así nadie vio cambiar su racha. Si esta migración
-- redefiniera `_calcular_racha`, correrla ahora pisaría esa versión y le
-- cambiaría el número a todos.
