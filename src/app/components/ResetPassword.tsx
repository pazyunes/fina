import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

// PR — Pantalla a la que lleva el link del mail de recuperación. Supabase
// procesa el token del URL (detectSessionInUrl) y abre una sesión temporal de
// recovery; acá la usuaria setea su nueva contraseña.
export function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // El link crea una sesión de recovery. La detectamos para habilitar el form.
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const valid = pw.length >= 6 && pw === pw2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error } = await updatePassword(pw);
    setSubmitting(false);
    if (error) {
      setError('No se pudo cambiar la contraseña. El link puede haber vencido — pedí uno nuevo desde “¿Olvidaste tu contraseña?”.');
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/', { replace: true }), 1600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#7626B3] rounded-full mb-4">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-3xl mb-2 text-[#7626B3]" style={{ fontFamily: 'var(--font-serif)' }}>Nueva contraseña</h1>
          <p className="text-gray-600">Elegí una contraseña nueva para tu cuenta.</p>
        </div>

        {done ? (
          <div className="text-center bg-white rounded-2xl shadow-sm p-6">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-sm text-gray-700">¡Listo! Tu contraseña se actualizó. Te llevamos a tu informe…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="pw" className="text-gray-700 text-sm">Nueva contraseña</Label>
              <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mínimo 6 caracteres" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="pw2" className="text-gray-700 text-sm">Repetí la contraseña</Label>
              <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repetila" className="mt-1 rounded-xl" />
            </div>

            {pw2 !== '' && pw !== pw2 && <p className="text-sm text-[#7626B3]">Las contraseñas no coinciden.</p>}
            {error && <p className="text-sm text-[#7626B3]">{error}</p>}
            {!ready && <p className="text-xs text-gray-400">Validando el link del mail…</p>}

            <Button
              type="submit"
              disabled={!valid || submitting}
              className="w-full bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full text-center text-sm text-gray-600 mt-6 hover:text-[#7626B3]"
        >
          ← Volver a iniciar sesión
        </button>
      </motion.div>
    </div>
  );
}
