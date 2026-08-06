import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useMoney } from '../lib/displayCurrency';

type Contribution = { amount: number; date: string; kind?: 'paid' | 'saved'; label?: string };

const fmtInput = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '');
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};

// PR — Editar un objetivo: ver el progreso e ir sumando lo que pagaste o
// separaste (llena el donut). Los aportes se guardan en ARS.
export function GoalEditModal({
  title,
  amount,
  initialContributions,
  onClose,
  onSave,
}: {
  title: string;
  amount: number;
  initialContributions: Contribution[];
  onClose: () => void;
  onSave: (contributions: Contribution[]) => Promise<void>;
}) {
  const { fmt } = useMoney();
  const [contribs, setContribs] = useState<Contribution[]>(initialContributions);
  const [kind, setKind] = useState<'paid' | 'saved'>('paid');
  const [newAmount, setNewAmount] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const saved = contribs.reduce((s, c) => s + (c.amount || 0), 0);
  const pct = amount > 0 ? Math.min(Math.round((saved / amount) * 100), 100) : 0;

  const add = () => {
    const a = parseInt(newAmount.replace(/\D/g, '')) || 0;
    if (a <= 0) return;
    setContribs((prev) => [...prev, { amount: a, date: new Date().toISOString(), kind, label: newLabel.trim() || (kind === 'paid' ? 'Pago' : 'Separado') }]);
    setNewAmount('');
    setNewLabel('');
  };
  const remove = (i: number) => setContribs((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    await onSave(contribs);
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
          <h2 className="text-base font-semibold text-[#7626B3] truncate pr-2" style={{ fontFamily: 'var(--font-serif)' }}>{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#7626B3] shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-[#F0E7FA] rounded-xl px-3 py-2.5 text-sm text-[#431C72]">
            Llevás <strong>{fmt(saved)}</strong> de {fmt(amount)} <span className="text-[#7626B3]">({pct}%)</span>
          </div>

          {/* Lista de aportes */}
          {contribs.length > 0 && (
            <div className="space-y-2">
              {contribs.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.kind === 'paid' ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#F0E7FA] text-[#7626B3]'}`}>
                    {c.kind === 'paid' ? 'Pagado' : 'Separado'}
                  </span>
                  <span className="flex-1 text-gray-600 truncate">{c.label}</span>
                  <span className="font-medium text-gray-800">{fmt(c.amount)}</span>
                  <button onClick={() => remove(i)} className="text-gray-300 hover:text-[#D85A30]"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Agregar aporte */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-sm font-medium text-gray-700">Sumar al objetivo</p>
            <div className="grid grid-cols-2 gap-2">
              {(['paid', 'saved'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${kind === k ? 'border-[#7626B3] bg-[#F0E7FA] text-[#7626B3]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#7626B3]/50'}`}
                >
                  {k === 'paid' ? 'Ya lo pagué' : 'Lo separé'}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={kind === 'paid' ? '¿Qué pagaste? (opcional)' : 'Nota (opcional)'}
              className="w-full rounded-xl border-2 border-gray-200 focus:border-[#7626B3] outline-none px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute top-1/2 -translate-y-1/2 left-4 text-gray-500 z-10">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newAmount}
                  onChange={(e) => setNewAmount(fmtInput(e.target.value))}
                  placeholder="0"
                  className="w-full rounded-xl border-2 border-gray-200 focus:border-[#7626B3] outline-none pl-8 pr-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={add}
                disabled={(parseInt(newAmount.replace(/\D/g, '')) || 0) <= 0}
                className="bg-[#7626B3] hover:bg-[#682690] text-white rounded-xl px-3 disabled:opacity-40"
                aria-label="Agregar aporte"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
