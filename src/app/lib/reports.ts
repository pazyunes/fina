import { supabase, isSupabaseConfigured } from './supabase';
import { FinancialAnalysis, UserData } from '../types';

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

// Fire-and-forget persistence of a finished flow. Invisible to the end user;
// failures are logged but never surfaced in the UI.
export async function saveReport(userData: UserData, analysis: FinancialAnalysis): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('reports').insert({
    email: userData.email?.trim().toLowerCase() || null,
    name: userData.name || null,
    user_data: userData,
    analysis,
    ai_reasoning: buildFullReasoning(userData, analysis),
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fina] saveReport failed:', error.message);
  }
}
