import { useState } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

// PR — "¿Cuándo se renueva tu plata?" — el día en que entra el sueldo. Se guarda
// en user_metadata.incomeResetDay (default 1). En esa fecha arranca un período
// nuevo y el presupuesto por categoría se reinicia. Va debajo del Resumen.
export function IncomeResetControl() {
  const { user } = useAuth();
  const current = Number(user?.user_metadata?.incomeResetDay) || 1;
  const [day, setDay] = useState(current);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (n: number) => {
    setDay(n);
    setSaving(true);
    // Guardamos en auth (lo lee la app) y espejamos en user_profiles (lo lee la
    // función SQL tickets_disponibles del bot, así ambos usan el mismo período).
    await supabase.auth.updateUser({ data: { incomeResetDay: n } });
    if (user?.id) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ income_reset_day: n })
        .eq('id', user.id);
      if (error) console.error('[fina] mirror income_reset_day:', error.message);
    }
    setSaving(false);
    setOpen(false);
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 bg-white border border-[#D7C2EF]/70 shadow-sm rounded-xl px-4 py-3 text-sm text-gray-700 hover:border-[#7626B3] transition-colors"
      >
        <RefreshCw className="w-4 h-4 text-[#7626B3] shrink-0" />
        <span className="flex-1 text-left">
          Tu plata se renueva el <strong>día {day}</strong> de cada mes
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="bg-white border border-[#D7C2EF]/70 shadow-sm rounded-xl p-4 mt-2">
          <p className="text-sm text-gray-600 mb-3">¿Qué día entra tu sueldo o se renueva tu plata?</p>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                disabled={saving}
                onClick={() => save(n)}
                className={`h-8 rounded-lg text-sm transition-colors ${
                  n === day ? 'bg-[#7626B3] text-white font-semibold' : 'bg-[#F0E7FA] text-gray-700 hover:bg-[#E3D2F2]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">En esa fecha se reinicia el presupuesto del mes.</p>
        </div>
      )}
    </div>
  );
}
