import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
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

  // Vive acompañado → recordatorio de cargar solo su parte en gastos compartibles
  const livesAccompanied = initial?.livesAlone === false;

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

  // Controlled accordion so completed sections collapse automatically while
  // staying reopenable. Suscripciones starts open.
  const [openItems, setOpenItems] = useState<string[]>(['subs']);
  const SECTION_ORDER = ['subs', 'entertainment', 'delivery', 'super'];

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

  // Per-section completion (drives the auto-close + the trigger check icon)
  const entertainmentComplete = noEntertainment || (entertainmentFrequency !== '' && entertainmentAmount !== '');
  const deliveryComplete = noDelivery || (deliveryFrequency !== '' && deliveryAmount !== '');
  const supermarketComplete = noSupermarket || (supermarketFrequency !== '' && supermarketAmount !== '');
  const subsCount = selectedSubscriptions.size + customSubscriptions.filter(s => s.confirmed).length;

  // Collapse a finished section and open the next one that's still incomplete.
  // Only called when the section itself is already complete (all its fields).
  const advanceFrom = (key: string) => {
    const sectionComplete: Record<string, boolean> = {
      subs: subsCount > 0,
      entertainment: entertainmentComplete,
      delivery: deliveryComplete,
      super: supermarketComplete,
    };
    setOpenItems(prev => {
      const without = prev.filter(k => k !== key);
      const startIdx = SECTION_ORDER.indexOf(key);
      for (let i = startIdx + 1; i < SECTION_ORDER.length; i++) {
        const next = SECTION_ORDER[i];
        if (!sectionComplete[next]) {
          if (!without.includes(next)) without.push(next);
          break;
        }
      }
      return without;
    });
  };

  const isValid =
    entertainmentComplete &&
    deliveryComplete &&
    supermarketComplete &&
    // All custom subscriptions must have both name and cost
    customSubscriptions.every(sub => !sub.name || (sub.name && sub.cost));

  const TriggerLabel = ({ icon: Icon, color, title, done, badge }: { icon: any; color: string; title: string; done?: boolean; badge?: string }) => (
    <div className="flex items-center gap-3 flex-1">
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <span className="text-gray-700 text-left flex-1" style={{ fontFamily: 'var(--font-sans)' }}>{title}</span>
      {badge && <span className="text-xs text-gray-500 mr-1">{badge}</span>}
      {done && <Check className="w-4 h-4 text-green-600 shrink-0" />}
    </div>
  );

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
              Salidas, delivery, súper y suscripciones: lo que varía según el mes. Tocá cada categoría para completarla
            </p>
          </div>

          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-3">
            {/* Subscriptions Section */}
            <AccordionItem value="subs" className="bg-white rounded-2xl shadow-sm border-0 px-5">
              <AccordionTrigger className="hover:no-underline py-4">
                <TriggerLabel icon={Zap} color="#D85A30" title="Suscripciones y servicios" badge={subsCount > 0 ? `${subsCount}` : undefined} done={subsCount > 0} />
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-5">
                <p className="text-xs text-gray-500 mb-3">
                  Apps y plataformas que pagás todos los meses
                </p>
                {livesAccompanied && (
                  <p className="text-xs text-[#D4537E] mb-3">Poné solo lo que pagás vos</p>
                )}
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
              </AccordionContent>
            </AccordionItem>

            {/* Entertainment Section */}
            <AccordionItem value="entertainment" className="bg-white rounded-2xl shadow-sm border-0 px-5">
              <AccordionTrigger className="hover:no-underline py-4">
                <TriggerLabel icon={Sparkles} color="#D4537E" title="Salidas y entretenimiento" done={entertainmentComplete} />
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-5">
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    checked={noEntertainment}
                    onCheckedChange={(checked) => {
                      setNoEntertainment(checked);
                      if (checked) {
                        setEntertainmentFrequency('0');
                        setEntertainmentAmount('0');
                        advanceFrom('entertainment');
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
                      onBlur={() => { if (entertainmentComplete) advanceFrom('entertainment'); }}
                      placeholder="Ej: 2"
                      min="0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noEntertainment}
                      style={{ backgroundColor: noEntertainment ? '#f3f3f5' : undefined }}
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
                      onBlur={() => { if (entertainmentComplete) advanceFrom('entertainment'); }}
                      placeholder="$0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noEntertainment}
                      style={{ backgroundColor: noEntertainment ? '#f3f3f5' : undefined }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Delivery Section */}
            <AccordionItem value="delivery" className="bg-white rounded-2xl shadow-sm border-0 px-5">
              <AccordionTrigger className="hover:no-underline py-4">
                <TriggerLabel icon={UtensilsCrossed} color="#3B6D11" title="Delivery / comida pedida" done={deliveryComplete} />
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-5">
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    checked={noDelivery}
                    onCheckedChange={(checked) => {
                      setNoDelivery(checked);
                      if (checked) {
                        setDeliveryFrequency('0');
                        setDeliveryAmount('0');
                        advanceFrom('delivery');
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
                      onBlur={() => { if (deliveryComplete) advanceFrom('delivery'); }}
                      placeholder="Ej: 3"
                      min="0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noDelivery}
                      style={{ backgroundColor: noDelivery ? '#f3f3f5' : undefined }}
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
                      onBlur={() => { if (deliveryComplete) advanceFrom('delivery'); }}
                      placeholder="$0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noDelivery}
                      style={{ backgroundColor: noDelivery ? '#f3f3f5' : undefined }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Supermarket Section */}
            <AccordionItem value="super" className="bg-white rounded-2xl shadow-sm border-0 px-5">
              <AccordionTrigger className="hover:no-underline py-4">
                <TriggerLabel icon={ShoppingCart} color="#D4537E" title="Supermercado" done={supermarketComplete} />
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-5">
                {livesAccompanied && (
                  <p className="text-xs text-[#D4537E] mb-3">Poné solo lo que pagás vos</p>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    checked={noSupermarket}
                    onCheckedChange={(checked) => {
                      setNoSupermarket(checked);
                      if (checked) {
                        setSupermarketFrequency('0');
                        setSupermarketAmount('0');
                        advanceFrom('super');
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
                      onBlur={() => { if (supermarketComplete) advanceFrom('super'); }}
                      placeholder="Ej: 1"
                      min="0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noSupermarket}
                      style={{ backgroundColor: noSupermarket ? '#f3f3f5' : undefined }}
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
                      onBlur={() => { if (supermarketComplete) advanceFrom('super'); }}
                      placeholder="$0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noSupermarket}
                      style={{ backgroundColor: noSupermarket ? '#f3f3f5' : undefined }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
