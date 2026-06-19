import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, TrendingUp } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { CurrencyToggle } from './CurrencyToggle';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { arsFromUsd, formatArs } from '../lib/currency';
import { Currency } from '../types';

// PR — Popup al tocar una categoría de objetivo. Hace que TODOS los objetivos
// sean SMART (Específico: nombre/qué; Medible: monto; Alcanzable: muestra el
// ahorro mensual necesario vs tu disponible; Temporal: plazo o "lo antes
// posible" calculado). Tipos:
//   - 'amount'  → monto + plazo (con opción "lo antes posible"). Ej: Comprar, Pagar deudas.
//   - 'travel'  → dos metas (pasajes/hospedaje + presupuesto del viaje).
//   - 'percent' → ahorrar X% del sueldo por mes (para "No tengo objetivo").
//   - 'info'    → mensaje informativo (Invertir).
export interface GoalCategoryConfig {
  kind: 'amount' | 'travel' | 'percent' | 'info';
  emoji?: string;
  prompt?: string;
  amountLabel?: string;
  askWhat?: boolean;
  whatLabel?: string;
  defaultTitle?: string;
  message?: string;
}

export type GoalDraft = { title: string; amount: string; timeframe: string; currency: Currency };

const fmtInput = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '');
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};
const digitsOf = (s: string) => parseInt(s.replace(/\D/g, '')) || 0;

export function GoalCategoryModal({
  category,
  config,
  usdRate,
  monthlyForGoals,
  monthlyIncome,
  onClose,
  onConfirmGoals,
  onConfirmInfo,
}: {
  category: string;
  config: GoalCategoryConfig;
  usdRate: number | null;
  monthlyForGoals: number; // cuánto puede destinar por mes a objetivos (ARS)
  monthlyIncome: number;   // sueldo mensual (ARS) para el % del sueldo
  onClose: () => void;
  onConfirmGoals: (goals: GoalDraft[]) => void;
  onConfirmInfo: () => void;
}) {
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [amount2, setAmount2] = useState(''); // travel: presupuesto del viaje
  const [percent, setPercent] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [asap, setAsap] = useState(false);
  const [currency, setCurrency] = useState<Currency>('ARS');

  const canAsap = monthlyForGoals > 0;
  const toArs = (digits: number) => (currency === 'USD' ? (usdRate ? arsFromUsd(digits, usdRate) : 0) : digits);

  // Monto total en ARS según el tipo (para feasibility y "lo antes posible").
  const totalArs =
    config.kind === 'travel'
      ? toArs(digitsOf(amount)) + toArs(digitsOf(amount2))
      : config.kind === 'percent'
        ? Math.round(monthlyIncome * (parseInt(percent) || 0) / 100) * (parseInt(timeframe) || 0)
        : toArs(digitsOf(amount));

  // Plazo efectivo (meses). En "lo antes posible" lo calculamos con el disponible.
  const asapMonths = canAsap && totalArs > 0 ? Math.max(1, Math.ceil(totalArs / monthlyForGoals)) : 0;
  const months = config.kind === 'percent' ? (parseInt(timeframe) || 0) : (asap ? asapMonths : (parseInt(timeframe) || 0));
  const monthlyNeeded = months > 0 ? Math.round(totalArs / months) : 0;
  const feasible = monthlyForGoals <= 0 || monthlyNeeded <= monthlyForGoals;

  // Validación por tipo.
  const canSave = (() => {
    if (months <= 0 && !(config.kind !== 'percent' && asap && canAsap)) {
      // percent siempre necesita meses; amount/travel necesitan meses salvo asap.
      if (!(config.kind !== 'percent' && asap && canAsap && asapMonths > 0)) return false;
    }
    if (config.kind === 'percent') return (parseInt(percent) || 0) > 0 && (parseInt(timeframe) || 0) > 0 && monthlyIncome > 0;
    if (config.kind === 'travel') return (digitsOf(amount) > 0 || digitsOf(amount2) > 0) && months > 0;
    // amount
    return digitsOf(amount) > 0 && months > 0 && (!config.askWhat || what.trim().length > 0);
  })();

  const handleSave = () => {
    if (!canSave) return;
    const tf = String(months);
    const goals: GoalDraft[] = [];
    if (config.kind === 'travel') {
      const dest = what.trim();
      const base = dest ? `Viaje a ${dest}` : (config.defaultTitle || 'Viaje');
      if (digitsOf(amount) > 0) goals.push({ title: `${base} – pasajes y hospedaje`, amount, timeframe: tf, currency });
      if (digitsOf(amount2) > 0) goals.push({ title: `${base} – presupuesto del viaje`, amount: amount2, timeframe: tf, currency });
    } else if (config.kind === 'percent') {
      const pct = parseInt(percent) || 0;
      const total = Math.round(monthlyIncome * pct / 100) * (parseInt(timeframe) || 0);
      goals.push({ title: `Ahorrar ${pct}% del sueldo por mes`, amount: fmtInput(String(total)), timeframe: tf, currency: 'ARS' });
    } else {
      const title = config.askWhat ? (what.trim() || config.defaultTitle || category) : (config.defaultTitle || category);
      goals.push({ title, amount, timeframe: tf, currency });
    }
    onConfirmGoals(goals);
    onClose();
  };

  // Campo de monto reutilizable (con moneda).
  const amountField = (label: string, value: string, setValue: (v: string) => void) => (
    <div>
      <Label className="text-gray-700 text-sm">{label}</Label>
      <div className="relative mt-2">
        <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>
          {currency === 'USD' ? 'USD' : '$'}
        </span>
        <Input
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(fmtInput(e.target.value))}
          placeholder="0"
          className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`}
        />
      </div>
    </div>
  );

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
          <button onClick={onClose} className="text-gray-400 hover:text-[#7626B3]"><X className="w-5 h-5" /></button>
        </div>

        {config.kind === 'info' ? (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-start gap-3 bg-[#F0E7FA] rounded-xl p-4">
              <TrendingUp className="w-5 h-5 text-[#7626B3] shrink-0 mt-0.5" />
              <p className="text-sm text-[#431C72] leading-relaxed">{config.message}</p>
            </div>
            <Button onClick={() => { onConfirmInfo(); onClose(); }} className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl">
              Entendido
            </Button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {config.prompt && <p className="text-sm text-gray-600">{config.prompt}</p>}

            {/* Nombre / destino / qué (Específico) */}
            {(config.askWhat || config.kind === 'travel') && (
              <div>
                <Label className="text-gray-700 text-sm">{config.whatLabel ?? (config.kind === 'travel' ? '¿A dónde viajás?' : '¿Qué querés comprar?')}</Label>
                <Input type="text" value={what} onChange={(e) => setWhat(e.target.value)} placeholder={config.kind === 'travel' ? 'Ej: Brasil, Bariloche…' : 'Ej: notebook, celular…'} className="mt-2 rounded-xl" />
              </div>
            )}

            {/* Montos */}
            {config.kind === 'travel' ? (
              <>
                <div className="flex justify-end"><CurrencyToggle value={currency} usdEnabled={!!usdRate} onChange={setCurrency} /></div>
                {amountField('Pasajes, hospedaje y reservas', amount, setAmount)}
                {amountField('Presupuesto para gastar en el viaje', amount2, setAmount2)}
              </>
            ) : config.kind === 'percent' ? (
              <div>
                <Label className="text-gray-700 text-sm">¿Qué % de tu sueldo querés ahorrar por mes?</Label>
                <div className="relative mt-2">
                  <Input type="number" inputMode="numeric" min="1" max="90" value={percent} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setPercent(v); }} placeholder="Ej: 20" className={`rounded-xl pr-8 ${AMOUNT_FIELD_CLASS}`} />
                  <span className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-500">%</span>
                </div>
                {monthlyIncome > 0 && (parseInt(percent) || 0) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">≈ {formatArs(Math.round(monthlyIncome * (parseInt(percent) || 0) / 100))}/mes</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-gray-700 text-sm">{config.amountLabel ?? '¿Cuánto querés ahorrar?'}</Label>
                  <CurrencyToggle value={currency} usdEnabled={!!usdRate} onChange={setCurrency} />
                </div>
                <div className="relative">
                  <span className={`absolute top-1/2 -translate-y-1/2 text-gray-500 z-10 ${currency === 'USD' ? 'left-3 text-sm' : 'left-4'}`}>{currency === 'USD' ? 'USD' : '$'}</span>
                  <Input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(fmtInput(e.target.value))} placeholder="0" className={`rounded-xl ${currency === 'USD' ? 'pl-12' : 'pl-8'} ${AMOUNT_FIELD_CLASS}`} />
                </div>
              </>
            )}

            {/* Plazo (Temporal) */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-700 text-sm">¿En cuántos meses?</Label>
                {config.kind !== 'percent' && canAsap && (
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    Lo antes posible
                    <Switch checked={asap} onCheckedChange={setAsap} className="data-[state=checked]:bg-[#7626B3]" />
                  </label>
                )}
              </div>
              {asap && config.kind !== 'percent' ? (
                <p className="text-sm text-[#431C72] bg-[#F0E7FA] rounded-lg px-3 py-2 mt-2">
                  {asapMonths > 0
                    ? <>Con tu disponible podrías lograrlo en <strong>~{asapMonths} {asapMonths === 1 ? 'mes' : 'meses'}</strong>.</>
                    : 'Cargá el monto para estimar el plazo.'}
                </p>
              ) : (
                <Input type="number" inputMode="numeric" min="1" max="120" value={timeframe} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setTimeframe(v); }} placeholder="6" className="mt-2 rounded-xl" />
              )}
            </div>

            {/* Feedback SMART: ahorro mensual necesario + alcanzabilidad */}
            {months > 0 && totalArs > 0 && (
              <div className={`rounded-lg px-3 py-2 text-sm ${feasible ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>
                Tenés que ahorrar <strong>~{formatArs(monthlyNeeded)}/mes</strong>.
                {monthlyForGoals > 0 && (feasible
                  ? ' Entra en tu disponible 👍'
                  : ` Es más que tu disponible (~${formatArs(monthlyForGoals)}/mes); quizás necesites más tiempo.`)}
              </div>
            )}

            <Button onClick={handleSave} disabled={!canSave} className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Check className="w-4 h-4" /> Guardar objetivo
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
