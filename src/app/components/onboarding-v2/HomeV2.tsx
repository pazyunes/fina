import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionRow, COLORS, Face, formatThousands, fmtMoney, loadV2ArrancasOculto, loadV2Categorias, loadV2Foto, loadV2GastosState, loadV2Grupo, loadV2InversionesPerfil, loadV2InversionesState, loadV2Nombre, loadV2ObjetivosIniciales, loadV2ObjetivosState, loadV2PerfilOnboarding, loadV2Reserva, parseMoneyInput, saludoDelDia, saveV2ArrancasOculto, saveV2Reserva } from './shared';

const MEDALLAS = ['🥇', '🥈', '🥉'];

// Mensajes motivadores, no un "Control: Bastante" a secas — la idea es que
// se sienta un acompañamiento, no una planilla de datos sobre uno mismo.
const MENSAJES_POTENCIAL: Record<string, Record<string, string>> = {
  controlaGastos: {
    todo: '🔍 Tenés muy controlados tus gastos — seguí así.',
    bastante: '🔍 Ya controlás bastante bien tus gastos — vamos por más.',
    poco: '🔍 Vas controlando de a poco tus gastos — te lo hacemos más fácil.',
    nada: '🔍 Todavía no controlás mucho tus gastos — arrancamos juntas.',
  },
  ahorra: {
    todo: '🐷 Gran parte de tu plata ya va al ahorro — ¡buenísimo!',
    bastante: '🐷 Ya le destinás bastante al ahorro — vamos por más.',
    poco: '🐷 Estás arrancando a ahorrar — de a poco se llega lejos.',
    nada: '🐷 Todavía no ahorrás nada — es un buen momento para arrancar.',
  },
  invierte: {
    todo: '🌱 Gran parte de tu plata ya está invirtiendo — ¡que siga rindiendo!',
    bastante: '🌱 Ya invertís bastante — vamos por más.',
    poco: '🌱 Diste el primer paso invirtiendo — vamos por más.',
    nada: '🌱 Todavía no invertís nada — es un buen momento para arrancar.',
  },
};

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
//
// "Tu potencial" — a diferencia del anillo de bienestar (que solo aparece
// con USO real), esto se arma con lo que la persona ya contó en el
// onboarding (autopercepción de ahorro/inversión/control) y aparece desde
// el primer segundo — le da algo de valor apenas entra, sin esperar a que
// use la app.
// Los 3 accesos principales, ahora como 3 cuadraditos en una sola línea
// (ícono + nombre), en vez de 3 filas grandes.
const ACCESOS = [
  { icon: '💸', label: 'Gastos', to: '/onboarding-v2/gastos', color: COLORS.coral, soft: COLORS.coralSoft },
  { icon: '🎯', label: 'Objetivos', to: '/onboarding-v2/objetivos', color: COLORS.gold, soft: COLORS.goldSoft },
  { icon: '🌱', label: 'Inversiones', to: '/onboarding-v2/inversiones', color: COLORS.green, soft: COLORS.greenSoft },
];

// Una tarjeta chica de "Mis análisis" — arranca simple: un título, un dato
// grande (si ya hay datos reales) y una barrita del color de la sección.
function AnalisisCard({ titulo, valor, sub, color }: { titulo: string; valor: string; sub: string; color: string }) {
  return (
    <div className="w-[168px] shrink-0 bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)] flex flex-col gap-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>{titulo}</p>
      <p className="text-[24px] font-bold leading-none" style={{ color }}>{valor}</p>
      <p className="text-[11.5px] leading-snug" style={{ color: COLORS.inkSoft }}>{sub}</p>
      <div className="h-1.5 rounded-full mt-1" style={{ background: color, opacity: 0.25 }} />
    </div>
  );
}

export function HomeV2() {
  const navigate = useNavigate();
  const nombre = loadV2Nombre();
  const foto = loadV2Foto();
  const grupo = loadV2Grupo();
  const topGrupo = grupo ? [...grupo.miembros].sort((a, b) => b.actividad - a.actividad).slice(0, 3) : [];
  const tips = tipsPara();
  const b = datosBienestar();
  const hayBienestar = b.gastosPct !== null || b.objetivosPct !== null || b.inversionPct !== null;
  const perfil = loadV2PerfilOnboarding();
  const potencial = perfil
    ? (['controlaGastos', 'ahorra', 'invierte'] as const)
        .map((key) => (perfil[key] ? MENSAJES_POTENCIAL[key]?.[perfil[key] as string] : null))
        .filter((m): m is string => !!m)
    : [];

  // Reserva ("alcancía") — se movió acá desde Gastos.
  const [reserva, setReserva] = useState(() => loadV2Reserva());
  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaVal, setReservaVal] = useState('');
  function guardarReserva() {
    const n = parseMoneyInput(reservaVal);
    if (!n) return;
    const nuevo = reserva + n;
    setReserva(nuevo);
    saveV2Reserva(nuevo);
    setReservaVal('');
    setReservaOpen(false);
  }

  // Cartel "Así arrancás" — se puede cerrar con la X.
  const [arrancasOculto, setArrancasOculto] = useState(() => loadV2ArrancasOculto());

  // "Mis análisis" — tarjetas simples con lo que ya hay de datos reales.
  const analisis = [
    { titulo: 'Gastos', valor: b.gastosPct !== null ? `${b.gastosPct}%` : '—', sub: b.gastosTexto || 'Poné topes en Gastos para ver este análisis.', color: COLORS.coral },
    { titulo: 'Objetivos', valor: b.objetivosPct !== null ? `${b.objetivosPct}%` : '—', sub: b.objetivosTexto || 'Cargá un objetivo con monto para ver el progreso.', color: COLORS.gold },
    { titulo: 'Inversiones', valor: b.inversionPct !== null ? (b.inversionPct >= 100 ? '✓' : '~') : '—', sub: b.inversionTexto || 'Sumá un aporte en Inversiones para ver este análisis.', color: COLORS.green },
  ];

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

      {/* Reservas (alcancía) — movida acá desde Gastos, arriba de todo,
          debajo del bienestar. Es plata que apartás para no gastarla. */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)]">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.goldSoft }}>🔒</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-semibold" style={{ color: COLORS.ink }}>Reservas</p>
            <p className="text-[11.5px]" style={{ color: COLORS.inkSoft }}>{reserva > 0 ? `Tenés ${fmtMoney(reserva)} apartados` : 'Apartá plata para no gastarla — tipo alcancía.'}</p>
          </div>
          <button type="button" onClick={() => setReservaOpen((o) => !o)} className="text-[13px] font-semibold underline shrink-0" style={{ color: COLORS.brand }}>
            {reserva > 0 ? 'Sumar' : 'Reservar'}
          </button>
        </div>
        {reservaOpen && (
          <div className="mt-3 pt-3 border-t border-dashed flex gap-2" style={{ borderColor: 'rgba(31,27,46,0.14)' }}>
            <input
              autoFocus
              className="flex-1 border border-[rgba(31,27,46,0.16)] rounded-xl px-3 py-2 text-[13.5px] outline-none focus:border-[#7626B3] transition-colors"
              placeholder="¿Cuánto querés reservar?"
              inputMode="numeric"
              value={reservaVal}
              onChange={(e) => setReservaVal(formatThousands(e.target.value))}
            />
            <button type="button" onClick={guardarReserva} className="rounded-xl px-3.5 text-[12.5px] font-bold text-white transition-all duration-100 active:scale-95" style={{ background: COLORS.brand }}>
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Así arrancás — mensajes motivadores con lo del onboarding. Card más
          chica y con una X para cerrarla (no vuelve a aparecer). */}
      {potencial.length > 0 && !arrancasOculto && (
        <div className="rounded-2xl px-3.5 py-2.5 flex items-start gap-2.5" style={{ background: COLORS.brandSoft }}>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.brandDark }}>Así arrancás en FINA</p>
            {potencial.map((m) => (
              <p key={m} className="text-[12px] font-medium leading-snug" style={{ color: COLORS.ink }}>{m}</p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setArrancasOculto(true); saveV2ArrancasOculto(); }}
            aria-label="Cerrar"
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px] transition-all duration-100 active:scale-90"
            style={{ background: 'rgba(255,255,255,0.7)', color: COLORS.inkSoft }}
          >
            ✕
          </button>
        </div>
      )}

      <ActionRow
        icon={<span className="text-lg">📝</span>}
        label="Completá tu perfil"
        onClick={() => navigate('/onboarding-v2/perfil')}
      />

      {/* 3 accesos como cuadraditos en una línea */}
      <div className="grid grid-cols-3 gap-3">
        {ACCESOS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => navigate(a.to)}
            className="flex flex-col items-center gap-2 bg-white rounded-2xl py-4 px-2 shadow-[0_2px_18px_rgba(31,27,46,0.07)] transition-all duration-100 active:scale-[0.97]"
          >
            <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: a.soft }}>
              <span className="text-xl">{a.icon}</span>
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Mis análisis — carrusel horizontal de visualizaciones (simple) */}
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Mis análisis</p>
        <div className="flex gap-3 overflow-x-auto -mx-[22px] px-[22px] pb-1" style={{ scrollbarWidth: 'none' }}>
          {analisis.map((a) => (
            <AnalisisCard key={a.titulo} titulo={a.titulo} valor={a.valor} sub={a.sub} color={a.color} />
          ))}
        </div>
      </div>

      {/* Mis competencias — ranking del grupo. Empieza simple: el nombre del
          grupo con una franja de color arriba y el ranking de actividad. */}
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Mis competencias</p>
        {grupo ? (
          <button
            type="button"
            onClick={() => navigate('/onboarding-v2/grupos')}
            className="text-left bg-white rounded-2xl overflow-hidden shadow-[0_2px_18px_rgba(31,27,46,0.07)] transition-transform duration-100 active:scale-[0.99]"
          >
            <div className="px-4 py-2 flex items-center justify-between" style={{ background: COLORS.brand }}>
              <p className="font-bold text-[13.5px] text-white truncate">👥 {grupo.nombre}</p>
              <span className="text-[11.5px] font-semibold text-white/90 shrink-0">Ver todo →</span>
            </div>
            <div className="p-4 flex flex-col gap-1.5">
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
          <div className="rounded-2xl px-4 py-3.5 text-[12.5px]" style={{ background: COLORS.tint, color: COLORS.inkSoft }}>
            Todavía no tenés un grupo. Armá uno desde <strong style={{ color: COLORS.brand }}>Objetivos</strong> para competir con tus amigas y amigos.
          </div>
        )}
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
    </div>
  );
}
