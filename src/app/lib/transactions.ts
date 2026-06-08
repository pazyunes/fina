import { supabase, isSupabaseConfigured } from './supabase';

// PR — Egresos registrados por la usuaria (los sube el chatbot de WhatsApp a la
// tabla `transactions`). El informe los usa para llenar el presupuesto por
// categoría (tope = estimado del onboarding) y para el disponible real.

export interface Txn {
  id: string;
  occurred_at: string;
  amount_ars: number;
  category: string | null;
  merchant: string | null;
  description: string | null;
}

// Categorías canónicas del presupuesto (matchean con el onboarding y con las
// categorías que escribe el chatbot).
export type BudgetCat =
  | 'entertainment' | 'delivery' | 'cafeterias' | 'restaurants' | 'supermarket'
  | 'housing' | 'health' | 'beauty' | 'therapy' | 'gym' | 'transport'
  | 'subscriptions' | 'other';

// Mapea la category que escribe el bot (Entretenimiento, Delivery, Cafetería,
// Restaurantes, Supermercado, Vivienda, Salud, Belleza, Terapia, Gimnasio,
// Nafta, SUBE, Suscripciones) a una categoría canónica. Nafta + SUBE → transporte.
export function mapTxnCategory(raw: string | null): BudgetCat {
  const c = (raw || '').toLowerCase();
  if (/entreten/.test(c)) return 'entertainment';
  if (/deliver|pedido|rappi/.test(c)) return 'delivery';
  if (/cafe|cafeter/.test(c)) return 'cafeterias';
  if (/restaur/.test(c)) return 'restaurants';
  if (/super|mercado|almac/.test(c)) return 'supermarket';
  if (/vivienda|alquiler|hogar|expensas/.test(c)) return 'housing';
  if (/salud|prepaga|m[eé]dic/.test(c)) return 'health';
  if (/belleza|peluquer|manicur/.test(c)) return 'beauty';
  if (/terapia|psico/.test(c)) return 'therapy';
  if (/gimnasio|gym/.test(c)) return 'gym';
  if (/nafta|combust|sube|transp|colectiv|uber|taxi|cabify/.test(c)) return 'transport';
  if (/suscrip|streaming/.test(c)) return 'subscriptions';
  return 'other';
}

export interface PeriodExpenses {
  items: Txn[];
  total: number;
  count: number;
  byCategory: Record<BudgetCat, number>;
  periodStart: Date;
}

// Inicio del período actual según el día de reinicio (día en que "se regenera"
// el ingreso). Ej: resetDay=10 y hoy es 5 → arranca el 10 del mes pasado.
export function currentPeriodStart(resetDay: number): Date {
  const now = new Date();
  const d = Math.min(Math.max(resetDay || 1, 1), 28);
  const start = new Date(now.getFullYear(), now.getMonth(), d);
  if (now.getDate() < d) start.setMonth(start.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

const emptyByCat = (): Record<BudgetCat, number> => ({
  entertainment: 0, delivery: 0, cafeterias: 0, restaurants: 0, supermarket: 0,
  housing: 0, health: 0, beauty: 0, therapy: 0, gym: 0, transport: 0,
  subscriptions: 0, other: 0,
});

// Egresos del período en curso (type='expense'), agrupados por categoría.
export async function fetchPeriodExpenses(resetDay: number): Promise<PeriodExpenses> {
  const periodStart = currentPeriodStart(resetDay);
  const empty: PeriodExpenses = { items: [], total: 0, count: 0, byCategory: emptyByCat(), periodStart };
  if (!isSupabaseConfigured) return empty;

  const { data, error } = await supabase
    .from('transactions')
    .select('id, occurred_at, amount_ars, category, merchant, description')
    .eq('type', 'expense')
    .gte('occurred_at', periodStart.toISOString())
    .order('occurred_at', { ascending: false });

  if (error || !data) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[fina] fetchPeriodExpenses failed:', error.message);
    }
    return empty;
  }

  const items = data as Txn[];
  const byCategory = emptyByCat();
  let total = 0;
  for (const t of items) {
    const amt = Number(t.amount_ars || 0);
    total += amt;
    byCategory[mapTxnCategory(t.category)] += amt;
  }
  return { items, total, count: items.length, byCategory, periodStart };
}
