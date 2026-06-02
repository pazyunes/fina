import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../lib/auth';

type Mode = 'signin' | 'signup';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signIn, signUp } = useAuth();

  // Splash pasa state.mode para abrir directo en signin o signup. Si la ruta
  // se carga directo sin state (link compartido), arrancamos en signin.
  const initialMode: Mode = (location.state as { mode?: Mode } | null)?.mode === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(''); // E.164 (+ país sin espacios), opcional
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mismo regex que el CHECK de user_profiles.phone en 0003_live_profile.sql.
  // Opcional en el formulario: si está vacío se omite; si está cargado, debe matchear.
  const E164 = /^\+[1-9][0-9]{1,14}$/;
  const phoneValid = mode === 'signin' || phone.trim() === '' || E164.test(phone.trim());

  // PR6 — Tras autenticar volvemos a `/` y RootRedirect decide adónde:
  // con informe → /result; sin informe → /welcome (mensajito de bienvenida).
  // Si llegan acá ya con sesión activa, mismo redirect.
  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session]);

  const valid = email.trim() !== '' && password.length >= 6 && phoneValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(traducirError(error));
      else navigate('/', { replace: true });
    } else {
      const { error, needsConfirmation } = await signUp(email, password, phone.trim() || undefined);
      if (error) setError(traducirError(error));
      else if (needsConfirmation) {
        setInfo('Te enviamos un email para confirmar tu cuenta. Confirmalo y volvé a iniciar sesión.');
        setMode('signin');
      } else {
        navigate('/', { replace: true });
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#D4537E] rounded-full mb-4">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h1
            className="text-3xl mb-2 text-[#D4537E]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {mode === 'signin' ? 'Iniciá sesión' : 'Creá tu cuenta'}
          </h1>
          <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
            Para ver tu perfil y el historial de tus informes
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-gray-700 text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="mt-1 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-700 text-sm">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="mt-1 rounded-xl"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <Label htmlFor="phone" className="text-gray-700 text-sm">Teléfono (WhatsApp, opcional)</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+5491112345678"
                className="mt-1 rounded-xl"
              />
              {phone.trim() !== '' && !phoneValid && (
                <p className="text-xs text-[#D4537E] mt-1">
                  Formato: + código de país sin espacios. Ej: +5491112345678
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Lo usamos para conectar tu cuenta con WhatsApp cuando lancemos el chatbot.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-[#D4537E]">{error}</p>}
          {info && <p className="text-sm text-[#3B6D11]">{info}</p>}

          <Button
            type="submit"
            disabled={!valid || submitting}
            className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white py-5 rounded-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Un momento…' : mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
          className="w-full text-center text-sm text-gray-600 mt-6 hover:text-[#D4537E]"
        >
          {mode === 'signin'
            ? '¿No tenés cuenta? Creá una'
            : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </motion.div>
    </div>
  );
}

// Mensajes de Supabase en inglés → algo entendible en español.
function traducirError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese email.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('email not confirmed')) return 'Tenés que confirmar tu email antes de iniciar sesión.';
  return msg;
}
