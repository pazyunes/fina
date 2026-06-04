import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopRightUser } from './TopRightUser';

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
    <div className="min-h-screen bg-[#F1E8F8] pb-24 lg:pb-8 lg:pl-56 flex flex-col">
      <Sidebar />
      <TopRightUser />
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
            <div className="col-span-2 rounded-2xl px-6 py-8 lg:py-12 text-center bg-gradient-to-br from-[#7E2EA8] to-[#A95FC8] shadow-lg shadow-[#7E2EA8]/25">
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
            <div className="bg-white rounded-xl p-5 border border-[#DCC6EC]/50">
              <p className="text-base font-semibold mb-1">¿En qué podés recortar?</p>
              <p className="text-sm text-gray-500 mb-4">De todo lo que gastás, esta parte la podés bajar con pequeños cambios.</p>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-extrabold text-[#FF5C8A] leading-none">{reducible}%</span>
                <span className="text-sm text-gray-500 mb-1">es recortable</span>
              </div>
              <div className="flex h-3.5 rounded-full overflow-hidden mt-4 bg-[#F1E8F8]">
                <div className="bg-[#FF5C8A]" style={{ width: `${reducible}%` }} />
                <div className="bg-[#DCC6EC]" style={{ width: `${fijo}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="font-semibold text-[#FF5C8A]">Recortable {reducible}%</span>
                <span className="text-gray-500">Fijo {fijo}%</span>
              </div>
              <div className="bg-[#F1E8F8] rounded-lg px-3 py-2.5 text-sm text-[#4A1C66] border-l-[3px] border-[#7E2EA8] mt-4">
                Con pequeños cambios de hábitos podrías liberar ese <strong className="text-[#7E2EA8]">{reducible}%</strong> de tus gastos.
              </div>
            </div>
          </section>

          {/* POTENCIAL DE INVERSIÓN — monto grande + barra */}
          <section>
            <SectionLabel>Potencial de inversión</SectionLabel>
            <div className="bg-white rounded-xl p-5 border border-[#DCC6EC]/50">
              <p className="text-base font-semibold mb-1">¿Cuánto podrías invertir?</p>
              {investRecommended > 0 ? (
                <>
                  <p className="text-sm text-gray-500 mb-4">Una parte de lo que te queda libre puede ir a inversión.</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl lg:text-5xl font-extrabold text-[#7E2EA8] leading-none">{formatKpi(investAmount)}</span>
                    <span className="text-sm text-gray-500 mb-1">/mes</span>
                  </div>
                  <div className="flex h-3.5 rounded-full overflow-hidden mt-4 bg-[#F1E8F8]">
                    <div className="bg-[#7E2EA8]" style={{ width: `${investRecommended}%` }} />
                    <div className="bg-[#DCC6EC]" style={{ width: `${investRest}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span className="font-semibold text-[#7E2EA8]">Invertible {investRecommended}%</span>
                    <span className="text-gray-500">Resto {investRest}%</span>
                  </div>
                  <div className="bg-[#F1E8F8] rounded-lg px-3 py-2.5 text-sm text-[#4A1C66] border-l-[3px] border-[#7E2EA8] mt-4">
                    Mantené el resto líquido para gastos e imprevistos. Mirá la pestaña <strong className="text-[#7E2EA8]">Inversiones</strong> para opciones concretas.
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 py-4">
                  Por ahora tus gastos absorben todo lo que entra. Cuando liberés disponible vas a poder destinar parte a inversión.
                </p>
              )}
            </div>
          </section>

          {/* CATEGORÍAS DE GASTO — ranking con emoji + monto + barra */}
          {topCategories.length > 0 && (
            <section>
              <SectionLabel>Categorías de gasto</SectionLabel>
              <div className="bg-white rounded-xl p-5 border border-[#DCC6EC]/50">
                <p className="text-base font-semibold mb-4">¿A dónde va tu plata?</p>
                <div className="space-y-3.5">
                  {topCategories.map((c) => {
                    const rel = topCategories[0].amount > 0 ? Math.round((c.amount / topCategories[0].amount) * 100) : 0;
                    const share = totalCategories > 0 ? Math.round((c.amount / totalCategories) * 100) : 0;
                    return (
                      <div key={c.key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-700 flex items-center gap-2">
                            <span className="text-base">{c.emoji}</span>{c.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {formatKpi(c.amount)} <span className="text-xs font-normal text-gray-400">· {share}%</span>
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[#F1E8F8] overflow-hidden">
                          <div className="h-full rounded-full bg-[#7E2EA8]" style={{ width: `${rel}%` }} />
                        </div>
                      </div>
                    );
                  })}
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
            <div className="bg-white rounded-xl px-4 py-5 lg:p-5 border border-[#DCC6EC]/50 text-center">
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
            <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#DCC6EC]/50 flex items-center gap-3">
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
          <div className="bg-gradient-to-br from-[#D85A30] to-[#7E2EA8] rounded-xl p-4 text-white text-sm mt-5">
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
    <div className="bg-white rounded-xl px-2 py-3 lg:py-4 border border-[#DCC6EC]/50 text-center">
      <p className="text-[10px] lg:text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-lg lg:text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
