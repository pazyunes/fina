import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { Button } from './ui/button';

// Welcome screen. Mostrado en `/` cuando NO hay sesión activa (el redirect
// para usuarios logueados lo decide RootRedirect). Dos CTAs: iniciar sesión
// o crear cuenta. Ambos van a /login y el modo lo elige location.state.mode.
export function Splash() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBEAF0] to-white flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-md w-full"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
          className="mb-8"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 bg-[#D4537E] rounded-full mb-6">
            <Heart className="w-12 h-12 text-white fill-white" />
          </div>
        </motion.div>

        <h1
          className="mb-4 text-[#D4537E]"
          style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', lineHeight: '1.1' }}
        >
          FINA
        </h1>

        <p
          className="text-xl mb-8 text-gray-700"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Entender tu plata no tiene<br />que ser complicado
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-3 w-full max-w-xs mx-auto"
        >
          <Button
            onClick={() => navigate('/login', { state: { mode: 'signin' } })}
            className="bg-[#D4537E] hover:bg-[#C14870] text-white py-6 rounded-full text-lg"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Iniciar sesión
          </Button>
          <Button
            onClick={() => navigate('/login', { state: { mode: 'signup' } })}
            variant="outline"
            className="border-2 border-[#D4537E] text-[#D4537E] hover:bg-[#FBEAF0] py-6 rounded-full text-lg"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Crear cuenta
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
