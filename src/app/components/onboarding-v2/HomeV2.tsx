import { useNavigate } from 'react-router';
import { Face, ActionRow, COLORS, loadV2Foto, loadV2Nombre, saludoDelDia } from './shared';

// REDISEÑO v2 — Home, según el boceto: perfil arriba + 3 acciones grandes
// para arrancar. Fondo con un leve tinte lavanda (zona "cálida" del
// espectro, junto con el bot) — nada de dashboard con gráficos todavía,
// el punto de partida es "elegí por dónde empezar".
//
// Saluda por nombre y según la hora (mismo detalle que Headspace/Cleo) —
// es lo que más cambia que esto se sienta "alguien te habla" y no un
// formulario. Si todavía no dio el nombre (saltó ese paso), cae al genérico.
// El avatar lleva a Perfil (foto + nombre + grupos).
export function HomeV2() {
  const navigate = useNavigate();
  const nombre = loadV2Nombre();
  const foto = loadV2Foto();

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/perfil')}
          className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-[0_2px_10px_rgba(31,27,46,0.08)] transition-transform duration-100 active:scale-95"
          aria-label="Ver tu perfil"
        >
          {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Face color={COLORS.brand} size={48} mood="happy" />}
        </button>
        <div>
          <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>{saludoDelDia()}{nombre ? `, ${nombre}` : ''}</p>
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
        <ActionRow
          icon={<span className="text-lg">👥</span>}
          label="Armá un grupo con amigas"
          onClick={() => navigate('/onboarding-v2/grupos')}
        />
      </div>
    </div>
  );
}
