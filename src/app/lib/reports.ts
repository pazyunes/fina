import { supabase, isSupabaseConfigured } from './supabase';
import { FinancialAnalysis, UserData } from '../types';

export interface AIReasoningSnapshot {
  totalIncome: number;
  totalExpenses: number;
  available: number;
  financialLevel: string;
  reduciblePercentage: number;
  insights: string[];
  recommendedInvestments: string[];
  actionPlan: string[];
}

export function buildReasoningSnapshot(analysis: FinancialAnalysis): AIReasoningSnapshot {
  return {
    totalIncome: analysis.totalIncome,
    totalExpenses: analysis.totalExpenses,
    available: analysis.available,
    financialLevel: analysis.financialLevel,
    reduciblePercentage: analysis.reduciblePercentage,
    insights: analysis.insights,
    recommendedInvestments: analysis.recommendedInvestments,
    actionPlan: analysis.actionPlan,
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
    ai_reasoning: buildReasoningSnapshot(analysis),
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fina] saveReport failed:', error.message);
  }
}
