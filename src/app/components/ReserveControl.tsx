import { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { useMoney } from '../lib/displayCurrency';

const fmtInput = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '');
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};

// PR — Reserva GENERAL de la plata: la usuaria aparta un monto arbitrario de su
// disponible. No está atada a objetivos. El disponible libre = disponible −
// reserva. El bot avisa si los gastos se comen la reserva.
export function ReserveControl({
  reserve,
  available,
  onSave,
}: {
  reserve: number;      // ARS reservado
  available: number;    // disponible del mes (ARS)
  onSave: (reserveArs: number) => Promise<void>;
}) {
  const { fmt } = useMoney();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(reserve > 0 ? fmtInput(String(reserve)) : '');
  const [saving, setSaving] = useState(false);

  const free = Math.max(available - reserve, 0);

  const save = async () => {
    const n = parseInt(value.replace(/\D/g, '')) || 0;
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setOpen(false);
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#F0E7FA] flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-[#7626B3]" />
        </div>
        <p className="flex-1 text-sm font-semibold text-gray-800">Reserva</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 text-sm font-semibold text-[#7626B3] hover:text-[#682690]"
        >
          {reserve > 0 ? 'Editar' : 'Reservar'}
        </button>
      </div>

      {reserve > 0 ? (
        <div className="mt-3 grid grid-cols-2 divide-x divide-[#D7C2EF]/50">
          <div className="pr-3">
            <p className="text-xs text-gray-500">En reserva</p>
            <p className="text-lg font-bold text-[#7626B3]">{fmt(reserve)}</p>
          </div>
          <div className="pl-3">
            <p className="text-xs text-gray-500">Disponible libre</p>
            <p className="text-lg font-bold text-gray-800">{fmt(free)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">Apartá un monto para no gastarlo. El bot te avisa si empezás a usarlo.</p>
      )}

      {open && (
        <div className="mt-3 pt-3 border-t border-[#D7C2EF]/50">
          <label className="text-xs text-gray-600">¿Cuánto querés dejar en reserva este mes?</label>
          <div className="flex gap-2 mt-1.5">
            <div className="relative flex-1">
              <span className="absolute top-1/2 -translate-y-1/2 left-4 text-gray-500 z-10">$</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={value}
                onChange={(e) => setValue(fmtInput(e.target.value))}
                placeholder="0"
                autoFocus
                className="w-full rounded-xl border-2 border-gray-200 focus:border-[#7626B3] outline-none pl-8 pr-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-[#059669] hover:bg-[#047857] text-white rounded-xl px-4 text-sm font-semibold flex items-center gap-1 disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> {saving ? '…' : 'Guardar'}
            </button>
          </div>
          {available > 0 && (
            <p className="text-[11px] text-gray-400 mt-1.5">Tu disponible del mes es {fmt(available)}. Reservá hasta ahí.</p>
          )}
        </div>
      )}
    </div>
  );
}
