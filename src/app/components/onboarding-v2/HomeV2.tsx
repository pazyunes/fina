import { useState } from 'react';
import { useNavigate } from 'react-router';
import { COLORS, Face, formatThousands, fmtMoney, loadV2Categorias, loadV2Foto, loadV2GastosState, loadV2Grupo, loadV2InversionesPerfil, loadV2InversionesState, loadV2Nombre, loadV2ObjetivosIniciales, loadV2ObjetivosState, loadV2Reserva, parseMoneyInput, saludoDelDia, saveV2Reserva } from './shared';

const MEDALLAS = ['🥇', '🥈', '🥉'];

type Tip = { icon: string; texto: string; to: string };

// "Tu próximo paso" — el hilo estilo Duolingo: una sola acción, la más útil
// según en qué punto está la persona. Da coherencia al dashboard sin
// despojarlo: es la tarjeta que lidera, y el resto queda como estaba.
type EstadoPaso = { gastos: { ts?: number }[]; topes: Record<string, unknown> };
type ObjPaso = { nombre: string; montoTotal: number; montoModo: string | null; contribuciones: { monto: number }[] };
function proximoPaso(): { titulo: string; msg: string; cta: string; to: string } {
  const g = loadV2GastosState<EstadoPaso>();
  const objetivos = loadV2ObjetivosState<ObjPaso[]>() ?? [];
  const invPerfil = loadV2InversionesPerfil();
  if (!g || g.gastos.length === 0) {
    return { titulo: 'Registrá tu primer gasto', msg: 'Con eso ya te armamos tus secciones y tu análisis solo.', cta: 'Registrar un gasto', to: '/onboarding-v2/gastos' };
  }
  const objIncompleto = objetivos.find((o) => o.montoModo === null || (o.montoModo !== 'desconocido' && !(o.montoTotal > 0)));
  if (objIncompleto) {
    return { titulo: `Completá “${objIncompleto.nombre}”`, msg: 'Ponéle un monto para empezar a ver tu progreso.', cta: 'Completar objetivo', to: '/onboarding-v2/objetivos' };
  }
  const objCerca = objetivos.find((o) => {
    const s = o.contribuciones.reduce((a, c) => a + c.monto, 0);
    return o.montoTotal > 0 && s / o.montoTotal >= 0.7 && s < o.montoTotal;
  });
  if (objCerca) {
    return { titulo: `¡Estás cerca de “${objCerca.nombre}”!`, msg: 'Sumá lo último que separaste y llegás.', cta: 'Ver mi objetivo', to: '/onboarding-v2/objetivos' };
  }
  if (!invPerfil) {
    return { titulo: 'Descubrí cómo invertir tu plata', msg: 'Armá tu perfil y te decimos qué te conviene según vos.', cta: 'Armar mi perfil inversor', to: '/onboarding-v2/inversiones' };
  }
  return { titulo: '¡Venís al día!', msg: 'Registrá lo de hoy para no cortar la racha.', cta: 'Registrar un gasto', to: '/onboarding-v2/gastos' };
}

// Racha: días consecutivos (terminando hoy) con al menos un gasto.
function rachaDeGastos(): number {
  const g = loadV2GastosState<{ gastos: { ts?: number }[] }>();
  if (!g) return 0;
  const dias = new Set(g.gastos.filter((x) => x.ts).map((x) => new Date(x.ts as number).toDateString()));
  let s = 0;
  const d = new Date();
  while (dias.has(d.toDateString())) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

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
  return tips.slice(0, 1);
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
export function HomeV2() {
  const navigate = useNavigate();
  const nombre = loadV2Nombre();
  const foto = loadV2Foto();
  const grupo = loadV2Grupo();
  const topGrupo = grupo ? [...grupo.miembros].sort((a, b) => b.actividad - a.actividad).slice(0, 3) : [];
  const tips = tipsPara();
  const b = datosBienestar();
  const paso = proximoPaso();
  const racha = rachaDeGastos();

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

  // Un solo lugar por sección: cada tarjeta muestra su dato y lleva a su
  // pantalla (fusiona los viejos "accesos" + "bienestar" + "Mis análisis").
  const secciones = [
    { icon: '💸', label: 'Gastos', to: '/onboarding-v2/gastos', soft: COLORS.coralSoft, accent: COLORS.coral, metric: b.gastosPct !== null ? b.gastosTexto : 'Registrá para ver tu resumen' },
    { icon: '🎯', label: 'Objetivos', to: '/onboarding-v2/objetivos', soft: COLORS.goldSoft, accent: COLORS.gold, metric: b.objetivosPct !== null ? `${b.objetivosPct}% de progreso` : 'Ponéle un monto a un objetivo' },
    { icon: '🌱', label: 'Inversiones', to: '/onboarding-v2/inversiones', soft: COLORS.greenSoft, accent: COLORS.green, metric: b.inversionPct !== null ? b.inversionTexto : 'Sumá tu primer aporte' },
  ];

  return (
    <div className="px-[22px] pt-8 pb-4 flex flex-col gap-6 lg:max-w-2xl lg:mx-auto lg:pt-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/perfil')}
          className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-[0_2px_10px_rgba(31,27,46,0.08)] transition-transform duration-100 active:scale-95"
          aria-label="Ver tu perfil"
        >
          {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Face color={COLORS.brand} size={48} mood="happy" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>{saludoDelDia()}{nombre ? `, ${nombre}` : ''}</p>
          <p className="text-[19px] font-bold leading-tight" style={{ color: COLORS.ink }}>Tu FINA</p>
        </div>
        {/* Racha 🔥 — hábito estilo Duolingo */}
        <div className="flex flex-col items-center shrink-0 rounded-2xl px-3 py-1.5" style={{ background: COLORS.brandSoft }}>
          <span className="text-[15px] font-bold leading-none" style={{ color: COLORS.brandDark }}>🔥 {racha}</span>
          <span className="text-[9.5px] font-semibold" style={{ color: COLORS.brand }}>{racha === 1 ? 'día' : 'días'}</span>
        </div>
      </div>

      {/* Tu próximo paso — HERO de color: el foco de la pantalla, no una caja más */}
      <div className="rounded-[26px] p-5 flex flex-col gap-4" style={{ background: COLORS.brand }}>
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl" style={{ background: 'rgba(255,255,255,0.18)' }}>✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.75)' }}>Tu próximo paso</p>
            <p className="font-bold text-[17px] leading-tight text-white">{paso.titulo}</p>
            <p className="text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>{paso.msg}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(paso.to)}
          className="w-full rounded-2xl py-3.5 text-[15px] font-bold transition-transform duration-100 active:scale-[0.99]"
          style={{ background: '#fff', color: COLORS.brand }}
        >
          {paso.cta}
        </button>
      </div>

      {/* Reservas + Completá tu perfil — lista PLANA (sin caja individual),
          filas apoyadas sobre el fondo y separadas por una línea fina. */}
      <div className="flex flex-col">
        <div className="flex items-center gap-3 py-3">
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
          <div className="pb-3 flex gap-2">
            <input
              autoFocus
              className="flex-1 min-w-0 border border-[rgba(31,27,46,0.16)] rounded-xl px-3 py-2 text-[13.5px] outline-none focus:border-[#7626B3] transition-colors"
              placeholder="¿Cuánto querés reservar?"
              inputMode="numeric"
              value={reservaVal}
              onChange={(e) => setReservaVal(formatThousands(e.target.value))}
            />
            <button type="button" onClick={guardarReserva} className="rounded-xl px-3.5 text-[12.5px] font-bold text-white transition-all duration-100 active:scale-95 shrink-0" style={{ background: COLORS.brand }}>
              Guardar
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/perfil')}
          className="flex items-center gap-3 py-3 text-left border-t"
          style={{ borderColor: COLORS.line }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brandSoft }}>📝</span>
          <span className="flex-1 text-[14.5px] font-semibold" style={{ color: COLORS.ink }}>Completá tu perfil</span>
          <span className="shrink-0 font-bold" style={{ color: COLORS.brand }}>→</span>
        </button>
      </div>

      {/* 3 secciones — fichas con color (una por sección): dato + acceso */}
      <div className="flex flex-col gap-3">
        {secciones.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => navigate(s.to)}
            className="flex items-center gap-3.5 text-left rounded-2xl p-4 transition-all duration-100 active:scale-[0.98]"
            style={{ background: s.soft }}
          >
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-lg bg-white/70">{s.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-[15px]" style={{ color: COLORS.ink }}>{s.label}</span>
              <span className="block text-[12.5px] leading-snug" style={{ color: COLORS.inkSoft }}>{s.metric}</span>
            </span>
            <span className="shrink-0 font-bold text-[18px]" style={{ color: s.accent }}>→</span>
          </button>
        ))}
      </div>

      {/* Mis competencias — ranking del grupo. Empieza simple: el nombre del
          grupo con una franja de color arriba y el ranking de actividad. */}
      <div className="flex flex-col gap-2 lg:col-span-1">
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
      <div className="flex flex-col gap-2 lg:col-span-3">
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
