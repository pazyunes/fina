import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { X, Plus, Check } from 'lucide-react';
import { DEBUG_MODE } from '../config';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { UserData } from '../types';

interface GoalItem {
  title: string;
  amount: string;
  timeframe: string;
}

interface GoalsProps {
  initial?: Partial<UserData>;
  onComplete: (data: {
    goals: string[];
    specificGoals: Array<{
      title: string;
      amount: number;
      timeframe: number;
    }>;
  }) => void;
}

// "12000" -> "12.000" (sin símbolo, igual que el resto del flujo de objetivos)
const formatGoalAmount = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  const cleanNumbers = numbers.replace(/^0+/, '') || '0';
  return cleanNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const GOAL_OPTIONS = [
  'Ahorrar para emergencias',
  'Viajar',
  'Comprar algo específico',
  'Pagar deudas',
  'Invertir',
  'Independizarme',
  'No tengo'
];

export function Goals({ initial, onComplete }: GoalsProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [selectedGoals, setSelectedGoals] = useState<string[]>(initial?.goals ?? []);
  const [specificGoals, setSpecificGoals] = useState<GoalItem[]>(
    (initial?.specificGoals ?? []).map((goal) => ({
      title: goal.title,
      amount: formatGoalAmount(String(goal.amount)),
      timeframe: String(goal.timeframe),
    }))
  );
  const [currentGoal, setCurrentGoal] = useState<GoalItem>({
    title: '',
    amount: '',
    timeframe: '',
  });

  const [showSavingsGoal, setShowSavingsGoal] = useState(initial?.goals?.includes('No tengo') ?? false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const toggleGoal = (goal: string) => {
    if (goal === 'No tengo') {
      const wasSelected = selectedGoals.includes(goal);
      setSelectedGoals(wasSelected ? [] : [goal]);
      setShowSavingsGoal(!wasSelected);
    } else {
      setSelectedGoals(prev => {
        const filtered = prev.filter(g => g !== 'No tengo');
        if (prev.includes(goal)) {
          return filtered.filter(g => g !== goal);
        } else {
          return [...filtered, goal];
        }
      });
      setShowSavingsGoal(false);
    }
  };

  const formatCurrency = (value: string) => {
    // Remove all non-digit characters
    const numbers = value.replace(/\D/g, '');
    // Prevent leading zeros except for "0" itself
    const cleanNumbers = numbers.replace(/^0+/, '') || '0';
    // Format with thousands separator
    return cleanNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const addGoal = () => {
    if (currentGoal.title && currentGoal.amount && currentGoal.timeframe) {
      setSpecificGoals([...specificGoals, { ...currentGoal }]);
      setCurrentGoal({ title: '', amount: '', timeframe: '' });
      setShowConfirmation(true);
    }
  };

  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => {
        setShowConfirmation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmation]);

  const removeGoal = (index: number) => {
    setSpecificGoals(specificGoals.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const parsedGoals = specificGoals.map(goal => ({
      title: goal.title,
      amount: parseFloat(goal.amount.replace(/\./g, '')),
      timeframe: parseInt(goal.timeframe),
    }));

    onComplete({
      goals: selectedGoals,
      specificGoals: parsedGoals,
    });
    
    // Navigate to AI Reasoning if debug mode is enabled, otherwise go to result
    navigate(DEBUG_MODE ? '/ai-reasoning' : '/result');
  };

  const isValid = selectedGoals.length > 0 || specificGoals.length > 0;
  const canAddCurrentGoal = currentGoal.title && currentGoal.amount && currentGoal.timeframe;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full overflow-y-auto pb-32">
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
              Tus objetivos
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              ¿Qué querés lograr? Elegí categorías o definí tus propios objetivos
            </p>
          </div>

          {/* Categorías generales - PRIMERO */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Categorías generales</h3>
            <div className="space-y-3">
              {GOAL_OPTIONS.map(goal => (
                <div
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedGoals.includes(goal)
                      ? 'border-[#D4537E] bg-[#FBEAF0]'
                      : 'border-gray-200 bg-white hover:border-[#D4537E]/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedGoals.includes(goal)}
                    onCheckedChange={() => toggleGoal(goal)}
                    className="data-[state=checked]:bg-[#D4537E] data-[state=checked]:border-[#D4537E]"
                  />
                  <span className="text-gray-700">{goal}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Si eligió "No tengo" - formulario de ahorro general */}
          {showSavingsGoal && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#FFF8F0] p-6 rounded-2xl shadow-sm space-y-4 mb-6 border-2 border-[#D85A30]"
            >
              <p className="text-gray-700 mb-4">
                Perfecto! Igual es bueno ahorrar. ¿Cuánto querés juntar?
              </p>
              <div>
                <Label htmlFor="savings-amount" className="text-gray-700">
                  Monto que querés ahorrar
                </Label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="savings-amount"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentGoal.amount}
                    onChange={(e) => setCurrentGoal({ ...currentGoal, amount: formatCurrency(e.target.value), title: 'Ahorro general' })}
                    placeholder="0"
                    className={`pl-8 rounded-xl ${AMOUNT_FIELD_CLASS}`}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="savings-timeframe" className="text-gray-700">
                  ¿En cuántos meses?
                </Label>
                <Input
                  id="savings-timeframe"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentGoal.timeframe}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 0 || e.target.value === '') {
                      setCurrentGoal({ ...currentGoal, timeframe: e.target.value, title: 'Ahorro general' });
                    }
                  }}
                  placeholder="6"
                  min="1"
                  max="60"
                  className="mt-2 bg-white border-gray-200 focus:border-[#D85A30] focus:ring-[#D85A30] rounded-xl"
                />
              </div>

              <Button
                onClick={() => {
                  if (currentGoal.amount && currentGoal.timeframe) {
                    addGoal();
                    setShowSavingsGoal(false);
                  }
                }}
                disabled={!currentGoal.amount || !currentGoal.timeframe}
                className="w-full bg-[#D85A30] hover:bg-[#C14F28] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar objetivo de ahorro
              </Button>
            </motion.div>
          )}

          {/* Lista de objetivos creados */}
          <AnimatePresence>
            {specificGoals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6"
              >
                <h3 className="text-sm font-medium text-gray-700 mb-3">Objetivos específicos creados</h3>
                <div className="space-y-3">
                  {specificGoals.map((goal, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-white p-4 rounded-xl border-2 border-[#D4537E] flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-[#D4537E] mb-1">{goal.title}</p>
                        <p className="text-sm text-gray-600">
                          ${formatCurrency(goal.amount)} en {goal.timeframe} meses
                        </p>
                      </div>
                      <button
                        onClick={() => removeGoal(index)}
                        className="text-gray-400 hover:text-[#D4537E] p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario para agregar objetivo específico - DESPUÉS */}
          {!showSavingsGoal && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                O definí un objetivo específico (viaje, compra, etc.)
              </h3>
              <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
                <div>
                  <Label htmlFor="goal-title" className="text-gray-700">
                    ¿Qué querés lograr?
                  </Label>
                  <Input
                    id="goal-title"
                    type="text"
                    value={currentGoal.title}
                    onChange={(e) => setCurrentGoal({ ...currentGoal, title: e.target.value })}
                    placeholder="Ej: Viaje a San Martín, nueva notebook..."
                    className="mt-2 bg-white border-gray-200 focus:border-[#D4537E] focus:ring-[#D4537E] rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="goal-amount" className="text-gray-700">
                    Monto total objetivo
                  </Label>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <Input
                      id="goal-amount"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={currentGoal.amount}
                      onChange={(e) => setCurrentGoal({ ...currentGoal, amount: formatCurrency(e.target.value) })}
                      placeholder="0"
                      className={`pl-8 rounded-xl ${AMOUNT_FIELD_CLASS}`}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="goal-timeframe" className="text-gray-700">
                    Cantidad de meses para cumplirlo
                  </Label>
                  <Input
                    id="goal-timeframe"
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentGoal.timeframe}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 0 || e.target.value === '') {
                        setCurrentGoal({ ...currentGoal, timeframe: e.target.value });
                      }
                    }}
                    placeholder="3"
                    min="1"
                    max="60"
                    className="mt-2 bg-white border-gray-200 focus:border-[#D4537E] focus:ring-[#D4537E] rounded-xl"
                  />
                </div>

                <Button
                  onClick={addGoal}
                  disabled={!canAddCurrentGoal}
                  className="w-full bg-[#3B6D11] hover:bg-[#2d5a0d] text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Guardar objetivo
                </Button>

                {/* Confirmation message */}
                <AnimatePresence>
                  {showConfirmation && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg"
                    >
                      <Check className="w-5 h-5" />
                      <span>Objetivo guardado</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white py-5 rounded-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ver mi análisis
          </Button>

          <div className="mt-4">
            <OnboardingProgress currentPath={pathname} />
          </div>
        </div>
      </div>
    </div>
  );
}