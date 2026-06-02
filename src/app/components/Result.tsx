import { motion } from 'motion/react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';
import { BottomNav } from './BottomNav';

interface ResultProps {
  analysis: FinancialAnalysis;
}

// PR7 — Pantalla Home / Informe. Reemplaza el long-scroll viejo por un
// layout estilo dashboard que matchea el HTML de referencia (header rosa
// sticky + 5 secciones: Resumen, Potencial de ahorro, Categorías de gasto,
// Desglose detallado y Tu nivel financiero). El resto del contenido viejo
// (insights, recomendaciones, action plan, inversiones) viaja a las pestañas
// /objetivos y /inversiones (BottomNav). Las cards usan el mismo tono rosa
// pálido + borde sutil del HTML, recharts para los charts.

// Map del string libre de analysis.financialLevel a un número 1-5 + descripción
// corta para el badge "nivel N/5".
function levelToBadge(level: string): { num: number; copy: string } {
  if (level.includes('Inversor')) return { num: 4, copy: 'Tenés capacidad real de ahorrar e invertir' };
  if (level.includes('Con ahorro')) return { num: 3, copy: 'Ahorrás pero todavía no invertís lo disponible' };
  if (level.includes('sin control')) return { num: 2, copy: 'Tenés cuenta, pero no controlás los gastos' };
  return { num: 1, copy: 'Empezando a bancarizarte' };
}

// Construye la lista ordenada de categorías de gasto desde userData + analysis.
// Devuelve solo las categorías con monto > 0, ordenadas descendente.
function buildCategories(analysis: FinancialAnalysis) {
  const u = analysis.userData;
  const monthlyEntertainment = u.entertainmentFrequency * u.entertainmentAmount * 4.33;
  const monthlyDelivery = u.deliveryFrequency * u.deliveryAmount * 4.33;
  const monthlySupermarket = (u.supermarketFrequency || 0) * (u.supermarketAmount || 0) * 4.33;
  const monthlyCafeterias = (u.cafeteriasFrequency || 0) * (u.cafeteriasAmount || 0) * 4.33;
  const subs = u.subscriptions.reduce((s, i) => s + i.cost, 0);
  const inst = u.installments.reduce((s, i) => s + i.monthlyAmount, 0);

  return [
    { key: 'housing',       label: 'Vivienda',       emoji: '🏠', amount: u.expenses.housing },
    { key: 'transport',     label: 'Transporte',     emoji: '🚗', amount: u.expenses.transport },
    { key: 'food',          label: 'Comida',         emoji: '🍕', amount: monthlyDelivery + monthlyCafeterias + monthlySupermarket },
    { key: 'entertainment', label: 'Ocio',           emoji: '🎉', amount: Math.round(monthlyEntertainment) },
    { key: 'beauty',        label: 'Belleza',        emoji: '💅', amount: u.expenses.beauty },
    { key: 'health',        label: 'Salud',          emoji: '❤️', amount: u.expenses.health },
    { key: 'therapy',       label: 'Terapia',        emoji: '🧘', amount: u.expenses.therapy },
    { key: 'gym',           label: 'Gimnasio',       emoji: '🏋️', amount: u.expenses.gym },
    { key: 'subscriptions', label: 'Suscripciones',  emoji: '📱', amount: subs },
    { key: 'installments',  label: 'Cuotas',         emoji: '💳', amount: inst },
  ].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
}

// Formato corto $XXk / $X.XM para los KPI tiles del Resumen — el HTML usa
// abreviaciones para que entren cómodos en mobile.
function formatKpi(ars: number): string {
  if (ars >= 1_000_000) return `$${(ars / 1_000_000).toFixed(ars >= 10_000_000 ? 0 : 1)}M`;
  if (ars >= 1_000) return `$${Math.round(ars / 1_000)}k`;
  return `$${ars}`;
}

const BAR_COLORS = ['#D4537E', '#E07499', '#E899B8', '#F0BBCF', '#F8DDE7'];

export function Result({ analysis }: ResultProps) {
  const categories = buildCategories(analysis);
  const totalCategories = categories.reduce((s, c) => s + c.amount, 0);
  const reducible = Math.round(analysis.reduciblePercentage);
  const fijo = 100 - reducible;
  const level = levelToBadge(analysis.financialLevel);

  // Top 5 para el bar chart horizontal — el HTML muestra 5 barras.
  const topCategories = categories.slice(0, 5);
  const desgloseCategories = categories.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#FBEAF0] pb-24 flex flex-col">
      {/* Header rosa sticky */}
      <div className="bg-[#D4537E] text-white px-5 pt-6 pb-5 sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg" style={{ fontFamily: 'var(--font-sans)' }}>Tu informe financiero</h1>
          <p className="text-xs text-white/80 mt-0.5">
            Generado hoy · {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 p-4 max-w-md mx-auto w-full space-y-5"
      >
        {/* RESUMEN */}
        <section>
          <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">Resumen</p>
          <div className="grid grid-cols-3 gap-2">
            <KpiTile label="Ingresos" value={formatKpi(analysis.totalIncome)} color="#3B6D11" />
            <KpiTile label="Gastos" value={formatKpi(analysis.totalExpenses)} color="#D85A30" />
            <KpiTile label="Disponible" value={formatKpi(Math.max(analysis.available, 0))} color="#D4537E" />
          </div>
        </section>

        {/* POTENCIAL DE AHORRO */}
        <section>
          <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">Potencial de ahorro</p>
          <div className="bg-white rounded-xl p-4 border border-[#F4C0D1]/50">
            <p className="text-sm mb-3">¿En qué podés recortar?</p>
            <div className="h-40 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Reducible', value: reducible },
                      { name: 'Fijo', value: fijo },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={65}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="#D85A30" />
                    <Cell fill="#3B6D11" />
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-[11px] text-gray-600 mb-3">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#D85A30' }} /> Reducible {reducible}%</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#3B6D11' }} /> Fijo {fijo}%</span>
            </div>
            <div className="bg-[#FBEAF0] rounded-lg px-3 py-2.5 text-xs text-[#993556] border-l-[3px] border-[#D4537E]">
              Aproximadamente el <strong className="text-[#D4537E]">{reducible}%</strong> de tus gastos son reducibles con pequeños cambios de hábitos.
            </div>
          </div>
        </section>

        {/* CATEGORÍAS DE GASTO (bar chart horizontal) */}
        {topCategories.length > 0 && (
          <section>
            <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">Categorías de gasto</p>
            <div className="bg-white rounded-xl p-4 border border-[#F4C0D1]/50">
              <p className="text-sm mb-3">¿A dónde va tu plata?</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCategories.map((c, i) => ({
                      label: c.label.slice(0, 8),
                      value: totalCategories > 0 ? Math.round((c.amount / totalCategories) * 100) : 0,
                      fill: BAR_COLORS[i] ?? BAR_COLORS[0],
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                  >
                    <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={72} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="value" radius={[5, 5, 5, 5]} isAnimationActive={false}>
                      {topCategories.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i] ?? BAR_COLORS[0]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* DESGLOSE DETALLADO */}
        {desgloseCategories.length > 0 && (
          <section>
            <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">Desglose detallado</p>
            <div className="bg-white rounded-xl px-4 py-2 border border-[#F4C0D1]/50">
              {desgloseCategories.map((c, i) => {
                const pct = totalCategories > 0 ? Math.round((c.amount / totalCategories) * 100) : 0;
                return (
                  <div key={c.key} className={`flex items-center gap-2 py-2 ${i > 0 ? 'border-t border-[#F4C0D1]/50' : ''}`}>
                    <span className="text-base">{c.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium mb-1 truncate">{c.label}</p>
                      <div className="h-1.5 bg-[#FBEAF0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#D4537E] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">~{formatKpi(c.amount)}</p>
                      <p className="text-[10px] text-gray-500">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TU NIVEL FINANCIERO */}
        <section>
          <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">Tu nivel financiero</p>
          <div className="bg-white rounded-xl p-4 border border-[#F4C0D1]/50 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#FBEAF0] flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-[#D4537E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{analysis.financialLevel}</p>
              <p className="text-xs text-gray-500 mt-0.5">{level.copy}</p>
            </div>
            <span className="bg-[#EAF3DE] text-[#3B6D11] text-[10px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">
              nivel {level.num}/5
            </span>
          </div>
        </section>

        {/* Deficit warning si available negativo */}
        {analysis.available < 0 && (
          <div className="bg-gradient-to-br from-[#D85A30] to-[#D4537E] rounded-xl p-4 text-white text-sm">
            ⚠️ Tus gastos superan tus ingresos por {formatArs(Math.abs(analysis.available))} este mes. Mirá la pestaña Objetivos para los próximos pasos.
          </div>
        )}
      </motion.div>

      <BottomNav />
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl px-2 py-2.5 border border-[#F4C0D1]/50 text-center">
      <p className="text-[9px] text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium" style={{ color }}>{value}</p>
    </div>
  );
}
