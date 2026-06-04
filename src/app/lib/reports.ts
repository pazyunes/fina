import { supabase, isSupabaseConfigured } from './supabase';
import { FinancialAnalysis, UserData } from '../types';
import { analyzeFinances } from '../utils/financialAnalyzer';

// Full, human-auditable dump of every step the AI Reasoning dashboard shows
// plus the raw inputs that fed into the financial analyzer. Stored in the
// `ai_reasoning` jsonb column so each flow run is traceable end to end.
export interface FullReasoning {
  profile: {
    name: string;
    age: string;
    email: string;
    gender: string;
  };
  interpretedData: {
    totalIncome: number;
    totalExpenses: number;
    available: number;
    expensesByCategory: {
      housing: number;
      health: number;
      beauty: number;
      therapy: number;
      gym: number;
      transport: number;
      subscriptionsTotal: number;
      subscriptionsCount: number;
      entertainmentWeeklyFrequency: number;
      entertainmentWeeklyAmount: number;
      deliveryWeeklyFrequency: number;
      deliveryWeeklyAmount: number;
      supermarketWeeklyFrequency: number;
      supermarketWeeklyAmount: number;
      installments: Array<{ name: string; monthlyAmount: number; remainingInstallments: number }>;
    };
  };
  calculations: {
    monthlyEntertainment: number;
    monthlyDelivery: number;
    monthlyInstallments: number;
    monthlySubscriptions: number;
    savingsRate: number;
    entertainmentPercentage: number;
    deliveryPercentage: number;
    fixedExpensesPercentage: number;
    installmentsPercentage: number;
    formulas: {
      totalExpenses: string;
      available: string;
      weeklyToMonthlyEntertainment: string;
      weeklyToMonthlyDelivery: string;
      savingsRate: string;
    };
  };
  patterns: Array<{ type: 'warning' | 'info' | 'success'; text: string }>;
  insightExplanations: Array<{ insight: string; explanation: string }>;
  goalCalculations: Array<{
    title: string;
    amount: number;
    timeframe: number;
    monthlyRequired: number;
    status: string;
    requiredPercentageOfAvailable: number | null;
    deficitIfNotPossible: number | null;
  }>;
  finalOutput: {
    financialLevel: string;
    reduciblePercentage: number;
    insights: string[];
    recommendedInvestments: string[];
    actionPlan: string[];
  };
}

export function buildFullReasoning(userData: UserData, analysis: FinancialAnalysis): FullReasoning {
  const { totalIncome, totalExpenses, available } = analysis;

  const monthlyEntertainment = userData.entertainmentFrequency * userData.entertainmentAmount * 4.33;
  const monthlyDelivery = userData.deliveryFrequency * userData.deliveryAmount * 4.33;
  const monthlyInstallments = userData.installments.reduce((sum, inst) => sum + inst.monthlyAmount, 0);
  const monthlySubscriptions = userData.subscriptions.reduce((sum, s) => sum + s.cost, 0);

  const pct = (part: number) => (totalIncome > 0 ? (part / totalIncome) * 100 : 0);
  const entertainmentPercentage = pct(monthlyEntertainment);
  const deliveryPercentage = pct(monthlyDelivery);
  const installmentsPercentage = pct(monthlyInstallments);
  const savingsRate = pct(available);
  const fixedExpensesPercentage = pct(
    userData.expenses.housing +
      userData.expenses.health +
      userData.expenses.beauty +
      userData.expenses.therapy +
      userData.expenses.gym +
      userData.expenses.transport
  );

  const patterns: FullReasoning['patterns'] = [];
  if (deliveryPercentage > 15) patterns.push({ type: 'warning', text: `Alto gasto en delivery en relación al ingreso (${deliveryPercentage.toFixed(1)}%)` });
  if (entertainmentPercentage > 20) patterns.push({ type: 'warning', text: `Gasto elevado en ocio semanal (${entertainmentPercentage.toFixed(1)}%)` });
  if (savingsRate < 10) patterns.push({ type: 'warning', text: `Bajo margen de ahorro (${savingsRate.toFixed(1)}%)` });
  if (fixedExpensesPercentage > 60) patterns.push({ type: 'warning', text: `Alta carga de gastos fijos (${fixedExpensesPercentage.toFixed(1)}%)` });
  if (savingsRate >= 20) patterns.push({ type: 'success', text: `Buen margen de ahorro (${savingsRate.toFixed(1)}%)` });
  if (deliveryPercentage < 10 && entertainmentPercentage < 15) patterns.push({ type: 'success', text: 'Gastos variables controlados' });

  const insightExplanations = analysis.insights.map((insight) => {
    let explanation: string;
    if (insight.includes('delivery')) {
      explanation = `Se sugiere reducir delivery porque representa más del 15% del gasto total (${deliveryPercentage.toFixed(1)}%). Esto es un gasto variable fácilmente optimizable.`;
    } else if (insight.includes('ocio') || insight.includes('salidas')) {
      explanation = `Se sugiere revisar gastos de ocio porque representan más del 20% del ingreso (${entertainmentPercentage.toFixed(1)}%). Es una categoría con alto potencial de ahorro.`;
    } else if (insight.includes('ahorro')) {
      explanation = `El margen de ahorro es bajo (${savingsRate.toFixed(1)}%). Se recomienda aumentar el ahorro para alcanzar objetivos financieros.`;
    } else if (insight.includes('gastos fijos')) {
      explanation = `Los gastos fijos representan ${fixedExpensesPercentage.toFixed(1)}% del ingreso. Es importante optimizar estos gastos para liberar más flujo de caja.`;
    } else {
      explanation = 'Insight generado basado en patrones detectados en el análisis financiero.';
    }
    return { insight, explanation };
  });

  const goalCalculations = analysis.goalsAnalysis.map((goal) => ({
    title: goal.title,
    amount: goal.amount,
    timeframe: goal.timeframe,
    monthlyRequired: goal.monthlyRequired,
    status: goal.status,
    requiredPercentageOfAvailable: available > 0 ? (goal.monthlyRequired / available) * 100 : null,
    deficitIfNotPossible: goal.status === 'not_possible' ? goal.monthlyRequired - available : null,
  }));

  return {
    profile: {
      name: userData.name,
      age: userData.age,
      email: userData.email,
      gender: userData.gender || 'prefiero_no_decir',
    },
    interpretedData: {
      totalIncome,
      totalExpenses,
      available,
      expensesByCategory: {
        housing: userData.expenses.housing,
        health: userData.expenses.health,
        beauty: userData.expenses.beauty,
        therapy: userData.expenses.therapy,
        gym: userData.expenses.gym,
        transport: userData.expenses.transport,
        subscriptionsTotal: monthlySubscriptions,
        subscriptionsCount: userData.subscriptions.length,
        entertainmentWeeklyFrequency: userData.entertainmentFrequency,
        entertainmentWeeklyAmount: userData.entertainmentAmount,
        deliveryWeeklyFrequency: userData.deliveryFrequency,
        deliveryWeeklyAmount: userData.deliveryAmount,
        supermarketWeeklyFrequency: userData.supermarketFrequency,
        supermarketWeeklyAmount: userData.supermarketAmount,
        installments: userData.installments,
      },
    },
    calculations: {
      monthlyEntertainment: Math.round(monthlyEntertainment),
      monthlyDelivery: Math.round(monthlyDelivery),
      monthlyInstallments,
      monthlySubscriptions,
      savingsRate: Number(savingsRate.toFixed(2)),
      entertainmentPercentage: Number(entertainmentPercentage.toFixed(2)),
      deliveryPercentage: Number(deliveryPercentage.toFixed(2)),
      fixedExpensesPercentage: Number(fixedExpensesPercentage.toFixed(2)),
      installmentsPercentage: Number(installmentsPercentage.toFixed(2)),
      formulas: {
        totalExpenses: `fijos(${userData.expenses.housing} + ${userData.expenses.health} + ${userData.expenses.beauty} + ${userData.expenses.therapy} + ${userData.expenses.gym} + ${userData.expenses.transport}) + suscripciones(${monthlySubscriptions}) + ocio(${userData.entertainmentFrequency} × ${userData.entertainmentAmount} × 4.33) + delivery(${userData.deliveryFrequency} × ${userData.deliveryAmount} × 4.33) + cuotas(${monthlyInstallments}) = ${totalExpenses}`,
        available: `${totalIncome} - ${totalExpenses} = ${available}`,
        weeklyToMonthlyEntertainment: `${userData.entertainmentFrequency} × ${userData.entertainmentAmount} × 4.33 = ${Math.round(monthlyEntertainment)}`,
        weeklyToMonthlyDelivery: `${userData.deliveryFrequency} × ${userData.deliveryAmount} × 4.33 = ${Math.round(monthlyDelivery)}`,
        savingsRate: `(${available} / ${totalIncome}) × 100 = ${savingsRate.toFixed(2)}%`,
      },
    },
    patterns,
    insightExplanations,
    goalCalculations,
    finalOutput: {
      financialLevel: analysis.financialLevel,
      reduciblePercentage: analysis.reduciblePercentage,
      insights: analysis.insights,
      recommendedInvestments: analysis.recommendedInvestments,
      actionPlan: analysis.actionPlan,
    },
  };
}

// Persistencia del informe terminado. PR6: cada usuario tiene UN solo
// informe (UNIQUE constraint en reports.user_id). Usamos upsert con
// ignoreDuplicates así un segundo intento no crashea — el redirect del
// onboarding ya debería prevenir esto, pero es defensa en profundidad.
// Sin sesión no se guarda nada (el onboarding requiere auth desde PR3).
export async function saveReport(userData: UserData, analysis: FinancialAnalysis): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const { error } = await supabase
    .from('reports')
    .upsert(
      {
        user_id: session.user.id,
        email: userData.email?.trim().toLowerCase() || null,
        name: userData.name || null,
        user_data: userData,
        analysis,
        ai_reasoning: buildFullReasoning(userData, analysis),
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fina] saveReport failed:', error.message);
  }
  // PR8c — Reflejamos los mismos datos en las tablas relacionales.
  await syncProfileTables(session.user.id, userData);
}

// PR6 — saber si el usuario logueado tiene su informe ya generado.
// Se usa para gatekeeping de rutas: con informe → /result, sin informe →
// flujo de onboarding. RLS garantiza que solo cuenta los propios.
export async function userHasReport(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { count, error } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fina] userHasReport failed:', error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

// PR6 — fetch del único informe del usuario logueado. Devuelve userData y
// analysis para que /result pueda renderizar tras un refresh sin que Main
// pierda contexto (el state in-memory se vacía con cada reload).
// El UNIQUE constraint en reports.user_id garantiza max 1 row.
export async function fetchUserReport(): Promise<{ userData: UserData; analysis: FinancialAnalysis } | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('reports')
    .select('user_data, analysis')
    .maybeSingle();
  if (error || !data) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[fina] fetchUserReport failed:', error.message);
    }
    return null;
  }
  return {
    userData: data.user_data as UserData,
    analysis: data.analysis as FinancialAnalysis,
  };
}

// PR8 — Reescribe el informe del usuario con un userData actualizado.
// Re-corre el analyzer del lado cliente y persiste user_data + analysis +
// ai_reasoning. Devuelve el nuevo analysis (o null si falló) así el caller
// puede actualizar el estado de UI sin esperar a un refetch redondante.
// Sigue siendo "un informe por usuario" (UNIQUE en user_id) — la UPDATE
// matchea la fila existente.
export async function updateReportData(newUserData: UserData): Promise<{ error: string | null; analysis: FinancialAnalysis | null }> {
  if (!isSupabaseConfigured) return { error: 'Supabase no configurado', analysis: null };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: 'Sin sesión activa', analysis: null };

  const analysis = analyzeFinances(newUserData);

  const { error } = await supabase
    .from('reports')
    .update({
      user_data: newUserData,
      analysis,
      ai_reasoning: buildFullReasoning(newUserData, analysis),
    })
    .eq('user_id', session.user.id);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fina] updateReportData failed:', error.message);
    return { error: error.message, analysis: null };
  }
  // PR8c — Espejamos a las tablas relacionales después de cada edición.
  await syncProfileTables(session.user.id, newUserData);
  return { error: null, analysis };
}

// PR8c — Espeja el userData del informe en las tablas relacionales del modelo
// "live profile" (user_profiles, incomes, fixed_expenses,
// variable_expense_estimates, goals). Estrategia: replace — borramos lo
// existente para el user y reinsertamos. Es lo más simple y suficiente para
// el volumen de datos que maneja un informe (decenas de filas como mucho).
//
// Se invoca después de cada save/update del informe. Cada tabla se sincroniza
// de forma independiente: si una falla (p. ej. constraint nuevo aún no
// aplicado), se loguea el error pero el resto avanza. La verdad sigue siendo
// reports.user_data jsonb; estas tablas son una vista normalizada para
// queries granulares.
async function syncProfileTables(userId: string, userData: UserData): Promise<void> {
  if (!isSupabaseConfigured) return;

  // ── user_profiles ──
  // Hacemos UPDATE en vez de INSERT porque la fila ya existe por el trigger
  // on_auth_user_created. NO tocamos phone ni phone_verified_at (los maneja
  // PR5b a través de user_metadata).
  const ageInt = userData.age ? parseInt(userData.age, 10) : null;
  try {
    const { error } = await supabase.from('user_profiles').update({
      name: userData.name || null,
      age: ageInt && !Number.isNaN(ageInt) ? ageInt : null,
      gender: userData.gender || null,
      lives_alone: userData.livesAlone ?? null,
      works_or_studies: userData.worksOrStudies || null,
      banks: userData.banks ?? [],
      income_type: userData.incomeType ?? 'fixed',
    }).eq('id', userId);
    if (error) console.error('[fina] sync user_profiles:', error.message);
  } catch (e: any) {
    console.error('[fina] sync user_profiles threw:', e?.message ?? e);
  }

  // ── incomes ──
  // Replace por simplicidad. Fixed = 1 fila (salario neto = monthlyIncome -
  // promedio freelance). Freelance = hasta 3 filas (month1/2/3).
  try {
    await supabase.from('incomes').delete().eq('user_id', userId);
    const incomeRows: Array<Record<string, unknown>> = [];
    const incomeType = userData.incomeType ?? 'fixed';
    if (incomeType === 'fixed' || incomeType === 'both') {
      const freelanceAvg = userData.freelanceIncome?.monthlyAvgArs ?? 0;
      const fixedArs = Math.max(userData.monthlyIncome - freelanceAvg, 0);
      if (fixedArs > 0) {
        incomeRows.push({
          user_id: userId,
          type: 'fixed',
          source: 'sueldo',
          amount_ars: fixedArs,
          currency: userData.incomeCurrency ?? 'ARS',
          original_amount: userData.incomeOriginalAmount ?? null,
          range_label: userData.incomeRange ?? null,
        });
      }
    }
    if (incomeType === 'freelance' || incomeType === 'both') {
      const fi = userData.freelanceIncome;
      if (fi) {
        for (const period of ['month1', 'month2', 'month3'] as const) {
          const m = fi[period];
          if (m && m.ars > 0) {
            incomeRows.push({
              user_id: userId,
              type: 'freelance',
              source: 'freelance',
              period,
              amount_ars: m.ars,
              currency: m.currency,
              original_amount: m.amount ?? null,
            });
          }
        }
      }
    }
    if (incomeRows.length > 0) {
      const { error } = await supabase.from('incomes').insert(incomeRows);
      if (error) console.error('[fina] sync incomes:', error.message);
    }
  } catch (e: any) {
    console.error('[fina] sync incomes threw:', e?.message ?? e);
  }

  // ── fixed_expenses ──
  try {
    await supabase.from('fixed_expenses').delete().eq('user_id', userId);
    const fixedRows: Array<Record<string, unknown>> = [];
    const namedCats = ['housing', 'health', 'beauty', 'therapy', 'gym', 'transport'] as const;
    for (const cat of namedCats) {
      const amt = (userData.expenses as any)?.[cat] ?? 0;
      if (amt > 0) {
        const row: Record<string, unknown> = {
          user_id: userId,
          category: cat,
          amount_ars: amt,
          currency: cat === 'housing' ? (userData.housingCurrency ?? 'ARS') : 'ARS',
        };
        if (cat === 'housing' && userData.housingOriginalAmount) {
          row.original_amount = userData.housingOriginalAmount;
        }
        if (cat === 'therapy' && userData.therapyDetails) {
          row.metadata = {
            session_price: userData.therapyDetails.sessionPrice,
            sessions_per_month: userData.therapyDetails.sessionsPerMonth,
          };
        }
        fixedRows.push(row);
      }
    }
    for (const inst of userData.installments ?? []) {
      if (inst.name && inst.monthlyAmount > 0) {
        fixedRows.push({
          user_id: userId,
          category: 'installment',
          merchant: inst.name,
          amount_ars: inst.monthlyAmount,
          currency: inst.currency ?? 'ARS',
          original_amount: inst.originalAmount ?? null,
          metadata: { remaining: inst.remainingInstallments },
        });
      }
    }
    for (const sub of userData.subscriptions ?? []) {
      if (sub.name && sub.cost > 0) {
        fixedRows.push({
          user_id: userId,
          category: 'subscription',
          merchant: sub.name,
          amount_ars: sub.cost,
          currency: sub.currency ?? 'ARS',
          original_amount: sub.originalCost ?? null,
        });
      }
    }
    if (fixedRows.length > 0) {
      const { error } = await supabase.from('fixed_expenses').insert(fixedRows);
      if (error) console.error('[fina] sync fixed_expenses:', error.message);
    }
  } catch (e: any) {
    console.error('[fina] sync fixed_expenses threw:', e?.message ?? e);
  }

  // ── variable_expense_estimates ──
  // weekly_frequency tiene CHECK > 0, así que skipeamos categorías con 0.
  try {
    await supabase.from('variable_expense_estimates').delete().eq('user_id', userId);
    const varRows: Array<Record<string, unknown>> = [];
    const variableMap = [
      { cat: 'entertainment', freq: userData.entertainmentFrequency, amt: userData.entertainmentAmount },
      { cat: 'delivery',      freq: userData.deliveryFrequency,      amt: userData.deliveryAmount },
      { cat: 'supermarket',   freq: userData.supermarketFrequency ?? 0, amt: userData.supermarketAmount ?? 0 },
      // 'cafeterias' requiere la migration 0007 aplicada — si no, esta fila
      // falla pero no rompe el resto.
      { cat: 'cafeterias',    freq: userData.cafeteriasFrequency ?? 0,  amt: userData.cafeteriasAmount ?? 0 },
    ];
    for (const v of variableMap) {
      if (v.freq > 0) {
        varRows.push({
          user_id: userId,
          category: v.cat,
          weekly_frequency: v.freq,
          average_amount_ars: v.amt,
        });
      }
    }
    if (varRows.length > 0) {
      const { error } = await supabase.from('variable_expense_estimates').insert(varRows);
      if (error) console.error('[fina] sync variable_expense_estimates:', error.message);
    }
  } catch (e: any) {
    console.error('[fina] sync variable_expense_estimates threw:', e?.message ?? e);
  }

  // ── goals ──
  try {
    await supabase.from('goals').delete().eq('user_id', userId);
    const goalRows = (userData.specificGoals ?? [])
      .filter((g) => g.title && g.amount > 0 && g.timeframe > 0)
      .map((g) => ({
        user_id: userId,
        title: g.title,
        amount_ars: g.amount,
        timeframe_months: g.timeframe,
        status: 'active',
      }));
    if (goalRows.length > 0) {
      const { error } = await supabase.from('goals').insert(goalRows);
      if (error) console.error('[fina] sync goals:', error.message);
    }
  } catch (e: any) {
    console.error('[fina] sync goals threw:', e?.message ?? e);
  }
}
