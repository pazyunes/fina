import { useNavigate } from 'react-router';
import { ActionRow, Coachmark, COLORS, Face, loadV2Categorias, loadV2Foto, loadV2GastosState, loadV2Grupo, loadV2InversionesPerfil, loadV2InversionesState, loadV2Nombre, loadV2ObjetivosIniciales, loadV2ObjetivosState, saludoDelDia } from './shared';

const MEDALLAS = ['🥇', '🥈', '🥉'];

type Tip = { icon: string; texto: string; to: string };

// Tips reales, no inventados — el mismo espíritu que las "ideas para
// llegar más rápido" que ya tiene ObjetivosPage.tsx en la app real, pero
// acá en Home y armados con lo único que persiste entre pantallas en este
// sandbox (las respuestas del onboarding), no con gastos/objetivos que se
// cargan durante la sesión — esos todavía viven solo en cada pantalla.
function tipsPara(): Tip[] {
  const tips: Tip[] = [];
  if (loadV2Categorias().length === 0) {
    tips.push({ icon: '💸', texto: 'Registrá tu primer gasto y armamos tus secciones solas, a partir de eso.', to: '/onboarding-v2/gastos' });
  }
  if (loadV2ObjetivosIniciales().length > 0) {
    tips.push({ icon: '🎯', texto: 'Tenés objetivos anotados del onboarding — ponéles un monto para ver el progreso.', to: '/onboarding-v2/objetivos' });
  }
  if (loadV2InversionesPerfil()) {
    tips.push({ icon: '🌱', texto: 'Ya nos contaste algo de tu perfil inversor — terminalo en Inversiones para ver recomendaciones.', to: '/onboarding-v2/inversiones' });
  }
  if (tips.length === 0) {
    tips.push({ icon: '👀', texto: 'Explorá Gastos, Objetivos e Inversiones — cuanto más uses FINA, más te vamos a poder ayudar.', to: '/onboarding-v2/gastos' });
  }
  return tips.slice(0, 2);
}

// ── Anillo de bienestar financiero (estilo Headspace/Apple Watch) ──────
// Le da un lugar visual a "Cuidá tu bienestar financiero" del checklist
// del onboarding. Cada arco solo se calcula con datos reales — si una
// sección todavía no tiene nada que decir, ese arco directamente no se
// dibuja (no es "0% = mal", es "todavía no hay nada que mostrar acá"), y
// si NINGÚN arco tiene datos, el anillo entero no aparece: en una pantalla
// de celular, no vale la pena el espacio de algo que no dice nada todavía.
type GastosLite = { categorias: { id: string; nombre: string }[]; gastos: { categoriaId: string; monto: number }[]; topes: Record<string, { monto: number; periodo: 'semana' | 'mes' }> };
type ObjetivoLite = { montoTotal: number; contribuciones: { monto: number }[] };
type InversionesLite = { aportes: { ts: number }[] };

function datosBienestar() {
  const g = loadV2GastosState<GastosLite>();
  const objetivos = loadV2ObjetivosState<ObjetivoLite[]>() ?? [];
  const inv = loadV2InversionesState<InversionesLite>();

  let gastosPct: number | null = null;
  let gastosTexto = '';
  if (g) {
    const conTope = g.categorias.filter((c) => g.topes[c.id]);
    if (conTope.length > 0) {
      const dentro = conTope.filter((c) => {
        const gastado = g.gastos.filter((x) => x.categoriaId === c.id).reduce((s, x) => s + x.monto, 0);
        return gastado <= g.topes[c.id].monto;
      });
      gastosPct = Math.round((dentro.length / conTope.length) * 100);
      gastosTexto = `${dentro.length} de ${conTope.length} secciones dentro del tope`;
    }
  }

  let objetivosPct: number | null = null;
  let objetivosTexto = '';
  const conMonto = objetivos.filter((o) => o.montoTotal > 0);
  if (conMonto.length > 0) {
    const suma = conMonto.reduce((s, o) => {
      const saved = o.contribuciones.reduce((ss, c) => ss + c.monto, 0);
      return s + Math.min(100, Math.round((saved / o.montoTotal) * 100));
    }, 0);
    objetivosPct = Math.round(suma / conMonto.length);
    objetivosTexto = `${objetivosPct}% de progreso promedio en tus objetivos`;
  }

  let inversionPct: number | null = null;
  let inversionTexto = '';
  if (inv && inv.aportes.length > 0) {
    const ahora = new Date();
    const esteMes = inv.aportes.some((a) => {
      const d = new Date(a.ts);
      return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    });
    inversionPct = esteMes ? 100 : 35;
    inversionTexto = esteMes ? 'Aportaste a tus inversiones este mes' : 'Hace tiempo que no le sumás a tus inversiones';
  }

  return { gastosPct, gastosTexto, objetivosPct, objetivosTexto, inversionPct, inversionTexto };
}

function Arco({ radius, pct, color }: { radius: number; pct: number | null; color: string }) {
  const c = 2 * Math.PI * radius;
  const dash = pct === null ? 0 : (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(31,27,46,0.08)" strokeWidth="9" />
      {pct !== null && (
        <circle
          cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      )}
    </>
  );
}

// REDISEÑO v2 — Home, según el boceto: perfil arriba + 3 acciones grandes
// para arrancar, y — si hay un grupo armado — una vista chica de la
// actividad del grupo debajo del dashboard (no mezclada con los accesos
// principales). Si todavía no armó uno, un único CTA para armarlo.
//
// Saluda por nombre y según la hora (mismo detalle que Headspace/Cleo) —
// es lo que más cambia que esto se sienta "alguien te habla" y no un
// formulario. El avatar lleva a Perfil (foto + nombre + grupos).
export function HomeV2() {
  const navigate = useNavigate();
  const nombre = loadV2Nombre();
  const foto = loadV2Foto();
  const grupo = loadV2Grupo();
  const topGrupo = grupo ? [...grupo.miembros].sort((a, b) => b.actividad - a.actividad).slice(0, 3) : [];
  const tips = tipsPara();
  const b = datosBienestar();
  const hayBienestar = b.gastosPct !== null || b.objetivosPct !== null || b.inversionPct !== null;

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-6 pb-4">
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

      <Coachmark id="home">
        ¡Bienvenida! Elegí por dónde arrancar acá abajo. Y ese botón redondo y oscuro del medio, en el menú de abajo, es tu bot de WhatsApp — tocalo cuando quieras cargar un gasto hablando o hacer una pregunta.
      </Coachmark>

      {/* Anillo de bienestar financiero — solo si hay algo real que mostrar */}
      {hayBienestar && (
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)] flex gap-4 items-center">
          <svg viewBox="0 0 120 120" className="w-[92px] h-[92px] shrink-0">
            <Arco radius={50} pct={b.gastosPct} color={COLORS.coral} />
            <Arco radius={38} pct={b.objetivosPct} color={COLORS.gold} />
            <Arco radius={26} pct={b.inversionPct} color={COLORS.green} />
          </svg>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-[12px] font-bold uppercase tracking-wide mb-0.5" style={{ color: COLORS.inkSoft }}>Tu bienestar financiero</p>
            {b.gastosPct !== null && (
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.ink }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.coral }} />{b.gastosTexto}
              </span>
            )}
            {b.objetivosPct !== null && (
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.ink }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.gold }} />{b.objetivosTexto}
              </span>
            )}
            {b.inversionPct !== null && (
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.ink }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.green }} />{b.inversionTexto}
              </span>
            )}
          </div>
        </div>
      )}

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

      {/* Tips para vos — recomendaciones cortas según lo que ya sabemos de vos */}
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Tips para vos</p>
        {tips.map((t) => (
          <button
            key={t.texto}
            type="button"
            onClick={() => navigate(t.to)}
            className="w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3.5 transition-all duration-100 active:scale-[0.99]"
            style={{ background: COLORS.goldSoft }}
          >
            <span className="text-lg shrink-0">{t.icon}</span>
            <span className="flex-1 text-[13px] font-medium" style={{ color: COLORS.ink }}>{t.texto}</span>
          </button>
        ))}
      </div>

      {/* Tu grupo — debajo del dashboard, no mezclado con los accesos de arriba */}
      {grupo ? (
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/grupos')}
          className="text-left bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)] flex flex-col gap-2.5 transition-transform duration-100 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <p className="font-bold text-[14.5px]" style={{ color: COLORS.ink }}>👥 {grupo.nombre}</p>
            <span className="text-[12px] font-semibold" style={{ color: COLORS.brand }}>Ver todo →</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {topGrupo.map((m, i) => (
              <div key={m.nombre} className="flex items-center gap-2 text-[13px]">
                <span className="w-5 text-center shrink-0">{MEDALLAS[i]}</span>
                <span className="flex-1 truncate" style={{ color: m.sosVos ? COLORS.brand : COLORS.ink, fontWeight: m.sosVos ? 700 : 500 }}>
                  {m.nombre}{m.sosVos ? ' (vos)' : ''}
                </span>
                <span style={{ color: COLORS.inkSoft }}>{m.actividad}</span>
              </div>
            ))}
          </div>
        </button>
      ) : (
        <ActionRow
          icon={<span className="text-lg">👥</span>}
          label="Armá un grupo con amigas"
          onClick={() => navigate('/onboarding-v2/grupos')}
        />
      )}
    </div>
  );
}
