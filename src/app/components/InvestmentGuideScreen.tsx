import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { InvestmentGuide } from '../lib/investmentGuides';

interface InvestmentGuideScreenProps {
  guide: InvestmentGuide;
  // Bancos/apps que la usuaria dijo usar (onboarding). Se usa para destacar la
  // que ya tiene y que todo sea coherente con sus datos.
  userBanks?: string[];
  onClose: () => void;
}

const RISK_STYLE: Record<InvestmentGuide['risk']['level'], { bg: string; text: string }> = {
  Bajo: { bg: '#EAF3DE', text: '#3B6D11' },
  Medio: { bg: '#FAEEDA', text: '#854F0B' },
  Alto: { bg: '#FBE3D9', text: '#D85A30' },
};

const STEP_LABELS = ['¿Qué es?', 'Apps disponibles', 'Paso a paso'];

// PR — Pantalla full-screen con el instructivo de 3 pasos de una inversión.
// Se abre desde el botón "¿Cómo lo hago?" de cada recomendación en Inversiones.
export function InvestmentGuideScreen({ guide, userBanks, onClose }: InvestmentGuideScreenProps) {
  const [step, setStep] = useState(0);
  const isLast = step === 2;
  const risk = RISK_STYLE[guide.risk.level];

  // Coherencia con los datos: apps que la usuaria ya tiene y sirven para esto.
  const banks = userBanks ?? [];
  const myApps = guide.apps.filter((a) => banks.includes(a));
  // Apps ordenadas: primero las que ya usa, después el resto.
  const orderedApps = [...myApps, ...guide.apps.filter((a) => !myApps.includes(a))];
  const noneMatch = myApps.length === 0 && banks.length > 0 && !banks.includes('No uso banco');

  const next = () => (isLast ? onClose() : setStep((s) => s + 1));
  const back = () => (step === 0 ? onClose() : setStep((s) => s - 1));

  return (
    <div className="fixed inset-0 z-50 bg-[#F0E7FA] flex flex-col">
      {/* Header rosa */}
      <div className="bg-[#7626B3] text-white px-5 pt-6 pb-4 shrink-0">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-white/80 uppercase tracking-wider">¿Cómo lo hago?</p>
              <h1 className="text-xl font-semibold leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
                {guide.title}
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 -mr-1 -mt-1 p-1 rounded-full hover:bg-white/15"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progreso 3 pasos */}
          <div className="flex items-center gap-2 mt-4">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-white' : 'bg-white/30'}`}
                />
                <p className={`text-xs mt-1 ${i === step ? 'text-white font-semibold' : 'text-white/70'}`}>
                  {i + 1}. {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-md mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-[#7626B3] mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
                    ¿Qué es {guide.title}?
                  </h2>
                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-4"
                    style={{ background: risk.bg, color: risk.text }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Riesgo {guide.risk.level.toLowerCase()}
                  </div>
                  <p className="text-base text-gray-700 leading-relaxed">{guide.what}</p>
                  <div className="bg-white rounded-xl px-4 py-3 mt-4 border-l-[3px] border-[#7626B3] text-sm text-[#431C72]">
                    {guide.risk.note}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-[#7626B3] mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                    ¿Dónde puedo hacerlo?
                  </h2>

                  {/* Coherente con lo que la persona usa. */}
                  {myApps.length > 0 ? (
                    <div className="bg-[#EAF3DE] rounded-xl px-4 py-3 mb-4 text-sm text-[#3B6D11] border-l-[3px] border-[#3B6D11]">
                      🎯 <strong>{myApps.join(' y ')}</strong> — que ya usás — te sirve para esto. Hacelo directo desde ahí, sin instalar nada nuevo.
                    </div>
                  ) : noneMatch ? (
                    <p className="text-sm text-gray-500 mb-4">
                      Ninguna de las apps que cargaste hace esto directo, así que vas a tener que abrir una nueva. Es <strong>gratis y rápido</strong> — elegí la que más te guste:
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mb-4">
                      Podés hacerlo desde cualquiera de estas plataformas. Elegí la que más te guste:
                    </p>
                  )}

                  <div className="space-y-2.5">
                    {orderedApps.map((app) => {
                      const mine = myApps.includes(app);
                      return (
                        <div
                          key={app}
                          className={`flex items-center gap-3 rounded-xl px-4 py-3.5 border ${mine ? 'border-[#7626B3] bg-[#F0E7FA]' : 'border-[#D7C2EF]/50 bg-white'}`}
                        >
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${mine ? 'bg-[#7626B3]' : 'bg-[#EAF3DE]'}`}>
                            <Check className={`w-3.5 h-3.5 ${mine ? 'text-white' : 'text-[#3B6D11]'}`} />
                          </span>
                          <span className="text-sm font-medium text-gray-800 flex-1">{app}</span>
                          {mine && (
                            <span className="text-[10px] font-semibold text-[#7626B3] bg-white border border-[#7626B3]/30 px-2 py-0.5 rounded-full shrink-0">
                              Ya la usás
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-[#7626B3] mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
                    Paso a paso
                  </h2>
                  <ol className="space-y-3">
                    {guide.steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-7 h-7 rounded-full bg-[#7626B3] text-white text-sm font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-base text-gray-700 leading-snug pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="bg-gradient-to-br from-[#7626B3] to-[#A858CE] rounded-2xl px-4 py-4 mt-6 text-white flex gap-3 items-start">
                    <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium leading-snug">{guide.reassurance}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer navegación */}
      <div className="shrink-0 bg-white/70 backdrop-blur border-t border-[#D7C2EF]/50 px-5 py-4">
        <div className="max-w-md mx-auto w-full flex gap-3">
          <Button
            onClick={back}
            variant="outline"
            className="flex-1 rounded-full border-gray-300 text-gray-600"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {step === 0 ? 'Salir' : 'Atrás'}
          </Button>
          <Button
            onClick={next}
            className="flex-1 bg-[#059669] hover:bg-[#047857] text-white rounded-full"
          >
            {isLast ? '¡Listo!' : 'Siguiente'}
            {!isLast && <ArrowRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
