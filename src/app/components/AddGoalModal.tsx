import { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { CurrencyToggle } from './CurrencyToggle';
import { Currency } from '../types';
import { arsFromUsd } from '../lib/currency';

// PR8 — Modal para agregar un objetivo nuevo desde la pestaña Objetivos.
// Comparte el mismo shape que los objetivos del onboarding
// (UserData.specificGoals[N]): title, amount (en ARS final), timeframe,
// currency, originalAmount. El padre (ObjetivosPage) decide cómo persistirlo
// — generalmente: mergear en userData.specificGoals[] y re-correr el analyzer.
interface AddGoalModalProps {
  onClose: () => void;
  onAdd: (goal: {
    title: string;
    amount: number;       // ARS final
    timeframe: number;    // meses
    currency: Currency;
    originalAmount: number;
  }) => void;
  usdRate?: number | null;
}

const formatThousands = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  const clean = numbers.replace(/^0+/, '') || '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export function AddGoalModal({ onClose, onAdd, usdRate }: AddGoalModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');

  const typedAmount = parseInt(amount.replace(/\D/g, '')) || 0;
  const months = parseInt(timeframe) || 0;
  const canSave = title.trim() !== '' && typedAmount > 0 && months > 0;

  const handleSave = () => {
    if (!canSave) return;
    const amountArs = currency === 'USD' && usdRate ? arsFromUsd(typedAmount, usdRate) : typedAmount;
    onAdd({
      title: title.trim(),
      amount: amountArs,
      timeframe: months,
      currency,
      originalAmount: typedAmount,
    });
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
        <div className="sticky top-0 bg-white border-b border-[#E2C4EA]/60 px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-[#9A3D9E]" style={{ fontFamily: 'var(--font-serif)' }}>
            Nuevo objetivo
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#9A3D9E]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <Label htmlFor="goal-title" className="text-gray-700 text-sm">¿Qué querés lograr?</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Viaje a Brasil, notebook nueva…"
              className="mt-1 rounded-xl"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="goal-amount" className="text-gray-700 text-sm">Monto total objetivo</Label>
              <CurrencyToggle
                value={currency}
                usdEnabled={!!usdRate}
                onChange={setCurrency}
              />
            </div>
            <div className="relative mt-1">
              <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>
                {currency === 'USD' ? 'USD' : '$'}
              </span>
              <Input
                id="goal-amount"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formatThousands(amount)}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'}`}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="goal-time" className="text-gray-700 text-sm">¿En cuántos meses querés alcanzarlo?</Label>
            <Input
              id="goal-time"
              type="number"
              inputMode="numeric"
              min="1"
              max="120"
              value={timeframe}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d+$/.test(v)) setTimeframe(v);
              }}
              placeholder="Ej: 6"
              className="mt-1 rounded-xl"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full bg-[#9A3D9E] hover:bg-[#7E3082] text-white rounded-full py-5 text-base disabled:opacity-50"
          >
            Agregar objetivo
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
