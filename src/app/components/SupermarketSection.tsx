import { useEffect, useRef, useState } from 'react';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import { ShoppingCart } from 'lucide-react';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { UserData } from '../types';

// PR #5 — Supermercado movido a "Gastos que se pagan mes a mes". Se sigue
// cargando por frecuencia × monto (para conservar el tracker "te quedan N
// compras" y la función del bot), pero la pregunta es POR MES. Internamente
// guardamos la frecuencia semanal equivalente (mes ÷ 4.33), sin tocar el bot.
export function SupermarketSection({
  initial,
  livesAccompanied,
  onChange,
  onCompleted,
}: {
  initial?: Partial<UserData>;
  livesAccompanied?: boolean;
  onChange: (v: { supermarketFrequency: number; supermarketAmount: number }) => void;
  onCompleted?: () => void;
}) {
  // Mostramos la frecuencia mensual (semanal guardado × 4.33).
  const [frequency, setFrequency] = useState(
    initial?.supermarketFrequency ? String(Math.round(initial.supermarketFrequency * 4.33)) : ''
  );
  const [amount, setAmount] = useState(initial?.supermarketAmount ? String(initial.supermarketAmount) : '');
  const [noSupermarket, setNoSupermarket] = useState(false);

  const fmt = (v: string) => {
    const n = Math.max(0, parseInt(v.replace(/\D/g, '')) || 0);
    return n > 0 ? `$${n.toLocaleString('es-AR').replace(/,/g, '.')}` : '';
  };

  useEffect(() => {
    if (noSupermarket) {
      onChange({ supermarketFrequency: 0, supermarketAmount: 0 });
      return;
    }
    onChange({
      // mensual → semanal para que el resto del sistema (×4.33) dé el mensual real.
      supermarketFrequency: (parseFloat(frequency) || 0) / 4.33,
      supermarketAmount: parseInt(amount.replace(/\D/g, '') || '0'),
    });
  }, [frequency, amount, noSupermarket]);

  const complete = noSupermarket || (frequency !== '' && amount !== '');
  // Avisar "completo" una sola vez (al perder foco / togglear), para cerrarla.
  const fired = useRef(false);
  const fireIfComplete = () => { if (!fired.current && complete) { fired.current = true; onCompleted?.(); } };

  return (
    <AccordionItem value="super" className="bg-white rounded-2xl shadow-sm border-0 px-5">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#7626B320' }}>
            <ShoppingCart className="w-5 h-5" style={{ color: '#7626B3' }} />
          </div>
          <span className="text-gray-700 text-left">Supermercado</span>
          {complete && !noSupermarket && <span className="ml-auto text-sm text-[#3B6D11]">✓</span>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-0 pb-5">
        {livesAccompanied && (
          <div className="mb-3 flex items-center gap-2 bg-[#FFF7E0] border border-[#E7C200] rounded-lg px-3 py-2">
            <span className="text-base">👯</span>
            <p className="text-sm font-semibold text-[#7A5B00]">Importante: poné solo lo que pagás <span className="underline">vos</span>.</p>
          </div>
        )}
        <div className="flex items-center gap-2 mb-4">
          <Switch checked={noSupermarket} onCheckedChange={(c) => { setNoSupermarket(c); if (c && !fired.current) { fired.current = true; onCompleted?.(); } }} className="data-[state=checked]:bg-[#7626B3]" />
          <span className="text-sm font-medium text-gray-600">No aplica / no lo pago yo</span>
        </div>

        <div className="space-y-4" style={{ opacity: noSupermarket ? 0.4 : 1, pointerEvents: noSupermarket ? 'none' : 'auto' }}>
          <div>
            <label className="block text-sm text-gray-600 mb-2">¿Cuántas compras en el súper hacés <span className="text-base font-bold text-[#7626B3]">por mes</span>?</label>
            <Input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={frequency}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setFrequency(v); }}
              onBlur={fireIfComplete}
              placeholder="Ej: 4"
              className={`w-full ${AMOUNT_FIELD_CLASS}`}
              disabled={noSupermarket}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">¿Cuánto gastás aproximadamente <span className="text-base font-bold text-[#7626B3]">por compra</span>?</label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={fmt(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              onBlur={fireIfComplete}
              placeholder="$0"
              className={`w-full ${AMOUNT_FIELD_CLASS}`}
              disabled={noSupermarket}
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
