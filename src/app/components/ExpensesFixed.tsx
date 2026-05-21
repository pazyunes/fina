import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Home, Heart, Plus, X, Check } from 'lucide-react';
import { TransportSelector, isTransportDataValid } from './TransportSelector';
import { TransportData } from '../types';

interface ExpensesFixedProps {
  monthlyIncome: number;
  onComplete: (data: {
    housing: number;
    health: number;
    transportDetails: TransportData;
    installments: Array<{
      name: string;
      monthlyAmount: number;
      remainingInstallments: number;
    }>;
  }) => void;
}

interface ExpenseCategory {
  key: 'housing' | 'health';
  label: string;
  icon: any;
  color: string;
}

const CATEGORIES: ExpenseCategory[] = [
  { key: 'housing', label: 'Alquiler', icon: Home, color: '#D4537E' },
  { key: 'health', label: 'Salud', icon: Heart, color: '#D85A30' },
];

export function ExpensesFixed({ monthlyIncome, onComplete }: ExpensesFixedProps) {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState({
    housing: 0,
    health: 0,
  });

  const [notPaying, setNotPaying] = useState({
    housing: false,
    health: false,
  });

  const [transportData, setTransportData] = useState<TransportData>({
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
  });

  const [hasInstallments, setHasInstallments] = useState<boolean | null>(null);
  const [installments, setInstallments] = useState<Array<{ name: string; monthlyAmount: string; remainingInstallments: string }>>([]);
  const [currentInstallment, setCurrentInstallment] = useState({ name: '', monthlyAmount: '', remainingInstallments: '' });
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showTransportValidation, setShowTransportValidation] = useState(false);

  const maxAmount = monthlyIncome * 1.5; // Allow up to 150% of income

  const updateExpense = (key: ExpenseCategory['key'], value: number[]) => {
    setExpenses(prev => ({ ...prev, [key]: value[0] }));
  };

  const updateExpenseInput = (key: ExpenseCategory['key'], value: string) => {
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
      setInstallments([...installments, { ...currentInstallment }]);
      setCurrentInstallment({ name: '', monthlyAmount: '', remainingInstallments: '' });
      setShowConfirmation(true);
    }
  };

  const removeInstallment = (index: number) => {
    setInstallments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // Check transport validation first
    if (!isTransportDataValid(transportData)) {
      setShowTransportValidation(true);
      return;
    }

    const validInstallments = installments
      .filter(inst => inst.name && inst.monthlyAmount && inst.remainingInstallments)
      .map(inst => ({
        name: inst.name,
        monthlyAmount: parseInt(inst.monthlyAmount.replace(/\D/g, '')) || 0,
        remainingInstallments: parseInt(inst.remainingInstallments) || 0,
      }));

    onComplete({
      ...expenses,
      transportDetails: transportData,
      installments: validInstallments,
    });
    navigate('/expenses-services');
  };

  const isTransportValid = isTransportDataValid(transportData);
  const isValid = hasInstallments !== null && isTransportValid;
  const canAddCurrentInstallment = currentInstallment.name && currentInstallment.monthlyAmount && currentInstallment.remainingInstallments;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full pb-24"
        >
          <div className="mb-8 sticky top-0 bg-gradient-to-br from-white to-[#FBEAF0] pb-4 z-10">
            <h2 
              className="text-3xl mb-2 text-[#D4537E]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Gastos fijos
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Estimá tus gastos mensuales fijos
            </p>
          </div>

          <div className="space-y-6">
            {CATEGORIES.map(category => {
              const Icon = category.icon;
              const isNotPaying = notPaying[category.key];
              return (
                <div key={category.key} className="bg-white p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: category.color }} />
                      </div>
                      <p className="text-gray-700">{category.label}</p>
                    </div>
                  </div>

                  {isNotPaying && (
                    <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                      <span className="text-xs text-gray-600">Cubierto por otro</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={expenses[category.key] > 0 ? formatCurrency(expenses[category.key]) : ''}
                      onChange={(e) => updateExpenseInput(category.key, e.target.value)}
                      placeholder="$0"
                      className="w-32 text-right"
                      style={{
                        color: category.color,
                        fontFamily: 'var(--font-sans)',
                        opacity: isNotPaying ? 0.4 : 1,
                        pointerEvents: isNotPaying ? 'none' : 'auto',
                        backgroundColor: isNotPaying ? '#f3f3f5' : 'white'
                      }}
                      disabled={isNotPaying}
                    />
                  </div>

                  <Slider
                    value={[expenses[category.key]]}
                    onValueChange={(value) => updateExpense(category.key, value)}
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

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    <Switch
                      checked={isNotPaying}
                      onCheckedChange={(checked) => {
                        setNotPaying(prev => ({ ...prev, [category.key]: checked }));
                        if (checked) {
                          setExpenses(prev => ({ ...prev, [category.key]: 0 }));
                        }
                      }}
                      className="data-[state=checked]:bg-[#D4537E]"
                    />
                    <span className="text-sm text-gray-500">No lo pago yo</span>
                  </div>
                </div>
              );
            })}

            {/* Transport Selector */}
            <TransportSelector
              value={transportData}
              onChange={setTransportData}
              showValidation={showTransportValidation}
            />

            {/* Installments section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm mt-8">
              <h3 className="text-lg mb-4 text-[#D4537E]" style={{ fontFamily: 'var(--font-sans)' }}>
                ¿Estás pagando cuotas actualmente?
              </h3>

              <div className="flex gap-3 mb-4">
                <Button
                  onClick={() => {
                    setHasInstallments(true);
                    setShowInstallmentForm(true);
                  }}
                  variant={hasInstallments === true ? 'default' : 'outline'}
                  className={`flex-1 ${hasInstallments === true ? 'bg-[#D4537E] hover:bg-[#C14870]' : ''}`}
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
                  className={`flex-1 ${hasInstallments === false ? 'bg-[#D4537E] hover:bg-[#C14870]' : ''}`}
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
                          className="bg-white p-4 rounded-xl border-2 border-[#D4537E] flex items-start justify-between"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-[#D4537E] mb-1">{inst.name}</p>
                            <p className="text-sm text-gray-600">
                              ${formatThousands(inst.monthlyAmount)}/mes × {inst.remainingInstallments} cuotas restantes
                            </p>
                          </div>
                          <button
                            onClick={() => removeInstallment(index)}
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
                      <label className="block text-sm text-gray-600 mb-2">
                        Monto mensual de esta cuota
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={currentInstallment.monthlyAmount ? `$${formatThousands(currentInstallment.monthlyAmount)}` : ''}
                        onChange={(e) => setCurrentInstallment({ ...currentInstallment, monthlyAmount: e.target.value.replace(/\D/g, '') })}
                        placeholder="$0"
                        className="w-full"
                      />
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
                      className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white py-6 rounded-full text-lg disabled:opacity-50"
          >
            Continuar
          </Button>
          
          <div className="flex justify-center gap-2 mt-4">
            <div className="w-3 h-3 bg-[#D4537E] rounded-full"></div>
            <div className="w-3 h-3 bg-[#D4537E] rounded-full"></div>
            <div className="w-3 h-3 bg-[#D4537E] rounded-full"></div>
            <div className="w-3 h-3 bg-[#D4537E] rounded-full"></div>
            <div className="w-3 h-3 bg-[#D4537E] rounded-full"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}