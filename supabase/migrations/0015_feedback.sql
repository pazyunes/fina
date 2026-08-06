-- 0015 — Encuesta de feedback in-app (y del bot de WhatsApp).
-- Guarda una respuesta por (usuaria, contexto): rating 1..5 + comentario libre.
-- context: 'onboarding' | 'objetivos' | 'inversiones' | 'whatsapp' | otros.

create table if not exists feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  context    text not null,
  rating     int  check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_context_idx on feedback (context);

alter table feedback enable row level security;

drop policy if exists "feedback owner insert" on feedback;
drop policy if exists "feedback owner read"   on feedback;

-- Cada usuaria inserta/lee sólo su feedback. (El bot de WhatsApp inserta con la
-- service_role key, que salta RLS, usando context = 'whatsapp'.)
create policy "feedback owner insert" on feedback
  for insert with check (auth.uid() = user_id);
create policy "feedback owner read" on feedback
  for select using (auth.uid() = user_id);
