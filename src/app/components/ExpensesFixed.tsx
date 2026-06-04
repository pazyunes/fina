import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import { Home, Heart, Sparkles, Brain, Dumbbell, Plus, X, Check } from 'lucide-react';
import { TransportSelector, isTransportDataValid } from './TransportSelector';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { StepIntroMessage } from './StepIntroMessage';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { TransportData, UserData, Currency } from '../types';

type FixedKey = 'housing' | 'health' | 'beauty' | 'therapy' | 'gym';

interface ExpensesFixedProps {
  initial?: Partial<UserData>;
  monthlyIncome: number;
  // PR8 — En edit mode no navega al siguiente step; el contenedor decide.
  editMode?: boolean;
  onComplete: (data: {
    housing: number;
    health: number;
    beauty: number;
    therapy: number;
    gym: number;
    housingCurrency: Currency;
    housingOriginalAmount: number;
    therapyDetails: { sessionPrice: number; sessionsPerMonth: number };
    transportDetails: TransportData;
    installments: Array<{
      name: string;
      monthlyAmount: number;
      remainingInstallments: number;
      currency: Currency;
      originalAmount: number;
    }>;
  }) => void;
}

interface ExpenseCategory {
  key: FixedKey;
  label: string;
  icon: any;
  color: string;
  helper?: string;
}

const CATEGORIES: ExpenseCategory[] = [
  { key: 'housing', label: 'Alquiler', icon: Home, color: '#9A3D9E', helper: 'Poné solo tu parte, no el total' },
  { key: 'health', label: 'Salud', icon: Heart, color: '#D85A30', helper: 'Nos referimos a la prepaga' },
  { key: 'beauty', label: 'Belleza y cuidado personal', icon: Sparkles, color: '#9C7AA5', helper: 'Cuánto gastás por mes en peluquería, manicura, pedicura, definitiva, etc.' },
  { key: 'therapy', label: 'Psicóloga / terapia', icon: Brain, color: '#3B6D11' },
  { key: 'gym', label: 'Gimnasio', icon: Dumbbell, color: '#D85A30', helper: 'La cuota del gym o tu actividad física' },
];

const DEFAULT_TRANSPORT: TransportData = {
  hasCar: false,
  insurance: 0,
  fuel: 0,
  insuranceNotPaying: false,
  fuelNotPaying: false,
  hasPublicTransport: false,
  publicTransportTrips: 0,
  publicTransportCostPerTrip: 400,
  hasRideApps: false,
  rideAppTrips: 0,
  rideAppCostPerTrip: 4000,
};

export function ExpensesFixed({ initial, monthlyIncome, onComplete, editMode }: ExpensesFixedProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [expenses, setExpenses] = useState<Record<FixedKey, number>>({
    housing: initial?.expenses?.housing ?? 0,
    health: initial?.expenses?.health ?? 0,
    beauty: initial?.expenses?.beauty ?? 0,
    therapy: initial?.expenses?.therapy ?? 0,
    gym: initial?.expenses?.gym ?? 0,
  });

  const [notPaying, setNotPaying] = useState<Record<FixedKey, boolean>>({
    housing: false,
    health: false,
    beauty: false,
    therapy: false,
    gym: false,
  });

  // Alquiler en ARS o USD. expenses.housing siempre queda en ARS (convertido).
  const usdRate = initial?.exchangeRate?.rate ?? null;
  const [housingCurrency, setHousingCurrency] = useState<Currency>(initial?.housingCurrency ?? 'ARS');
  const [housingUsd, setHousingUsd] = useState<string>(
    initial?.housingCurrency === 'USD' && initial?.housingOriginalAmount ? String(initial.housingOriginalAmount) : ''
  );

  // Terapia: el usuario carga precio por sesión y frecuencia mensual; el monto
  // mensual (expenses.therapy) se deriva como el producto.
  const [therapySessionPrice, setTherapySessionPrice] = useState<string>(
    initial?.therapyDetails?.sessionPrice ? String(initial.therapyDetails.sessionPrice) : ''
  );
  const [therapySessionsPerMonth, setTherapySessionsPerMonth] = useState<string>(
    initial?.therapyDetails?.sessionsPerMonth ? String(initial.therapyDetails.sessionsPerMonth) : ''
  );
  const recalcTherapy = (priceStr: string, freqStr: string) => {
    const p = parseInt(priceStr.replace(/\D/g, '')) || 0;
    const f = parseInt(freqStr) || 0;
    setExpenses(prev => ({ ...prev, therapy: p * f }));
  };

  // Controlled accordion so a category collapses once completed but can be
  // reopened. Alquiler (housing) starts open.
  // En edición abrimos todas las categorías para que edite la que quiera.
  const [openItems, setOpenItems] = useState<string[]>(
    editMode ? CATEGORIES.map(c => c.key) : ['housing']
  );
  const FIXED_ORDER = CATEGORIES.map(c => c.key);
  // Collapse the finished category and open the next one that's still empty.
  // Only called once the category is complete (amount entered or "no lo pago yo").
  const advanceFrom = (key: FixedKey) => {
    if (editMode) return; // en edición no auto-colapsamos
    setOpenItems(prev => {
      const without = prev.filter(k => k !== key);
      const startIdx = FIXED_ORDER.indexOf(key);
      for (let i = startIdx + 1; i < FIXED_ORDER.length; i++) {
        const next = FIXED_ORDER[i];
        if (!(expenses[next] > 0 || notPaying[next])) {
          if (!without.includes(next)) without.push(next);
          break;
        }
      }
      return without;
    });
  };

  const [transportData, setTransportData] = useState<TransportData>(
    initial?.transportDetails ?? DEFAULT_TRANSPORT
  );

  const [installments, setInstallments] = useState<Array<{ name: string; monthlyAmount: string; remainingInstallments: string; currency: Currency; originalAmount: number }>>(
    (initial?.installments ?? []).map((inst) => ({
      name: inst.name,
      monthlyAmount: String(inst.monthlyAmount),
      remainingInstallments: String(inst.remainingInstallments),
      currency: inst.currency ?? 'ARS',
      originalAmount: inst.originalAmount ?? inst.monthlyAmount,
    }))
  );
  const [hasInstallments, setHasInstallments] = useState<boolean | null>(
    (initial?.installments?.length ?? 0) > 0 ? true : null
  );
  const [currentInstallment, setCurrentInstallment] = useState({ name: '', monthlyAmount: '', remainingInstallments: '' });
  const [currentInstallmentCurrency, setCurrentInstallmentCurrency] = useState<Currency>('ARS');
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showTransportValidation, setShowTransportValidation] = useState(false);

  const maxAmount = monthlyIncome * 1.5; // Allow up to 150% of income

  const updateExpense = (key: FixedKey, value: number[]) => {
    setExpenses(prev => ({ ...prev, [key]: value[0] }));
  };

  const updateExpenseInput = (key: FixedKey, value: string) => {
    const numValue = parseInt(value.replace(/\D/g, '')) || 0;
    // Ensure value is never negative
    const validValue = Math.max(0, numValue);
    setExpenses(prev => ({ ...prev, [key]: validValue }));
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('es-AR').replace(/,/g, '.')}`;
  };

  // Formatea una cadena de dígitos con separador de miles (ej: "10000" -> "10.000")
  const formatThousands = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => {
        setShowConfirmation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmation]);

  const addInstallment = () => {
    if (currentInstallment.name && currentInstallment.monthlyAmount && currentInstallment.remainingInstallments) {
      const typed = parseInt(currentInstallment.monthlyAmount.replace(/\D/g, '')) || 0;
      const arsAmount = currentInstallmentCurrency === 'USD' && usdRate ? arsFromUsd(typed, usdRate) : typed;
      setInstallments([...installments, {
        name: currentInstallment.name,
        monthlyAmount: String(arsAmount),
        remainingInstallments: currentInstallment.remainingInstallments,
        currency: currentInstallmentCurrency,
        originalAmount: typed,
      }]);
      setCurrentInstallment({ name: '', monthlyAmount: '', remainingInstallments: '' });
      setCurrentInstallmentCurrency('ARS');
      setShowConfirmation(true);
    }
  };

  const removeInstallment = (index: number) => {
    setInstallments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // Check transport validation first (en edición no bloqueamos por esto)
    if (!editMode && !isTransportDataValid(transportData)) {
      setShowTransportValidation(true);
      return;
    }

    const validInstallments = installments
      .filter(inst => inst.name && inst.monthlyAmount && inst.remainingInstallments)
      .map(inst => ({
        name: inst.name,
        monthlyAmount: parseInt(inst.monthlyAmount.replace(/\D/g, '')) || 0,
        remainingInstallments: parseInt(inst.remainingInstallments) || 0,
        currency: inst.currency,
        originalAmount: inst.originalAmount,
      }));

    const housingOriginalAmount = housingCurrency === 'USD'
      ? (parseInt(housingUsd.replace(/\D/g, '')) || 0)
      : expenses.housing;

    const therapyDetails = {
      sessionPrice: parseInt(therapySessionPrice.replace(/\D/g, '')) || 0,
      sessionsPerMonth: parseInt(therapySessionsPerMonth) || 0,
    };

    onComplete({
      ...expenses,
      housingCurrency,
      housingOriginalAmount,
      therapyDetails,
      transportDetails: transportData,
      installments: validInstallments,
    });
    if (!editMode) navigate('/expenses-services');
  };

  const isTransportValid = isTransportDataValid(transportData);
  const isValid = editMode ? true : (hasInstallments !== null && isTransportValid);
  const canAddCurrentInstallment = currentInstallment.name && currentInstallment.monthlyAmount && currentInstallment.remainingInstallments;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F3E9F8] flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full pb-24"
        >
          <BackButton currentPath={pathname} />

          {!editMode && (
            <StepIntroMessage
              title="¡Vamos bien!"
              body={
                <>
                  Ahora pensemos en los <strong>gastos que se repiten todos los meses</strong>:
                  alquiler, expensas, suscripciones, gimnasio, esas cosas. No te olvides de
                  ninguna 😉
                </>
              }
            />
          )}

          <div className="mb-6 sticky top-0 bg-gradient-to-br from-white to-[#F3E9F8] pb-3 z-10">
            <h2
              className="text-3xl mb-2 text-[#9A3D9E]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Gastos que se repiten todos los meses
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              {editMode
                ? 'Actualizá solo lo que cambió. No hace falta tocar todas las categorías.'
                : 'Lo que pagás casi igual mes a mes. Tocá cada categoría para completarla'}
            </p>
          </div>

          {/* Categorías de monto fijo, cada una colapsable (la primera abierta) */}
          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-3">
            {CATEGORIES.map(category => {
              const Icon = category.icon;
              const isNotPaying = notPaying[category.key];
              const value = expenses[category.key];
              return (
                <AccordionItem
                  key={category.key}
                  value={category.key}
                  className="bg-white rounded-2xl shadow-sm border-0 px-5"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: category.color }} />
                      </div>
                      <span className="text-gray-700 text-left">{category.label}</span>
                      {value > 0 && !isNotPaying && (
                        <span className="ml-auto text-sm" style={{ color: category.color }}>
                          {formatCurrency(value)}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-0 pb-5">
                    {category.helper && (
                      <p className="text-sm text-gray-500 mb-3">{category.helper}</p>
                    )}

                    {category.key === 'housing' && (
                      <div className="mb-3 flex items-center gap-2">
                        <CurrencyToggle
                          value={housingCurrency}
                          usdEnabled={!!usdRate}
                          onChange={(c) => {
                            setHousingCurrency(c);
                            if (c === 'USD') {
                              const usd = parseInt(housingUsd.replace(/\D/g, '')) || 0;
                              setExpenses(prev => ({ ...prev, housing: usdRate ? arsFromUsd(usd, usdRate) : 0 }));
                            }
                          }}
                        />
                        {!usdRate && (
                          <span className="text-xs text-gray-400">USD no disponible ahora</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <Switch
                        checked={isNotPaying}
                        onCheckedChange={(checked) => {
                          setNotPaying(prev => ({ ...prev, [category.key]: checked }));
                          if (checked) {
                            setExpenses(prev => ({ ...prev, [category.key]: 0 }));
                            advanceFrom(category.key);
                          }
                        }}
                        className="data-[state=checked]:bg-[#9A3D9E]"
                      />
                      <span className="text-sm text-gray-500">No lo pago yo</span>
                    </div>

                    {isNotPaying && (
                      <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                        <span className="text-xs text-gray-600">Cubierto por otro</span>
                      </div>
                    )}

                    {category.key === 'therapy' ? (
                      <div className="space-y-3" style={{ opacity: isNotPaying ? 0.4 : 1, pointerEvents: isNotPaying ? 'none' : 'auto' }}>
                        <div>
                          <label className="block text-sm text-gray-600 mb-2">
                            ¿Cuánto pagás por sesión?
                          </label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={therapySessionPrice ? formatCurrency(parseInt(therapySessionPrice) || 0) : ''}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              setTherapySessionPrice(digits);
                              recalcTherapy(digits, therapySessionsPerMonth);
                            }}
                            placeholder="$0"
                            className={`rounded-xl ${AMOUNT_FIELD_CLASS}`}
                            style={{ color: category.color, fontFamily: 'var(--font-sans)' }}
                            disabled={isNotPaying}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-2">
                            Frecuencia por mes
                          </label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="0"
                            value={therapySessionsPerMonth}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '' || /^\d+$/.test(v)) {
                                setTherapySessionsPerMonth(v);
                                recalcTherapy(therapySessionPrice, v);
                              }
                            }}
                            onBlur={() => { if (expenses.therapy > 0) advanceFrom('therapy'); }}
                            placeholder="0"
                            className={`rounded-xl ${AMOUNT_FIELD_CLASS}`}
                            disabled={isNotPaying}
                          />
                        </div>
                        {expenses.therapy > 0 && (
                          <p className="text-sm text-gray-500">
                            Total mensual: <span style={{ color: category.color }}>{formatCurrency(expenses.therapy)}</span>
                          </p>
                        )}
                      </div>
                    ) : category.key === 'housing' && housingCurrency === 'USD' ? (
                      <div style={{ opacity: isNotPaying ? 0.4 : 1, pointerEvents: isNotPaying ? 'none' : 'auto' }}>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm z-10">USD</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={housingUsd ? Number(housingUsd).toLocaleString('es-AR').replace(/,/g, '.') : ''}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              setHousingUsd(digits);
                              const usd = parseInt(digits) || 0;
                              setExpenses(prev => ({ ...prev, housing: usdRate ? arsFromUsd(usd, usdRate) : 0 }));
                            }}
                            onBlur={() => { if (expenses.housing > 0) advanceFrom('housing'); }}
                            placeholder="0"
                            className={`pl-12 rounded-xl ${AMOUNT_FIELD_CLASS}`}
                            disabled={isNotPaying}
                          />
                        </div>
                        {housingUsd && usdRate && (
                          <p className="text-xs text-gray-500 mt-2">
                            ≈ {formatArs(expenses.housing)} al cambio del día (USD blue {formatArs(usdRate)})
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-end gap-3 mb-3">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={value > 0 ? formatCurrency(value) : ''}
                            onChange={(e) => updateExpenseInput(category.key, e.target.value)}
                            onBlur={() => { if (expenses[category.key] > 0) advanceFrom(category.key); }}
                            placeholder="$0"
                            className={`w-36 text-right rounded-xl ${AMOUNT_FIELD_CLASS}`}
                            style={{
                              color: category.color,
                              fontFamily: 'var(--font-sans)',
                              opacity: isNotPaying ? 0.4 : 1,
                              pointerEvents: isNotPaying ? 'none' : 'auto',
                              backgroundColor: isNotPaying ? '#f3f3f5' : undefined,
                            }}
                            disabled={isNotPaying}
                          />
                        </div>

                        <Slider
                          value={[value]}
                          onValueChange={(val) => updateExpense(category.key, val)}
                          max={maxAmount}
                          step={1000}
                          className="mt-2"
                          disabled={isNotPaying}
                          style={{ opacity: isNotPaying ? 0.4 : 1, pointerEvents: isNotPaying ? 'none' : 'auto' }}
                        />

                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                          <span>$0</span>
                          <span>{formatCurrency(maxAmount)}</span>
                        </div>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <div className="space-y-4 mt-4">
            {/* Transport Selector */}
            <TransportSelector
              value={transportData}
              onChange={setTransportData}
              showValidation={showTransportValidation}
            />

            {/* Installments section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="text-lg mb-4 text-[#9A3D9E]" style={{ fontFamily: 'var(--font-sans)' }}>
                ¿Estás pagando algo en cuotas?
              </h3>

              <div className="flex gap-3 mb-4">
                <Button
                  onClick={() => {
                    setHasInstallments(true);
                    setShowInstallmentForm(true);
                  }}
                  variant={hasInstallments === true ? 'default' : 'outline'}
                  className={`flex-1 ${hasInstallments === true ? 'bg-[#9A3D9E] hover:bg-[#7E3082]' : ''}`}
                >
                  Sí
                </Button>
                <Button
                  onClick={() => {
                    setHasInstallments(false);
                    setInstallments([]);
                    setShowInstallmentForm(false);
                    setCurrentInstallment({ name: '', monthlyAmount: '', remainingInstallments: '' });
                  }}
                  variant={hasInstallments === false ? 'default' : 'outline'}
                  className={`flex-1 ${hasInstallments === false ? 'bg-[#9A3D9E] hover:bg-[#7E3082]' : ''}`}
                >
                  No
                </Button>
              </div>

              {/* Lista de cuotas creadas */}
              <AnimatePresence>
                {installments.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4"
                  >
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Cuotas creadas</h4>
                    <div className="space-y-3">
                      {installments.map((inst, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-white p-4 rounded-xl border-2 border-[#9A3D9E] flex items-start justify-between"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-[#9A3D9E] mb-1">{inst.name}</p>
                            <p className="text-sm text-gray-600">
                              ${formatThousands(inst.monthlyAmount)}/mes × {inst.remainingInstallments} cuotas restantes
                            </p>
                            {inst.currency === 'USD' && (
                              <p className="text-xs text-gray-400">
                                Cargada en USD {inst.originalAmount.toLocaleString('es-AR').replace(/,/g, '.')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeInstallment(index)}
                            className="text-gray-400 hover:text-[#9A3D9E] p-1"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {hasInstallments && !showInstallmentForm && (
                <Button
                  variant="outline"
                  onClick={() => setShowInstallmentForm(true)}
                  className="w-full mb-4 border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar cuota
                </Button>
              )}

              {hasInstallments && showInstallmentForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 mt-4"
                >
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">
                        Nombre / en qué es
                      </label>
                      <Input
                        type="text"
                        value={currentInstallment.name}
                        onChange={(e) => setCurrentInstallment({ ...currentInstallment, name: e.target.value })}
                        placeholder="Ej: zapatillas, celular, viaje"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-gray-600">
                          Monto mensual de esta cuota
                        </label>
                        <CurrencyToggle
                          value={currentInstallmentCurrency}
                          usdEnabled={!!usdRate}
                          onChange={setCurrentInstallmentCurrency}
                        />
                      </div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={currentInstallment.monthlyAmount ? `${currentInstallmentCurrency === 'USD' ? 'USD ' : '$'}${formatThousands(currentInstallment.monthlyAmount)}` : ''}
                        onChange={(e) => setCurrentInstallment({ ...currentInstallment, monthlyAmount: e.target.value.replace(/\D/g, '') })}
                        placeholder={currentInstallmentCurrency === 'USD' ? 'USD 0' : '$0'}
                        className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      />
                      {currentInstallmentCurrency === 'USD' && currentInstallment.monthlyAmount && usdRate && (
                        <p className="text-xs text-gray-500 mt-1">
                          ≈ {formatArs(arsFromUsd(parseInt(currentInstallment.monthlyAmount.replace(/\D/g, '')) || 0, usdRate))} al cambio del día
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-2">
                        Cantidad de cuotas restantes
                      </label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={currentInstallment.remainingInstallments}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val >= 0 || e.target.value === '') {
                            setCurrentInstallment({ ...currentInstallment, remainingInstallments: e.target.value });
                          }
                        }}
                        placeholder="Ej: 12"
                        min="0"
                        className="w-full"
                      />
                    </div>

                    <Button
                      onClick={addInstallment}
                      disabled={!canAddCurrentInstallment}
                      className="w-full bg-[#9A3D9E] hover:bg-[#7E3082] text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      Guardar cuota
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
                          <span>✓ Cuota guardada</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full bg-[#9A3D9E] hover:bg-[#7E3082] text-white py-5 rounded-full text-lg disabled:opacity-50"
          >
            {editMode ? 'Guardar cambios' : 'Continuar'}
          </Button>

          {!editMode && (
            <div className="mt-4">
              <OnboardingProgress currentPath={pathname} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
