import { supabase, isSupabaseConfigured } from './supabase';

// PR — Egresos registrados por la usuaria (los sube el chatbot de WhatsApp a la
// tabla `transactions`, source='whatsapp'/'web'/'manual'). El informe los lee
// para mostrar "egresos subidos a Fina" y un disponible real.

export interface Txn {
  id: string;
  occurred_at: string;
  amount_ars: number;
  category: string | null;
  merchant: string | null;
  description: string | null;
}

export interface MonthlyExpenses {
  items: Txn[];
  total: number;     // suma del mes
  count: number;
  avgPerDay: number; // total / días transcurridos del mes
}

// Egresos del mes en curso (type='expense'). RLS garantiza solo los propios.
export async function fetchMonthlyExpenses(): Promise<MonthlyExpenses> {
  const empty: MonthlyExpenses = { items: [], total: 0, count: 0, avgPerDay: 0 };
  if (!isSupabaseConfigured) return empty;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data, error } = await supabase
    .from('transactions')
    .select('id, occurred_at, amount_ars, category, merchant, description')
    .eq('type', 'expense')
    .gte('occurred_at', start)
    .order('occurred_at', { ascending: false });

  if (error || !data) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[fina] fetchMonthlyExpenses failed:', error.message);
    }
    return empty;
  }

  const items = data as Txn[];
  const total = items.reduce((s, t) => s + Number(t.amount_ars || 0), 0);
  const daysElapsed = Math.max(1, now.getDate());
  return {
    items,
    total,
    count: items.length,
    avgPerDay: Math.round(total / daysElapsed),
  };
}
