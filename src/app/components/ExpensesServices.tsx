import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { Zap, UtensilsCrossed, Sparkles, Plus, X, Check, ShoppingCart } from 'lucide-react';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { UserData } from '../types';

interface ExpensesServicesProps {
  initial?: Partial<UserData>;
  onComplete: (data: {
    subscriptions: Array<{
      name: string;
      cost: number;
      isCustom: boolean;
    }>;
    entertainmentFrequency: number;
    entertainmentAmount: number;
    deliveryFrequency: number;
    deliveryAmount: number;
    supermarketFrequency: number;
    supermarketAmount: number;
  }) => void;
}

const PRESET_SUBSCRIPTIONS = [
  { name: 'IA', price: 32000 },
  { name: 'Spotify', price: 4000 },
  { name: 'Netflix', price: 15000 },
  { name: 'Disney+', price: 12000 },
  { name: 'Prime Video', price: 6000 },
];

export function ExpensesServices({ initial, onComplete }: ExpensesServicesProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const initialSubs = initial?.subscriptions ?? [];

  // Subscriptions
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(
    new Set(initialSubs.filter((s) => !s.isCustom).map((s) => s.name))
  );
  const [customSubscriptions, setCustomSubscriptions] = useState<Array<{ name: string; cost: string; confirmed: boolean }>>(
    initialSubs.filter((s) => s.isCustom).map((s) => ({ name: s.name, cost: String(s.cost), confirmed: true }))
  );

  // Entertainment
  const [entertainmentFrequency, setEntertainmentFrequency] = useState(initial?.entertainmentFrequency ? String(initial.entertainmentFrequency) : '');
  const [entertainmentAmount, setEntertainmentAmount] = useState(initial?.entertainmentAmount ? String(initial.entertainmentAmount) : '');
  const [noEntertainment, setNoEntertainment] = useState(false);

  // Delivery
  const [deliveryFrequency, setDeliveryFrequency] = useState(initial?.deliveryFrequency ? String(initial.deliveryFrequency) : '');
  const [deliveryAmount, setDeliveryAmount] = useState(initial?.deliveryAmount ? String(initial.deliveryAmount) : '');
  const [noDelivery, setNoDelivery] = useState(false);

  // Supermarket
  const [supermarketFrequency, setSupermarketFrequency] = useState(initial?.supermarketFrequency ? String(initial.supermarketFrequency) : '');
  const [supermarketAmount, setSupermarketAmount] = useState(initial?.supermarketAmount ? String(initial.supermarketAmount) : '');
  const [noSupermarket, setNoSupermarket] = useState(false);

  const toggleSubscription = (name: string) => {
    const newSelected = new Set(selectedSubscriptions);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedSubscriptions(newSelected);
  };

  const addCustomSubscription = () => {
    setCustomSubscriptions(prev => [...prev, { name: '', cost: '', confirmed: false }]);
  };

  const updateCustomSubscription = (index: number, field: 'name' | 'cost', value: string) => {
    setCustomSubscriptions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleConfirmSubscription = (index: number) => {
    setCustomSubscriptions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], confirmed: !updated[index].confirmed };
      return updated;
    });
  };

  const removeCustomSubscription = (index: number) => {
    setCustomSubscriptions(prev => prev.filter((_, i) => i !== index));
  };

  const formatCurrency = (value: string) => {
    const num = parseInt(value.replace(/\D/g, '')) || 0;
    // Ensure value is never negative
    const validNum = Math.max(0, num);
    return validNum > 0 ? `$${validNum.toLocaleString('es-AR').replace(/,/g, '.')}` : '';
  };

  const handleSubmit = () => {
    // Build subscriptions array
    const subscriptions: Array<{ name: string; cost: number; isCustom: boolean }> = [];

    // Add selected preset subscriptions with their predefined prices
    selectedSubscriptions.forEach(name => {
      const preset = PRESET_SUBSCRIPTIONS.find(s => s.name === name);
      if (preset) {
        subscriptions.push({ name: preset.name, cost: preset.price, isCustom: false });
      }
    });

    // Add custom subscriptions
    customSubscriptions.forEach(sub => {
      if (sub.name && sub.cost) {
        const cost = parseInt(sub.cost.replace(/\D/g, '') || '0');
        if (cost > 0) {
          subscriptions.push({ name: sub.name, cost, isCustom: true });
        }
      }
    });

    onComplete({
      subscriptions,
      entertainmentFrequency: parseFloat(entertainmentFrequency) || 0,
      entertainmentAmount: parseInt(entertainmentAmount.replace(/\D/g, '') || '0'),
      deliveryFrequency: parseFloat(deliveryFrequency) || 0,
      deliveryAmount: parseInt(deliveryAmount.replace(/\D/g, '') || '0'),
      supermarketFrequency: parseFloat(supermarketFrequency) || 0,
      supermarketAmount: parseInt(supermarketAmount.replace(/\D/g, '') || '0'),
    });

    navigate('/habits');
  };

  const isValid =
    (noEntertainment || (entertainmentFrequency !== '' && entertainmentAmount !== '')) &&
    (noDelivery || (deliveryFrequency !== '' && deliveryAmount !== '')) &&
    (noSupermarket || (supermarketFrequency !== '' && supermarketAmount !== '')) &&
    // All custom subscriptions must have both name and cost
    customSubscriptions.every(sub => !sub.name || (sub.name && sub.cost));

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full pb-24"
        >
          <BackButton currentPath={pathname} />

          <div className="mb-6 sticky top-0 bg-gradient-to-br from-white to-[#FBEAF0] pb-3 z-10">
            <h2
              className="text-3xl mb-2 text-[#D4537E]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Gastos que cambian mes a mes
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Salidas, delivery, súper y suscripciones: lo que varía según el mes
            </p>
          </div>

          <div className="space-y-6">
            {/* Subscriptions Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#D85A30]/20">
                  <Zap className="w-5 h-5 text-[#D85A30]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg text-[#D4537E]" style={{ fontFamily: 'var(--font-sans)' }}>
                    Servicios / suscripciones
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Apps y plataformas que pagás todos los meses
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {PRESET_SUBSCRIPTIONS.map(service => (
                  <div key={service.name} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={`sub-${service.name}`}
                      checked={selectedSubscriptions.has(service.name)}
                      onCheckedChange={() => toggleSubscription(service.name)}
                    />
                    <label
                      htmlFor={`sub-${service.name}`}
                      className="flex-1 text-gray-700 cursor-pointer"
                    >
                      {service.name}
                    </label>
                  </div>
                ))}

                {/* Custom subscriptions */}
                {customSubscriptions.map((sub, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`space-y-2 pt-3 border-t rounded-lg p-3 transition-colors ${
                      sub.confirmed ? 'bg-[#F0FAF4]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          type="text"
                          value={sub.name}
                          onChange={(e) => updateCustomSubscription(index, 'name', e.target.value)}
                          placeholder="Nombre del servicio"
                          className="w-full"
                        />
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={formatCurrency(sub.cost)}
                          onChange={(e) => updateCustomSubscription(index, 'cost', e.target.value.replace(/\D/g, ''))}
                          placeholder="¿Cuánto cuesta?"
                          className={`w-full ${AMOUNT_FIELD_CLASS}`}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleConfirmSubscription(index)}
                          className={`${
                            sub.confirmed
                              ? 'text-green-600 hover:text-green-700 bg-green-100'
                              : 'text-gray-400 hover:text-green-600'
                          } transition-colors`}
                          disabled={!sub.name || !sub.cost}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomSubscription(index)}
                          className={`text-red-500 hover:text-red-700 transition-opacity ${
                            sub.confirmed ? 'opacity-30' : 'opacity-100'
                          }`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <Button
                  variant="outline"
                  onClick={addCustomSubscription}
                  className="w-full mt-3 border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar otro servicio
                </Button>
              </div>
            </div>

            {/* Entertainment Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#D4537E]/20">
                  <Sparkles className="w-5 h-5 text-[#D4537E]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg text-[#D4537E]" style={{ fontFamily: 'var(--font-sans)' }}>
                    Entretenimiento / ocio / salidas
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Switch
                  checked={noEntertainment}
                  onCheckedChange={(checked) => {
                    setNoEntertainment(checked);
                    if (checked) {
                      setEntertainmentFrequency('0');
                      setEntertainmentAmount('0');
                    }
                  }}
                  className="data-[state=checked]:bg-[#D4537E]"
                />
                <span className="text-sm text-gray-500">No consumo</span>
              </div>

              {noEntertainment && (
                <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                  <span className="text-xs text-gray-600">No aplica</span>
                </div>
              )}

              <div className="space-y-4" style={{ opacity: noEntertainment ? 0.4 : 1, pointerEvents: noEntertainment ? 'none' : 'auto' }}>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    ¿Cuántas veces salís por semana aproximadamente?
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={entertainmentFrequency}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val >= 0 || e.target.value === '') {
                        setEntertainmentFrequency(e.target.value);
                      }
                    }}
                    placeholder="Ej: 2"
                    min="0"
                    className="w-full"
                    disabled={noEntertainment}
                    style={{ backgroundColor: noEntertainment ? '#f3f3f5' : 'white' }}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    ¿Cuánto gastás aproximadamente por salida?
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatCurrency(entertainmentAmount)}
                    onChange={(e) => {
                      const numbers = e.target.value.replace(/\D/g, '');
                      setEntertainmentAmount(numbers);
                    }}
                    placeholder="$0"
                    className={`w-full ${AMOUNT_FIELD_CLASS}`}
                    disabled={noEntertainment}
                    style={{ backgroundColor: noEntertainment ? '#f3f3f5' : undefined }}
                  />
                </div>
              </div>
            </div>

            {/* Delivery Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#3B6D11]/20">
                  <UtensilsCrossed className="w-5 h-5 text-[#3B6D11]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg text-[#D4537E]" style={{ fontFamily: 'var(--font-sans)' }}>
                    Delivery / comida por app
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Switch
                  checked={noDelivery}
                  onCheckedChange={(checked) => {
                    setNoDelivery(checked);
                    if (checked) {
                      setDeliveryFrequency('0');
                      setDeliveryAmount('0');
                    }
                  }}
                  className="data-[state=checked]:bg-[#D4537E]"
                />
                <span className="text-sm text-gray-500">No consumo</span>
              </div>

              {noDelivery && (
                <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                  <span className="text-xs text-gray-600">No aplica</span>
                </div>
              )}

              <div className="space-y-4" style={{ opacity: noDelivery ? 0.4 : 1, pointerEvents: noDelivery ? 'none' : 'auto' }}>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    ¿Cuántas veces pedís delivery por semana aproximadamente?
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={deliveryFrequency}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val >= 0 || e.target.value === '') {
                        setDeliveryFrequency(e.target.value);
                      }
                    }}
                    placeholder="Ej: 3"
                    min="0"
                    className="w-full"
                    disabled={noDelivery}
                    style={{ backgroundColor: noDelivery ? '#f3f3f5' : 'white' }}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    ¿Cuánto gastás aproximadamente por pedido?
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatCurrency(deliveryAmount)}
                    onChange={(e) => {
                      const numbers = e.target.value.replace(/\D/g, '');
                      setDeliveryAmount(numbers);
                    }}
                    placeholder="$0"
                    className={`w-full ${AMOUNT_FIELD_CLASS}`}
                    disabled={noDelivery}
                    style={{ backgroundColor: noDelivery ? '#f3f3f5' : undefined }}
                  />
                </div>
              </div>
            </div>

            {/* Supermarket Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#D4537E]/20">
                  <ShoppingCart className="w-5 h-5 text-[#D4537E]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg text-[#D4537E]" style={{ fontFamily: 'var(--font-sans)' }}>
                    Supermercado
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Switch
                  checked={noSupermarket}
                  onCheckedChange={(checked) => {
                    setNoSupermarket(checked);
                    if (checked) {
                      setSupermarketFrequency('0');
                      setSupermarketAmount('0');
                    }
                  }}
                  className="data-[state=checked]:bg-[#D4537E]"
                />
                <span className="text-sm text-gray-500">No aplica</span>
              </div>

              {noSupermarket && (
                <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                  <span className="text-xs text-gray-600">No aplica</span>
                </div>
              )}

              <div className="space-y-4" style={{ opacity: noSupermarket ? 0.4 : 1, pointerEvents: noSupermarket ? 'none' : 'auto' }}>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    ¿Cuántas veces por semana hacés compras en el súper?
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={supermarketFrequency}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val >= 0 || e.target.value === '') {
                        setSupermarketFrequency(e.target.value);
                      }
                    }}
                    placeholder="Ej: 1"
                    min="0"
                    className="w-full"
                    disabled={noSupermarket}
                    style={{ backgroundColor: noSupermarket ? '#f3f3f5' : 'white' }}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    ¿Cuánto gastás aproximadamente por compra?
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatCurrency(supermarketAmount)}
                    onChange={(e) => {
                      const numbers = e.target.value.replace(/\D/g, '');
                      setSupermarketAmount(numbers);
                    }}
                    placeholder="$0"
                    className={`w-full ${AMOUNT_FIELD_CLASS}`}
                    disabled={noSupermarket}
                    style={{ backgroundColor: noSupermarket ? '#f3f3f5' : undefined }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white py-5 rounded-full text-lg disabled:opacity-50"
          >
            Continuar
          </Button>

          <div className="mt-4">
            <OnboardingProgress currentPath={pathname} />
          </div>
        </div>
      </div>
    </div>
  );
}
