import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { Currency } from '../types';

// Objetivo editable (mismo shape que GoalItem en Goals.tsx): amount es un string
// en la MONEDA elegida; parts (desglose de viaje) está en ARS.
export interface EditableGoal {
  title: string;
  amount: string;
  timeframe: string;
  currency: Currency;
  parts?: Array<{ label: string; amount: number }>;
  contributions?: Array<{ amount: number; date: string; kind?: 'paid' | 'saved'; label?: string }>;
}

const fmtInput = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '');
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};
const digitsOf = (s: string) => parseInt(s.replace(/\D/g, '')) || 0;

// PR — Modal para EDITAR la DEFINICIÓN de un objetivo ya creado (desde el lápiz
// en la lista de objetivos). Cambia nombre, monto, plazo y — si es un viaje con
// desglose — cada parte (pasajes / presupuesto) por separado.
//
// Distinto de GoalEditModal, que edita los aportes/progreso (llenar el donut).
//
// Coherencia moneda↔ARS: las parts se guardan en ARS; acá se muestran en la
// moneda del objetivo y se reconvierten a ARS al guardar. amount = suma en moneda.
export function GoalDetailsEditModal({
  goal,
  usdRate,
  onSave,
  onClose,
}: {
  goal: EditableGoal;
  usdRate: number | null;
  onSave: (updated: EditableGoal) => void;
  onClose: () => void;
}) {
  const hasParts = !!goal.parts && goal.parts.length > 0;
  const [title, setTitle] = useState(goal.title);
  const [currency, setCurrency] = useState<Currency>(goal.currency);
  const [timeframe, setTimeframe] = useState(goal.timeframe);

  const arsToDisplay = (ars: number) =>
    currency === 'USD' && usdRate ? Math.round(ars / usdRate) : Math.round(ars);
  const toArs = (digits: number) =>
    currency === 'USD' ? (usdRate ? arsFromUsd(digits, usdRate) : 0) : digits;

  const [amount, setAmount] = useState(hasParts ? '' : goal.amount);
  const [parts, setParts] = useState<Array<{ label: string; amount: string }>>(
    (goal.parts ?? []).map((p) => ({ label: p.label, amount: fmtInput(String(arsToDisplay(p.amount))) }))
  );
  const setPartAmount = (i: number, v: string) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, amount: fmtInput(v) } : p)));

  // Al cambiar la moneda, reconvertimos los valores mostrados para no perder el monto.
  const onCurrencyChange = (c: Currency) => {
    const reDisplay = (digits: number) => {
      const ars = currency === 'USD' ? (usdRate ? arsFromUsd(digits, usdRate) : 0) : digits;
      return c === 'USD' && usdRate ? Math.round(ars / usdRate) : Math.round(ars);
    };
    if (hasParts) {
      setParts((prev) => prev.map((p) => ({ ...p, amount: fmtInput(String(reDisplay(digitsOf(p.amount)))) })));
    } else {
      setAmount(fmtInput(String(reDisplay(digitsOf(amount)))));
    }
    setCurrency(c);
  };

  const totalDisplay = hasParts ? parts.reduce((s, p) => s + digitsOf(p.amount), 0) : digitsOf(amount);
  const canSave = totalDisplay > 0 && (parseInt(timeframe) || 0) > 0 && title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const updated: EditableGoal = {
      ...goal,
      title: title.trim(),
      currency,
      timeframe: String(parseInt(timeframe) || 0),
      amount: fmtInput(String(totalDisplay)),
      parts: hasParts ? parts.map((p) => ({ label: p.label, amount: toArs(digitsOf(p.amount)) })) : goal.parts,
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-[#D7C2EF]/60 px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#7626B3]" style={{ fontFamily: 'var(--font-serif)' }}>
            Editar objetivo
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#7626B3]"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Nombre */}
          <div>
            <Label className="text-gray-700 text-sm">Nombre del objetivo</Label>
            <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Viaje a Europa" className="mt-2 rounded-xl" />
          </div>

          {/* Moneda */}
          <div className="flex justify-end">
            <CurrencyToggle value={currency} usdEnabled={!!usdRate} onChange={onCurrencyChange} />
          </div>

          {/* Monto: desglose (viaje) o monto único */}
          {hasParts ? (
            <div className="space-y-3">
              <Label className="text-gray-700 text-sm">Desglose</Label>
              {parts.map((p, i) => (
                <div key={i}>
                  <Label className="text-gray-500 text-xs">{p.label}</Label>
                  <div className="relative mt-1">
                    <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>{currency === 'USD' ? 'USD' : '$'}</span>
                    <Input type="text" inputMode="numeric" pattern="[0-9]*" value={p.amount} onChange={(e) => setPartAmount(i, e.target.value)} placeholder="0" className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`} />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-[#7626B3]">{currency === 'USD' ? `USD ${fmtInput(String(totalDisplay))}` : `$${fmtInput(String(totalDisplay))}`}</span>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-gray-700 text-sm">Monto total a ahorrar</Label>
              <div className="relative mt-2">
                <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>{currency === 'USD' ? 'USD' : '$'}</span>
                <Input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(fmtInput(e.target.value))} placeholder="0" className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`} />
              </div>
            </div>
          )}

          {currency === 'USD' && usdRate && totalDisplay > 0 && (
            <p className="text-xs text-gray-500 -mt-1">≈ {formatArs(arsFromUsd(totalDisplay, usdRate))} al cambio del día</p>
          )}

          {/* Plazo */}
          <div>
            <Label className="text-gray-700 text-sm">¿En cuántos meses?</Label>
            <Input type="number" inputMode="numeric" min="1" max="120" value={timeframe} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setTimeframe(v); }} placeholder="6" className="mt-2 rounded-xl" />
          </div>

          <Button onClick={handleSave} disabled={!canSave} className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Check className="w-4 h-4" /> Guardar cambios
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
