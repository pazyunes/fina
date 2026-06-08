import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';
import { fetchPeriodExpenses, PeriodExpenses, BudgetCat } from '../lib/transactions';

interface BudgetTrackerProps {
  analysis: FinancialAnalysis;
  resetDay: number;
}

// Tope mensual estimado por categoría, a partir del onboarding.
function budgetsFrom(analysis: FinancialAnalysis): { key: BudgetCat; label: string; emoji: string; budget: number }[] {
  const u = analysis.userData;
  const e = u.expenses;
  const m = (f?: number, a?: number) => Math.round((f || 0) * (a || 0) * 4.33);
  const subs = (u.subscriptions ?? []).reduce((s, x) => s + (x.cost || 0), 0);
  return [
    { key: 'entertainment', label: 'Entretenimiento', emoji: '🎉', budget: m(u.entertainmentFrequency, u.entertainmentAmount) },
    { key: 'delivery',      label: 'Delivery',        emoji: '🍔', budget: m(u.deliveryFrequency, u.deliveryAmount) },
    { key: 'cafeterias',    label: 'Cafetería',       emoji: '☕', budget: m(u.cafeteriasFrequency, u.cafeteriasAmount) },
    { key: 'restaurants',   label: 'Restaurantes',    emoji: '🍽️', budget: m(u.restaurantsFrequency, u.restaurantsAmount) },
    { key: 'supermarket',   label: 'Supermercado',    emoji: '🛒', budget: m(u.supermarketFrequency, u.supermarketAmount) },
    { key: 'housing',       label: 'Vivienda',        emoji: '🏠', budget: e?.housing || 0 },
    { key: 'health',        label: 'Salud',           emoji: '🩺', budget: e?.health || 0 },
    { key: 'beauty',        label: 'Belleza',         emoji: '💄', budget: e?.beauty || 0 },
    { key: 'therapy',       label: 'Terapia',         emoji: '🧠', budget: e?.therapy || 0 },
    { key: 'gym',           label: 'Gimnasio',        emoji: '💪', budget: e?.gym || 0 },
    { key: 'transport',     label: 'Transporte',      emoji: '🚌', budget: e?.transport || 0 },
    { key: 'subscriptions', label: 'Suscripciones',   emoji: '📺', budget: subs },
  ].filter((c) => c.budget > 0);
}

export function BudgetTracker({ analysis, resetDay }: BudgetTrackerProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<PeriodExpenses | null>(null);

  useEffect(() => {
    let active = true;
    fetchPeriodExpenses(resetDay).then((d) => { if (active) setData(d); });
    return () => { active = false; };
  }, [resetDay]);

  const cats = budgetsFrom(analysis);
  const spentOf = (k: BudgetCat) => data?.byCategory[k] ?? 0;
  const overCats = cats.filter((c) => spentOf(c.key) > c.budget);

  if (cats.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm mt-3 text-sm text-gray-500">
        Cargá tus gastos variables en el perfil para ver tu presupuesto por categoría.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#D7C2EF]/70 shadow-sm mt-3">
      <p className="text-base font-semibold mb-1">Tu presupuesto del mes</p>
      <p className="text-xs text-gray-500 mb-4">
        El tope sale de lo que estimaste al arrancar. Se llena con lo que registrás por el chatbot.
      </p>

      <div className="space-y-3.5">
        {cats.map((c) => {
          const spent = spentOf(c.key);
          const pct = c.budget > 0 ? Math.min(Math.round((spent / c.budget) * 100), 100) : 0;
          const over = spent > c.budget;
          return (
            <div key={c.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="text-base">{c.emoji}</span>{c.label}
                </span>
                <span className={`text-sm font-semibold ${over ? 'text-[#D85A30]' : 'text-gray-800'}`}>
                  {formatArs(spent)} <span className="text-xs font-normal text-gray-400">/ {formatArs(c.budget)}</span>
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#F0E7FA] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: over ? '#D85A30' : '#7626B3' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Aviso de exceso: ajustar tope o bajar el consumo */}
      {overCats.length > 0 && (
        <div className="mt-4 bg-[#FBE3D9] rounded-lg px-3 py-3 text-sm text-[#8A3A1A]">
          <p className="font-semibold mb-1">Te pasaste del tope en {overCats.map((c) => c.label).join(', ')}.</p>
          <p className="text-xs mb-2">
            ¿Querés <strong>ajustar el tope</strong> (poné como referencia lo que gastaste) o{' '}
            <strong>bajar el consumo</strong> el próximo período?
          </p>
          <button
            type="button"
            onClick={() => navigate('/editar/gastos-variables')}
            className="text-xs font-semibold text-[#7626B3] underline"
          >
            Ajustar el tope en mi perfil →
          </button>
        </div>
      )}
    </div>
  );
}
