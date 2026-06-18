import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, TrendingUp } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { Currency } from '../types';

// PR #8 — Popup al tocar una categoría de objetivo. Para metas con monto
// (Viajar / Comprar / Pagar deudas) pide cuánto y en cuánto tiempo. Para
// "Invertir" muestra un mensaje informativo (no pide monto).
export interface GoalCategoryConfig {
  kind: 'amount' | 'info';
  emoji?: string;
  prompt?: string;       // texto guía para metas con monto
  askWhat?: boolean;     // pide "¿qué querés comprar?" (Comprar algo específico)
  whatLabel?: string;
  defaultTitle?: string; // título base del objetivo creado
  message?: string;      // texto del popup informativo (Invertir)
}

const formatThousands = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  const clean = numbers.replace(/^0+/, '') || '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export function GoalCategoryModal({
  category,
  config,
  usdRate,
  onClose,
  onConfirmAmount,
  onConfirmInfo,
}: {
  category: string;
  config: GoalCategoryConfig;
  usdRate: number | null;
  onClose: () => void;
  onConfirmAmount: (goal: { title: string; amount: string; timeframe: string; currency: Currency }) => void;
  onConfirmInfo: () => void;
}) {
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');

  const amountDigits = parseInt(amount.replace(/\D/g, '')) || 0;
  const canSave = amountDigits > 0 && (parseInt(timeframe) || 0) > 0 && (!config.askWhat || what.trim().length > 0);

  const handleSaveAmount = () => {
    if (!canSave) return;
    const title = config.askWhat
      ? (what.trim() || config.defaultTitle || category)
      : (config.defaultTitle || category);
    onConfirmAmount({ title, amount, timeframe, currency });
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
            {config.emoji ? `${config.emoji} ` : ''}{category}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#7626B3]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {config.kind === 'info' ? (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-start gap-3 bg-[#F0E7FA] rounded-xl p-4">
              <TrendingUp className="w-5 h-5 text-[#7626B3] shrink-0 mt-0.5" />
              <p className="text-sm text-[#431C72] leading-relaxed">{config.message}</p>
            </div>
            <Button
              onClick={() => { onConfirmInfo(); onClose(); }}
              className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl"
            >
              Entendido
            </Button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {config.prompt && <p className="text-sm text-gray-600">{config.prompt}</p>}

            {config.askWhat && (
              <div>
                <Label className="text-gray-700 text-sm">{config.whatLabel ?? '¿Qué querés comprar?'}</Label>
                <Input
                  type="text"
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder="Ej: notebook, celular, mudanza…"
                  className="mt-2 rounded-xl"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-700 text-sm">¿Cuánto querés ahorrar?</Label>
                <CurrencyToggle value={currency} usdEnabled={!!usdRate} onChange={setCurrency} />
              </div>
              <div className="relative mt-2">
                <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>
                  {currency === 'USD' ? 'USD' : '$'}
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={(e) => setAmount(formatThousands(e.target.value))}
                  placeholder="0"
                  className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`}
                />
              </div>
              {currency === 'USD' && amountDigits > 0 && usdRate && (
                <p className="text-xs text-gray-500 mt-1">≈ {formatArs(arsFromUsd(amountDigits, usdRate))} al cambio del día</p>
              )}
            </div>

            <div>
              <Label className="text-gray-700 text-sm">¿En cuántos meses?</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                value={timeframe}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d+$/.test(v)) setTimeframe(v);
                }}
                placeholder="6"
                className="mt-2 rounded-xl"
              />
            </div>

            <Button
              onClick={handleSaveAmount}
              disabled={!canSave}
              className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" /> Guardar objetivo
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
