import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || sending) return;
    setSending(true);
    setError(null);
    const { error } = await signInWithOtp(email.trim());
    setSending(false);
    if (error) setError(error);
    else setSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 shadow-md w-full max-w-md"
      >
        <h1
          className="text-3xl mb-2 text-[#D4537E]"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Bienvenida a FINA
        </h1>
        <p className="text-gray-600 mb-6" style={{ fontFamily: 'var(--font-sans)' }}>
          Ingresá tu email y te mandamos un link mágico para entrar. Guardamos tu historial para que puedas ver tu progreso.
        </p>

        {sent ? (
          <div className="bg-[#FBEAF0] rounded-2xl p-4 text-[#D4537E]">
            Revisá tu casilla — te mandamos un link a <strong>{email}</strong>. Abrilo desde este mismo dispositivo.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-[#D4537E]"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
            {error && <p className="text-sm text-[#C0392B]">{error}</p>}
            <Button
              type="submit"
              disabled={sending}
              className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white disabled:opacity-50"
            >
              {sending ? 'Enviando...' : 'Enviarme el link'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
