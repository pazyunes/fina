import { Check } from 'lucide-react';
import { ONBOARDING_STEPS, getStepIndex } from '../onboarding/steps';

// PR — Panel lateral del onboarding para desktop (lg+). Da una vista de
// "wizard de escritorio": marca FINA + lista de pasos con el actual resaltado.
// Las pantallas del onboarding reservan el espacio con `lg:pl-72`. En mobile
// no se muestra (la barra de progreso de abajo cumple ese rol).
export function OnboardingAside({ currentPath }: { currentPath: string }) {
  const idx = getStepIndex(currentPath);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-72 bg-[#7626B3] text-white flex-col px-6 py-8 z-30">
      <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-serif)' }}>FINA</p>
      <p className="text-sm text-white/80 mt-2 mb-8 leading-snug">
        Armemos tu informe financiero en unos pocos pasos.
      </p>

      <ol className="space-y-1 flex-1">
        {ONBOARDING_STEPS.map((s, i) => {
          const done = idx > i;
          const current = idx === i;
          return (
            <li
              key={s.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                current ? 'bg-white/15 font-semibold' : done ? 'text-white/85' : 'text-white/50'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  current ? 'bg-white text-[#7626B3] font-bold' : done ? 'bg-white/30' : 'border border-white/40'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-white/60 mt-6">Tus datos son privados y solo los usás vos.</p>
    </aside>
  );
}
