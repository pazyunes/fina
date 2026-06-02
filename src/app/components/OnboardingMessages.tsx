import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Heart, Sparkles, TrendingUp, Wallet, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

// PR6 — Pantallas intermedias del onboarding ("mensajitos"). Sirven para que
// el flujo se sienta más conversacional. Vienen entre los steps reales y NO
// cuentan en el progreso de OnboardingProgress.
//
// Cinco variantes, una por punto del flujo:
//   /welcome                       → antes de /personal-data (P1)
//   /mensaje/ingresos              → antes de /activity     (P2)
//   /mensaje/gastos-fijos          → antes de /expenses-fixed (P3)
//   /mensaje/gastos-variables      → antes de /expenses-services (P4)
//   /loading                       → antes de /result, 2.5 s   (P5)

interface MessageScreenProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; fill?: string }>;
  title: React.ReactNode;
  body: React.ReactNode;
  buttonLabel: string;
  nextPath: string;
}

function MessageScreen({ icon: Icon, title, body, buttonLabel, nextPath }: MessageScreenProps) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBEAF0] to-white flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-md w-full"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
          className="mb-8 inline-flex items-center justify-center w-20 h-20 bg-[#D4537E] rounded-full"
        >
          <Icon className="w-10 h-10 text-white" strokeWidth={1.75} />
        </motion.div>

        <h2
          className="mb-6 text-[#D4537E]"
          style={{ fontFamily: 'var(--font-serif)', fontSize: '2.25rem', lineHeight: '1.15' }}
        >
          {title}
        </h2>

        <div
          className="text-lg text-gray-700 mb-10 leading-relaxed"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {body}
        </div>

        <Button
          onClick={() => navigate(nextPath)}
          className="bg-[#D4537E] hover:bg-[#C14870] text-white px-10 py-6 rounded-full text-lg"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {buttonLabel}
        </Button>
      </motion.div>
    </div>
  );
}

export function WelcomeScreen() {
  return (
    <MessageScreen
      icon={Heart}
      title="Hola, soy Fina."
      body={
        <>
          Te voy a pedir algunos datos. En <strong>5 minutos</strong> vas a
          terminar y te llevo a un <strong>plan de acción personalizado</strong>{' '}
          para que puedas ordenar tus finanzas y cumplir tus objetivos.
          <br /><br />
          Vamos a pensar por vos.
        </>
      }
      buttonLabel="Empezar →"
      nextPath="/personal-data"
    />
  );
}

export function MessageIngresos() {
  return (
    <MessageScreen
      icon={Wallet}
      title="Ahora hablemos de plata 💰"
      body={
        <>
          Vamos a entender cuánto te entra cada mes. Si tenés freelance o más
          de una fuente de ingresos, también lo vamos a contemplar.
        </>
      }
      buttonLabel="Seguir"
      nextPath="/activity"
    />
  );
}

export function MessageGastosFijos() {
  return (
    <MessageScreen
      icon={Sparkles}
      title="¡Vamos bien!"
      body={
        <>
          Ahora pensemos en los <strong>gastos que se repiten todos los meses</strong>:
          alquiler, expensas, suscripciones, gimnasio, esas cosas. No te olvides
          de ninguna 😉
        </>
      }
      buttonLabel="Seguir"
      nextPath="/expenses-fixed"
    />
  );
}

export function MessageGastosVariables() {
  return (
    <MessageScreen
      icon={TrendingUp}
      title="Última parte."
      body={
        <>
          Ahora los <strong>gastos que cambian mes a mes</strong>: salidas,
          supermercado, regalitos, todo lo que no es fijo.
        </>
      }
      buttonLabel="Seguir"
      nextPath="/expenses-services"
    />
  );
}

// P5 — Pantalla "Pensando tu plan…". Auto-navega a /result después de 2.5 s.
// Durante ese tiempo Main.tsx ya disparó saveReport, así que cuando llegamos
// a /result el informe está persistido y hasReport en el contexto es true.
export function LoadingScreen() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate('/result', { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBEAF0] to-white flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md w-full"
      >
        <Loader2 className="w-12 h-12 text-[#D4537E] mx-auto mb-6 animate-spin" strokeWidth={2} />
        <h2
          className="mb-3 text-[#D4537E]"
          style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}
        >
          Pensando tu plan… ⚡
        </h2>
        <p
          className="text-gray-700"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Estoy analizando tus números y armando recomendaciones para vos.
        </p>
      </motion.div>
    </div>
  );
}
