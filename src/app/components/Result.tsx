import { motion } from 'motion/react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopRightUser } from './TopRightUser';
import { WhatsAppFab } from './WhatsAppFab';

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
//
// PR — Adaptación desktop: el contenedor se ensancha (max-w-5xl) y las
// secciones pasan de single-column a una grilla de 2 columnas en lg+. El
// "Disponible" es un hero a todo lo ancho con número gigante para generar
// impacto. Tipografía más grande/bold también en mobile.

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

// Eyebrow de sección reutilizable — un poco más grande y bold que antes para
// dar jerarquía, tanto en mobile como en desktop.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-[#7E2EA8] uppercase tracking-wider mb-2">{children}</p>
  );
}

export function Result({ analysis }: ResultProps) {
  const categories = buildCategories(analysis);
  const totalCategories = categories.reduce((s, c) => s + c.amount, 0);
  const reducible = Math.round(analysis.reduciblePercentage);
  const fijo = 100 - reducible;
  const level = levelToBadge(analysis.financialLevel);
  const hasSurplus = analysis.available > 0;

  // Top 5 para el bar chart horizontal — el HTML muestra 5 barras.
  const topCategories = categories.slice(0, 5);

  // PR8 — Potencial de inversión: % de los ingresos que podrían destinarse a
  // inversión recomendada. Asumimos 70% del disponible (resto liquidez/
  // imprevistos). Si available <= 0 → 0%.
  const investRecommended = analysis.available > 0 && analysis.totalIncome > 0
    ? Math.max(0, Math.min(100, Math.round((analysis.available * 0.7 / analysis.totalIncome) * 100)))
    : 0;
  const investRest = 100 - investRecommended;
  const investAmount = analysis.available > 0 ? Math.round(analysis.available * 0.7) : 0;

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-8 lg:pl-56 flex flex-col">
      <Sidebar />
      <TopRightUser />
      <WhatsAppFab />
      {/* Header rosa sticky — solo mobile (en desktop manda el sidebar) */}
      <div className="lg:hidden bg-[#7E2EA8] text-white px-5 pt-6 pb-5 sticky top-0 z-10">
        <div className="max-w-md lg:max-w-5xl mx-auto">
          <h1 className="text-lg lg:text-2xl font-semibold" style={{ fontFamily: 'var(--font-sans)' }}>Tu informe financiero</h1>
          <p className="text-xs lg:text-sm text-white/80 mt-0.5">
            Generado hoy · {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 p-4 lg:px-8 lg:pt-20 lg:pb-8 max-w-md lg:max-w-6xl mx-auto w-full"
      >
       <div className="lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
        {/* COLUMNA PRINCIPAL (2/3) */}
        <div className="space-y-5 lg:col-span-2">
        {/* RESUMEN — Disponible como hero a todo el ancho + Ingresos/Gastos */}
        <section>
          <SectionLabel>Resumen</SectionLabel>
          <div className="grid grid-cols-2 gap-2 lg:gap-4">
            {/* Hero Disponible: gradiente rosa + número gigante para impacto */}
            <div className="col-span-2 rounded-2xl px-6 py-8 lg:py-12 text-center bg-[#7E2EA8] shadow-lg shadow-[#7E2EA8]/25">
              <p className="text-xs lg:text-sm text-white/85 mb-2 uppercase tracking-[0.18em] font-semibold">
                Te queda disponible
              </p>
              <p
                className="font-bold leading-none text-white"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(3rem, 13vw, 6.5rem)',
                }}
              >
                {formatKpi(Math.max(analysis.available, 0))}
              </p>
              <p className="text-xs lg:text-base text-white/90 mt-3 font-medium">
                {hasSurplus
                  ? 'por mes para ahorrar o invertir 🚀'
                  : 'Este mes tus gastos se comieron todo 😬'}
              </p>
            </div>
            <KpiTile label="Ingresos" value={formatKpi(analysis.totalIncome)} color="#3B6D11" />
            <KpiTile label="Gastos" value={formatKpi(analysis.totalExpenses)} color="#D85A30" />
          </div>
        </section>

          {/* POTENCIAL DE AHORRO — stat grande + barra segmentada */}
          <section>
            <SectionLabel>Potencial de ahorro</SectionLabel>
            <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#DCC6EC]/70 shadow-sm">
              <p className="text-base font-semibold mb-3">¿En qué podés recortar?</p>
              <div className="relative h-44 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Reducible', value: reducible },
                        { name: 'Fijo', value: fijo },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={74}
                      cornerRadius={6}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#7E2EA8" />
                      <Cell fill="#DCC6EC" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-3xl font-bold text-[#7E2EA8] leading-none">{reducible}%</p>
                  <p className="text-xs text-gray-500 mt-1">reducible</p>
                </div>
              </div>
              <div className="flex justify-center gap-4 text-xs text-gray-600 mb-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7E2EA8' }} /> Reducible {reducible}%</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#DCC6EC' }} /> Fijo {fijo}%</span>
              </div>
              <div className="bg-[#F1E8F8] rounded-lg px-3 py-2.5 text-sm text-[#4A1C66] border-l-[3px] border-[#7E2EA8]">
                Aproximadamente el <strong className="text-[#7E2EA8]">{reducible}%</strong> de tus gastos son reducibles con pequeños cambios de hábitos.
              </div>
            </div>
          </section>

          {/* POTENCIAL DE INVERSIÓN — dona */}
          <section>
            <SectionLabel>Potencial de inversión</SectionLabel>
            <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#DCC6EC]/70 shadow-sm">
              <p className="text-base font-semibold mb-3">¿Cuánto podrías invertir?</p>
              {investRecommended > 0 ? (
                <>
                  <div className="relative h-44 mb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Invertible', value: investRecommended },
                            { name: 'Para gastos / buffer', value: investRest },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={74}
                          cornerRadius={6}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#7E2EA8" />
                          <Cell fill="#DCC6EC" />
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-3xl font-bold text-[#7E2EA8] leading-none">{investRecommended}%</p>
                      <p className="text-xs text-gray-500 mt-1">invertible</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4 text-xs text-gray-600 mb-3">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7E2EA8' }} /> Invertible {investRecommended}%</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#DCC6EC' }} /> Resto {investRest}%</span>
                  </div>
                  <div className="bg-[#F1E8F8] rounded-lg px-3 py-2.5 text-sm text-[#4A1C66] border-l-[3px] border-[#7E2EA8]">
                    Podrías destinar hasta <strong className="text-[#7E2EA8]">{formatKpi(investAmount)}/mes</strong> a inversión y mantener el resto líquido para gastos e imprevistos. Mirá la pestaña Inversiones para opciones concretas.
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-6">
                  Por ahora tus gastos absorben todo lo que entra. Cuando liberés disponible — bajando gastos reducibles o sumando ingresos — vas a poder destinar parte a inversión.
                </p>
              )}
            </div>
          </section>

          {/* CATEGORÍAS DE GASTO — bar chart horizontal (finito) */}
          {topCategories.length > 0 && (
            <section>
              <SectionLabel>Categorías de gasto</SectionLabel>
              <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#DCC6EC]/70 shadow-sm">
                <p className="text-base font-semibold mb-3">¿A dónde va tu plata?</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topCategories.map((c) => ({
                        label: c.label.slice(0, 8),
                        value: totalCategories > 0 ? Math.round((c.amount / totalCategories) * 100) : 0,
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                    >
                      <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={72} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="value" radius={[7, 7, 7, 7]} barSize={14} isAnimationActive={false} fill="#7E2EA8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* COLUMNA DERECHA / right rail (1/3) */}
        <div className="space-y-5">
          {/* DESCUENTOS DISPONIBLES PARA VOS (PR8 — placeholder de cupones) */}
          <section>
            <SectionLabel>Descuentos disponibles para vos</SectionLabel>
            <div className="bg-white rounded-xl px-4 py-5 lg:p-5 border border-[#DCC6EC]/70 shadow-sm text-center">
              <p className="text-2xl mb-2">🎟️</p>
              <p className="text-base font-semibold text-gray-800 mb-1">Próximamente</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Acá van a aparecer cupones de descuento elegidos según tus gustos y categorías de gasto.
                Estamos trabajando para conseguirlos.
              </p>
            </div>
          </section>

          {/* TU NIVEL FINANCIERO */}
          <section>
            <SectionLabel>Tu nivel financiero</SectionLabel>
            <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#DCC6EC]/70 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#F1E8F8] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-[#7E2EA8]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold">{analysis.financialLevel}</p>
                <p className="text-sm text-gray-500 mt-0.5">{level.copy}</p>
              </div>
              <span className="bg-[#EAF3DE] text-[#3B6D11] text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                nivel {level.num}/5
              </span>
            </div>
          </section>
        </div>
       </div>

        {/* Deficit warning si available negativo */}
        {analysis.available < 0 && (
          <div className="bg-[#D85A30] rounded-xl p-4 text-white text-sm mt-5">
            ⚠️ Tus gastos superan tus ingresos por <strong>{formatArs(Math.abs(analysis.available))}</strong> este mes. Mirá la pestaña Objetivos para los próximos pasos.
          </div>
        )}
      </motion.div>

      <BottomNav />
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl px-2 py-3 lg:py-4 border border-[#DCC6EC]/70 shadow-sm text-center">
      <p className="text-xs lg:text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-lg lg:text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
