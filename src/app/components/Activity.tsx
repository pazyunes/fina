import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { StepIntroMessage } from './StepIntroMessage';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { Currency, UserData } from '../types';

type Activity = 'works' | 'studies' | 'both' | 'neither';
type IncomeType = 'fixed' | 'freelance' | 'both';

interface ActivityProps {
  initial?: Partial<UserData>;
  // PR8 — En edit mode el componente NO navega al siguiente step; deja que el
  // contenedor (Main, vía la ruta /editar/ingresos) decida adónde ir.
  editMode?: boolean;
  onComplete: (data: {
    worksOrStudies: Activity;
    monthlyIncome: number; // siempre en ARS (suma de fijo + promedio freelance, según corresponda)
    incomeRange?: string;
    incomeCurrency: Currency;
    incomeOriginalAmount: number; // USD si incomeCurrency === 'USD', si no ARS (del bloque fijo)
    incomeType: IncomeType;
    freelanceIncome?: NonNullable<UserData['freelanceIncome']>;
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

// Estado controlado para cada uno de los 3 meses del bloque freelance.
type FreelanceMonth = { amount: string; currency: Currency };
const emptyMonth = (currency: Currency = 'USD'): FreelanceMonth => ({ amount: '', currency });

const initMonth = (
  saved: NonNullable<UserData['freelanceIncome']>['month1'] | undefined
): FreelanceMonth => {
  if (!saved || !saved.amount) return emptyMonth();
  return { amount: formatCurrency(String(saved.amount)), currency: saved.currency };
};

export function Activity({ initial, onComplete, editMode }: ActivityProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [activity, setActivity] = useState<Activity | null>(initial?.worksOrStudies ?? null);

  // Tipo de ingreso (PR4). Default 'fixed' para preservar el flujo viejo: si el
  // initial trae monthlyIncome pero no incomeType, asumimos que era sueldo fijo.
  const [incomeType, setIncomeType] = useState<IncomeType | null>(
    initial?.incomeType ?? (initial?.monthlyIncome ? 'fixed' : null)
  );

  // PR7b — Si la usuaria seleccionó "studies" o "neither" no le mostramos el
  // selector de tipo de ingreso (no aplica sueldo/freelance) y forzamos
  // incomeType='fixed' bajo el capó. La pregunta de monto pasa a ser
  // "¿Cuánta plata disponible tenés por mes?" con el mismo selector de rango
  // / monto exacto que ya teníamos.
  const showIncomeTypeSelector = activity === 'works' || activity === 'both';
  useEffect(() => {
    if (!activity) return;
    if (!showIncomeTypeSelector && incomeType !== 'fixed') {
      setIncomeType('fixed');
    }
  }, [activity, showIncomeTypeSelector, incomeType]);

  // Cotización del blue para convertir ingresos cargados en USD a ARS.
  const usdRate = initial?.exchangeRate?.rate ?? null;
  const [currency, setCurrency] = useState<Currency>(initial?.incomeCurrency ?? 'ARS');

  const ranges = currency === 'USD' ? INCOME_RANGES_USD : INCOME_RANGES_ARS;

  // ── Bloque fijo (idéntico al flujo histórico) ────────────────────────────
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
  const fixedFilled = incomeRange !== '' || (useExact && exactIncome !== '');

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

  // ── Bloque freelance (PR4) ───────────────────────────────────────────────
  const [m1, setM1] = useState<FreelanceMonth>(initMonth(initial?.freelanceIncome?.month1));
  const [m2, setM2] = useState<FreelanceMonth>(initMonth(initial?.freelanceIncome?.month2));
  const [m3, setM3] = useState<FreelanceMonth>(initMonth(initial?.freelanceIncome?.month3));

  // Convierte el monto cargado de un mes a ARS aplicando la cotización si es USD.
  const monthAmountArs = (m: FreelanceMonth): number => {
    const digits = parseInt(m.amount.replace(/\D/g, '')) || 0;
    if (m.currency === 'USD') {
      return usdRate ? arsFromUsd(digits, usdRate) : 0;
    }
    return digits;
  };
  const m1Ars = monthAmountArs(m1);
  const m2Ars = monthAmountArs(m2);
  const m3Ars = monthAmountArs(m3);
  const freelanceComplete = m1.amount !== '' && m2.amount !== '' && m3.amount !== '';
  const freelanceAvg = freelanceComplete ? Math.round((m1Ars + m2Ars + m3Ars) / 3) : 0;
  // Helper de variabilidad: el mayor supera al doble del menor.
  const monthsArs = [m1Ars, m2Ars, m3Ars];
  const minMonth = Math.min(...monthsArs);
  const maxMonth = Math.max(...monthsArs);
  const highVariability = freelanceComplete && minMonth > 0 && maxMonth > 2 * minMonth;

  // ── Validación del step ──────────────────────────────────────────────────
  const fixedNeeded = incomeType === 'fixed' || incomeType === 'both';
  const freelanceNeeded = incomeType === 'freelance' || incomeType === 'both';
  const incomeValid =
    incomeType !== null &&
    (!fixedNeeded || fixedFilled) &&
    (!freelanceNeeded || freelanceComplete);

  const handleSubmit = () => {
    if (!activity || !incomeValid || !incomeType) return;

    // Bloque fijo (en ARS) — replica la lógica que existía antes.
    let fixedArs = 0;
    let incomeRangeLabel: string | undefined;
    let incomeOriginalAmount = 0;
    if (fixedNeeded) {
      const exactValue = parseInt(exactIncome.replace(/\D/g, '')) || 0;
      const useExactValue = useExact && exactValue > 0;
      incomeOriginalAmount = useExactValue ? exactValue : (selectedRange?.value ?? 0);
      fixedArs = currency === 'USD'
        ? (usdRate ? arsFromUsd(incomeOriginalAmount, usdRate) : 0)
        : incomeOriginalAmount;
      incomeRangeLabel = useExactValue ? 'Monto exacto' : selectedRange?.label;
    }

    // Bloque freelance — promedio en ARS.
    const freelanceArs = freelanceNeeded ? freelanceAvg : 0;
    const freelanceIncome = freelanceNeeded
      ? {
          month1: { amount: parseInt(m1.amount.replace(/\D/g, '')) || 0, currency: m1.currency, ars: m1Ars },
          month2: { amount: parseInt(m2.amount.replace(/\D/g, '')) || 0, currency: m2.currency, ars: m2Ars },
          month3: { amount: parseInt(m3.amount.replace(/\D/g, '')) || 0, currency: m3.currency, ars: m3Ars },
          monthlyAvgArs: freelanceAvg,
        }
      : undefined;

    const monthlyIncome = fixedArs + freelanceArs;

    onComplete({
      worksOrStudies: activity,
      monthlyIncome,
      incomeRange: incomeRangeLabel,
      incomeCurrency: currency,
      incomeOriginalAmount,
      incomeType,
      freelanceIncome,
    });
    if (!editMode) navigate('/bank');
  };

  const getFixedLabel = () => {
    if (incomeType === 'both') return '¿Cuánto ganás de sueldo por mes?';
    if (activity === 'works') return '¿Cuánto cobrás por mes aproximadamente?';
    // PR7b — para estudiantes / sin trabajo la pregunta no habla de sueldo.
    if (activity === 'studies' || activity === 'neither') return '¿Cuánta plata disponible tenés por mes?';
    return '¿Cuánto recibís por mes aproximadamente?';
  };

  // Render de un mes del bloque freelance.
  const renderMonth = (
    label: string,
    month: FreelanceMonth,
    setMonth: (m: FreelanceMonth) => void
  ) => {
    const digits = parseInt(month.amount.replace(/\D/g, '')) || 0;
    const arsPreview = month.currency === 'USD' && usdRate ? arsFromUsd(digits, usdRate) : 0;
    return (
      <div>
        <Label className="text-gray-700 text-sm">{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <div className="relative flex-1">
            <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${month.currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>
              {month.currency === 'USD' ? 'USD' : '$'}
            </span>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={month.amount}
              onChange={(e) => setMonth({ ...month, amount: formatCurrency(e.target.value) })}
              placeholder="0"
              className={`rounded-xl ${month.currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`}
            />
          </div>
          <CurrencyToggle
            value={month.currency}
            usdEnabled={!!usdRate}
            onChange={(c) => setMonth({ ...month, currency: c })}
          />
        </div>
        {month.currency === 'USD' && digits > 0 && usdRate && (
          <p className="text-xs text-gray-500 mt-1">≈ {formatArs(arsPreview)}</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col">
      <div className={`flex-1 flex flex-col items-center justify-center p-6 mx-auto w-full ${incomeType === 'both' ? 'max-w-md md:max-w-3xl' : 'max-w-md'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <BackButton currentPath={pathname} />

          <StepIntroMessage
            title="Ahora hablemos de plata 💰"
            body="Vamos a entender cuánto te entra cada mes. Si tenés freelance o más de una fuente de ingresos, también lo vamos a contemplar."
          />

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

            {/* Selector de tipo de ingreso (PR4). Oculto para studies/neither
                (PR7b): para esos perfiles forzamos incomeType='fixed' bajo el
                capó y mostramos el bloque con la pregunta "plata disponible"
                directamente. */}
            {activity && showIncomeTypeSelector && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2"
              >
                <p className="text-lg mb-3 text-gray-700">¿Cómo es tu ingreso?</p>
                <div className="space-y-2">
                  {([
                    { value: 'fixed', label: 'Tengo un sueldo fijo' },
                    { value: 'freelance', label: 'Trabajo freelance' },
                    { value: 'both', label: 'Tengo sueldo + hago freelance' },
                  ] as { value: IncomeType; label: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIncomeType(opt.value)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        incomeType === opt.value
                          ? 'border-[#D4537E] bg-[#FBEAF0] text-[#D4537E]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-[#D4537E]/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Bloques de ingreso. En modo 'both', en md+ se renderizan en dos columnas
                (fijo a la izquierda, freelance a la derecha) para reducir scrolling. En
                mobile o en los modos de un solo bloque, se apilan como antes. */}
            {activity && (fixedNeeded || freelanceNeeded) && (
            <div className={incomeType === 'both' ? 'space-y-5 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start' : ''}>
            {fixedNeeded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-700">{getFixedLabel()}</Label>
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
                      {incomeType === 'both'
                        ? 'Cargá solo tu sueldo fijo. El freelance se carga aparte.'
                        : activity === 'studies' || activity === 'neither'
                        ? 'Mesada, beca, ayuda de familia, ahorros que retirás, lo que sea.'
                        : 'Incluí sueldo, alquiler o cualquier ingreso regular'}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Bloque ingreso freelance (PR4) */}
            {freelanceNeeded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2 space-y-3"
              >
                <Label className="text-gray-700">
                  ¿Cuánto ganaste por freelance en los últimos 3 meses?
                </Label>

                <div className="space-y-3">
                  {renderMonth('Mes 1 (más reciente)', m1, setM1)}
                  {renderMonth('Mes 2', m2, setM2)}
                  {renderMonth('Mes 3', m3, setM3)}
                </div>

                <div className="border-t border-gray-200 pt-3">
                  {freelanceComplete ? (
                    <>
                      <p className="text-sm text-gray-700">
                        Promedio mensual: <span className="text-[#D4537E]">{formatArs(freelanceAvg)}</span>
                      </p>
                      {highVariability && (
                        <p className="text-xs text-gray-500 mt-2 italic">
                          Tu ingreso varía bastante mes a mes. En el informe vas a ver
                          recomendaciones para manejarlo.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Completá los 3 meses para ver el promedio</p>
                  )}
                </div>
              </motion.div>
            )}
            </div>
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
