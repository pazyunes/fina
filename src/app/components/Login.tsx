import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

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
  // PR6c — Ahora el input acepta solo los dígitos locales (área + número). El
  // prefijo "+54" es fijo, se muestra al lado del input y se concatena al
  // armar el valor E.164 para la DB. Argentina es el único país soportado por
  // ahora; cuando agreguemos otros se reemplaza por un selector.
  const [phoneDigits, setPhoneDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Argentina: el número local es área + abonado = 10 dígitos. El "9" de celular
  // es opcional; lo normalizamos para que "11..." y "9 11..." sean EL MISMO
  // teléfono. También sacamos un 0 inicial (formato local).
  const phoneNormalized = (() => {
    let n = phoneDigits.replace(/\D/g, '');
    if (n.startsWith('0')) n = n.slice(1);
    if (n.length === 11 && n.startsWith('9')) n = n.slice(1);
    return n;
  })();
  const phoneValid =
    mode === 'signin' || phoneDigits === '' || phoneNormalized.length === 10;
  // Canónico SIN el 9: +54 + 10 dígitos. Así el índice único de user_profiles
  // trata con-9 y sin-9 como el mismo número.
  const phoneE164 = phoneNormalized.length === 10 ? `+54${phoneNormalized}` : '';

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
      // No permitir dos cuentas con el mismo teléfono (también lo respalda el
      // índice único de user_profiles). El RPC es security-definer.
      if (phoneE164) {
        try {
          const { data: inUse } = await supabase.rpc('phone_in_use', { p_phone: phoneE164 });
          if (inUse) {
            setError('Ese teléfono ya está registrado en otra cuenta.');
            setSubmitting(false);
            return;
          }
        } catch {
          // Si el RPC no existe todavía, seguimos: el índice único es el backstop.
        }
      }
      const { error, needsConfirmation } = await signUp(email, password, phoneE164 || undefined);
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
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#7626B3] rounded-full mb-4">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h1
            className="text-3xl mb-2 text-[#7626B3]"
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
              <Label htmlFor="phone" className="text-gray-700 text-sm">Teléfono (opcional)</Label>
              <div className="mt-1 flex items-stretch rounded-xl border border-gray-200 focus-within:border-[#7626B3] overflow-hidden bg-white">
                <span className="px-3 flex items-center text-sm text-gray-600 bg-gray-50 border-r border-gray-200 select-none">
                  +54
                </span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phoneDigits}
                  onChange={(e) => {
                    // Solo dígitos. Máx 11 (10 del número + un 9 opcional de celular).
                    const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setPhoneDigits(v);
                  }}
                  placeholder="Ej: 11 1234 5678"
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                />
              </div>
              {phoneDigits !== '' && !phoneValid && (
                <p className="text-xs text-[#7626B3] mt-1">
                  Tienen que ser 10 dígitos (código de área + número). El 9 de celular es opcional.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Opcional. Nos ayuda a identificarte y contactarte si lo necesitás.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-[#7626B3]">{error}</p>}
          {info && <p className="text-sm text-[#3B6D11]">{info}</p>}

          <Button
            type="submit"
            disabled={!valid || submitting}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Un momento…' : mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
          className="w-full text-center text-sm text-gray-600 mt-6 hover:text-[#7626B3]"
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
