import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { g, Gender } from '../utils/gender';
import { UserData } from '../types';

interface ContextProps {
  initial?: Partial<UserData>;
  gender?: Gender;
  onComplete: (data: { livesAlone: boolean }) => void;
}

export function Context({ initial, gender, onComplete }: ContextProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [livesAlone, setLivesAlone] = useState<boolean | null>(initial?.livesAlone ?? null);

  const handleSubmit = () => {
    if (livesAlone !== null) {
      onComplete({ livesAlone });
      navigate('/activity');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <BackButton currentPath={pathname} />

          <div className="mb-6">
            <h2
              className="text-3xl mb-2 text-[#D4537E]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Tu situación
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Para entender mejor cómo te organizás
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-lg mb-4 text-gray-700">¿Vivís {g(gender, 'sola', 'solo')}?</p>

            <button
              onClick={() => setLivesAlone(true)}
              className={`w-full p-5 rounded-2xl border-2 transition-all ${
                livesAlone === true
                  ? 'border-[#D4537E] bg-[#FBEAF0]'
                  : 'border-gray-200 bg-white hover:border-[#D4537E]/50'
              }`}
            >
              <p className="text-lg" style={{ fontFamily: 'var(--font-sans)' }}>
                Sí, vivo {g(gender, 'sola', 'solo')}
              </p>
            </button>

            <button
              onClick={() => setLivesAlone(false)}
              className={`w-full p-5 rounded-2xl border-2 transition-all ${
                livesAlone === false
                  ? 'border-[#D4537E] bg-[#FBEAF0]'
                  : 'border-gray-200 bg-white hover:border-[#D4537E]/50'
              }`}
            >
              <p className="text-lg" style={{ fontFamily: 'var(--font-sans)' }}>
                No, vivo {g(gender, 'acompañada', 'acompañado')}
              </p>
            </button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={livesAlone === null}
            className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white py-5 rounded-full text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar
          </Button>
        </motion.div>
      </div>

      <div className="p-4">
        <OnboardingProgress currentPath={pathname} />
      </div>
    </div>
  );
}
