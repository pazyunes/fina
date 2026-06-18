import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import { Zap, UtensilsCrossed, Sparkles, Plus, X, Check, ShoppingCart, Coffee, CalendarClock } from 'lucide-react';
import { BackButton } from './BackButton';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingProgress } from './OnboardingProgress';
import { StepIntroMessage } from './StepIntroMessage';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { UserData, Currency } from '../types';

interface ExpensesServicesProps {
  initial?: Partial<UserData>;
  // PR8 — edit mode skips the internal navigate('/habits').
  editMode?: boolean;
  onComplete: (data: {
    entertainmentFrequency: number;
    entertainmentAmount: number;
    deliveryFrequency: number;
    deliveryAmount: number;
    cafeteriasFrequency: number;
    cafeteriasAmount: number;
    restaurantsFrequency: number;
    restaurantsAmount: number;
    occasionalExpenses: Array<{ name: string; everyMonths: number; amount: number }>;
  }) => void;
}

export function ExpensesServices({ initial, onComplete, editMode }: ExpensesServicesProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Vive acompañado → recordatorio de cargar solo su parte en gastos compartibles
  const livesAccompanied = initial?.livesAlone === false;
  const usdRate = initial?.exchangeRate?.rate ?? null;

  // Entertainment
  // Salidas: la usuaria ingresa la frecuencia POR MES, pero el resto del sistema
  // (analyzer, tracker, bot) usa frecuencia semanal × 4.33. Convertimos: al
  // mostrar, semanal × 4.33 → mensual; al guardar, mensual ÷ 4.33 → semanal.
  const [entertainmentFrequency, setEntertainmentFrequency] = useState(
    initial?.entertainmentFrequency ? String(Math.round(initial.entertainmentFrequency * 4.33)) : ''
  );
  const [entertainmentAmount, setEntertainmentAmount] = useState(initial?.entertainmentAmount ? String(initial.entertainmentAmount) : '');
  const [noEntertainment, setNoEntertainment] = useState(false);

  // Delivery
  const [deliveryFrequency, setDeliveryFrequency] = useState(initial?.deliveryFrequency ? String(initial.deliveryFrequency) : '');
  const [deliveryAmount, setDeliveryAmount] = useState(initial?.deliveryAmount ? String(initial.deliveryAmount) : '');
  const [noDelivery, setNoDelivery] = useState(false);

  // PR6 — Cafeterías
  const [cafeteriasFrequency, setCafeteriasFrequency] = useState(initial?.cafeteriasFrequency ? String(initial.cafeteriasFrequency) : '');
  const [cafeteriasAmount, setCafeteriasAmount] = useState(initial?.cafeteriasAmount ? String(initial.cafeteriasAmount) : '');
  const [noCafeterias, setNoCafeterias] = useState(false);

  // PR — Restaurantes (separado de cafeterías)
  const [restaurantsFrequency, setRestaurantsFrequency] = useState(initial?.restaurantsFrequency ? String(initial.restaurantsFrequency) : '');
  const [restaurantsAmount, setRestaurantsAmount] = useState(initial?.restaurantsAmount ? String(initial.restaurantsAmount) : '');
  const [noRestaurants, setNoRestaurants] = useState(false);

  // Gastos ocasionales (no todos los meses). Opcional. Cada fila: qué, cada
  // cuántos meses, y cuánto. Se guardan los strings y se parsean al submit.
  const [occasional, setOccasional] = useState<Array<{ name: string; everyMonths: string; amount: string }>>(
    (initial?.occasionalExpenses ?? []).map((o) => ({
      name: o.name,
      everyMonths: String(o.everyMonths),
      amount: String(o.amount),
    }))
  );
  const addOccasional = () => setOccasional(prev => [...prev, { name: '', everyMonths: '', amount: '' }]);
  const updateOccasional = (i: number, field: 'name' | 'everyMonths' | 'amount', value: string) =>
    setOccasional(prev => prev.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  const removeOccasional = (i: number) => setOccasional(prev => prev.filter((_, idx) => idx !== i));

  // Controlled accordion so completed sections collapse automatically while
  // staying reopenable. Suscripciones starts open.
  // En edición abrimos todo para que vea sus valores y edite el que quiera; en
  // onboarding arranca solo "Suscripciones".
  const [openItems, setOpenItems] = useState<string[]>(
    editMode ? ['entertainment', 'delivery', 'cafeterias', 'restaurants'] : ['entertainment']
  );
  const SECTION_ORDER = ['entertainment', 'delivery', 'cafeterias', 'restaurants'];

  const formatCurrency = (value: string) => {
    const num = parseInt(value.replace(/\D/g, '')) || 0;
    // Ensure value is never negative
    const validNum = Math.max(0, num);
    return validNum > 0 ? `$${validNum.toLocaleString('es-AR').replace(/,/g, '.')}` : '';
  };

  const handleSubmit = () => {
    onComplete({
      entertainmentFrequency: (parseFloat(entertainmentFrequency) || 0) / 4.33,
      entertainmentAmount: parseInt(entertainmentAmount.replace(/\D/g, '') || '0'),
      deliveryFrequency: parseFloat(deliveryFrequency) || 0,
      deliveryAmount: parseInt(deliveryAmount.replace(/\D/g, '') || '0'),
      cafeteriasFrequency: parseFloat(cafeteriasFrequency) || 0,
      cafeteriasAmount: parseInt(cafeteriasAmount.replace(/\D/g, '') || '0'),
      restaurantsFrequency: parseFloat(restaurantsFrequency) || 0,
      restaurantsAmount: parseInt(restaurantsAmount.replace(/\D/g, '') || '0'),
      occasionalExpenses: occasional
        .map((o) => ({
          name: o.name.trim(),
          everyMonths: parseInt(o.everyMonths) || 0,
          amount: parseInt(o.amount.replace(/\D/g, '')) || 0,
        }))
        .filter((o) => o.name && o.everyMonths > 0 && o.amount > 0),
    });

    if (!editMode) navigate('/habits');
  };

  // Per-section completion (drives the auto-close + the trigger check icon)
  const entertainmentComplete = noEntertainment || (entertainmentFrequency !== '' && entertainmentAmount !== '');
  const deliveryComplete = noDelivery || (deliveryFrequency !== '' && deliveryAmount !== '');
  const cafeteriasComplete = noCafeterias || (cafeteriasFrequency !== '' && cafeteriasAmount !== '');
  const restaurantsComplete = noRestaurants || (restaurantsFrequency !== '' && restaurantsAmount !== '');

  // Collapse a finished section and open the next one that's still incomplete.
  // Only called when the section itself is already complete (all its fields).
  const advanceFrom = (key: string) => {
    if (editMode) return; // en edición no auto-colapsamos: editás lo que querés
    const sectionComplete: Record<string, boolean> = {
      entertainment: entertainmentComplete,
      delivery: deliveryComplete,
      cafeterias: cafeteriasComplete,
      restaurants: restaurantsComplete,
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

  // En edición no exigimos completar todas las categorías: la usuaria actualiza
  // solo lo que cambió.
  const isValid =
    editMode || (entertainmentComplete && deliveryComplete && cafeteriasComplete && restaurantsComplete);

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
    <div className={`min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col ${editMode ? '' : 'lg:pl-72'}`}>
      {!editMode && <OnboardingAside currentPath={pathname} />}
      <div className="flex-1 flex flex-col p-6 max-w-md lg:max-w-2xl mx-auto w-full overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full pb-24"
        >
          <BackButton currentPath={pathname} />

          {!editMode && (
            <StepIntroMessage
              title="Última parte."
              body={
                <>
                  Ahora los <strong>gastos que cambian mes a mes</strong>: salidas, supermercado,
                  regalitos, todo lo que no es fijo.
                </>
              }
            />
          )}

          <div className="mb-6 sticky top-0 bg-gradient-to-br from-white to-[#F0E7FA] pb-3 z-10">
            <h2
              className="text-3xl mb-2 text-[#7626B3]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Gastos que cambian mes a mes
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              {editMode
                ? 'Actualizá solo lo que cambió. No hace falta tocar todas las categorías.'
                : 'Salidas, delivery, súper y suscripciones: lo que varía según el mes. Tocá cada categoría para completarla'}
            </p>
          </div>

          {/* Aviso: hay una sección aparte para gastos que no son mensuales */}
          <div className="mb-4 flex items-start gap-2.5 bg-[#FFF7E0] border-l-4 border-[#B8860B] rounded-lg px-4 py-3">
            <span className="text-lg leading-none">📌</span>
            <p className="text-sm text-[#7A5B00]">
              Más abajo hay una sección para <strong>gastos que NO son todos los meses</strong> (ropa, regalos, viajes…). No los pongas en las categorías de acá arriba — cargalos ahí.
            </p>
          </div>

          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-3">
            {/* Entertainment Section */}
            <AccordionItem value="entertainment" className="bg-white rounded-2xl shadow-sm border-0 px-5">
              <AccordionTrigger className="hover:no-underline py-4">
                <TriggerLabel icon={Sparkles} color="#7626B3" title="Salidas y entretenimiento" done={entertainmentComplete} />
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-5">
                <p className="text-xs text-gray-500 mb-3">
                  Entretenimiento: cine, teatro, recitales, salir de fiesta/boliche. (Cafeterías y restaurantes tienen su propia sección.)
                </p>
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
                    className="data-[state=checked]:bg-[#7626B3]"
                  />
                  <span className="text-sm font-medium text-gray-600">No consumo / no lo pago yo</span>
                </div>

                {noEntertainment && (
                  <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                    <span className="text-xs text-gray-600">No aplica</span>
                  </div>
                )}

                <div className="space-y-4" style={{ opacity: noEntertainment ? 0.4 : 1, pointerEvents: noEntertainment ? 'none' : 'auto' }}>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      ¿Cuántas salidas hacés <span className="text-base font-bold text-[#7626B3]">por mes</span>?
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={entertainmentFrequency}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d+$/.test(v)) {
                          setEntertainmentFrequency(v);
                        }
                      }}
                      onBlur={() => { if (entertainmentComplete) advanceFrom('entertainment'); }}
                      placeholder="Ej: 8"
                      min="0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noEntertainment}
                      style={{ backgroundColor: noEntertainment ? '#f3f3f5' : undefined }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      ¿Cuánto gastás aproximadamente <span className="text-base font-bold text-[#7626B3]">por salida</span>?
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
                    className="data-[state=checked]:bg-[#7626B3]"
                  />
                  <span className="text-sm font-medium text-gray-600">No consumo / no lo pago yo</span>
                </div>

                {noDelivery && (
                  <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                    <span className="text-xs text-gray-600">No aplica</span>
                  </div>
                )}

                <div className="space-y-4" style={{ opacity: noDelivery ? 0.4 : 1, pointerEvents: noDelivery ? 'none' : 'auto' }}>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      ¿Cuántas veces pedís delivery <span className="text-base font-bold text-[#7626B3]">por semana</span> aproximadamente?
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={deliveryFrequency}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d+$/.test(v)) {
                          setDeliveryFrequency(v);
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
                      ¿Cuánto gastás aproximadamente <span className="text-base font-bold text-[#7626B3]">por pedido</span>?
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

            {/* Cafeterías (PR6) */}
            <AccordionItem value="cafeterias" className="bg-white rounded-2xl shadow-sm border-0 px-5">
              <AccordionTrigger className="hover:no-underline py-4">
                <TriggerLabel icon={Coffee} color="#9C7AA5" title="Cafeterías" done={cafeteriasComplete} />
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-5">
                <p className="text-xs text-gray-500 mb-3">
                  Café, desayuno o merienda afuera.
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    checked={noCafeterias}
                    onCheckedChange={(checked) => {
                      setNoCafeterias(checked);
                      if (checked) {
                        setCafeteriasFrequency('0');
                        setCafeteriasAmount('0');
                        advanceFrom('cafeterias');
                      }
                    }}
                    className="data-[state=checked]:bg-[#7626B3]"
                  />
                  <span className="text-sm font-medium text-gray-600">No consumo / no lo pago yo</span>
                </div>

                {noCafeterias && (
                  <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                    <span className="text-xs text-gray-600">No aplica</span>
                  </div>
                )}

                <div className="space-y-4" style={{ opacity: noCafeterias ? 0.4 : 1, pointerEvents: noCafeterias ? 'none' : 'auto' }}>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      ¿Cuántas veces <span className="text-base font-bold text-[#7626B3]">por semana</span> vas a una cafetería?
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={cafeteriasFrequency}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d+$/.test(v)) {
                          setCafeteriasFrequency(v);
                        }
                      }}
                      onBlur={() => { if (cafeteriasComplete) advanceFrom('cafeterias'); }}
                      placeholder="Ej: 2"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noCafeterias}
                      style={{ backgroundColor: noCafeterias ? '#f3f3f5' : undefined }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      ¿Cuánto gastás aproximadamente <span className="text-base font-bold text-[#7626B3]">por visita</span>?
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formatCurrency(cafeteriasAmount)}
                      onChange={(e) => {
                        const numbers = e.target.value.replace(/\D/g, '');
                        setCafeteriasAmount(numbers);
                      }}
                      onBlur={() => { if (cafeteriasComplete) advanceFrom('cafeterias'); }}
                      placeholder="$0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noCafeterias}
                      style={{ backgroundColor: noCafeterias ? '#f3f3f5' : undefined }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Restaurantes (separado de cafeterías) */}
            <AccordionItem value="restaurants" className="bg-white rounded-2xl shadow-sm border-0 px-5">
              <AccordionTrigger className="hover:no-underline py-4">
                <TriggerLabel icon={UtensilsCrossed} color="#A858CE" title="Restaurantes" done={restaurantsComplete} />
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-5">
                <p className="text-xs text-gray-500 mb-3">
                  Salidas a almorzar o cenar afuera.
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    checked={noRestaurants}
                    onCheckedChange={(checked) => {
                      setNoRestaurants(checked);
                      if (checked) {
                        setRestaurantsFrequency('0');
                        setRestaurantsAmount('0');
                        advanceFrom('restaurants');
                      }
                    }}
                    className="data-[state=checked]:bg-[#7626B3]"
                  />
                  <span className="text-sm font-medium text-gray-600">No consumo / no lo pago yo</span>
                </div>

                {noRestaurants && (
                  <div className="mb-3 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                    <span className="text-xs text-gray-600">No aplica</span>
                  </div>
                )}

                <div className="space-y-4" style={{ opacity: noRestaurants ? 0.4 : 1, pointerEvents: noRestaurants ? 'none' : 'auto' }}>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      ¿Cuántas veces <span className="text-base font-bold text-[#7626B3]">por semana</span> vas a un restaurante?
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={restaurantsFrequency}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d+$/.test(v)) {
                          setRestaurantsFrequency(v);
                        }
                      }}
                      onBlur={() => { if (restaurantsComplete) advanceFrom('restaurants'); }}
                      placeholder="Ej: 1"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noRestaurants}
                      style={{ backgroundColor: noRestaurants ? '#f3f3f5' : undefined }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      ¿Cuánto gastás aproximadamente <span className="text-base font-bold text-[#7626B3]">por visita</span>?
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formatCurrency(restaurantsAmount)}
                      onChange={(e) => {
                        const numbers = e.target.value.replace(/\D/g, '');
                        setRestaurantsAmount(numbers);
                      }}
                      onBlur={() => { if (restaurantsComplete) advanceFrom('restaurants'); }}
                      placeholder="$0"
                      className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      disabled={noRestaurants}
                      style={{ backgroundColor: noRestaurants ? '#f3f3f5' : undefined }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          {/* GASTOS OCASIONALES — no todos los meses (opcional) */}
          <div className="mt-3 bg-white rounded-2xl shadow-sm border border-[#D7C2EF]/60 p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-full bg-[#F0E7FA] flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5 text-[#7626B3]" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Gastos que no son todos los meses</p>
                <p className="text-xs text-gray-500">Opcional · ropa, regalos, viajes, gimnasio o seguro anual, etc.</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-3">Poné qué es, cada cuántos meses lo gastás y cuánto. Para algo anual, poné 12.</p>

            <div className="space-y-3">
              {occasional.map((o, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-3 pt-8 space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => removeOccasional(i)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-[#7626B3]"
                    aria-label="Quitar gasto ocasional"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <Input
                    value={o.name}
                    onChange={(e) => updateOccasional(i, 'name', e.target.value)}
                    placeholder="¿Qué es? Ej: Ropa"
                    className="w-full"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Cada cuántos meses (12 = anual)</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={o.everyMonths}
                        onChange={(e) => updateOccasional(i, 'everyMonths', e.target.value.replace(/\D/g, ''))}
                        placeholder="Ej: 3"
                        className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Cuánto</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={o.amount ? `$${parseInt(o.amount).toLocaleString('es-AR').replace(/,/g, '.')}` : ''}
                        onChange={(e) => updateOccasional(i, 'amount', e.target.value.replace(/\D/g, ''))}
                        placeholder="$0"
                        className={`w-full ${AMOUNT_FIELD_CLASS}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={addOccasional} className="w-full mt-3 border-dashed">
              <Plus className="w-4 h-4 mr-2" /> Agregar gasto ocasional
            </Button>
          </div>
        </motion.div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg ${editMode ? '' : 'lg:left-72'}`}>
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg disabled:opacity-50"
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
