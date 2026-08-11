import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldHalf, ChevronDown } from 'lucide-react';
import { FinancialAnalysis } from '../types';
import { useMoney, DisplayCurrencyToggle } from '../lib/displayCurrency';
import { g } from '../utils/gender';
import { BottomNav } from './BottomNav';
import { OpenAccountGuides } from './OpenAccountGuides';
import { Sidebar } from './Sidebar';
import { TopRightUser } from './TopRightUser';
import { WhatsAppFab } from './WhatsAppFab';
import { InvestmentGuideScreen } from './InvestmentGuideScreen';
import { resolveInvestmentGuide, InvestmentGuide, instrumentCoveredByKinds } from '../lib/investmentGuides';

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
  inicio: 'bg-[#F0E7FA] text-[#431C72]',
};

// Catálogo corto con descripción + TNA aproximada para cada instrumento que
// el analyzer recomienda. Si llega uno desconocido se renderiza con desc vacío.
// `rinde` = descripción cualitativa (NO una TNA fija, que se desactualiza y
// pierde credibilidad). Igual que lo comunican los neobancos.
const INSTRUMENT_INFO: Record<string, { desc: string; rinde: string; liquidez: string }> = {
  'Cuenta remunerada':                  { desc: 'MP, Ualá, Brubank · sin mínimo',               rinde: 'rinde todos los días', liquidez: 'retiro inmediato' },
  'Plazo fijo tradicional':             { desc: 'Banco · 30 días mínimo',                       rinde: 'tasa fija',            liquidez: '30 días' },
  'Plazo fijo UVA':                     { desc: 'Se ajusta a inflación · 90 días mín.',         rinde: 'sigue la inflación',   liquidez: '90 días' },
  'Fondo común de inversión Money Market': { desc: 'FCI · liquidez diaria',                     rinde: '≈ le gana a la inflación', liquidez: 'retiro inmediato' },
  'Fondo común de inversión mixto':     { desc: 'FCI mixto · bonos + acciones',                 rinde: 'variable',             liquidez: 'medio' },
  'Fondo común de inversión acciones':  { desc: 'FCI 100% acciones · horizonte largo',          rinde: 'variable · largo plazo', liquidez: 'medio-alto' },
  'CEDEARs diversificados':             { desc: 'Acciones extranjeras en ARS · cobertura USD',  rinde: 'atado al dólar',       liquidez: 'medio' },
  'Bonos CER':                          { desc: 'Bonos atados a inflación',                     rinde: 'sigue la inflación',   liquidez: 'medio' },
};

// Inflación anual estimada (ilustrativa). Se usa para el mensaje de "plata
// parada" y como referencia de que un FCI ≈ le empata/gana.
const ANNUAL_INFLATION = 0.30;

// Proyección a 12 meses partiendo de lo que YA tiene invertido + su disponible
// mensual como aporte. Es ilustrativa — los multiplicadores aproximan un año de
// rendimiento sin entrar en compounding fino; el disclaimer cubre el resto.
function projection(available: number, invested: number) {
  const months = 12;
  // Base = lo que ya tiene invertido + un año de aportes de su disponible.
  const base = Math.max(invested, 0) + Math.max(available, 0) * months;
  return [
    { label: 'Sin invertir',     value: base,                    pct: 62,  color: '#CCC',     valColor: '#999' },
    { label: 'Cta. remunerada',  value: Math.round(base * 1.22), pct: 78,  color: '#7626B3', valColor: '#7626B3' },
    { label: 'FCI Money Mkt',    value: Math.round(base * 1.27), pct: 88,  color: '#7626B3', valColor: '#7626B3' },
    { label: 'Plazo fijo UVA',   value: Math.round(base * 1.32), pct: 100, color: '#7626B3', valColor: '#7626B3' },
  ];
}

export function InversionesPage({ analysis }: InversionesPageProps) {
  const { fmt, setRate } = useMoney();
  const rate = analysis.userData.exchangeRate?.rate ?? null;
  useEffect(() => { setRate(rate); }, [rate, setRate]);
  const profile = riskProfile(analysis.financialLevel, analysis.userData.gender);
  // No bancarizada: eligió "No uso banco" en el onboarding. En ese caso, antes
  // que recomendar instrumentos, le mostramos cómo abrir su primera cuenta.
  const notBanked = analysis.userData.banks?.includes('No uso banco') ?? false;
  const recommendations = (analysis.recommendedInvestments ?? []).slice(0, 3);
  // Datos autoreportados en "hábitos": cuánto tiene ahorrado (parado) e invertido.
  const invested = analysis.userData.investedAmount ?? 0;
  const savings = analysis.userData.savingsAmount ?? 0;
  // Ya invierte (respondió "Sí" en hábitos) → no le mostramos el explicador básico.
  const alreadyInvests = analysis.userData.invests === true;
  // Poder de compra que pierde en un año la plata parada (ahorrada sin invertir).
  const idleLoss = Math.round(savings * ANNUAL_INFLATION / (1 + ANNUAL_INFLATION));
  // Patrimonio hoy = ahorrado + invertido, y qué % está invertido vs parado.
  const patrimonio = savings + invested;
  const investedPct = patrimonio > 0 ? Math.round((invested / patrimonio) * 100) : 0;
  const savingsPct = 100 - investedPct;
  const rows = projection(analysis.available, invested);
  const extraVsBase = rows[2].value - rows[0].value; // FCI vs sin invertir
  // Instructivo "¿Cómo lo hago?" abierto (null = ninguno).
  const [activeGuide, setActiveGuide] = useState<InvestmentGuide | null>(null);
  // Explicador "¿Nunca invertiste?" para bajar el miedo (arranca abierto).
  const [showBasics, setShowBasics] = useState(true);

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-8 lg:pl-56 flex flex-col">
      <Sidebar />
      <TopRightUser />
      <WhatsAppFab />
      {/* Header — solo mobile */}
      <div className="lg:hidden bg-[#7626B3] text-white px-5 pt-6 pb-5 sticky top-0 z-10">
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
        <div className="flex justify-start">
          <DisplayCurrencyToggle />
        </div>

        {/* GUÍAS PARA ABRIR CUENTA — solo si no está bancarizada. Va primero
            porque es el paso previo a cualquier inversión. */}
        {notBanked && <OpenAccountGuides />}

        {/* PERFIL DE RIESGO */}
        <section>
          <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Tu perfil de riesgo</p>
          <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm flex items-center gap-3">
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

        {/* TU PLATA HOY — patrimonio (ahorrado + invertido) + % de asignación. */}
        {patrimonio > 0 && (
          <section>
            <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Tu plata hoy</p>
            <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm">
              <p className="text-sm text-gray-500">Ahorrado + invertido</p>
              <p className="text-2xl font-bold text-[#7626B3]">{fmt(patrimonio)}</p>

              {/* Barra de asignación: invertido vs parado */}
              <div className="flex h-3 rounded-full overflow-hidden mt-3 bg-[#F0E7FA]">
                {investedPct > 0 && <div className="bg-[#7626B3] h-full" style={{ width: `${investedPct}%` }} />}
                {savingsPct > 0 && <div className="bg-[#C6A6E6] h-full" style={{ width: `${savingsPct}%` }} />}
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 mt-2.5 text-xs">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7626B3]" /> Invertido {fmt(invested)} · <strong>{investedPct}%</strong>
                </span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C6A6E6]" /> Sin invertir {fmt(savings)} · <strong>{savingsPct}%</strong>
                </span>
              </div>

              {savingsPct >= 50 && savings > 0 && (
                <div className="bg-[#FAEEDA] rounded-lg px-3 py-2 text-xs text-[#854F0B] mt-3">
                  Tenés más de la mitad de tu plata sin invertir. Movete a poner una parte a trabajar.
                </div>
              )}
            </div>
          </section>
        )}

        {/* TU PLATA PARADA — nudge usando lo ahorrado sin invertir (autoreportado). */}
        {savings > 0 && (
          <section>
            <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Tu plata parada</p>
            <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm">
              {invested > 0 && (
                <p className="text-xs text-[#3B6D11] font-medium mb-2">Ya tenés {fmt(invested)} invertido 👏</p>
              )}
              <p className="text-base font-semibold mb-1">{invested > 0 ? 'Pero tenés' : 'Tenés'} {fmt(savings)} ahorrados sin invertir</p>
              <p className="text-sm text-gray-600">
                Contra la inflación (~30% al año, estimado), en 12 meses pierden ≈{' '}
                <strong className="text-[#D85A30]">{fmt(idleLoss)}</strong> de poder de compra.
              </p>
              <div className="bg-[#EAF3DE] rounded-lg px-3 py-2.5 text-xs text-[#3B6D11] border-l-[3px] border-[#3B6D11] mt-3">
                💡 Si esos {fmt(savings)} los ponés en un <strong>FCI</strong> (rinde ≈ inflación, retiro inmediato), en vez de perderlos los mantenés. Mirá las opciones de acá abajo.
              </div>
            </div>
          </section>
        )}

        {/* EXPLICADOR PARA PRINCIPIANTES — solo si NO invierte todavía. */}
        {!alreadyInvests && (
        <section>
          <button
            type="button"
            onClick={() => setShowBasics((s) => !s)}
            className="w-full flex items-center justify-between bg-[#F0E7FA] rounded-xl px-4 py-3 text-left"
            aria-expanded={showBasics}
          >
            <span className="text-sm font-semibold text-[#431C72]">💡 ¿Nunca invertiste? Empezá por acá</span>
            <ChevronDown className={`w-4 h-4 text-[#7626B3] shrink-0 transition-transform ${showBasics ? 'rotate-180' : ''}`} />
          </button>
          {showBasics && (
            <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm mt-2 space-y-2.5 text-sm text-gray-600">
              <p>💚 <strong>No necesitás mucha plata.</strong> Con <strong>$1.000</strong> ya podés arrancar. Lo importante no es el monto — es aprender <strong>cómo</strong>. Después escalás.</p>
              <p>🧺 <strong>¿Qué es un FCI (fondo común)?</strong> Es como una canasta de inversiones que maneja un profesional por vos. Ponés tu plata, rinde todos los días, y en los más comunes la sacás cuando querés (al toque).</p>
              <p>💧 <strong>Liquidez</strong> = qué tan rápido podés sacar tu plata. "Retiro inmediato" = ya, sin esperar.</p>
              <p>🔒 <strong>Plazo fijo</strong> = dejás la plata quieta un tiempo (ej. 30 días) a cambio de una tasa fija.</p>
              <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">Estos instrumentos están en apps y bancos <strong>regulados por la CNV</strong>. FINA no toca ni mueve tu plata — solo te muestra el camino.</p>
            </div>
          )}
        </section>
        )}

        {/* OPCIONES RECOMENDADAS */}
        {recommendations.length > 0 && (() => {
          const investedIn = analysis.userData.investedIn ?? [];
          // Reconocer + complementar: las que la persona NO hace todavía van
          // primero (para diversificar); las que ya hace, al final y marcadas.
          const covered = (name: string) => instrumentCoveredByKinds(name, investedIn);
          const orderedRecs = [...recommendations].sort((a, b) => Number(covered(a)) - Number(covered(b)));
          const anyNew = orderedRecs.some((n) => !covered(n));
          return (
          <section>
            <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Opciones recomendadas</p>

            {/* Coherencia con lo que ya invierte (onboarding). */}
            {investedIn.length > 0 && (
              <div className="bg-[#EAF3DE] rounded-xl px-3 py-2.5 mb-2 text-xs text-[#3B6D11] border-l-[3px] border-[#3B6D11]">
                🎯 Ya invertís en <strong>{investedIn.join(', ')}</strong>.{' '}
                {anyNew
                  ? 'Te priorizamos otras opciones para diversificar tu plata.'
                  : '¡Buenísimo! Ya estás diversificada en lo que recomendamos.'}
              </div>
            )}

            <div className="bg-white rounded-xl p-3 border border-[#D7C2EF]/70 shadow-sm space-y-2">
              {orderedRecs.map((name, i) => {
                const info = INSTRUMENT_INFO[name] ?? { desc: '', rinde: '', liquidez: '' };
                // Coherencia: ¿alguna app que la persona ya usa sirve para esto?
                const guideApps = resolveInvestmentGuide(name).apps;
                const userApp = (analysis.userData.banks ?? []).find((b) => guideApps.includes(b));
                const already = covered(name);
                return (
                  <div key={i} className={`p-2.5 rounded-lg ${already ? 'bg-gray-50 opacity-80' : 'bg-[#F0E7FA]/60'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full text-white text-xs font-medium flex items-center justify-center shrink-0 ${already ? 'bg-gray-400' : 'bg-[#7626B3]'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          {name}
                          {already && (
                            <span className="text-[10px] font-semibold text-[#3B6D11] bg-[#EAF3DE] px-1.5 py-0.5 rounded-full">Ya lo hacés ✓</span>
                          )}
                        </p>
                        {userApp ? (
                          <p className="text-xs font-semibold text-[#3B6D11]">✓ Desde tu {userApp}</p>
                        ) : (
                          info.desc && <p className="text-xs text-gray-500">{info.desc}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {info.rinde && <p className="text-xs font-medium text-[#3B6D11]">{info.rinde}</p>}
                        {info.liquidez && <p className="text-xs text-gray-500">{info.liquidez}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveGuide(resolveInvestmentGuide(name))}
                      className="mt-2.5 w-full text-xs font-semibold text-[#7626B3] bg-white border border-[#7626B3]/40 rounded-full py-2 hover:bg-[#7626B3] hover:text-white transition-colors"
                    >
                      {already ? 'Ver la guía igual →' : userApp ? `¿Cómo lo hago desde ${userApp}? →` : '¿Cómo lo hago? →'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          );
        })()}

        {/* TASA DE MEJORA */}
        {(analysis.available > 0 || invested > 0) && (
          <section>
            <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">
              Tasa de mejora — si invertís tu disponible
            </p>
            <div className="bg-white rounded-xl p-4 border border-[#D7C2EF]/70 shadow-sm">
              <p className="text-base font-semibold mb-1">¿Cuánto podrías tener en un año?</p>
              {invested > 0 && (
                <p className="text-xs text-gray-500 mb-4">
                  Arranca desde tus <strong>{fmt(invested)}</strong> ya invertidos + tu disponible mensual.
                </p>
              )}
              {invested === 0 && <div className="mb-4" />}
              <div className="space-y-2.5">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24 shrink-0">{r.label}</span>
                    <div className="flex-1 h-2.5 bg-[#F0E7FA] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.pct}%`,
                          background: r.color === '#CCC' ? '#CFCFCF' : '#7626B3',
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-16 text-right" style={{ color: r.valColor }}>
                      {fmt(r.value)}
                    </span>
                  </div>
                ))}
              </div>
              {extraVsBase > 0 && (
                <div className="bg-[#F0E7FA] rounded-lg px-3 py-2.5 text-xs text-[#431C72] border-l-[3px] border-[#7626B3] mt-4">
                  💡 Poniendo tu plata en un FCI, en un año tendrías ~{fmt(extraVsBase)} más que dejándola quieta — sin hacer nada.
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
        <InvestmentGuideScreen
          guide={activeGuide}
          userBanks={analysis.userData.banks ?? []}
          onClose={() => setActiveGuide(null)}
        />
      )}
    </div>
  );
}
