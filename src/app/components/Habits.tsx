import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BackButton } from './BackButton';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingProgress } from './OnboardingProgress';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { INVESTMENT_KINDS } from '../lib/investmentGuides';
import { Currency, UserData } from '../types';

interface HabitsProps {
  initial?: Partial<UserData>;
  // PR — editMode: se reusa desde el perfil (/editar/finanzas) para modificar
  // ahorro/inversión sin navegar al siguiente paso del onboarding.
  editMode?: boolean;
  onComplete: (data: {
    knowsLastMonthExpenses: boolean;
    saves: boolean;
    invests: boolean;
    savingsAmount?: number;
    savingsCurrency?: Currency;
    savingsOriginalAmount?: number;
    investedAmount?: number;
    investedCurrency?: Currency;
    investedOriginalAmount?: number;
    investedIn?: string[];
  }) => void;
}

const fmtMoney = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '');
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};

export function Habits({ initial, onComplete, editMode }: HabitsProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const usdRate = initial?.exchangeRate?.rate ?? null;

  const [habits, setHabits] = useState({
    knowsLastMonthExpenses: initial?.knowsLastMonthExpenses ?? null as boolean | null,
    saves: initial?.saves ?? null as boolean | null,
    invests: initial?.invests ?? null as boolean | null,
  });

  // Ahorro e inversión: monto (string) + moneda. Se muestra el original si se
  // cargó en USD; el ARS convertido se calcula al guardar.
  const [savingsCurrency, setSavingsCurrency] = useState<Currency>(initial?.savingsCurrency ?? 'ARS');
  const [savingsInput, setSavingsInput] = useState(() =>
    initial?.savingsCurrency === 'USD'
      ? (initial?.savingsOriginalAmount ? String(initial.savingsOriginalAmount) : '')
      : (initial?.savingsAmount ? String(initial.savingsAmount) : '')
  );
  const [investedCurrency, setInvestedCurrency] = useState<Currency>(initial?.investedCurrency ?? 'ARS');
  const [investedInput, setInvestedInput] = useState(() =>
    initial?.investedCurrency === 'USD'
      ? (initial?.investedOriginalAmount ? String(initial.investedOriginalAmount) : '')
      : (initial?.investedAmount ? String(initial.investedAmount) : '')
  );

  // ¿En qué invierte? (opcional) — chips de INVESTMENT_KINDS + texto libre "Otro".
  // Al cargar, separamos lo conocido (chips) de lo que no está en la lista (Otro).
  const [investedKinds, setInvestedKinds] = useState<string[]>(
    () => (initial?.investedIn ?? []).filter((x) => INVESTMENT_KINDS.includes(x))
  );
  const [investedOther, setInvestedOther] = useState<string>(
    () => (initial?.investedIn ?? []).filter((x) => !INVESTMENT_KINDS.includes(x)).join(', ')
  );
  const toggleKind = (k: string) =>
    setInvestedKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const toArs = (digits: number, cur: Currency) => (cur === 'USD' ? (usdRate ? arsFromUsd(digits, usdRate) : 0) : digits);

  const isComplete = habits.knowsLastMonthExpenses !== null &&
                     habits.saves !== null &&
                     habits.invests !== null;

  const commit = () => {
    const data: Record<string, unknown> = {};
    if (habits.knowsLastMonthExpenses !== null) data.knowsLastMonthExpenses = habits.knowsLastMonthExpenses;
    if (habits.saves !== null) {
      data.saves = habits.saves;
      const d = habits.saves ? (parseInt(savingsInput.replace(/\D/g, '')) || 0) : 0;
      data.savingsAmount = toArs(d, savingsCurrency);
      data.savingsCurrency = savingsCurrency;
      data.savingsOriginalAmount = d;
    }
    if (habits.invests !== null) {
      data.invests = habits.invests;
      const d = habits.invests ? (parseInt(investedInput.replace(/\D/g, '')) || 0) : 0;
      data.investedAmount = toArs(d, investedCurrency);
      data.investedCurrency = investedCurrency;
      data.investedOriginalAmount = d;
      // En qué invierte (chips + "Otro"). Vacío si no invierte o no cargó nada.
      const otherClean = investedOther.trim();
      data.investedIn = habits.invests
        ? [...investedKinds, ...(otherClean ? [otherClean] : [])]
        : [];
    }
    onComplete(data as Parameters<HabitsProps['onComplete']>[0]);
  };
  const handleSubmit = () => {
    if (isComplete) {
      commit();
      if (!editMode) navigate('/goals');
    }
  };

  // Campo de monto con toggle de moneda (ahorro / inversión).
  const renderAmount = (
    label: string,
    input: string,
    setInput: (v: string) => void,
    currency: Currency,
    setCurrency: (c: Currency) => void,
  ) => {
    const digits = parseInt(input.replace(/\D/g, '')) || 0;
    return (
      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-gray-600">{label}</label>
          <CurrencyToggle value={currency} usdEnabled={!!usdRate} onChange={setCurrency} />
        </div>
        <div className="relative">
          <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>
            {currency === 'USD' ? 'USD' : '$'}
          </span>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={fmtMoney(input)}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`}
          />
        </div>
        {currency === 'USD' && digits > 0 && usdRate && (
          <p className="text-xs text-gray-500 mt-1">≈ {formatArs(arsFromUsd(digits, usdRate))} al cambio del día</p>
        )}
      </motion.div>
    );
  };

  const QUESTIONS: Array<{ key: 'knowsLastMonthExpenses' | 'saves' | 'invests'; text: string }> = [
    { key: 'knowsLastMonthExpenses', text: '¿Sabés cuánto gastaste el mes pasado?' },
    { key: 'saves', text: '¿Ahorrás regularmente?' },
    { key: 'invests', text: '¿Invertís tu dinero?' },
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
            {QUESTIONS.map(({ key, text }) => (
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

                {key === 'saves' && habits.saves === true &&
                  renderAmount('¿Cuánto tenés ahorrado? (opcional)', savingsInput, setSavingsInput, savingsCurrency, setSavingsCurrency)}
                {key === 'invests' && habits.invests === true && (
                  <>
                    {renderAmount('¿Cuánto tenés invertido? (opcional)', investedInput, setInvestedInput, investedCurrency, setInvestedCurrency)}
                    {/* ¿En qué invierte? (opcional) — personaliza la pantalla de Inversiones. */}
                    <div className="mt-3">
                      <label className="block text-sm text-gray-600 mb-2">¿En qué invertís? (opcional)</label>
                      <div className="flex flex-wrap gap-2">
                        {INVESTMENT_KINDS.map((k) => {
                          const on = investedKinds.includes(k);
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => toggleKind(k)}
                              className={`text-sm rounded-full px-3 py-1.5 border-2 transition-colors ${on ? 'border-[#7626B3] bg-[#F0E7FA] text-[#7626B3] font-medium' : 'border-gray-200 bg-white text-gray-600 hover:border-[#7626B3]/50'}`}
                            >
                              {k}
                            </button>
                          );
                        })}
                      </div>
                      <Input
                        value={investedOther}
                        onChange={(e) => setInvestedOther(e.target.value)}
                        placeholder="Otro (contanos en qué)"
                        className="mt-2 rounded-xl"
                      />
                    </div>
                  </>
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
