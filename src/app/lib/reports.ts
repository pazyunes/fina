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

export interface ReportRow {
  id: string;
  user_id: string;
  user_data: UserData;
  analysis: FinancialAnalysis;
  ai_reasoning: AIReasoningSnapshot | null;
  created_at: string;
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

export async function saveReport(args: {
  userData: UserData;
  analysis: FinancialAnalysis;
  aiReasoning: AIReasoningSnapshot;
}): Promise<{ id: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { id: null, error: 'Supabase no está configurado' };
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { id: null, error: 'No hay sesión activa' };

  // Keep the profile row in sync with the data just collected.
  await supabase
    .from('profiles')
    .update({
      name: args.userData.name,
      gender: args.userData.gender,
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid);

  const { data, error } = await supabase
    .from('reports')
    .insert({
      user_id: uid,
      user_data: args.userData,
      analysis: args.analysis,
      ai_reasoning: args.aiReasoning,
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null, error: null };
}

export async function listReports(): Promise<{ rows: ReportRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { rows: [], error: 'Supabase no está configurado' };
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { rows: [], error: error.message };
  return { rows: (data as ReportRow[]) ?? [], error: null };
}
