import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

// PR6 — "Pensando tu plan…". Auto-navega a /result después de 2.5 s.
// Mientras está visible, Main ya disparó saveReport y markHasReport, así que
// cuando aterrizamos en /result el informe está persistido y OnboardingGate
// no nos rebota.
//
// (Las pantallas P1/P2/P3/P4 que existían acá pasaron a ser banners inline
// en los steps correspondientes — ver StepIntroMessage.tsx.)
export function LoadingScreen() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate('/result', { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0E7FA] to-white flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md w-full"
      >
        <Loader2 className="w-12 h-12 text-[#7626B3] mx-auto mb-6 animate-spin" strokeWidth={2} />
        <h2
          className="mb-3 text-[#7626B3]"
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
