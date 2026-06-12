import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { formatArs, formatUsd } from './currency';

// PR — Moneda de visualización (ARS por default, o USD dolarizando todo). El
// toggle vive en el informe y en objetivos; la preferencia se guarda en el
// navegador. La cotización sale del snapshot del informe (la setea cada pantalla).

type DisplayCurrency = 'ARS' | 'USD';

interface Ctx {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  rate: number | null;
  setRate: (r: number | null) => void;
}

const C = createContext<Ctx | undefined>(undefined);
const KEY = 'fina-display-currency';

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
    try { return localStorage.getItem(KEY) === 'USD' ? 'USD' : 'ARS'; } catch { return 'ARS'; }
  });
  const [rate, setRate] = useState<number | null>(null);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    try { localStorage.setItem(KEY, c); } catch { /* noop */ }
  }, []);

  return <C.Provider value={{ currency, setCurrency, rate, setRate }}>{children}</C.Provider>;
}

export function useDisplayCurrency(): Ctx {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useDisplayCurrency debe usarse dentro de <DisplayCurrencyProvider>');
  return ctx;
}

// $XXk / $X.XM abreviado (ARS).
function formatKpiArs(ars: number): string {
  if (ars >= 1_000_000) return `$${(ars / 1_000_000).toFixed(ars >= 10_000_000 ? 0 : 1)}M`;
  if (ars >= 1_000) return `$${Math.round(ars / 1_000)}k`;
  return `$${ars}`;
}

// Formateadores que respetan la moneda elegida. Si es USD pero no hay cotización,
// caen a ARS.
export function useMoney() {
  const { currency, rate, setRate } = useDisplayCurrency();
  const usd = currency === 'USD' && rate && rate > 0;

  const fmt = (ars: number) => (usd ? formatUsd(Math.round(ars / (rate as number))) : formatArs(ars));

  const fmtKpi = (ars: number) => {
    if (!usd) return formatKpiArs(ars);
    const v = ars / (rate as number);
    if (v >= 1_000_000) return `US$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
    if (v >= 1_000) return `US$${Math.round(v / 1_000)}k`;
    return `US$${Math.round(v)}`;
  };

  return { fmt, fmtKpi, currency, isUsd: !!usd, setRate };
}

// Toggle ARS / USD. Estilo neutro (anda sobre fondo claro u oscuro vía `dark`).
export function DisplayCurrencyToggle({ dark = false }: { dark?: boolean }) {
  const { currency, setCurrency, rate } = useDisplayCurrency();
  const base = dark ? 'border-white/40' : 'border-[#D7C2EF]';
  return (
    <div className={`inline-flex rounded-full border ${base} overflow-hidden text-xs`}>
      {(['ARS', 'USD'] as const).map((c) => {
        const disabled = c === 'USD' && !rate;
        const active = currency === c;
        const activeCls = dark ? 'bg-white text-[#7626B3]' : 'bg-[#7626B3] text-white';
        const idleCls = dark ? 'text-white/80' : 'text-[#7626B3]';
        return (
          <button
            key={c}
            type="button"
            onClick={() => !disabled && setCurrency(c)}
            disabled={disabled}
            title={disabled ? 'Sin cotización disponible' : `Ver en ${c}`}
            className={`px-3 py-1.5 font-semibold transition-colors ${active ? activeCls : idleCls} disabled:opacity-40`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
