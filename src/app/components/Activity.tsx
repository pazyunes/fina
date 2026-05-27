import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { Currency, UserData } from '../types';

type Activity = 'works' | 'studies' | 'both' | 'neither';

interface ActivityProps {
  initial?: Partial<UserData>;
  onComplete: (data: {
    worksOrStudies: Activity;
    monthlyIncome: number; // siempre en ARS (convertido si se cargó en USD)
    incomeRange?: string;
    incomeCurrency: Currency;
    incomeOriginalAmount: number; // USD si incomeCurrency === 'USD', si no ARS
  }) => void;
}

interface IncomeRange {
  id: string;
  label: string;
  value: number; // punto medio (o piso para el último tramo) en la moneda del tramo
}

// Tramos de ingreso en ARS. `value` es el punto medio usado para cálculos;
// para "Más de $4.000.000" se usa $4.000.000 como piso (no hay techo).
const INCOME_RANGES_ARS: IncomeRange[] = [
  { id: 'ars-lt500', label: 'Menos de $500.000', value: 250000 },
  { id: 'ars-500-1000', label: '$500.000 – $1.000.000', value: 750000 },
  { id: 'ars-1000-1500', label: '$1.000.000 – $1.500.000', value: 1250000 },
  { id: 'ars-1500-2500', label: '$1.500.000 – $2.500.000', value: 2000000 },
  { id: 'ars-2500-4000', label: '$2.500.000 – $4.000.000', value: 3250000 },
  { id: 'ars-gt4000', label: 'Más de $4.000.000', value: 4000000 },
];

// Tramos equivalentes en USD para quien cobra en dólares. `value` es el punto
// medio en USD; se convierte a ARS al cambio del día para los cálculos.
const INCOME_RANGES_USD: IncomeRange[] = [
  { id: 'usd-lt500', label: 'Menos de USD 500', value: 250 },
  { id: 'usd-500-1000', label: 'USD 500 – 1.000', value: 750 },
  { id: 'usd-1000-2000', label: 'USD 1.000 – 2.000', value: 1500 },
  { id: 'usd-2000-3000', label: 'USD 2.000 – 3.000', value: 2500 },
  { id: 'usd-3000-5000', label: 'USD 3.000 – 5.000', value: 4000 },
  { id: 'usd-gt5000', label: 'Más de USD 5.000', value: 5000 },
];

const formatCurrency = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  const cleanNumbers = numbers.replace(/^0+/, '') || '0';
  const numValue = parseInt(cleanNumbers);
  if (numValue < 0) return '0';
  return cleanNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export function Activity({ initial, onComplete }: ActivityProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [activity, setActivity] = useState<Activity | null>(initial?.worksOrStudies ?? null);

  // Cotización del blue para convertir ingresos cargados en USD a ARS.
  const usdRate = initial?.exchangeRate?.rate ?? null;
  const [currency, setCurrency] = useState<Currency>(initial?.incomeCurrency ?? 'ARS');

  const ranges = currency === 'USD' ? INCOME_RANGES_USD : INCOME_RANGES_ARS;

  // Pre-fill: el monto original guardado está en la moneda elegida; lo matcheo
  // contra el punto medio del tramo, o lo trato como monto exacto.
  const initCurrency = initial?.incomeCurrency ?? 'ARS';
  const initRanges = initCurrency === 'USD' ? INCOME_RANGES_USD : INCOME_RANGES_ARS;
  const initOriginal = initCurrency === 'USD'
    ? (initial?.incomeOriginalAmount ?? 0)
    : (initial?.incomeOriginalAmount ?? initial?.monthlyIncome ?? 0);
  const matchedRange = initRanges.find(
    (r) => r.value === initOriginal && initial?.incomeRange !== 'Monto exacto'
  );
  const [incomeRange, setIncomeRange] = useState<string>(matchedRange?.id ?? '');
  const [useExact, setUseExact] = useState<boolean>(!matchedRange && !!initial?.monthlyIncome);
  const [exactIncome, setExactIncome] = useState<string>(
    !matchedRange && initOriginal ? formatCurrency(String(initOriginal)) : ''
  );

  const selectedRange = ranges.find((r) => r.id === incomeRange);
  const incomeValid = incomeRange !== '' || (useExact && exactIncome !== '');

  // Al cambiar de moneda los tramos dejan de aplicar (están en otra escala),
  // así que reseteo la selección y el monto exacto para evitar mezclas.
  const handleCurrencyChange = (next: Currency) => {
    if (next === currency) return;
    setCurrency(next);
    setIncomeRange('');
    setExactIncome('');
  };

  // Vista previa en ARS del monto exacto cargado en USD.
  const exactUsdDigits = parseInt(exactIncome.replace(/\D/g, '')) || 0;
  const exactUsdInArs = currency === 'USD' && usdRate ? arsFromUsd(exactUsdDigits, usdRate) : 0;

  const handleSubmit = () => {
    if (!activity || !incomeValid) return;

    const exactValue = parseInt(exactIncome.replace(/\D/g, '')) || 0;
    const useExactValue = useExact && exactValue > 0;

    // Monto en la moneda elegida (USD o ARS).
    const originalAmount = useExactValue ? exactValue : (selectedRange?.value ?? 0);
    // monthlyIncome siempre en ARS para los cálculos.
    const monthlyIncome = currency === 'USD'
      ? (usdRate ? arsFromUsd(originalAmount, usdRate) : 0)
      : originalAmount;
    const incomeRangeLabel = useExactValue ? 'Monto exacto' : selectedRange?.label;

    onComplete({
      worksOrStudies: activity,
      monthlyIncome,
      incomeRange: incomeRangeLabel,
      incomeCurrency: currency,
      incomeOriginalAmount: originalAmount,
    });
    navigate('/bank');
  };

  const getIncomeLabel = () => {
    if (activity === 'works' || activity === 'both') {
      return '¿Cuánto cobrás por mes aproximadamente?';
    }
    return '¿Cuánto recibís por mes aproximadamente?';
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
              Tu actividad
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Esto nos ayuda a darte un resultado más personalizado
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-lg mb-3 text-gray-700">¿Trabajás o estudiás?</p>

              <div className="space-y-2">
                {([
                  { value: 'works', label: 'Trabajo' },
                  { value: 'studies', label: 'Estudio' },
                  { value: 'both', label: 'Ambas' },
                  { value: 'neither', label: 'Ninguna' },
                ] as { value: Activity; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setActivity(opt.value)}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      activity === opt.value
                        ? 'border-[#D4537E] bg-[#FBEAF0]'
                        : 'border-gray-200 bg-white hover:border-[#D4537E]/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {activity && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-700">{getIncomeLabel()}</Label>
                  <CurrencyToggle
                    value={currency}
                    usdEnabled={!!usdRate}
                    onChange={handleCurrencyChange}
                  />
                </div>
                {currency === 'USD' && !usdRate && (
                  <p className="text-xs text-gray-400">USD no disponible ahora</p>
                )}

                <div className="space-y-2">
                  {ranges.map((range) => (
                    <button
                      key={range.id}
                      type="button"
                      onClick={() => {
                        setIncomeRange(range.id);
                        setUseExact(false);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        !useExact && incomeRange === range.id
                          ? 'border-[#D4537E] bg-[#FBEAF0] text-[#D4537E]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-[#D4537E]/50'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={useExact}
                    onCheckedChange={(checked) => setUseExact(checked)}
                    className="data-[state=checked]:bg-[#D4537E]"
                  />
                  <span className="text-sm text-gray-600">Quiero una experiencia más personalizada</span>
                </div>

                {useExact && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <Label htmlFor="income" className="text-gray-700 text-sm">
                      Monto exacto por mes
                    </Label>
                    <div className="relative mt-2">
                      <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>
                        {currency === 'USD' ? 'USD' : '$'}
                      </span>
                      <Input
                        id="income"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={exactIncome}
                        onChange={(e) => setExactIncome(formatCurrency(e.target.value))}
                        placeholder="0"
                        className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`}
                      />
                    </div>
                    {currency === 'USD' && exactUsdDigits > 0 && usdRate && (
                      <p className="text-xs text-gray-500 mt-2">
                        ≈ {formatArs(exactUsdInArs)} al cambio del día (USD blue {formatArs(usdRate)})
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Incluí sueldo, freelance, alquiler o cualquier ingreso regular
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!activity || !incomeValid}
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
