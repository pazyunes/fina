import { useNavigate } from 'react-router';
import { Cta, COLORS, Face, datosBienestar, fmtMoney, loadV2Categorias, loadV2Foto, loadV2GastosState, loadV2Grupo, loadV2InversionesPerfil, loadV2NivelFinanciero, loadV2Nombre, loadV2ObjetivosIniciales, loadV2ObjetivosState, loadV2Reserva, rachaDeGastos, saludoDelDia } from './shared';

// REDISEÑO v2 — Home "que fluye" (inspiración Finch + Duolingo):
//   - Home MÍNIMO: una barra chica de stats (racha / mes / reserva), la
//     estrella-compañera con UN solo "próximo paso" claro, y un tip.
//   - Todo lo detallado (bienestar, análisis) se mudó a Perfil ("Tu
//     progreso"); el ranking del grupo vive en Grupos (acá solo un chip).
//     Los accesos a Gastos/Objetivos/Inversiones ya están en el menú.

type EstadoLite = { gastos: { ts?: number }[]; topes: Record<string, unknown> };
type ObjLite = { nombre: string; montoTotal: number; montoModo: string | null; contribuciones: { monto: number }[] };

// "Tu próximo paso" — la regla que da coherencia: siempre una sola acción,
// la más útil según en qué punto está la persona (estilo "próxima lección"
// de Duolingo). Ordenado de lo más básico a lo más avanzado.
function proximoPaso(): { titulo: string; msg: string; cta: string; to: string } {
  const g = loadV2GastosState<EstadoLite>();
  const objetivos = loadV2ObjetivosState<ObjLite[]>() ?? [];
  const invPerfil = loadV2InversionesPerfil();

  if (!g || g.gastos.length === 0) {
    return { titulo: 'Arranquemos por acá', msg: 'Registrá tu primer gasto y yo armo tus secciones y tu análisis solo.', cta: 'Registrar un gasto', to: '/onboarding-v2/gastos' };
  }
  const objIncompleto = objetivos.find((o) => o.montoModo === null || (o.montoModo !== 'desconocido' && !(o.montoTotal > 0)));
  if (objIncompleto) {
    return { titulo: 'Te falta un paso', msg: `Ponéle un monto a “${objIncompleto.nombre}” para ver tu progreso.`, cta: 'Completar objetivo', to: '/onboarding-v2/objetivos' };
  }
  const objCerca = objetivos.find((o) => {
    const s = o.contribuciones.reduce((a, c) => a + c.monto, 0);
    return o.montoTotal > 0 && s / o.montoTotal >= 0.7 && s < o.montoTotal;
  });
  if (objCerca) {
    return { titulo: '¡Estás cerquita!', msg: `Te falta poco para “${objCerca.nombre}”. Sumá lo último que separaste.`, cta: 'Ver mi objetivo', to: '/onboarding-v2/objetivos' };
  }
  if (!invPerfil) {
    return { titulo: 'Un paso más', msg: 'Descubrí en qué te conviene poner tu plata según tu perfil.', cta: 'Armar mi perfil inversor', to: '/onboarding-v2/inversiones' };
  }
  return { titulo: '¡Venís al día!', msg: 'Registrá lo de hoy para no cortar la racha 🔥', cta: 'Registrar un gasto', to: '/onboarding-v2/gastos' };
}

// Cuánto del perfil está completo (para el anillo del avatar) — datos reales.
function perfilPct(): number {
  const g = loadV2GastosState<EstadoLite>();
  const objetivos = loadV2ObjetivosState<{ montoTotal: number }[]>() ?? [];
  let done = 0;
  if (g && g.gastos.length > 0) done++;
  if (g && Object.keys(g.topes).length > 0) done++;
  if (objetivos.some((o) => o.montoTotal > 0)) done++;
  if (loadV2NivelFinanciero()) done++;
  return Math.round((done / 4) * 100);
}

// Un solo tip, según lo que ya sabemos.
function tipDelDia(): { icon: string; texto: string; to: string } {
  if (loadV2Categorias().length === 0) return { icon: '💸', texto: 'Registrá tu primer gasto y armamos tus secciones solas.', to: '/onboarding-v2/gastos' };
  if (loadV2ObjetivosIniciales().length > 0) return { icon: '🎯', texto: 'Tenés objetivos anotados — ponéles un monto para ver el progreso.', to: '/onboarding-v2/objetivos' };
  if (loadV2InversionesPerfil()) return { icon: '🌱', texto: 'Terminá tu perfil inversor para ver recomendaciones.', to: '/onboarding-v2/inversiones' };
  return { icon: '💬', texto: 'Contale un gasto a FINA por WhatsApp — lo registra solo.', to: '/onboarding-v2/gastos' };
}

export function HomeV2() {
  const navigate = useNavigate();
  const nombre = loadV2Nombre();
  const foto = loadV2Foto();
  const grupo = loadV2Grupo();
  const reserva = loadV2Reserva();
  const racha = rachaDeGastos();
  const b = datosBienestar();
  const paso = proximoPaso();
  const tip = tipDelDia();
  const pct = perfilPct();

  // Semáforo del mes a partir de cómo venís con los topes de gasto.
  const mes = b.gastosPct === null
    ? { color: COLORS.inkFaint, label: 'Sin datos' }
    : b.gastosPct >= 67
      ? { color: COLORS.green, label: 'Vas bien' }
      : b.gastosPct >= 34
        ? { color: COLORS.gold, label: 'Atento' }
        : { color: COLORS.coral, label: 'Cuidado' };

  // Posición en el grupo (para el chip de competencias).
  const ordenados = grupo ? [...grupo.miembros].sort((a, b2) => b2.actividad - a.actividad) : [];
  const miPos = ordenados.findIndex((m) => m.sosVos) + 1;

  const StatChip = ({ children }: { children: React.ReactNode }) => (
    <div className="flex-1 bg-white rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5 shadow-[0_2px_14px_rgba(31,27,46,0.06)]">
      {children}
    </div>
  );

  return (
    <div className="px-[22px] pt-8 pb-4 flex flex-col gap-5 lg:max-w-md lg:mx-auto lg:pt-12">
      {/* Avatar (con anillo de progreso del perfil) + saludo */}
      <div className="flex items-center gap-3">
        <div className="rounded-full p-[3px] shrink-0" style={{ background: `conic-gradient(${COLORS.brand} ${pct}%, rgba(31,27,46,0.10) 0)` }}>
          <button
            type="button"
            onClick={() => navigate('/onboarding-v2/perfil')}
            className="w-12 h-12 rounded-full overflow-hidden block bg-white transition-transform duration-100 active:scale-95"
            aria-label="Ver tu perfil"
          >
            {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Face color={COLORS.brand} size={48} mood="happy" />}
          </button>
        </div>
        <div>
          <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>{saludoDelDia()}{nombre ? `, ${nombre}` : ''}</p>
          <p className="text-[19px] font-bold leading-tight" style={{ color: COLORS.ink }}>Tu FINA</p>
        </div>
      </div>

      {/* Barra compacta de stats */}
      <div className="flex gap-2.5">
        <StatChip>
          <span className="text-[17px] font-bold leading-none" style={{ color: COLORS.ink }}>🔥 {racha}</span>
          <span className="text-[10.5px]" style={{ color: COLORS.inkSoft }}>{racha === 1 ? 'día' : 'días'} de racha</span>
        </StatChip>
        <StatChip>
          <span className="flex items-center gap-1 text-[13px] font-bold leading-none" style={{ color: mes.color }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: mes.color }} />{mes.label}
          </span>
          <span className="text-[10.5px]" style={{ color: COLORS.inkSoft }}>este mes</span>
        </StatChip>
        <button type="button" onClick={() => navigate('/onboarding-v2/perfil')} className="flex-1 bg-white rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5 shadow-[0_2px_14px_rgba(31,27,46,0.06)] transition-transform active:scale-95">
          <span className="text-[13px] font-bold leading-none tabular-nums" style={{ color: COLORS.ink }}>{reserva > 0 ? fmtMoney(reserva) : '—'}</span>
          <span className="text-[10.5px]" style={{ color: COLORS.inkSoft }}>🔒 reserva</span>
        </button>
      </div>

      {/* La estrella + tu próximo paso (el corazón del Home) */}
      <div className="bg-white rounded-[26px] p-6 flex flex-col items-center text-center gap-3 shadow-[0_4px_24px_rgba(31,27,46,0.08)]">
        <Face color={COLORS.brand} size={104} mood="happy" />
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.brand }}>Tu próximo paso</p>
          <p className="text-[18px] font-bold leading-tight" style={{ color: COLORS.ink }}>{paso.titulo}</p>
          <p className="text-[13.5px] leading-snug" style={{ color: COLORS.inkSoft }}>{paso.msg}</p>
        </div>
        <div className="w-full pt-1">
          <Cta label={paso.cta} onClick={() => navigate(paso.to)} />
        </div>
      </div>

      {/* Competencias — solo un chip; el ranking completo vive en Grupos */}
      {grupo && miPos > 0 && (
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/grupos')}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.99]"
          style={{ background: COLORS.brandSoft }}
        >
          <span className="text-lg shrink-0">🏆</span>
          <span className="flex-1 text-[13px] font-semibold" style={{ color: COLORS.ink }}>Vas {miPos}° en {grupo.nombre}</span>
          <span className="text-[12px] font-bold shrink-0" style={{ color: COLORS.brandDark }}>Ver →</span>
        </button>
      )}

      {/* Un tip */}
      <button
        type="button"
        onClick={() => navigate(tip.to)}
        className="w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3.5 transition-transform active:scale-[0.99]"
        style={{ background: COLORS.goldSoft }}
      >
        <span className="text-lg shrink-0">{tip.icon}</span>
        <span className="flex-1 text-[13px] font-medium" style={{ color: COLORS.ink }}>{tip.texto}</span>
      </button>
    </div>
  );
}
