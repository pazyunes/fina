import { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { GoalStrategy } from '../utils/goalStrategies';
import { formatArs } from '../lib/currency';

// PR — Al tildar una estrategia ("Cómo llegar al objetivo"), preguntamos cuánto
// pudo ahorrar la usuaria con esa acción y a qué objetivo lo suma. El monto se
// guarda como aporte (contribution) del objetivo elegido → avanza el donut.

const fmtInput = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '');
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};

export function StrategyContributionModal({
  strategy,
  goals,
  onClose,
  onConfirm,
}: {
  strategy: GoalStrategy;
  goals: Array<{ title: string }>;
  onClose: () => void;
  onConfirm: (goalIndex: number, amountArs: number) => Promise<void>;
}) {
  // Sugerencia: los dígitos del impacto (ej "+$64.950/mes" → 64950). Si no hay
  // número (ej "variable"), arranca vacío.
  const suggested = (strategy.impact.match(/\d/g) ?? []).join('');
  const [amount, setAmount] = useState(fmtInput(suggested));
  const [goalIndex, setGoalIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const amountArs = parseInt(amount.replace(/\D/g, '')) || 0;
  const canSave = amountArs > 0 && goals.length > 0 && !saving;

  const handleConfirm = async () => {
    if (!canSave) return;
    setSaving(true);
    await onConfirm(goalIndex, amountArs);
    setSaving(false);
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
            ¡Buen paso! 💪
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#7626B3]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {strategy.emoji} <strong className="text-gray-800">{strategy.title}</strong>
          </p>

          {goals.length === 0 ? (
            <div className="bg-[#F0E7FA] rounded-lg px-3 py-3 text-sm text-[#431C72]">
              Todavía no tenés objetivos cargados. Creá uno y después sumale lo que ahorres.
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm text-gray-700 font-medium">¿Cuánto pudiste ahorrar con esto?</label>
                <div className="relative mt-2">
                  <span className="absolute top-1/2 -translate-y-1/2 left-4 text-gray-500 z-10">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={amount}
                    onChange={(e) => setAmount(fmtInput(e.target.value))}
                    placeholder="0"
                    autoFocus
                    className="w-full rounded-xl border-2 border-gray-200 focus:border-[#7626B3] outline-none pl-8 pr-4 py-3 text-lg"
                  />
                </div>
                {!!suggested && (
                  <p className="text-xs text-gray-400 mt-1">Sugerencia según tu estimación: {formatArs(parseInt(suggested))}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">¿A qué objetivo lo sumás?</label>
                <select
                  value={goalIndex}
                  onChange={(e) => setGoalIndex(Number(e.target.value))}
                  className="w-full mt-2 rounded-xl border-2 border-gray-200 focus:border-[#7626B3] outline-none px-4 py-3 text-sm bg-white"
                >
                  {goals.map((g, i) => (
                    <option key={i} value={i}>{g.title}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canSave}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando…' : 'Sumar al objetivo'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
