import { useEffect, useState } from 'react';
import { FinancialAnalysis, UserData } from '../types';
import { useMoney } from '../lib/displayCurrency';
import { fetchPeriodExpenses, BudgetCat } from '../lib/transactions';

// PR — Cierre de mes. Aparece en el informe los últimos días del período.
//  - #4: pregunta si ahorró su disponible (ingresos − gastos − invertible). Si
//    sí → lo suma como aporte al objetivo elegido. Si no → a dónde fue.
//  - #3: por cada categoría donde gastó MENOS que su tope, pregunta a dónde fue
//    esa plata.
// Las respuestas se guardan en userData.periodReviews[periodKey] (jsonb).

interface Props {
  analysis: FinancialAnalysis;
  resetDay: number;
  periodKey: string;
  periodStart: Date;
  savingTarget: number; // disponible que "debería" haber ahorrado
  onSubmit: (newUserData: UserData) => Promise<void>;
}

const VAR_CATS: { key: BudgetCat; label: string; emoji: string; freq: (u: UserData) => number; amt: (u: UserData) => number }[] = [
  { key: 'entertainment', label: 'Entretenimiento', emoji: '🎉', freq: (u) => u.entertainmentFrequency || 0, amt: (u) => u.entertainmentAmount || 0 },
  { key: 'delivery',      label: 'Delivery',        emoji: '🍔', freq: (u) => u.deliveryFrequency || 0,      amt: (u) => u.deliveryAmount || 0 },
  { key: 'cafeterias',    label: 'Cafetería',       emoji: '☕', freq: (u) => u.cafeteriasFrequency || 0,    amt: (u) => u.cafeteriasAmount || 0 },
  { key: 'restaurants',   label: 'Restaurantes',    emoji: '🍽️', freq: (u) => u.restaurantsFrequency || 0,   amt: (u) => u.restaurantsAmount || 0 },
  { key: 'supermarket',   label: 'Supermercado',    emoji: '🛒', freq: (u) => u.supermarketFrequency || 0,   amt: (u) => u.supermarketAmount || 0 },
];

const SPEND_OPTIONS = ['Lo ahorré', 'Lo gasté en otra cosa', 'Otra'];
const SAVE_NO_OPTIONS = ['Lo invertí', 'Lo gasté', 'Otra'];

function Choice({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === o ? 'bg-[#7626B3] text-white border-[#7626B3]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#7626B3]/50'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function MonthEndReview({ analysis, resetDay, periodKey, periodStart, savingTarget, onSubmit }: Props) {
  const { fmt } = useMoney();
  const u = analysis.userData;
  const goals = analysis.userData.specificGoals ?? [];

  const [spent, setSpent] = useState<Partial<Record<BudgetCat, number>>>({});
  const [saved, setSaved] = useState<'yes' | 'no' | ''>('');
  const [goalIdx, setGoalIdx] = useState(0);
  const [saveDest, setSaveDest] = useState('');
  const [saveDestOther, setSaveDestOther] = useState('');
  const [under, setUnder] = useState<Record<string, { choice: string; other: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPeriodExpenses(resetDay).then((d) => { if (active) setSpent(d.byCategory); });
    return () => { active = false; };
  }, [resetDay]);

  // Categorías donde gastó menos que el tope.
  const underCats = VAR_CATS.map((c) => {
    const budget = Math.round(c.freq(u) * c.amt(u) * 4.33);
    const sp = spent[c.key] ?? 0;
    return { ...c, budget, spent: sp, diff: budget - sp };
  }).filter((c) => c.budget > 0 && c.spent < c.budget);

  const setUnderFor = (key: string, patch: Partial<{ choice: string; other: string }>) =>
    setUnder((prev) => ({ ...prev, [key]: { choice: '', other: '', ...prev[key], ...patch } }));

  const handleSubmit = async () => {
    setSubmitting(true);
    const review = {
      done: true,
      saved: (saved || undefined) as 'yes' | 'no' | undefined,
      savedDestination: saved === 'no' ? (saveDest === 'Otra' ? saveDestOther.trim() : saveDest) || undefined : undefined,
      underspend: Object.fromEntries(
        underCats
          .map((c) => {
            const a = under[c.key];
            if (!a?.choice) return null;
            return [c.key, a.choice === 'Otra' ? a.other.trim() : a.choice];
          })
          .filter(Boolean) as [string, string][]
      ),
    };

    const next: UserData = {
      ...u,
      periodReviews: { ...(u.periodReviews ?? {}), [periodKey]: review },
    };

    // Si ahorró → sumamos el disponible como aporte al objetivo elegido.
    if (saved === 'yes' && savingTarget > 0 && goals.length > 0) {
      next.specificGoals = u.specificGoals.map((g, i) =>
        i === goalIdx
          ? { ...g, contributions: [...(g.contributions ?? []), { amount: savingTarget, date: periodStart.toISOString() }] }
          : g
      );
    }

    await onSubmit(next);
    setSubmitting(false);
  };

  const canSubmit = saved !== '' && (saved !== 'no' || saveDest !== '');

  return (
    <div className="bg-white rounded-xl p-4 lg:p-5 border-2 border-[#7626B3] shadow-sm mb-5">
      <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-1">Cierre de mes</p>
      <p className="text-base font-semibold mb-3">Repasemos cómo te fue 👀</p>

      {/* #4 — Ahorro */}
      <div className="mb-4">
        <p className="text-sm text-gray-700 mb-2">
          Este mes tu disponible para ahorrar era <strong>{fmt(savingTarget)}</strong>. ¿Lo ahorraste?
        </p>
        <Choice options={['Sí', 'No']} value={saved === 'yes' ? 'Sí' : saved === 'no' ? 'No' : ''} onChange={(v) => setSaved(v === 'Sí' ? 'yes' : 'no')} />

        {saved === 'yes' && goals.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">¿A qué objetivo lo sumamos?</p>
            <select
              value={goalIdx}
              onChange={(e) => setGoalIdx(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              {goals.map((g, i) => (
                <option key={i} value={i}>{g.title}</option>
              ))}
            </select>
          </div>
        )}

        {saved === 'no' && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">¿A dónde fue esa plata?</p>
            <Choice options={SAVE_NO_OPTIONS} value={saveDest} onChange={setSaveDest} />
            {saveDest === 'Otra' && (
              <input
                value={saveDestOther}
                onChange={(e) => setSaveDestOther(e.target.value)}
                placeholder="Contanos…"
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            )}
          </div>
        )}
      </div>

      {/* #3 — Por qué gastó menos en cada categoría */}
      {underCats.length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <p className="text-sm text-gray-700">Gastaste menos de lo previsto en estas. ¿A dónde fue esa plata?</p>
          {underCats.map((c) => (
            <div key={c.key}>
              <p className="text-sm text-gray-700 mb-2">
                <span className="mr-1">{c.emoji}</span>{c.label} — te sobraron <strong>{fmt(c.diff)}</strong>
              </p>
              <Choice
                options={SPEND_OPTIONS}
                value={under[c.key]?.choice ?? ''}
                onChange={(v) => setUnderFor(c.key, { choice: v })}
              />
              {under[c.key]?.choice === 'Otra' && (
                <input
                  value={under[c.key]?.other ?? ''}
                  onChange={(e) => setUnderFor(c.key, { other: e.target.value })}
                  placeholder="Contanos…"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full mt-5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? 'Guardando…' : 'Cerrar el mes'}
      </button>
    </div>
  );
}
