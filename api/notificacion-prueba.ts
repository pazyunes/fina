// El botón "Mandarme una de prueba" de Perfil: le manda un aviso a todos los
// navegadores donde la persona activó las notificaciones. Sirve para confirmar
// que le llegan sin esperar a las 19 hs.
//
// Actúa como la persona (con su sesión): sólo ve y toca sus propias
// suscripciones.

import { createClient } from '@supabase/supabase-js';
import { configurarPush, enviarAviso, type Suscripcion } from './_notificaciones/enviar.js';

type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'Sólo POST' }); return; }

  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) { res.status(500).json({ error: 'Supabase no configurado en el servidor' }); return; }
  if (!configurarPush()) { res.status(500).json({ error: 'Las notificaciones todavía no están configuradas en el servidor' }); return; }

  const auth = req.headers.authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Falta la sesión' }); return; }

  const supabase = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: sesion } = await supabase.auth.getUser(token);
  if (!sesion.user) { res.status(401).json({ error: 'Sesión inválida' }); return; }

  const { data, error } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth');
  if (error) { res.status(500).json({ error: error.message }); return; }

  let enviadas = 0;
  for (const s of (data ?? []) as (Suscripcion & { id: string })[]) {
    const r = await enviarAviso(s, {
      title: '¡Así te van a llegar!',
      body: 'Los avisos de FINA ya funcionan en este dispositivo.',
      url: '/onboarding-v2/perfil',
      tag: 'fina-prueba',
    });
    if (r === 'ok') enviadas++;
    else if (r === 'vencida') await supabase.from('push_subscriptions').delete().eq('id', s.id);
  }
  res.status(200).json({ enviadas });
}
