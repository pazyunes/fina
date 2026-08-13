import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Heart, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signIn, signUp, sendPasswordReset } = useAuth();

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
  const [showPassword, setShowPassword] = useState(false);
  // Modo 'forgot': si el email tiene cuenta o no, para decidir si el botón
  // dice "Enviar link" o "Crear cuenta". null = todavía no lo sabemos
  // (email vacío/incompleto, o el RPC no respondió).
  const [emailRegistered, setEmailRegistered] = useState<boolean | null>(null);

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

  // Modo 'forgot' — consultamos si el email está registrado (debounced) para
  // mostrar "Crear cuenta" en vez de "Enviar link" cuando no lo está.
  useEffect(() => {
    if (mode !== 'forgot') { setEmailRegistered(null); return; }
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) { setEmailRegistered(null); return; }
    let active = true;
    const timer = setTimeout(() => {
      supabase.rpc('email_in_use', { p_email: trimmed }).then(({ data, error }) => {
        if (active && !error) setEmailRegistered(Boolean(data));
      });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [email, mode]);

  const emailTrimmed = email.trim();
  const emailFormatValid = EMAIL_RE.test(emailTrimmed);

  const valid = mode === 'forgot'
    ? emailFormatValid
    : email.trim() !== '' && password.length >= 6 && phoneValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);

    if (mode === 'forgot') {
      if (emailRegistered === false) {
        setMode('signup');
        setSubmitting(false);
        return;
      }
      const { error: resetError } = await sendPasswordReset(email);
      if (resetError) {
        // Supabase ya no revela acá si el email existe o no (eso lo maneja
        // server-side sin error), así que un error real es un fallo genuino
        // (rate limit, redirect URL no permitida, etc.) y sí conviene mostrarlo.
        // eslint-disable-next-line no-console
        console.error('[fina] sendPasswordReset failed:', resetError);
        setError(traducirError(resetError));
      } else {
        setInfo('Si el email está registrado, te mandamos un link para restablecer tu contraseña. Revisá tu casilla (y el spam).');
      }
      setSubmitting(false);
      return;
    }

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
            {mode === 'signin' ? 'Iniciá sesión' : mode === 'signup' ? 'Creá tu cuenta' : 'Recuperá tu contraseña'}
          </h1>
          <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
            {mode === 'forgot'
              ? 'Ponés tu email y te mandamos un link para crear una nueva.'
              : 'Para ver tu perfil y el historial de tus informes'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-gray-700 text-sm">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Si venía de un submit previo (ej. "te mandamos el link"),
                // no lo dejamos pegado en pantalla contradiciendo lo que
                // ahora dice el hint de abajo (inválido / no registrado).
                setError(null);
                setInfo(null);
              }}
              placeholder="tu@email.com"
              className="mt-1 rounded-xl"
            />
            {mode === 'forgot' && emailTrimmed !== '' && (
              !emailFormatValid ? (
                <p className="text-red-500 text-xs mt-1.5">Ingresá un mail válido.</p>
              ) : emailRegistered === true ? (
                <p className="text-[#3B6D11] text-xs mt-1.5">Tocá "Enviar link" y te mandamos uno para recuperar tu contraseña.</p>
              ) : emailRegistered === false ? (
                <p className="text-red-500 text-xs mt-1.5">No estás registrada con este email.</p>
              ) : null
            )}
          </div>

          {mode !== 'forgot' && (
            <div>
              <Label htmlFor="password" className="text-gray-700 text-sm">Contraseña</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#7626B3]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
                  className="mt-1.5 text-xs text-[#7626B3] hover:text-[#682690]"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <Label htmlFor="phone" className="text-gray-700 text-sm">Teléfono</Label>
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
            {submitting
              ? 'Un momento…'
              : mode === 'signin'
              ? 'Iniciar sesión'
              : mode === 'signup'
              ? 'Crear cuenta'
              : emailRegistered === false
              ? 'Crear cuenta'
              : 'Enviar link'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null); setInfo(null);
          }}
          className="w-full text-center text-sm text-gray-600 mt-6 hover:text-[#7626B3]"
        >
          {mode === 'signin'
            ? '¿No tenés cuenta? Creá una'
            : mode === 'signup'
            ? '¿Ya tenés cuenta? Iniciá sesión'
            : '← Volver a iniciar sesión'}
        </button>

        {/* Privacidad — genera confianza antes de cargar datos sensibles. */}
        <div className="flex items-start gap-2 mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7626B3]" />
          <span>Tus datos son <strong>privados y solo tuyos</strong>. Viajan y se guardan cifrados, y solo vos podés verlos desde tu cuenta.</span>
        </div>
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
  if (m.includes('rate limit')) return 'Se enviaron demasiados emails en poco tiempo. Esperá unos minutos y probá de nuevo.';
  if (m.includes('you can only request this after') || m.includes('security purposes')) return 'Esperá un momento antes de pedir otro link — Supabase limita cuántos podés pedir seguidos.';
  return msg;
}
