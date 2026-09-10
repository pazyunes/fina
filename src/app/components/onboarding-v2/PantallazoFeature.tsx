import { COLORS, FONTS, fmtMoney } from './shared';
import { IconObjetivos, IconInversiones, IconReserva, IconGastos } from './FinaIcons';

// El pantallazo de la pantalla intermedia del onboarding.
//
// POR QUÉ. Antes esa pantalla mostraba tres tarjetas con un título y una
// frase: "Objetivos — tu meta con su progreso". Contaba la feature, no la
// mostraba. Y estaba justo en el punto del flujo donde hay que dar una razón
// para seguir contestando cinco preguntas más.
//
// Ahora muestra LA feature de lo que la persona dijo que quiere lograr, con
// datos de ejemplo, para que vea de qué se trata antes de tener datos propios.
//
// Los números son de EJEMPLO y se dice. Un pantallazo que parece el estado
// real de tu plata, cuando todavía no cargaste nada, es una mentira chica que
// se descubre en el primer segundo adentro.

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}
    >
      {children}
    </div>
  );
}

function Encabezado({ icono, texto }: { icono: React.ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brand }}>
        {icono}
      </span>
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>
        {texto}
      </span>
    </div>
  );
}

// ── Objetivos: la barra de progreso, que es la feature ──────────────────
function PantallazoObjetivo({ nombre }: { nombre: string }) {
  const total = 1200000;
  const juntado = 780000;
  const pct = Math.round((juntado / total) * 100);
  return (
    <Marco>
      <Encabezado icono={<IconObjetivos size={15} />} texto="Tu objetivo" />
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[19px] font-bold truncate" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{nombre}</span>
          <span className="text-[19px] font-bold shrink-0 tabular-nums" style={{ color: COLORS.limaText, fontFamily: FONTS.mono }}>{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS.lima }} />
        </div>
        <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>
          Llevás <span className="font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtMoney(juntado)}</span> de{' '}
          <span className="tabular-nums">{fmtMoney(total)}</span> — te falta{' '}
          <span className="font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtMoney(total - juntado)}</span>.
        </p>
      </div>
    </Marco>
  );
}

// ── Ahorro: la reserva creciendo mes a mes ──────────────────────────────
function PantallazoAhorro() {
  const meses = [
    { mes: 'may', monto: 40 },
    { mes: 'jun', monto: 55 },
    { mes: 'jul', monto: 52 },
    { mes: 'ago', monto: 78 },
    { mes: 'sep', monto: 100 },
  ];
  return (
    <Marco>
      <Encabezado icono={<IconReserva size={15} />} texto="Tu reserva" />
      <div className="flex flex-col gap-2">
        <span className="text-[26px] font-bold tabular-nums" style={{ color: COLORS.ink, fontFamily: FONTS.mono }}>
          {fmtMoney(325000)}
        </span>
        {/* Columnas, no una línea: cinco meses en 300px de ancho se leen mejor
            como barras — cada mes es un bloque que se puede comparar de un
            golpe, sin seguir una curva. */}
        <div className="flex items-end gap-1.5 h-[68px]">
          {meses.map((m) => (
            <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className="w-full rounded-t-md"
                style={{ height: `${m.monto}%`, background: m.monto === 100 ? COLORS.lima : COLORS.limaSoft }}
              />
              <span className="text-[11px]" style={{ color: COLORS.inkFaint, fontFamily: FONTS.mono }}>{m.mes}</span>
            </div>
          ))}
        </div>
        <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>
          Apartás plata y la ves crecer. Sin tocarla, sin tentarte.
        </p>
      </div>
    </Marco>
  );
}

// ── Inversiones: la simulación, que es la feature más fuerte ────────────
function PantallazoInversiones() {
  // Dos curvas: lo que ponés (recta) y lo que rinde (creciente). Es la forma
  // de la simulación real, simplificada a cinco puntos.
  const aportado = [0, 25, 50, 75, 100];
  const rendido = [0, 30, 62, 100, 148];
  const alto = 64;
  const ancho = 260;
  const maxY = 148;
  const puntos = (serie: number[]) =>
    serie
      .map((v, i) => `${(i / (serie.length - 1)) * ancho},${alto - (v / maxY) * alto}`)
      .join(' ');

  return (
    <Marco>
      <Encabezado icono={<IconInversiones size={15} />} texto="Tu simulación" />
      <div className="flex flex-col gap-2">
        <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" style={{ height: alto }} aria-hidden>
          <polyline points={puntos(aportado)} fill="none" stroke={COLORS.line} strokeWidth="2.5" strokeDasharray="4 4" />
          <polyline points={puntos(rendido)} fill="none" stroke={COLORS.brand} strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[13px] flex items-center gap-1.5" style={{ color: COLORS.inkSoft }}>
            <span className="w-3 h-[3px] rounded-full" style={{ background: COLORS.brand }} /> Con rendimiento
          </span>
          <span className="text-[13px] flex items-center gap-1.5" style={{ color: COLORS.inkSoft }}>
            <span className="w-3 h-[3px] rounded-full" style={{ background: COLORS.line }} /> Lo que pusiste
          </span>
        </div>
        <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>
          Te mostramos cuánto podría rendir tu plata según tu perfil, y con qué
          instrumento — nunca la movemos nosotros.
        </p>
      </div>
    </Marco>
  );
}

// ── Sin rumbo claro: en qué se te va la plata ───────────────────────────
function PantallazoGastos() {
  const filas = [
    { label: 'Delivery', pct: 100, color: COLORS.brand },
    { label: 'Supermercado', pct: 72, color: COLORS.lila },
    { label: 'Transporte', pct: 41, color: COLORS.star },
  ];
  return (
    <Marco>
      <Encabezado icono={<IconGastos size={15} />} texto="En qué se te va" />
      <div className="flex flex-col gap-2.5">
        {filas.map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>{f.label}</span>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
              <div className="h-full rounded-full" style={{ width: `${f.pct}%`, background: f.color }} />
            </div>
          </div>
        ))}
        <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>
          Con lo que registrás armamos esto solo. Sin planillas.
        </p>
      </div>
    </Marco>
  );
}

/**
 * El pantallazo que corresponde a lo que la persona dijo que quiere lograr.
 * `nombreObjetivo` es el objetivo que definió, si definió uno.
 */
export function PantallazoFeature({ meta, nombreObjetivo }: { meta: string | null; nombreObjetivo?: string }) {
  if (meta === 'objetivo') return <PantallazoObjetivo nombre={nombreObjetivo?.trim() || 'Viaje a Brasil'} />;
  if (meta === 'invertir') return <PantallazoInversiones />;
  if (meta === 'ahorrar') return <PantallazoAhorro />;
  return <PantallazoGastos />;
}
