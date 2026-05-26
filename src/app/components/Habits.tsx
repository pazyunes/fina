import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { UserData } from '../types';

interface HabitsProps {
  initial?: Partial<UserData>;
  onComplete: (data: {
    knowsLastMonthExpenses: boolean;
    saves: boolean;
    invests: boolean;
  }) => void;
}

export function Habits({ initial, onComplete }: HabitsProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [habits, setHabits] = useState({
    knowsLastMonthExpenses: initial?.knowsLastMonthExpenses ?? null as boolean | null,
    saves: initial?.saves ?? null as boolean | null,
    invests: initial?.invests ?? null as boolean | null,
  });

  const isComplete = habits.knowsLastMonthExpenses !== null &&
                     habits.saves !== null &&
                     habits.invests !== null;

  const handleSubmit = () => {
    if (isComplete) {
      onComplete({
        knowsLastMonthExpenses: habits.knowsLastMonthExpenses!,
        saves: habits.saves!,
        invests: habits.invests!,
      });
      navigate('/goals');
    }
  };

  const QUESTIONS: Array<{ key: 'knowsLastMonthExpenses' | 'saves' | 'invests'; text: string }> = [
    { key: 'knowsLastMonthExpenses', text: '¿Sabés cuánto gastaste el mes pasado?' },
    { key: 'saves', text: '¿Ahorrás regularmente?' },
    { key: 'invests', text: '¿Invertís tu dinero?' },
  ];

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
              Tus hábitos
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Esto no es para juzgarte, es para ayudarte
            </p>
          </div>

          <div className="space-y-6">
            {QUESTIONS.map(({ key, text }) => (
              <div key={key}>
                <p className="text-lg mb-3 text-gray-700">{text}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setHabits({ ...habits, [key]: true })}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      habits[key] === true
                        ? 'border-[#D4537E] bg-[#FBEAF0]'
                        : 'border-gray-200 bg-white hover:border-[#D4537E]/50'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setHabits({ ...habits, [key]: false })}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      habits[key] === false
                        ? 'border-[#D4537E] bg-[#FBEAF0]'
                        : 'border-gray-200 bg-white hover:border-[#D4537E]/50'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isComplete}
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
