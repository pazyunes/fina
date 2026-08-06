import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BackButton } from './BackButton';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingProgress } from './OnboardingProgress';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { UserData } from '../types';

interface HabitsProps {
  initial?: Partial<UserData>;
  // PR — editMode: se reusa desde el perfil (/editar/finanzas) para modificar
  // ahorro/inversión sin navegar al siguiente paso del onboarding.
  editMode?: boolean;
  onComplete: (data: {
    knowsLastMonthExpenses: boolean;
    saves: boolean;
    invests: boolean;
    savingsAmount?: number;   // cuánto tiene ahorrado (ARS)
    investedAmount?: number;  // cuánto tiene invertido (ARS)
  }) => void;
}

const fmtMoney = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '');
  return n ? `$${n.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : '';
};

export function Habits({ initial, onComplete, editMode }: HabitsProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [habits, setHabits] = useState({
    knowsLastMonthExpenses: initial?.knowsLastMonthExpenses ?? null as boolean | null,
    saves: initial?.saves ?? null as boolean | null,
    invests: initial?.invests ?? null as boolean | null,
  });
  const [savingsAmount, setSavingsAmount] = useState(initial?.savingsAmount ? String(initial.savingsAmount) : '');
  const [investedAmount, setInvestedAmount] = useState(initial?.investedAmount ? String(initial.investedAmount) : '');

  const isComplete = habits.knowsLastMonthExpenses !== null &&
                     habits.saves !== null &&
                     habits.invests !== null;

  // Commit parcial (solo lo respondido) para no perder respuestas al volver.
  const commit = () => {
    const data: Record<string, boolean | number> = {};
    if (habits.knowsLastMonthExpenses !== null) data.knowsLastMonthExpenses = habits.knowsLastMonthExpenses;
    if (habits.saves !== null) {
      data.saves = habits.saves;
      // Si ahorra, guardamos el monto; si no, lo dejamos en 0.
      data.savingsAmount = habits.saves ? (parseInt(savingsAmount.replace(/\D/g, '')) || 0) : 0;
    }
    if (habits.invests !== null) {
      data.invests = habits.invests;
      data.investedAmount = habits.invests ? (parseInt(investedAmount.replace(/\D/g, '')) || 0) : 0;
    }
    onComplete(data as { knowsLastMonthExpenses: boolean; saves: boolean; invests: boolean; savingsAmount?: number; investedAmount?: number });
  };
  const handleSubmit = () => {
    if (isComplete) {
      commit();
      if (!editMode) navigate('/goals');
    }
  };

  const QUESTIONS: Array<{ key: 'knowsLastMonthExpenses' | 'saves' | 'invests'; text: string; amountLabel?: string; amountValue?: string; setAmount?: (v: string) => void }> = [
    { key: 'knowsLastMonthExpenses', text: '¿Sabés cuánto gastaste el mes pasado?' },
    { key: 'saves', text: '¿Ahorrás regularmente?', amountLabel: '¿Cuánto tenés ahorrado?', amountValue: savingsAmount, setAmount: setSavingsAmount },
    { key: 'invests', text: '¿Invertís tu dinero?', amountLabel: '¿Cuánto tenés invertido?', amountValue: investedAmount, setAmount: setInvestedAmount },
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col ${editMode ? '' : 'lg:pl-72'}`}>
      {!editMode && <OnboardingAside currentPath={pathname} />}
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md lg:max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <BackButton currentPath={pathname} onBeforeBack={commit} />

          <div className="mb-6">
            <h2
              className="text-3xl mb-2 text-[#7626B3]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {editMode ? 'Ahorro e inversión' : 'Tus hábitos'}
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              {editMode ? 'Actualizá lo que cambió y el informe se recalcula.' : 'Esto no es para juzgarte, es para ayudarte'}
            </p>
          </div>

          <div className="space-y-6">
            {QUESTIONS.map(({ key, text, amountLabel, amountValue, setAmount }) => (
              <div key={key}>
                <p className="text-lg mb-3 text-gray-700">{text}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setHabits({ ...habits, [key]: true })}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      habits[key] === true
                        ? 'border-[#7626B3] bg-[#F0E7FA]'
                        : 'border-gray-200 bg-white hover:border-[#7626B3]/50'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setHabits({ ...habits, [key]: false })}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      habits[key] === false
                        ? 'border-[#7626B3] bg-[#F0E7FA]'
                        : 'border-gray-200 bg-white hover:border-[#7626B3]/50'
                    }`}
                  >
                    No
                  </button>
                </div>

                {/* Monto: aparece si respondió "Sí" (solo ahorro/inversión). */}
                {amountLabel && habits[key] === true && setAmount && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                    <label className="block text-sm text-gray-600 mb-2">{amountLabel}</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={fmtMoney(amountValue ?? '')}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="$0"
                      className={`rounded-xl ${AMOUNT_FIELD_CLASS}`}
                    />
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isComplete}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editMode ? 'Guardar cambios' : 'Continuar'}
          </Button>
        </motion.div>
      </div>

      {!editMode && (
        <div className="p-4">
          <OnboardingProgress currentPath={pathname} />
        </div>
      )}
    </div>
  );
}
