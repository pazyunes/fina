import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BackButton } from './BackButton';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingProgress } from './OnboardingProgress';
import { StepIntroMessage } from './StepIntroMessage';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { Currency, UserData } from '../types';

type Activity = 'works' | 'studies' | 'both' | 'neither';
type IncomeType = 'fixed' | 'freelance' | 'both';
type IncomeKind = 'fixed' | 'variable';

interface ActivityProps {
  initial?: Partial<UserData>;
  // PR8 — En edit mode el componente NO navega al siguiente step; deja que el
  // contenedor (Main, vía la ruta /editar/ingresos) decida adónde ir.
  editMode?: boolean;
  onComplete: (data: {
    worksOrStudies: Activity;
    monthlyIncome: number; // siempre en ARS (suma de todas las fuentes)
    incomeType: IncomeType; // derivado de los kind de las fuentes
    incomeCurrency: Currency; // moneda de la primera fuente (compat)
    incomeSources: NonNullable<UserData['incomeSources']>;
  }) => void;
}

const formatCurrency = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  const cleanNumbers = numbers.replace(/^0+/, '') || '0';
  const numValue = parseInt(cleanNumbers);
  if (numValue < 0) return '0';
  return cleanNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Estado controlado de una fuente de ingreso (nombre + monto + moneda + tipo).
type IncomeSource = { label: string; amount: string; currency: Currency; kind: IncomeKind };
const emptySource = (): IncomeSource => ({ label: '', amount: '', currency: 'ARS', kind: 'fixed' });

// Inicializa las fuentes desde lo guardado. Para reportes viejos (sin
// incomeSources pero con monthlyIncome) sembramos una fuente con esos datos.
const initSources = (initial?: Partial<UserData>): IncomeSource[] => {
  const saved = initial?.incomeSources;
  if (saved && saved.length > 0) {
    return saved.map((s) => ({
      label: s.label,
      amount: s.amount ? formatCurrency(String(s.amount)) : '',
      currency: s.currency,
      kind: s.kind,
    }));
  }
  if (initial?.monthlyIncome) {
    const orig = initial.incomeOriginalAmount ?? initial.monthlyIncome;
    return [{
      label: 'Sueldo',
      amount: formatCurrency(String(orig)),
      currency: initial.incomeCurrency ?? 'ARS',
      kind: initial.incomeType === 'freelance' ? 'variable' : 'fixed',
    }];
  }
  return [emptySource()];
};

export function Activity({ initial, onComplete, editMode }: ActivityProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [activity, setActivity] = useState<Activity | null>(initial?.worksOrStudies ?? null);

  // Cotización del blue para convertir ingresos cargados en USD a ARS.
  const usdRate = initial?.exchangeRate?.rate ?? null;

  // ── Fuentes de ingreso (nuevo modelo) ───────────────────────────────────
  const [sources, setSources] = useState<IncomeSource[]>(initSources(initial));
  const addSource = () => setSources((xs) => [...xs, emptySource()]);
  const removeSource = (i: number) => setSources((xs) => (xs.length <= 1 ? xs : xs.filter((_, idx) => idx !== i)));
  const updateSource = (i: number, patch: Partial<IncomeSource>) =>
    setSources((xs) => xs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const sourceArs = (s: IncomeSource): number => {
    const digits = parseInt(s.amount.replace(/\D/g, '')) || 0;
    return s.currency === 'USD' ? (usdRate ? arsFromUsd(digits, usdRate) : 0) : digits;
  };
  const totalArs = sources.reduce((sum, s) => sum + sourceArs(s), 0);

  // ── Validación del step ──────────────────────────────────────────────────
  const incomeValid = sources.some((s) => sourceArs(s) > 0);

  const handleSubmit = () => {
    if (!activity || !incomeValid) return;

    const incomeSources = sources
      .map((s) => ({
        label: s.label.trim() || 'Ingreso',
        amount: parseInt(s.amount.replace(/\D/g, '')) || 0,
        currency: s.currency,
        ars: sourceArs(s),
        kind: s.kind,
      }))
      .filter((s) => s.ars > 0);

    // incomeType derivado de los kind (compat con analyzer / tabla incomes).
    const kinds = new Set(incomeSources.map((s) => s.kind));
    const incomeType: IncomeType = kinds.has('fixed') && kinds.has('variable')
      ? 'both'
      : kinds.has('variable')
        ? 'freelance'
        : 'fixed';

    onComplete({
      worksOrStudies: activity,
      monthlyIncome: totalArs,
      incomeType,
      incomeCurrency: incomeSources[0]?.currency ?? 'ARS',
      incomeSources,
    });
    if (!editMode) navigate('/bank');
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col ${editMode ? '' : 'lg:pl-72'}`}>
      {!editMode && <OnboardingAside currentPath={pathname} />}
      <div className="flex-1 flex flex-col items-center justify-center p-6 mx-auto w-full max-w-md lg:max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <BackButton currentPath={pathname} />

          {!editMode && (
            <StepIntroMessage
              title="Ahora hablemos de plata 💰"
              body="Vamos a entender cuánto te entra cada mes. Si tenés más de una fuente de ingresos, podés sumarlas todas."
            />
          )}

          <div className="mb-6">
            <h2
              className="text-3xl mb-2 text-[#7626B3]"
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
                        ? 'border-[#7626B3] bg-[#F0E7FA]'
                        : 'border-gray-200 bg-white hover:border-[#7626B3]/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* INGRESO/S — lista de fuentes: nombre + monto + fijo/variable. */}
            {activity && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2"
              >
                <p className="text-lg mb-1 text-gray-700">Ingreso/s</p>
                <p className="text-xs text-gray-500 mb-3">
                  Podés poner tu ingreso exacto o aproximado, según lo que te sientas más cómoda. Si tenés varios, sumalos con “Agregar ingreso”.
                </p>

                <div className="space-y-3">
                  {sources.map((s, i) => {
                    const digits = parseInt(s.amount.replace(/\D/g, '')) || 0;
                    const arsPreview = s.currency === 'USD' && usdRate ? arsFromUsd(digits, usdRate) : 0;
                    return (
                      <div key={i} className="rounded-xl border-2 border-gray-200 bg-white p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={s.label}
                            onChange={(ev) => updateSource(i, { label: ev.target.value })}
                            placeholder="Nombre (ej: sueldo, alquiler)"
                            className="rounded-lg bg-gray-50 border-gray-200 text-sm h-9 flex-1"
                          />
                          {sources.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSource(i)}
                              aria-label="Quitar ingreso"
                              className="shrink-0 text-gray-400 hover:text-[#7626B3] transition-colors p-1"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${s.currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>
                              {s.currency === 'USD' ? 'USD' : '$'}
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={s.amount}
                              onChange={(ev) => updateSource(i, { amount: formatCurrency(ev.target.value) })}
                              placeholder="0"
                              className={`rounded-xl ${s.currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`}
                            />
                          </div>
                          <CurrencyToggle
                            value={s.currency}
                            usdEnabled={!!usdRate}
                            onChange={(c) => updateSource(i, { currency: c })}
                          />
                        </div>

                        {s.currency === 'USD' && digits > 0 && usdRate && (
                          <p className="text-xs text-gray-500">≈ {formatArs(arsPreview)}</p>
                        )}

                        {/* Fijo / Variable */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          {([
                            { value: 'fixed', label: 'Fijo' },
                            { value: 'variable', label: 'Variable' },
                          ] as { value: IncomeKind; label: string }[]).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateSource(i, { kind: opt.value })}
                              className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                s.kind === opt.value
                                  ? 'border-[#7626B3] bg-[#F0E7FA] text-[#7626B3]'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-[#7626B3]/50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addSource}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#7626B3]/40 text-[#7626B3] font-medium hover:bg-[#F0E7FA]/40 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Agregar ingreso
                  </button>

                  {totalArs > 0 && (
                    <p className="text-sm text-gray-700">
                      Total mensual: <span className="text-[#7626B3] font-semibold">{formatArs(totalArs)}</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!activity || !incomeValid}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
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
