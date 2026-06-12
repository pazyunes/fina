import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, MessageCircle } from 'lucide-react';
import { FinancialAnalysis, UserData } from '../types';
import { useAuth } from '../lib/auth';
import { useMoney, DisplayCurrencyToggle } from '../lib/displayCurrency';
import { currentPeriodStart } from '../lib/transactions';
import { updateReportData } from '../lib/reports';
import { COUPONS } from '../lib/coupons';
import { MonthEndReview } from './MonthEndReview';
import { WHATSAPP_URL } from './WhatsAppFab';
import { OpenBankAccountBox } from './OpenBankAccountBox';
import { BudgetTracker } from './BudgetTracker';
import { IncomeResetControl } from './IncomeResetControl';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopRightUser } from './TopRightUser';
import { WhatsAppFab } from './WhatsAppFab';

interface ResultProps {
  analysis: FinancialAnalysis;
  // PR — para persistir el cierre de mes (aportes + respuestas) desde el informe.
  onAnalysisChange?: (analysis: FinancialAnalysis, userData: UserData) => void;
}

// Días que faltan para el próximo "día de cobro" (reinicio del período).
function daysUntilReset(resetDay: number): number {
  const now = new Date();
  const d = Math.min(Math.max(resetDay || 1, 1), 28);
  let next = new Date(now.getFullYear(), now.getMonth(), d);
  if (now.getDate() >= d) next = new Date(now.getFullYear(), now.getMonth() + 1, d);
  return Math.ceil((next.getTime() - now.getTime()) / 86_400_000);
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
  const monthlyRestaurants = (u.restaurantsFrequency || 0) * (u.restaurantsAmount || 0) * 4.33;
  const subs = u.subscriptions.reduce((s, i) => s + i.cost, 0);
  const inst = u.installments.reduce((s, i) => s + i.monthlyAmount, 0);

  return [
    { key: 'housing',       label: 'Vivienda',       emoji: '🏠', amount: u.expenses.housing },
    { key: 'transport',     label: 'Transporte',     emoji: '🚗', amount: u.expenses.transport },
    { key: 'food',          label: 'Comida',         emoji: '🍕', amount: monthlyDelivery + monthlyCafeterias + monthlyRestaurants + monthlySupermarket },
    { key: 'entertainment', label: 'Ocio',           emoji: '🎉', amount: Math.round(monthlyEntertainment) },
    { key: 'beauty',        label: 'Belleza',        emoji: '💅', amount: u.expenses.beauty },
    { key: 'health',        label: 'Salud',          emoji: '❤️', amount: u.expenses.health },
    { key: 'therapy',       label: 'Terapia',        emoji: '🧘', amount: u.expenses.therapy },
    { key: 'gym',           label: 'Gimnasio',       emoji: '🏋️', amount: u.expenses.gym },
    { key: 'subscriptions', label: 'Suscripciones',  emoji: '📱', amount: subs },
    { key: 'installments',  label: 'Cuotas',         emoji: '💳', amount: inst },
  ].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
}


// Emoji contextual según el título del objetivo (para el recordatorio de ahorro).
function goalEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/viaj|vacacion|playa|sur|r[íi]o|europa|exterior/.test(t)) return '✈️';
  if (/auto|moto|coche/.test(t)) return '🚗';
  if (/casa|depto|alquiler|hogar|mudanza/.test(t)) return '🏠';
  if (/notebook|computadora|laptop|celular|telef/.test(t)) return '💻';
  if (/curso|estudio|carrera|universidad/.test(t)) return '📚';
  if (/casamiento|boda|fiesta/.test(t)) return '💍';
  if (/emergenc/.test(t)) return '🚨';
  return '🎯';
}

// Eyebrow de sección reutilizable — un poco más grande y bold que antes para
// dar jerarquía, tanto en mobile como en desktop.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">{children}</p>
  );
}

export function Result({ analysis, onAnalysisChange }: ResultProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fmt, fmtKpi, setRate } = useMoney();
  // Cotización para el toggle ARS/USD (snapshot del informe).
  const rate = analysis.userData.exchangeRate?.rate ?? null;
  useEffect(() => { setRate(rate); }, [rate, setRate]);
  const resetDay = Number(user?.user_metadata?.incomeResetDay) || 1;
  const categories = buildCategories(analysis);
  const totalCategories = categories.reduce((s, c) => s + c.amount, 0);
  const reducible = Math.round(analysis.reduciblePercentage);
  const fijo = 100 - reducible;
  const level = levelToBadge(analysis.financialLevel);

  // Ahorro registrado para objetivos en el período en curso → se resta del
  // disponible (esa plata ya la apartaste).
  const periodStart = currentPeriodStart(resetDay);
  const savingsThisPeriod = (analysis.userData.specificGoals ?? [])
    .flatMap((g) => g.contributions ?? [])
    .filter((c) => new Date(c.date) >= periodStart)
    .reduce((s, c) => s + (c.amount || 0), 0);
  const availableNow = Math.max(analysis.available - savingsThisPeriod, 0);
  const hasSurplus = availableNow > 0;

  // Top 5 para el bar chart horizontal — el HTML muestra 5 barras.
  const topCategories = categories.slice(0, 5);

  // PR8 — Potencial de inversión: % de los ingresos que podrían destinarse a
  // inversión recomendada. Asumimos 70% del disponible (resto liquidez/
  // imprevistos). Si availableNow <= 0 → 0%.
  const investRecommended = availableNow > 0 && analysis.totalIncome > 0
    ? Math.max(0, Math.min(100, Math.round((availableNow * 0.7 / analysis.totalIncome) * 100)))
    : 0;
  const investRest = 100 - investRecommended;
  const investAmount = availableNow > 0 ? Math.round(availableNow * 0.7) : 0;

  // No bancarizada: eligió "No uso banco" en el onboarding.
  const notBanked = analysis.userData.banks?.includes('No uso banco') ?? false;
  // Recordatorio de objetivo: tomamos el objetivo más urgente (menor plazo).
  const topGoal = (analysis.goalsAnalysis ?? [])
    .filter((g) => g.monthlyRequired > 0)
    .sort((a, b) => a.timeframe - b.timeframe)[0] ?? null;

  // Cierre de mes: aparece los últimos 3 días del período si todavía no lo hizo.
  const periodKey = periodStart.toISOString().slice(0, 10);
  const reviewDone = analysis.userData.periodReviews?.[periodKey]?.done ?? false;
  const showReview = !!onAnalysisChange && !reviewDone && daysUntilReset(resetDay) <= 3;
  // Disponible que "debería" ahorrar = ingresos − gastos − lo destinado a invertir (70%).
  const savingTarget = Math.max(Math.round(analysis.available * 0.3), 0);
  const submitReview = async (newUserData: UserData) => {
    const { analysis: next } = await updateReportData(newUserData);
    if (next) onAnalysisChange?.(next, newUserData);
  };

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-8 lg:pl-56 flex flex-col">
      <Sidebar />
      <TopRightUser />
      <WhatsAppFab />
      {/* Header rosa sticky — solo mobile (en desktop manda el sidebar) */}
      <div className="lg:hidden bg-[#7626B3] text-white px-5 pt-6 pb-5 sticky top-0 z-10">
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
       <div className="flex justify-start mb-3">
         <DisplayCurrencyToggle />
       </div>

       {showReview && (
         <MonthEndReview
           analysis={analysis}
           resetDay={resetDay}
           periodKey={periodKey}
           periodStart={periodStart}
           savingTarget={savingTarget}
           onSubmit={submitReview}
         />
       )}

       <div className="lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
        {/* COLUMNA PRINCIPAL (2/3) */}
        <div className="space-y-5 lg:col-span-2">
        {/* RESUMEN — Disponible como hero a todo el ancho + Ingresos/Gastos */}
        <section>
          <SectionLabel>Resumen</SectionLabel>
          <div className="grid grid-cols-2 gap-2 lg:gap-4">
            {/* Hero Disponible: gradiente rosa + número gigante para impacto */}
            <div
              onClick={() => navigate('/objetivos#en-curso')}
              role="button"
              title="Ver tus objetivos en curso"
              className="col-span-2 rounded-2xl px-6 py-8 lg:py-12 text-center bg-[#7626B3] shadow-lg shadow-[#7626B3]/25 cursor-pointer hover:bg-[#5F1F94] transition-colors"
            >
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
                {fmtKpi(availableNow)}
              </p>
              <p className="text-xs lg:text-base text-white/90 mt-3 font-medium">
                {hasSurplus
                  ? 'por mes para ahorrar o invertir 🚀'
                  : 'Este mes tus gastos se comieron todo 😬'}
              </p>
            </div>
            <KpiTile label="Ingresos" value={fmtKpi(analysis.totalIncome)} color="#3B6D11" />
            <KpiTile label="Gastos" value={fmtKpi(analysis.totalExpenses)} color="#D85A30" />
          </div>

          {/* PRESUPUESTO POR CATEGORÍA — tope del onboarding, se llena con los
              egresos del chatbot (tabla transactions) */}
          <BudgetTracker analysis={analysis} resetDay={resetDay} />

          {/* Botón → registrar gastos por el chatbot */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span><span className="underline font-bold">Hacé click acá</span> para registrar tus gastos…</span>
          </a>

          {/* ¿Cuándo se renueva tu ingreso? (reinicia el presupuesto) */}
          <IncomeResetControl />
        </section>

          {/* POTENCIAL DE AHORRO — stat grande + barra segmentada */}
          <section>
            <SectionLabel>Potencial de ahorro</SectionLabel>
            <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#D7C2EF]/70 shadow-sm">
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
                      <Cell fill="#7626B3" />
                      <Cell fill="#D7C2EF" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-3xl font-bold text-[#7626B3] leading-none">{reducible}%</p>
                  <p className="text-xs text-gray-500 mt-1">reducible</p>
                </div>
              </div>
              <div className="flex justify-center gap-4 text-xs text-gray-600 mb-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7626B3' }} /> Reducible {reducible}%</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#D7C2EF' }} /> Fijo {fijo}%</span>
              </div>
              <div className="bg-[#F0E7FA] rounded-lg px-3 py-2.5 text-sm text-[#431C72] border-l-[3px] border-[#7626B3]">
                Aproximadamente el <strong className="text-[#7626B3]">{reducible}%</strong> de tus gastos son reducibles con pequeños cambios de hábitos.
              </div>
            </div>
          </section>

          {/* POTENCIAL DE INVERSIÓN — dona */}
          <section>
            <SectionLabel>Potencial de inversión</SectionLabel>
            <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#D7C2EF]/70 shadow-sm">
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
                          <Cell fill="#7626B3" />
                          <Cell fill="#D7C2EF" />
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-3xl font-bold text-[#7626B3] leading-none">{investRecommended}%</p>
                      <p className="text-xs text-gray-500 mt-1">invertible</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4 text-xs text-gray-600 mb-3">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7626B3' }} /> Invertible {investRecommended}%</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#D7C2EF' }} /> Resto {investRest}%</span>
                  </div>
                  <div className="bg-[#F0E7FA] rounded-lg px-3 py-2.5 text-sm text-[#431C72] border-l-[3px] border-[#7626B3]">
                    Podrías destinar hasta <strong className="text-[#7626B3]">{fmtKpi(investAmount)}/mes</strong> a inversión y mantener el resto líquido para gastos e imprevistos. Mirá la pestaña Inversiones para opciones concretas.
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
              <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#D7C2EF]/70 shadow-sm">
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
                      <Bar dataKey="value" radius={[7, 7, 7, 7]} barSize={14} isAnimationActive={false} fill="#7626B3" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* COLUMNA DERECHA / right rail (1/3) */}
        <div className="space-y-5">
          {/* RECORDATORIO DE OBJETIVO — solo si hay un objetivo cargado */}
          {topGoal && (
            <section>
              <SectionLabel>Tu objetivo</SectionLabel>
              <div
                onClick={() => navigate('/objetivos#estrategias')}
                role="button"
                title="Ver cómo llegar al objetivo"
                className="bg-[#7626B3] rounded-xl p-4 text-white cursor-pointer hover:bg-[#5F1F94] transition-colors"
              >
                <p className="text-2xl mb-1">{goalEmoji(topGoal.title)}</p>
                <p className="text-sm leading-snug">
                  Recordá que tenés que ahorrar{' '}
                  <strong className="font-bold">{fmtKpi(topGoal.monthlyRequired)} por mes</strong>{' '}
                  para llegar a {topGoal.title}.
                </p>
              </div>
            </section>
          )}

          {/* DESCUENTOS DISPONIBLES PARA VOS — cupones. Tocar → /perfil "Mis cupones". */}
          <section>
            <SectionLabel>Descuentos disponibles para vos</SectionLabel>
            <div className="space-y-2">
              {COUPONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate('/perfil', { state: { openCoupons: true } })}
                  className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-[#D7C2EF]/70 shadow-sm hover:border-[#7626B3] transition-colors text-left"
                >
                  {c.logo ? (
                    <img src={c.logo} alt={c.brand} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ background: c.color }}>
                      {c.brand[0]}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{c.brand}</p>
                    <p className="text-xs text-gray-500">Código {c.code}</p>
                  </div>
                  <span className="text-sm font-bold px-2.5 py-1 rounded-full text-white" style={{ background: c.color }}>
                    {c.discount} OFF
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* TU NIVEL FINANCIERO */}
          <section>
            <SectionLabel>Tu nivel financiero</SectionLabel>
            <div className="bg-white rounded-xl p-4 lg:p-5 border border-[#D7C2EF]/70 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#F0E7FA] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-[#7626B3]" />
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

          {/* Abrir cuenta de banco — solo si eligió "No uso banco" */}
          {notBanked && <OpenBankAccountBox />}
        </div>
       </div>

        {/* Deficit warning si available negativo */}
        {analysis.available < 0 && (
          <div className="bg-[#D85A30] rounded-xl p-4 text-white text-sm mt-5">
            ⚠️ Tus gastos superan tus ingresos por <strong>{fmt(Math.abs(analysis.available))}</strong> este mes. Mirá la pestaña Objetivos para los próximos pasos.
          </div>
        )}
      </motion.div>

      <BottomNav />
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl px-2 py-3 lg:py-4 border border-[#D7C2EF]/70 shadow-sm text-center">
      <p className="text-xs lg:text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-lg lg:text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
