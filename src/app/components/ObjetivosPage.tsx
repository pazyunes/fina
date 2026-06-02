import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Check, TrendingUp, Sparkles, Clock } from 'lucide-react';
import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';
import { buildGoalStrategies, GoalStrategy } from '../utils/goalStrategies';
import { BottomNav } from './BottomNav';
import { PreferencesModal } from './PreferencesModal';

interface ObjetivosPageProps {
  analysis: FinancialAnalysis;
}

// PR7 — Pestaña Objetivos. Layout inspirado en el HTML de referencia:
// header rosa + "En curso" (goal cards con donut + status + tip) +
// "Cómo llegar al objetivo" (accionables del analyzer) +
// "Si cumplís todos los accionables" (estimación corta) +
// link cruzado a /inversiones + botón de preferencias.

const STATUS_LABEL: Record<string, string> = {
  possible: 'alcanzable',
  tight: 'ajustada',
  not_possible: 'no posible',
};
const STATUS_BADGE: Record<string, string> = {
  possible: 'bg-[#EAF3DE] text-[#3B6D11]',
  tight: 'bg-[#FAEEDA] text-[#854F0B]',
  not_possible: 'bg-[#FBEAF0] text-[#993556]',
};

// Emoji por palabra clave del título del objetivo. Si no matchea ninguna,
// fallback a 🎯.
function goalEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/viaj|vacacion|playa|sur|europa|exterior/.test(t)) return '✈️';
  if (/auto|moto|coche/.test(t)) return '🚗';
  if (/casa|depto|alquiler|hogar|mudanza/.test(t)) return '🏠';
  if (/notebook|computadora|laptop|celular|telef/.test(t)) return '💻';
  if (/curso|estudio|carrera|universidad/.test(t)) return '📚';
  if (/casamiento|boda|fiesta/.test(t)) return '💍';
  if (/emergenc/.test(t)) return '🚨';
  return '🎯';
}

export function ObjetivosPage({ analysis }: ObjetivosPageProps) {
  const navigate = useNavigate();
  const [showPrefs, setShowPrefs] = useState(false);
  const goals = analysis.goalsAnalysis ?? [];
  const strategies = buildGoalStrategies(analysis);

  return (
    <div className="min-h-screen bg-[#FBEAF0] pb-24 flex flex-col">
      {/* Header */}
      <div className="bg-[#D4537E] text-white px-5 pt-6 pb-5 sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg" style={{ fontFamily: 'var(--font-sans)' }}>Mis objetivos</h1>
          <p className="text-xs text-white/80 mt-0.5">Seguí tu avance y tus próximos pasos</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 p-4 max-w-md mx-auto w-full space-y-5"
      >
        {/* EN CURSO */}
        <section>
          <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">En curso</p>
          {goals.length === 0 ? (
            <div className="bg-white rounded-xl p-4 border border-[#F4C0D1]/50 text-sm text-gray-500">
              Todavía no cargaste objetivos específicos.
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((g, i) => (
                <GoalCard key={i} goal={g} />
              ))}
            </div>
          )}
        </section>

        {/* ESTRATEGIAS PARA LLEGAR AL OBJETIVO */}
        {strategies.length > 0 && (
          <section>
            <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">
              Cómo llegar al objetivo — varias opciones
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Marcá las que vas implementando. Cada una suma a la cuota mensual de tu objetivo.
            </p>
            <div className="bg-white rounded-xl px-4 py-1 border border-[#F4C0D1]/50">
              {strategies.map((s, i) => (
                <StrategyRow key={i} strategy={s} first={i === 0} />
              ))}
            </div>
          </section>
        )}

        {/* SI CUMPLÍS TODO */}
        {strategies.length > 0 && (
          <section>
            <p className="text-[10px] font-medium text-[#D4537E] uppercase tracking-wider mb-2">
              Si cumplís todos los accionables
            </p>
            <div className="bg-white rounded-xl p-4 border border-[#F4C0D1]/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EAF3DE] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[#3B6D11]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Podrías llegar antes de lo previsto</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Aplicando los pasos de arriba el plazo de tus objetivos se acorta.
                </p>
              </div>
              <span className="bg-[#EAF3DE] text-[#3B6D11] text-[10px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">
                avance
              </span>
            </div>
          </section>
        )}

        {/* CTA → Inversiones */}
        <button
          type="button"
          onClick={() => navigate('/inversiones')}
          className="w-full bg-white border-2 border-[#D4537E] text-[#D4537E] rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#FBEAF0]/40 transition-colors"
        >
          <TrendingUp className="w-4 h-4" /> Ver inversiones recomendadas
        </button>

        {/* CTA → Preferencias */}
        <button
          type="button"
          onClick={() => setShowPrefs(true)}
          className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Quiero recomendaciones personalizadas
        </button>
      </motion.div>

      <BottomNav />

      {showPrefs && (
        <PreferencesModal onClose={() => setShowPrefs(false)} />
      )}
    </div>
  );
}

// Card por objetivo. Donut con 0% logrado (PR7 v1 no trackea avance real)
// + monto/plazo + status badge + tip con la cuota mensual sugerida.
function GoalCard({ goal }: { goal: FinancialAnalysis['goalsAnalysis'][number] }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-[#F4C0D1]/50 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-medium truncate">
            {goalEmoji(goal.title)} {goal.title}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            ~{formatArs(goal.monthlyRequired)}/mes · {goal.timeframe} meses
          </p>
        </div>
        <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[goal.status]}`}>
          {STATUS_LABEL[goal.status]}
        </span>
      </div>

      {/* Donut con texto central — 0% logrado en v1. */}
      <div className="relative h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Logrado', value: 0 },
                { name: 'Resto', value: 100 },
              ]}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={60}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill="#D4537E" />
              <Cell fill="#FBEAF0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xl font-medium text-[#D4537E]" style={{ fontFamily: 'var(--font-sans)' }}>
            0%
          </p>
          <p className="text-[10px] text-gray-500">recién empezás</p>
        </div>
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Total objetivo</span>
        <span className="font-medium text-[#D4537E]">{formatArs(goal.amount)}</span>
      </div>

      <div className="bg-[#FBEAF0] rounded-lg px-3 py-2.5 text-xs text-[#993556] border-l-[3px] border-[#D4537E]">
        📅 {goal.insight}
      </div>
    </div>
  );
}

// Row del listado de estrategias. Layout del HTML de referencia: checkbox a la
// izquierda, título + subtítulo en el medio, badge de impacto verde a la
// derecha. El estado "done" es solo visual (no se persiste todavía).
function StrategyRow({ strategy, first }: { strategy: GoalStrategy; first: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div
      onClick={() => setDone(d => !d)}
      className={`flex items-start gap-3 py-3 cursor-pointer ${first ? '' : 'border-t border-[#F4C0D1]/50'}`}
    >
      <div className={`w-5 h-5 rounded-full border-2 border-[#D4537E] flex items-center justify-center shrink-0 mt-0.5 transition-colors ${done ? 'bg-[#D4537E]' : ''}`}>
        {done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-snug ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {strategy.emoji} {strategy.title}
        </p>
        <p className={`text-[11px] leading-relaxed mt-0.5 ${done ? 'text-gray-300' : 'text-gray-500'}`}>
          {strategy.subtitle}
        </p>
      </div>
      <span className={`text-[11px] font-medium whitespace-nowrap shrink-0 mt-0.5 ${done ? 'text-gray-300' : 'text-[#3B6D11]'}`}>
        {strategy.impact}
      </span>
    </div>
  );
}
