import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { FinancialAnalysis } from '../types';
import { Brain, TrendingUp, Calculator, Target, Lightbulb, AlertCircle, History, User } from 'lucide-react';

interface AIReasoningProps {
  analysis: FinancialAnalysis | null;
}

interface HistoryEntry {
  timestamp: string;
  profile: { name: string; age: string; email: string; gender: string };
  snapshot: {
    totalIncome: number;
    totalExpenses: number;
    available: number;
    financialLevel: string;
    reduciblePercentage: number;
    insights: string[];
    recommendedInvestments: string[];
    actionPlan: string[];
  };
}

const HISTORY_KEY = 'fina_ai_reasoning_history_v1';

function loadHistory(): Record<string, HistoryEntry[]> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHistoryEntry(email: string, entry: HistoryEntry) {
  const all = loadHistory();
  const key = email.trim().toLowerCase() || 'anonymous';
  all[key] = [entry, ...(all[key] || [])].slice(0, 20);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function AIReasoning({ analysis }: AIReasoningProps) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!analysis) return;
    const entry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      profile: {
        name: analysis.userData.name,
        age: analysis.userData.age,
        email: analysis.userData.email,
        gender: analysis.userData.gender || 'prefiero_no_decir',
      },
      snapshot: {
        totalIncome: analysis.totalIncome,
        totalExpenses: analysis.totalExpenses,
        available: analysis.available,
        financialLevel: analysis.financialLevel,
        reduciblePercentage: analysis.reduciblePercentage,
        insights: analysis.insights,
        recommendedInvestments: analysis.recommendedInvestments,
        actionPlan: analysis.actionPlan,
      },
    };
    saveHistoryEntry(analysis.userData.email, entry);
    const all = loadHistory();
    const key = (analysis.userData.email || '').trim().toLowerCase() || 'anonymous';
    setHistory(all[key] || []);
  }, [analysis]);

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">No hay datos de análisis disponibles</p>
          <Button onClick={() => navigate('/splash')} className="mt-4">
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }
  
  const { userData, totalIncome, totalExpenses, available } = analysis;

  // Calculate weekly to monthly conversions
  const monthlyEntertainment = userData.entertainmentFrequency * userData.entertainmentAmount * 4.33;
  const monthlyDelivery = userData.deliveryFrequency * userData.deliveryAmount * 4.33;
  const monthlyInstallments = userData.installments.reduce((sum, inst) => sum + inst.monthlyAmount, 0);

  // Calculate percentages
  const entertainmentPercentage = totalIncome > 0 ? (monthlyEntertainment / totalIncome) * 100 : 0;
  const deliveryPercentage = totalIncome > 0 ? (monthlyDelivery / totalIncome) * 100 : 0;
  const savingsRate = totalIncome > 0 ? (available / totalIncome) * 100 : 0;
  const fixedExpensesPercentage = totalIncome > 0 ? ((userData.expenses.housing + userData.expenses.health + userData.expenses.transport) / totalIncome) * 100 : 0;

  // Detect patterns
  const patterns: Array<{ type: 'warning' | 'info' | 'success'; text: string }> = [];
  
  if (deliveryPercentage > 15) {
    patterns.push({ type: 'warning', text: `Alto gasto en delivery en relación al ingreso (${deliveryPercentage.toFixed(1)}%)` });
  }
  
  if (entertainmentPercentage > 20) {
    patterns.push({ type: 'warning', text: `Gasto elevado en ocio semanal (${entertainmentPercentage.toFixed(1)}%)` });
  }
  
  if (savingsRate < 10) {
    patterns.push({ type: 'warning', text: `Bajo margen de ahorro (${savingsRate.toFixed(1)}%)` });
  }
  
  if (fixedExpensesPercentage > 60) {
    patterns.push({ type: 'warning', text: `Alta carga de gastos fijos (${fixedExpensesPercentage.toFixed(1)}%)` });
  }
  
  if (savingsRate >= 20) {
    patterns.push({ type: 'success', text: `Buen margen de ahorro (${savingsRate.toFixed(1)}%)` });
  }

  if (deliveryPercentage < 10 && entertainmentPercentage < 15) {
    patterns.push({ type: 'success', text: 'Gastos variables controlados' });
  }

  // Explain insights generation
  const insightExplanations = analysis.insights.map((insight, idx) => {
    let explanation = '';
    
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full pb-24"
        >
          {/* Header */}
          <div className="mb-8 border-b border-gray-700 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-8 h-8 text-purple-400" />
              <h2 className="text-3xl text-purple-400" style={{ fontFamily: 'var(--font-serif)' }}>
                AI Reasoning Dashboard
              </h2>
            </div>
            <p className="text-gray-400 text-sm">
              Vista interna del procesamiento de datos · No visible para usuario final
            </p>
          </div>

          <div className="space-y-6">
            {/* 0. Perfil del usuario */}
            <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl text-cyan-400">0. Perfil del usuario</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Nombre:</p>
                  <p className="text-white">{userData.name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Edad:</p>
                  <p className="text-white">{userData.age || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Email:</p>
                  <p className="text-white break-all">{userData.email || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Género:</p>
                  <p className="text-white">{userData.gender || '—'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Categorización: estos campos se usan para segmentar y validar el comportamiento del razonamiento.
              </p>
            </section>

            {/* 1. Interpreted Data */}
            <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h3 className="text-xl text-blue-400">1. Datos interpretados</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Ingresos detectados:</p>
                  <p className="text-lg text-white">${totalIncome.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                </div>
                
                <div>
                  <p className="text-gray-400">Total de egresos:</p>
                  <p className="text-lg text-white">${totalExpenses.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-700 pt-4">
                <p className="text-gray-400 mb-2">Gastos por categoría:</p>
                <div className="space-y-1 text-sm">
                  <p>• Alquiler: ${userData.expenses.housing.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                  <p>• Salud: ${userData.expenses.health.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                  <p>• Transporte / movilidad: ${userData.expenses.transport.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                  <p>• Suscripciones: {userData.subscriptions.length} servicios</p>
                  <p>• Entretenimiento/ocio: {userData.entertainmentFrequency}x/semana × ${userData.entertainmentAmount.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                  <p>• Delivery: {userData.deliveryFrequency}x/semana × ${userData.deliveryAmount.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                  {userData.installments.length > 0 && (
                    <>
                      <p className="mt-2 text-gray-400">• Cuotas ({userData.installments.length}):</p>
                      {userData.installments.map((inst, idx) => (
                        <p key={idx} className="ml-4">- {inst.name}: ${inst.monthlyAmount.toLocaleString('es-AR').replace(/,/g, '.')}/mes ({inst.remainingInstallments} restantes)</p>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* 2. Calculations Performed */}
            <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-green-400" />
                <h3 className="text-xl text-green-400">2. Cálculos realizados</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <p className="text-gray-400">Total de egresos:</p>
                  <p className="font-mono">
                    Fijos ({userData.expenses.housing} + {userData.expenses.health} + {userData.expenses.transport}) +
                    Suscripciones ({userData.subscriptions.reduce((sum, s) => sum + s.cost, 0)}) +
                    Ocio mensual ({userData.entertainmentFrequency} × {userData.entertainmentAmount} × 4.33 = {monthlyEntertainment.toFixed(0)}) +
                    Delivery mensual ({userData.deliveryFrequency} × {userData.deliveryAmount} × 4.33 = {monthlyDelivery.toFixed(0)}) +
                    Cuotas ({monthlyInstallments})
                  </p>
                  <p className="text-green-400 mt-2">= ${totalExpenses.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <p className="text-gray-400">Dinero disponible:</p>
                  <p className="font-mono">{totalIncome} - {totalExpenses} = ${available.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                  <p className="text-green-400 mt-2">Margen de ahorro: {savingsRate.toFixed(1)}%</p>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <p className="text-gray-400">Conversión semanal → mensual:</p>
                  <p className="font-mono">
                    • Ocio: {userData.entertainmentFrequency} salidas/semana × ${userData.entertainmentAmount} × 4.33 = ${monthlyEntertainment.toFixed(0)}/mes
                  </p>
                  <p className="font-mono">
                    • Delivery: {userData.deliveryFrequency} pedidos/semana × ${userData.deliveryAmount} × 4.33 = ${monthlyDelivery.toFixed(0)}/mes
                  </p>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <p className="text-gray-400">Impacto de cuotas:</p>
                  {userData.installments.length > 0 ? (
                    <div className="space-y-1">
                      {userData.installments.map((inst, idx) => (
                        <p key={idx} className="font-mono text-sm">
                          • {inst.name}: ${inst.monthlyAmount.toLocaleString('es-AR').replace(/,/g, '.')}/mes ({inst.remainingInstallments} cuotas restantes)
                        </p>
                      ))}
                      <p className="font-mono text-green-400 mt-2">
                        Total: ${monthlyInstallments.toLocaleString('es-AR').replace(/,/g, '.')}/mes ({((monthlyInstallments / totalIncome) * 100).toFixed(1)}% del ingreso)
                      </p>
                    </div>
                  ) : (
                    <p className="font-mono">Sin cuotas registradas</p>
                  )}
                </div>
              </div>
            </section>

            {/* 3. Pattern Detection */}
            <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <h3 className="text-xl text-yellow-400">3. Detección de patrones</h3>
              </div>
              
              <div className="space-y-2">
                {patterns.map((pattern, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded flex items-start gap-3 ${
                      pattern.type === 'warning' ? 'bg-yellow-900/20 border border-yellow-700' :
                      pattern.type === 'success' ? 'bg-green-900/20 border border-green-700' :
                      'bg-blue-900/20 border border-blue-700'
                    }`}
                  >
                    <span className={`text-2xl ${
                      pattern.type === 'warning' ? 'text-yellow-400' :
                      pattern.type === 'success' ? 'text-green-400' :
                      'text-blue-400'
                    }`}>
                      {pattern.type === 'warning' ? '⚠️' : pattern.type === 'success' ? '✅' : 'ℹ️'}
                    </span>
                    <p className="text-sm">{pattern.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Insight Generation */}
            <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl text-purple-400">4. Generación de insights</h3>
              </div>
              
              <div className="space-y-4">
                {insightExplanations.map((item, idx) => (
                  <div key={idx} className="bg-gray-900 p-4 rounded">
                    <p className="text-purple-300 mb-2">💡 Insight #{idx + 1}:</p>
                    <p className="text-white mb-2">"{item.insight}"</p>
                    <p className="text-gray-400 text-sm border-l-2 border-purple-600 pl-3">
                      <strong>Lógica aplicada:</strong> {item.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. Goal Calculation */}
            <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-pink-400" />
                <h3 className="text-xl text-pink-400">5. Cálculo de objetivos</h3>
              </div>
              
              <div className="space-y-4">
                {analysis.goalsAnalysis.length > 0 ? (
                  analysis.goalsAnalysis.map((goal, idx) => (
                    <div key={idx} className="bg-gray-900 p-4 rounded">
                      <p className="text-white mb-2">{goal.title}</p>
                      <div className="text-sm space-y-1 text-gray-300">
                        <p>• Monto objetivo: ${goal.amount.toLocaleString('es-AR').replace(/,/g, '.')}</p>
                        <p>• Plazo: {goal.timeframe} meses</p>
                        <p>• Ahorro mensual requerido: ${goal.monthlyRequired.toLocaleString('es-AR').replace(/,/g, '.')}/mes</p>
                        <p>• Disponible actual: ${available.toLocaleString('es-AR').replace(/,/g, '.')}/mes</p>
                        <p className="pt-2 border-t border-gray-700 mt-2">
                          <strong>Criterio de clasificación:</strong>
                        </p>
                        <p className={`pl-3 ${
                          goal.status === 'possible' ? 'text-green-400' :
                          goal.status === 'tight' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {goal.status === 'possible' && `✓ Posible: Requiere ${((goal.monthlyRequired / available) * 100).toFixed(0)}% del disponible`}
                          {goal.status === 'tight' && `⚠ Ajustado: Requiere ${((goal.monthlyRequired / available) * 100).toFixed(0)}% del disponible`}
                          {goal.status === 'not_possible' && `✗ Requiere ajustes: Excede disponible en $${(goal.monthlyRequired - available).toLocaleString('es-AR').replace(/,/g, '.')}`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No se definieron objetivos específicos</p>
                )}
              </div>
            </section>
            {/* 6. Historial de razonamientos por usuario */}
            <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-orange-400" />
                <h3 className="text-xl text-orange-400">6. Historial de cálculos</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Registros guardados localmente para <span className="text-white">{userData.email || 'anonymous'}</span> ({history.length})
              </p>
              {history.length === 0 ? (
                <p className="text-gray-400 text-sm">Sin entradas previas.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, idx) => (
                    <div key={idx} className="bg-gray-900 p-4 rounded border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">
                          {new Date(entry.timestamp).toLocaleString('es-AR')}
                        </span>
                        <span className="text-xs text-cyan-400">
                          {entry.profile.gender} · {entry.profile.age} años
                        </span>
                      </div>
                      <div className="text-sm space-y-1">
                        <p>
                          Ingreso: ${entry.snapshot.totalIncome.toLocaleString('es-AR').replace(/,/g, '.')} ·
                          Gastos: ${entry.snapshot.totalExpenses.toLocaleString('es-AR').replace(/,/g, '.')} ·
                          Disponible: ${entry.snapshot.available.toLocaleString('es-AR').replace(/,/g, '.')}
                        </p>
                        <p className="text-xs text-gray-400">Nivel: {entry.snapshot.financialLevel}</p>
                        {entry.snapshot.insights.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Insights: {entry.snapshot.insights.slice(0, 2).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => navigate('/result')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 rounded-full text-lg"
          >
            Ver resultado final →
          </Button>
        </div>
      </div>
    </div>
  );
}