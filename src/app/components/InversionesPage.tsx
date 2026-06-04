import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldHalf } from 'lucide-react';
import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';
import { g } from '../utils/gender';
import { BottomNav } from './BottomNav';
import { OpenAccountGuides } from './OpenAccountGuides';
import { Sidebar } from './Sidebar';
import { TopRightUser } from './TopRightUser';
import { InvestmentGuideScreen } from './InvestmentGuideScreen';
import { resolveInvestmentGuide, InvestmentGuide } from '../lib/investmentGuides';

interface InversionesPageProps {
  analysis: FinancialAnalysis;
}

// PR7 — Pestaña Inversiones. Layout del HTML de referencia:
// header rosa + Perfil de riesgo + Opciones recomendadas + Tasa de mejora +
// disclaimer.

// Mapeo grueso del financialLevel a un perfil de riesgo + badge.
// PR8 — Los títulos usan g() para adaptarse al género elegido en el onboarding.
function riskProfile(level: string, gender: FinancialAnalysis['userData']['gender']): { title: string; copy: string; badge: 'moderado' | 'conservador' | 'inicio' } {
  if (level.includes('Inversor')) return {
    title: g(gender, 'Equilibrada', 'Equilibrado'),
    copy: 'Ya invertís — te interesa balancear riesgo y rendimiento',
    badge: 'moderado',
  };
  if (level.includes('Con ahorro')) return {
    title: `${g(gender, 'Conservadora', 'Conservador')} con apertura`,
    copy: 'Priorizás la seguridad pero querés que la plata rinda',
    badge: 'moderado',
  };
  if (level.includes('sin control')) return {
    title: g(gender, 'Conservadora', 'Conservador'),
    copy: 'Mejor arrancar por instrumentos seguros y líquidos',
    badge: 'conservador',
  };
  return {
    title: 'Recién arrancando',
    copy: 'Primero abrí tu cuenta bancaria; después vemos inversiones',
    badge: 'inicio',
  };
}

const BADGE_COLOR: Record<string, string> = {
  moderado: 'bg-[#FAEEDA] text-[#854F0B]',
  conservador: 'bg-[#EAF3DE] text-[#3B6D11]',
  inicio: 'bg-[#F1E8F8] text-[#4A1C66]',
};

// Catálogo corto con descripción + TNA aproximada para cada instrumento que
// el analyzer recomienda. Si llega uno desconocido se renderiza con desc vacío.
const INSTRUMENT_INFO: Record<string, { desc: string; tasa: string; liquidez: string }> = {
  'Cuenta remunerada':                  { desc: 'MP, Ualá, Brubank · retiro inmediato',         tasa: '~80% TNA', liquidez: 'muy líquido' },
  'Plazo fijo tradicional':             { desc: 'Banco · 30 días mínimo',                       tasa: '~90% TNA', liquidez: '30 días' },
  'Plazo fijo UVA':                     { desc: 'Se ajusta a inflación · 90 días mín.',         tasa: 'inflación +1%', liquidez: '90 días' },
  'Fondo común de inversión Money Market': { desc: 'FCI · liquidez diaria',                     tasa: '~85% TNA', liquidez: 'bajo riesgo' },
  'Fondo común de inversión mixto':     { desc: 'FCI mixto · bonos + acciones',                 tasa: 'variable',     liquidez: 'medio' },
  'Fondo común de inversión acciones':  { desc: 'FCI 100% acciones · horizonte largo',          tasa: 'variable',     liquidez: 'medio-alto' },
  'CEDEARs diversificados':             { desc: 'Acciones extranjeras en ARS · cobertura USD',  tasa: 'variable',     liquidez: 'medio' },
  'Bonos CER':                          { desc: 'Bonos atados a inflación',                     tasa: 'inflación +X%', liquidez: 'medio' },
};

// Proyección simple a 5 meses ahorrando `available` por mes. Es ilustrativa —
// los multiplicadores aproximan rendimientos reales sin entrar en el detalle
// de compounding mensual; el disclaimer cubre el resto.
function projection(available: number) {
  const months = 5;
  const base = Math.max(available, 0) * months;
  return [
    { label: 'Sin invertir',     value: base,                   pct: 60,  color: '#CCC',     valColor: '#999' },
    { label: 'Cta. remunerada',  value: Math.round(base * 1.09), pct: 75,  color: '#7E2EA8', valColor: '#7E2EA8' },
    { label: 'FCI Money Mkt',    value: Math.round(base * 1.13), pct: 85,  color: '#7E2EA8', valColor: '#7E2EA8' },
    { label: 'Plazo fijo UVA',   value: Math.round(base * 1.17), pct: 100, color: '#7E2EA8', valColor: '#7E2EA8' },
  ];
}

export function InversionesPage({ analysis }: InversionesPageProps) {
  const profile = riskProfile(analysis.financialLevel, analysis.userData.gender);
  // No bancarizada: eligió "No uso banco" en el onboarding. En ese caso, antes
  // que recomendar instrumentos, le mostramos cómo abrir su primera cuenta.
  const notBanked = analysis.userData.banks?.includes('No uso banco') ?? false;
  const recommendations = (analysis.recommendedInvestments ?? []).slice(0, 3);
  const rows = projection(analysis.available);
  const extraVsBase = rows[2].value - rows[0].value; // FCI vs sin invertir
  // Instructivo "¿Cómo lo hago?" abierto (null = ninguno).
  const [activeGuide, setActiveGuide] = useState<InvestmentGuide | null>(null);

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-8 lg:pl-56 flex flex-col">
      <Sidebar />
      <TopRightUser />
      {/* Header — solo mobile */}
      <div className="lg:hidden bg-[#7E2EA8] text-white px-5 pt-6 pb-5 sticky top-0 z-10">
        <div className="max-w-md lg:max-w-3xl mx-auto">
          <h1 className="text-xl lg:text-2xl font-semibold" style={{ fontFamily: 'var(--font-sans)' }}>Inversiones para vos</h1>
          <p className="text-sm text-white/80 mt-0.5">Basadas en tu perfil y objetivo</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 p-4 lg:px-8 lg:pt-20 lg:pb-8 max-w-md lg:max-w-3xl mx-auto w-full space-y-5"
      >
        {/* GUÍAS PARA ABRIR CUENTA — solo si no está bancarizada. Va primero
            porque es el paso previo a cualquier inversión. */}
        {notBanked && <OpenAccountGuides />}

        {/* PERFIL DE RIESGO */}
        <section>
          <p className="text-xs font-bold text-[#7E2EA8] uppercase tracking-wider mb-2">Tu perfil de riesgo</p>
          <div className="bg-white rounded-xl p-4 border border-[#DCC6EC]/70 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FAEEDA] flex items-center justify-center shrink-0">
              <ShieldHalf className="w-5 h-5 text-[#854F0B]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold">{profile.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{profile.copy}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${BADGE_COLOR[profile.badge]}`}>
              {profile.badge}
            </span>
          </div>
        </section>

        {/* OPCIONES RECOMENDADAS */}
        {recommendations.length > 0 && (
          <section>
            <p className="text-xs font-bold text-[#7E2EA8] uppercase tracking-wider mb-2">Opciones recomendadas</p>
            <div className="bg-white rounded-xl p-3 border border-[#DCC6EC]/70 shadow-sm space-y-2">
              {recommendations.map((name, i) => {
                const info = INSTRUMENT_INFO[name] ?? { desc: '', tasa: '', liquidez: '' };
                return (
                  <div key={i} className="p-2.5 bg-[#F1E8F8]/60 rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#7E2EA8] text-white text-xs font-medium flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{name}</p>
                        {info.desc && <p className="text-xs text-gray-500">{info.desc}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {info.tasa && <p className="text-xs font-medium text-[#3B6D11]">{info.tasa}</p>}
                        {info.liquidez && <p className="text-xs text-gray-500">{info.liquidez}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveGuide(resolveInvestmentGuide(name))}
                      className="mt-2.5 w-full text-xs font-semibold text-[#7E2EA8] bg-white border border-[#7E2EA8]/40 rounded-full py-2 hover:bg-[#7E2EA8] hover:text-white transition-colors"
                    >
                      ¿Cómo lo hago? →
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TASA DE MEJORA */}
        {analysis.available > 0 && (
          <section>
            <p className="text-xs font-bold text-[#7E2EA8] uppercase tracking-wider mb-2">
              Tasa de mejora — si invertís tu disponible
            </p>
            <div className="bg-white rounded-xl p-4 border border-[#DCC6EC]/70 shadow-sm">
              <p className="text-base font-semibold mb-4">¿Cuánto más podrías tener en 5 meses?</p>
              <div className="space-y-2.5">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24 shrink-0">{r.label}</span>
                    <div className="flex-1 h-2.5 bg-[#F1E8F8] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.pct}%`,
                          background: r.color === '#CCC' ? '#CFCFCF' : '#7E2EA8',
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-16 text-right" style={{ color: r.valColor }}>
                      {formatArs(r.value)}
                    </span>
                  </div>
                ))}
              </div>
              {extraVsBase > 0 && (
                <div className="bg-[#F1E8F8] rounded-lg px-3 py-2.5 text-xs text-[#4A1C66] border-l-[3px] border-[#7E2EA8] mt-4">
                  💡 Invertir tu ahorro en un FCI te genera ~{formatArs(extraVsBase)} extra — sin hacer nada.
                </div>
              )}
            </div>
          </section>
        )}

        {/* DISCLAIMER */}
        <div className="bg-white/70 rounded-lg px-3 py-2.5 text-xs text-gray-500 border-l-[3px] border-gray-300">
          Este informe es orientativo y no constituye asesoramiento financiero. FINA no mueve tu plata.
        </div>
      </motion.div>

      <BottomNav />

      {/* Instructivo full-screen "¿Cómo lo hago?" */}
      {activeGuide && (
        <InvestmentGuideScreen guide={activeGuide} onClose={() => setActiveGuide(null)} />
      )}
    </div>
  );
}
