import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Plus, X, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import { CurrencyToggle } from './CurrencyToggle';
import { arsFromUsd } from '../lib/currency';
import { UserData, Currency } from '../types';

type Sub = { name: string; cost: number; isCustom: boolean; currency?: Currency; originalCost?: number };

const PRESET_SUBSCRIPTIONS = [
  { name: 'IA', price: 32000 },
  { name: 'Spotify', price: 4000 },
  { name: 'Netflix', price: 15000 },
  { name: 'Disney+', price: 12000 },
  { name: 'Prime Video', price: 6000 },
];

// PR #5 — Suscripciones movido a "Gastos que se pagan mes a mes". Mantiene la
// lista de servicios (presets + custom). Notifica el array al padre.
export function SubscriptionsSection({
  initial,
  usdRate,
  livesAccompanied,
  onChange,
}: {
  initial?: Partial<UserData>;
  usdRate: number | null;
  livesAccompanied?: boolean;
  onChange: (subs: Sub[]) => void;
}) {
  const initialSubs = initial?.subscriptions ?? [];
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSubs.filter((s) => !s.isCustom).map((s) => s.name))
  );
  const [custom, setCustom] = useState<Array<{ name: string; cost: string; confirmed: boolean; currency: Currency }>>(
    initialSubs.filter((s) => s.isCustom).map((s) => ({
      name: s.name,
      cost: String(s.currency === 'USD' ? (s.originalCost ?? '') : s.cost),
      confirmed: true,
      currency: s.currency ?? 'ARS',
    }))
  );
  const [noSubs, setNoSubs] = useState(false);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const addCustom = () => setCustom((prev) => [...prev, { name: '', cost: '', confirmed: false, currency: 'ARS' }]);
  const setCustomCurrency = (i: number, currency: Currency) =>
    setCustom((prev) => prev.map((c, idx) => (idx === i ? { ...c, currency } : c)));
  const updateCustom = (i: number, field: 'name' | 'cost', value: string) =>
    setCustom((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  const toggleConfirm = (i: number) =>
    setCustom((prev) => prev.map((c, idx) => (idx === i ? { ...c, confirmed: !c.confirmed } : c)));
  const removeCustom = (i: number) => setCustom((prev) => prev.filter((_, idx) => idx !== i));

  // Notificar el array al padre cuando cambia algo.
  useEffect(() => {
    if (noSubs) { onChange([]); return; }
    const subs: Sub[] = [];
    selected.forEach((name) => {
      const preset = PRESET_SUBSCRIPTIONS.find((s) => s.name === name);
      if (preset) subs.push({ name: preset.name, cost: preset.price, isCustom: false });
    });
    custom.forEach((sub) => {
      if (sub.name && sub.cost) {
        const typed = parseInt(sub.cost.replace(/\D/g, '') || '0');
        if (typed > 0) {
          const cost = sub.currency === 'USD' && usdRate ? arsFromUsd(typed, usdRate) : typed;
          subs.push({ name: sub.name, cost, isCustom: true, currency: sub.currency, originalCost: typed });
        }
      }
    });
    onChange(subs);
  }, [selected, custom, noSubs, usdRate]);

  const count = (noSubs ? 0 : selected.size + custom.filter((c) => c.name && c.cost).length);

  return (
    <AccordionItem value="subs" className="bg-white rounded-2xl shadow-sm border-0 px-5">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#7626B320' }}>
            <Zap className="w-5 h-5" style={{ color: '#7626B3' }} />
          </div>
          <span className="text-gray-700 text-left">Suscripciones y servicios</span>
          {count > 0 && <span className="ml-auto text-sm text-[#3B6D11]">{count}</span>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-0 pb-5">
        <p className="text-xs text-gray-500 mb-3">Apps y plataformas que pagás todos los meses</p>
        {livesAccompanied && (
          <div className="mb-3 flex items-center gap-2 bg-[#FFF7E0] border border-[#E7C200] rounded-lg px-3 py-2">
            <span className="text-base">👯</span>
            <p className="text-sm font-semibold text-[#7A5B00]">Importante: poné solo lo que pagás <span className="underline">vos</span>.</p>
          </div>
        )}
        <div className="flex items-center gap-2 mb-4">
          <Switch
            checked={noSubs}
            onCheckedChange={(checked) => {
              setNoSubs(checked);
              if (checked) { setSelected(new Set()); setCustom([]); }
            }}
            className="data-[state=checked]:bg-[#7626B3]"
          />
          <span className="text-sm font-medium text-gray-600">No tengo / no pago suscripciones</span>
        </div>

        <div className="space-y-3" style={{ opacity: noSubs ? 0.4 : 1, pointerEvents: noSubs ? 'none' : 'auto' }}>
          {PRESET_SUBSCRIPTIONS.map((service) => (
            <div key={service.name} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
              <Checkbox
                id={`sub-${service.name}`}
                checked={selected.has(service.name)}
                onCheckedChange={() => toggle(service.name)}
                className="data-[state=checked]:bg-[#7626B3] data-[state=checked]:border-[#7626B3]"
              />
              <label htmlFor={`sub-${service.name}`} className="flex-1 text-gray-700 cursor-pointer">{service.name}</label>
            </div>
          ))}

          {custom.map((sub, index) => (
            <motion.div key={index} className={`space-y-2 pt-3 border-t rounded-lg p-3 transition-colors ${sub.confirmed ? 'bg-[#F0FAF4]' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    type="text"
                    value={sub.name}
                    onChange={(e) => updateCustom(index, 'name', e.target.value)}
                    placeholder="Nombre del servicio"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">Costo</span>
                    <CurrencyToggle value={sub.currency} usdEnabled={!!usdRate} onChange={(c) => setCustomCurrency(index, c)} />
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={sub.cost ? `${sub.currency === 'USD' ? 'USD ' : '$'}${parseInt(sub.cost).toLocaleString('es-AR').replace(/,/g, '.')}` : ''}
                    onChange={(e) => updateCustom(index, 'cost', e.target.value.replace(/\D/g, ''))}
                    placeholder={sub.currency === 'USD' ? 'USD 0' : '¿Cuánto cuesta?'}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" onClick={() => toggleConfirm(index)} disabled={!sub.name || !sub.cost}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeCustom(index)} className="text-gray-400 hover:text-[#7626B3]">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}

          <Button variant="outline" onClick={addCustom} className="w-full mt-3 border-dashed">
            <Plus className="w-4 h-4 mr-2" /> Agregar otro servicio
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
