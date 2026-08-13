import { useEffect, useState } from 'react';
import { useMoney } from '../lib/displayCurrency';
import { fetchPeriodExpenses, PeriodExpenses, mapTxnCategory, CATEGORY_META } from '../lib/transactions';

// Fecha relativa amigable: Hoy / Ayer / Hace N días / "12 ago".
function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// PR — "Últimos movimientos": feed de los gastos que la usuaria fue registrando
// por el chatbot (tabla transactions), estilo el listado de Mercado Pago.
export function MovementsCard({ resetDay, limit = 6 }: { resetDay: number; limit?: number }) {
  const { fmt } = useMoney();
  const [data, setData] = useState<PeriodExpenses | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPeriodExpenses(resetDay).then((d) => { if (active) setData(d); });
    return () => { active = false; };
  }, [resetDay]);

  const items = data?.items ?? [];
  const shown = showAll ? items : items.slice(0, limit);

  return (
    <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#D7C2EF]/70 shadow-sm mt-3">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-base font-semibold">Últimos movimientos</p>
        {items.length > 0 && (
          <span className="text-xs text-gray-400">{items.length} este período</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">Lo que fuiste registrando por el chatbot.</p>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 bg-[#F0E7FA]/50 rounded-lg px-3 py-3">
          Todavía no registraste gastos por WhatsApp. Cuando lo hagas, aparecen acá 👇
        </p>
      ) : (
        <div className="divide-y divide-[#D7C2EF]/40">
          {shown.map((t) => {
            const meta = CATEGORY_META[mapTxnCategory(t.category)];
            // Título: descripción o comercio si el bot lo capturó; si no, la categoría.
            const title = (t.description || t.merchant || meta.label).trim();
            const showCat = title.toLowerCase() !== meta.label.toLowerCase();
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-full bg-[#F0E7FA] flex items-center justify-center text-lg shrink-0">
                  {meta.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
                  <p className="text-xs text-gray-400">
                    {showCat ? `${meta.label} · ` : ''}{relativeDate(t.occurred_at)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-800 shrink-0 whitespace-nowrap">
                  −{fmt(t.amount_ars)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {items.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-xs font-semibold text-[#7626B3] py-2 hover:underline"
        >
          {showAll ? 'Ver menos' : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  );
}
