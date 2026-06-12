import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { FinancialAnalysis, UserData } from '../types';
import { useMoney } from '../lib/displayCurrency';
import { fetchPeriodExpenses, PeriodExpenses, BudgetCat, mapTxnCategory } from '../lib/transactions';

interface BudgetTrackerProps {
  analysis: FinancialAnalysis;
  resetDay: number;
}

interface Cat {
  key: BudgetCat;
  label: string;
  emoji: string;
  budget: number;
}

// Tope mensual estimado por categoría, a partir del onboarding.
function budgetsFrom(analysis: FinancialAnalysis): Cat[] {
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

// Categorías "por visita": tienen ticket promedio y unidad para decir
// "te queda 1 café", etc.
const VISIT: Partial<Record<BudgetCat, { ticketBase: (u: UserData) => number; unit: (n: number) => string }>> = {
  entertainment: { ticketBase: (u) => u.entertainmentAmount || 0, unit: (n) => (n === 1 ? 'salida' : 'salidas') },
  delivery:      { ticketBase: (u) => u.deliveryAmount || 0,      unit: (n) => (n === 1 ? 'pedido' : 'pedidos') },
  cafeterias:    { ticketBase: (u) => u.cafeteriasAmount || 0,    unit: (n) => (n === 1 ? 'café' : 'cafés') },
  restaurants:   { ticketBase: (u) => u.restaurantsAmount || 0,   unit: (n) => 'salida' + (n === 1 ? '' : 's') + ' a comer' },
  supermarket:   { ticketBase: (u) => u.supermarketAmount || 0,   unit: (n) => (n === 1 ? 'compra' : 'compras') },
};

export function BudgetTracker({ analysis, resetDay }: BudgetTrackerProps) {
  const navigate = useNavigate();
  const { fmt } = useMoney();
  const [data, setData] = useState<PeriodExpenses | null>(null);

  useEffect(() => {
    let active = true;
    fetchPeriodExpenses(resetDay).then((d) => { if (active) setData(d); });
    return () => { active = false; };
  }, [resetDay]);

  const u = analysis.userData;
  const cats = budgetsFrom(analysis);
  const spentOf = (k: BudgetCat) => data?.byCategory[k] ?? 0;

  // Prorrateo del primer período: si arrancó el onboarding a mitad de período,
  // descontamos del tope lo que "ya hubiese gastado" antes (budget/30 * díasPrevios).
  const onboardingDate = u.onboardingDate ? new Date(u.onboardingDate) : null;
  const proRateFactor = (() => {
    const ps = data?.periodStart;
    if (!onboardingDate || !ps || onboardingDate < ps) return 1;
    const daysElapsed = Math.max(0, Math.floor((onboardingDate.getTime() - ps.getTime()) / 86400000));
    return Math.max(1 - daysElapsed / 30, 0);
  })();
  const budgetOf = (c: Cat) => Math.round(c.budget * proRateFactor);

  // Cantidad de transacciones registradas por categoría (para el ticket real).
  const counts: Partial<Record<BudgetCat, number>> = {};
  (data?.items ?? []).forEach((t) => {
    const k = mapTxnCategory(t.category);
    counts[k] = (counts[k] || 0) + 1;
  });

  // Ticket de una categoría: promedio real si ya registró, si no el del onboarding.
  const ticketOf = (key: BudgetCat): number => {
    const v = VISIT[key];
    if (!v) return 0;
    const c = counts[key] || 0;
    if (c > 0) return Math.round(spentOf(key) / c);
    return v.ticketBase(u);
  };

  // Resumen de "te queda N unidad" para las categorías por visita.
  const remainingTickets = cats
    .map((c) => {
      const v = VISIT[c.key];
      if (!v) return null;
      const remaining = Math.max(budgetOf(c) - spentOf(c.key), 0);
      const ticket = ticketOf(c.key);
      const n = ticket > 0 ? Math.floor(remaining / ticket) : 0;
      return n >= 1 ? `${n} ${v.unit(n)}` : null;
    })
    .filter(Boolean) as string[];

  const overCats = cats.filter((c) => spentOf(c.key) > budgetOf(c));

  if (cats.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm mt-3 text-sm text-gray-500">
        Cargá tus gastos en el perfil para ver tu presupuesto por categoría.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#D7C2EF]/70 shadow-sm mt-3">
      <p className="text-base font-semibold mb-1">Tu presupuesto del mes</p>
      <p className="text-xs text-gray-500 mb-3">
        Cada barra arranca llena con tu tope y baja a medida que registrás gastos por el chatbot.
      </p>

      {remainingTickets.length > 0 && (
        <div className="bg-[#F0E7FA] rounded-lg px-3 py-2.5 text-sm text-[#431C72] mb-4">
          🎟️ Según los gastos que fuiste registrando por el chatbot, este mes todavía te queda:{' '}
          <strong>{remainingTickets.slice(0, 3).join(', ')}</strong>.
        </div>
      )}

      <div className="space-y-3.5">
        {cats.map((c) => {
          const spent = spentOf(c.key);
          const budget = budgetOf(c);
          const remaining = Math.max(budget - spent, 0);
          const ratio = budget > 0 ? remaining / budget : 0;
          const pct = Math.round(ratio * 100);
          const color = spent > budget ? '#D85A30' : ratio <= 0.2 ? '#D85A30' : ratio <= 0.4 ? '#B8860B' : '#7626B3';
          const v = VISIT[c.key];
          const ticket = ticketOf(c.key);
          const nLeft = v && ticket > 0 ? Math.floor(remaining / ticket) : null;
          const over = spent > budget;
          return (
            <div key={c.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="text-base">{c.emoji}</span>{c.label}
                </span>
                <span className={`text-sm font-semibold ${over ? 'text-[#D85A30]' : 'text-gray-800'}`}>
                  {over ? `te pasaste ${fmt(spent - budget)}` : `te queda ${fmt(remaining)}`}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#F0E7FA] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
              {nLeft !== null && !over && (
                <p className="text-xs text-gray-400 mt-0.5">
                  ≈ {nLeft} {v!.unit(nLeft)} más
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Aviso de exceso */}
      {overCats.length > 0 && (
        <div className="mt-4 bg-[#FBE3D9] rounded-lg px-3 py-3 text-sm text-[#8A3A1A]">
          <p className="font-semibold mb-1">Te pasaste del tope en {overCats.map((c) => c.label).join(', ')}.</p>
          <p className="text-xs mb-2">
            ¿Querés <strong>ajustar el tope</strong> o <strong>bajar el consumo</strong> el próximo período?
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
