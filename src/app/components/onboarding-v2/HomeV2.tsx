import { useNavigate } from 'react-router';
import { Face, ActionRow, COLORS } from './shared';

// REDISEÑO v2 — Home, según el boceto: perfil arriba + 3 acciones grandes
// para arrancar. Fondo con un leve tinte lavanda (zona "cálida" del
// espectro, junto con el bot) — nada de dashboard con gráficos todavía,
// el punto de partida es "elegí por dónde empezar".
export function HomeV2() {
  const navigate = useNavigate();

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-[0_2px_10px_rgba(31,27,46,0.08)]">
          <Face color={COLORS.brand} size={48} mood="happy" />
        </div>
        <div>
          <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Hola de nuevo</p>
          <p className="text-[19px] font-bold leading-tight" style={{ color: COLORS.ink }}>Tu FINA</p>
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
