import { useNavigate } from 'react-router';
import { Face, ActionRow, COLORS } from './shared';

// REDISEÑO v2 — Home, según el boceto: perfil arriba + 3 acciones grandes
// para arrancar. Nada de dashboard con gráficos todavía — el punto de
// partida es "elegí por dónde empezar", no un panel de números.
export function HomeV2() {
  const navigate = useNavigate();

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full border-[2.5px] border-[#1E1E1E] overflow-hidden shrink-0" style={{ background: COLORS.mint }}>
          <Face color={COLORS.mint} size={48} mood="happy" />
        </div>
        <div>
          <p className="text-[13px] text-[#5b5b52]">Hola de nuevo</p>
          <p className="font-['Baloo_2'] text-[19px] font-bold text-[#1E1E1E] leading-tight">Tu FINA</p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <ActionRow
          icon={<span className="text-lg">💸</span>}
          label="Registrá tu primer gasto"
          onClick={() => navigate('/onboarding-v2/gastos')}
        />
        <ActionRow
          icon={<span className="text-lg">🎯</span>}
          label="Empezá a lograr algún objetivo"
          onClick={() => navigate('/onboarding-v2/objetivos')}
        />
        <ActionRow
          icon={<span className="text-lg">🌱</span>}
          label="Empezá a invertir con FINA"
          onClick={() => navigate('/onboarding-v2/inversiones')}
        />
      </div>
    </div>
  );
}
