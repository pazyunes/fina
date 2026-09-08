import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Celebracion, COLORS, EstadoConfianza, FONTS, Fila, Monto, Titulo, TituloSeccion, formatThousands, loadV2Categorias, loadV2Foto, loadV2GastosState, loadV2Grupo, loadV2InversionesPerfil, loadV2InversionesState, loadV2Nombre, loadV2ObjetivosIniciales, loadV2ObjetivosState, loadV2Reserva, parseMoneyInput, saludoDelDia, saveV2Reserva } from './shared';
import { IconChevron, IconFuego, IconGastos, IconGrupo, IconIdea, IconInversiones, IconObjetivos, IconPerfil, IconReserva, IconSparkle } from './FinaIcons';
import type { ComponentType } from 'react';

type Tip = { texto: string; to: string };

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
    tips.push({ texto: 'Registrá tu primer gasto y armamos tus secciones solas, a partir de eso.', to: '/onboarding-v2/gastos' });
  }
  if (loadV2ObjetivosIniciales().length > 0) {
    tips.push({ texto: 'Tenés objetivos anotados del onboarding — ponéles un monto para ver el progreso.', to: '/onboarding-v2/objetivos' });
  }
  if (loadV2InversionesPerfil()) {
    tips.push({ texto: 'Ya nos contaste algo de tu perfil inversor — terminalo en Inversiones para ver recomendaciones.', to: '/onboarding-v2/inversiones' });
  }
  if (tips.length === 0) {
    tips.push({ texto: 'Explorá Gastos, Objetivos e Inversiones — cuanto más uses FINA, más te vamos a poder ayudar.', to: '/onboarding-v2/gastos' });
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
  const [celebrarReserva, setCelebrarReserva] = useState(false);
  function guardarReserva() {
    const n = parseMoneyInput(reservaVal);
    if (!n) return;
    const nuevo = reserva + n;
    setReserva(nuevo);
    saveV2Reserva(nuevo);
    setReservaVal('');
    setReservaOpen(false);
    setCelebrarReserva(true);
    setTimeout(() => setCelebrarReserva(false), 800);
  }

  // Un solo lugar por sección: cada fila muestra su dato y lleva a su pantalla.
  // Ya no llevan color propio — el color por sección era otra forma de decir
  // "esto es una caja distinta", y con tintes de 1.1 de contraste no decía nada.
  const secciones: { Icon: ComponentType<{ size?: number }>; label: string; to: string; metric: string }[] = [
    { Icon: IconGastos, label: 'Gastos', to: '/onboarding-v2/gastos', metric: b.gastosPct !== null ? `${b.gastosPct}% en tope` : 'Registrá el primero' },
    { Icon: IconObjetivos, label: 'Objetivos', to: '/onboarding-v2/objetivos', metric: b.objetivosPct !== null ? `${b.objetivosPct}% de avance` : 'Sumá uno' },
    { Icon: IconInversiones, label: 'Inversiones', to: '/onboarding-v2/inversiones', metric: b.inversionPct !== null ? 'Al día' : 'Empezá' },
  ];

  return (
    // DIRECCIÓN C — Home des-encajonado. Antes casi todo elemento vivía dentro
    // de su propio contenedor redondeado y tintado: banda lila, fila, divisor,
    // fila, tres fichas de color, otra caja. Como los tintes estaban todos
    // entre 1.07 y 1.24 de contraste, ninguna de esas cajas separaba nada —
    // solo sumaban contornos. Ahora el contenido se apoya directo sobre el
    // papel y se separa por aire y por hairline; la ÚNICA tarjeta elevada de
    // toda la app es "tu próximo paso", que es lo que de verdad tiene prioridad.
    <div className="px-6 pt-8 pb-4 flex flex-col gap-8 lg:max-w-2xl lg:mx-auto lg:pt-10">

      {/* Saludo. El nombre pasa a ser el título de la pantalla, en Baloo 2:
          antes decía "Tu FINA" en 19px y el nombre iba arriba en gris chico,
          o sea que lo genérico pesaba más que lo personal. */}
      <header className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/perfil')}
          className="v2-focus w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center transition-transform duration-100 active:scale-95"
          style={foto ? undefined : { background: COLORS.brandSoft, color: COLORS.brand }}
          aria-label="Ver tu perfil"
        >
          {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <IconPerfil size={22} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>{saludoDelDia()}</p>
          <Titulo className="!text-[26px] lg:!text-[30px] truncate">{nombre || 'Tu FINA'}</Titulo>
        </div>
        {/* Racha. Con 0 días todavía no es un dato: se muestra tenue como
            invitación (por-descubrir), no como un cero que parece un error. */}
        {racha > 0 ? (
          <div className="flex flex-col items-center shrink-0" style={{ color: COLORS.brand }}>
            <span className="flex items-center gap-1 text-[20px] font-bold leading-none"><IconFuego size={16} /> <span className="font-mono tabular-nums">{racha}</span></span>
            <span className="text-[12px] font-semibold" style={{ color: COLORS.inkSoft }}>{racha === 1 ? 'día' : 'días'}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center shrink-0" style={{ color: COLORS.inkFaint }} aria-label="Todavía no arrancaste tu racha">
            <IconFuego size={16} />
            <span className="text-[12px] font-semibold leading-none mt-1">Racha</span>
          </div>
        )}
      </header>

      {/* LA tarjeta elevada de la app. Es la única, y por eso funciona: cuando
          todo era tarjeta, ser tarjeta no significaba nada. */}
      <section
        className="rounded-[22px] p-5 flex flex-col gap-4"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, boxShadow: '0 2px 14px rgba(43,33,24,0.06)' }}
      >
        <div className="flex items-start gap-3.5">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brand }}><IconSparkle size={22} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: COLORS.brand, fontFamily: FONTS.mono }}>Tu próximo paso</p>
            <p className="font-bold text-[20px] leading-tight mt-1" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{paso.titulo}</p>
            <p className="text-[15px] leading-snug mt-1" style={{ color: COLORS.inkSoft }}>{paso.msg}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(paso.to)}
          className="v2-focus w-full rounded-2xl py-3.5 text-[18px] font-bold transition-transform duration-100 active:scale-[0.99]"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          {paso.cta}
        </button>
      </section>

      {/* Tus secciones. Eran tres fichas tintadas en grilla; los tres tintes
          estaban a 1.1 del fondo, así que las fichas se leían como un bloque
          gris único. Como filas, el nombre y el dato de cada una se leen. */}
      <section className="flex flex-col gap-2">
        <TituloSeccion>Tus secciones</TituloSeccion>
        <div className="flex flex-col">
          {secciones.map((s) => (
            <Fila
              key={s.label}
              icon={<s.Icon size={18} />}
              label={s.label}
              valor={s.metric}
              onClick={() => navigate(s.to)}
            />
          ))}
        </div>
      </section>

      {/* Reservas + perfil */}
      <section className="flex flex-col gap-2">
        <TituloSeccion>Tu plata guardada</TituloSeccion>
        <div className="flex flex-col">
          <div className="relative flex items-center gap-3 min-h-[56px] py-3 border-b" style={{ borderColor: COLORS.line }}>
            <Celebracion show={celebrarReserva} />
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.starSoft, color: COLORS.starText }}><IconReserva size={18} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-semibold" style={{ color: COLORS.ink }}>Reservas</p>
              <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>
                {reserva > 0 ? <>Tenés <Monto value={reserva} className="text-[14px]" /> apartados</> : 'Apartá plata para no gastarla — tipo alcancía.'}
              </p>
              {/* La reserva la cargó la persona: dato declarado (§5.1). */}
              {reserva > 0 && <EstadoConfianza estado="declarado" className="mt-1" />}
            </div>
            <button type="button" onClick={() => setReservaOpen((o) => !o)} className="v2-focus flex items-center justify-center min-h-[44px] px-3 rounded-full text-[15px] font-bold shrink-0" style={{ color: COLORS.brand, border: `1.5px solid ${COLORS.brandSoft}` }}>
              {reserva > 0 ? 'Sumar' : 'Reservar'}
            </button>
          </div>
          {reservaOpen && (
            <div className="py-3 flex gap-2 border-b" style={{ borderColor: COLORS.line }}>
              <input
                autoFocus
                className="v2-focus flex-1 min-w-0 rounded-xl px-3 py-2 min-h-[44px] text-[16px] outline-none"
                style={{ border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink, background: COLORS.surface }}
                placeholder="¿Cuánto querés reservar?"
                inputMode="decimal"
                aria-label="Monto a reservar"
                value={reservaVal}
                onChange={(e) => setReservaVal(formatThousands(e.target.value))}
              />
              <button type="button" onClick={guardarReserva} className="v2-focus rounded-xl px-4 min-h-[44px] text-[15px] font-bold transition-all duration-100 active:scale-95 shrink-0" style={{ background: COLORS.brand, color: COLORS.surface }}>
                Guardar
              </button>
            </div>
          )}
          <Fila
            icon={<IconPerfil size={18} />}
            label="Completá tu perfil"
            onClick={() => navigate('/onboarding-v2/perfil')}
          />
        </div>
      </section>

      {/* Mis competencias */}
      <section className="flex flex-col gap-2">
        <TituloSeccion>Mis competencias</TituloSeccion>
        {grupo ? (
          <button
            type="button"
            onClick={() => navigate('/onboarding-v2/grupos')}
            className="v2-focus text-left flex flex-col gap-2.5 transition-transform duration-100 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-[16px] font-bold" style={{ color: COLORS.brand }}>
              <IconGrupo size={16} /> {grupo.nombre}
              <span className="ml-auto flex items-center gap-0.5 text-[14px] font-semibold">Ver todo <IconChevron size={13} /></span>
            </span>
            <span className="flex flex-col">
              {topGrupo.map((m, i) => (
                <span key={m.nombre} className="flex items-center gap-2.5 text-[15px] py-2 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 font-mono tabular-nums" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>{i + 1}</span>
                  <span className="flex-1 truncate" style={{ color: m.sosVos ? COLORS.brand : COLORS.ink, fontWeight: m.sosVos ? 700 : 500 }}>
                    {m.nombre}{m.sosVos ? ' (vos)' : ''}
                  </span>
                  <span className="font-mono tabular-nums" style={{ color: COLORS.inkSoft }}>{m.actividad}</span>
                </span>
              ))}
            </span>
          </button>
        ) : (
          <p className="text-[15px] leading-snug pl-3.5 border-l-2" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
            Todavía no tenés un grupo. Armá uno desde <strong style={{ color: COLORS.brandDark }}>Objetivos</strong> para competir con tus amigas y amigos.
          </p>
        )}
      </section>

      {/* Tips. Eran cajas amarillas apiladas — tres contenedores más. Ahora son
          filas con el ícono de idea al costado, separadas por hairline. */}
      {tips.length > 0 && (
        <section className="flex flex-col gap-2">
          <TituloSeccion>Tips para vos</TituloSeccion>
          <div className="flex flex-col">
            {tips.map((t) => (
              <button
                key={t.texto}
                type="button"
                onClick={() => navigate(t.to)}
                className="v2-focus w-full flex items-center gap-3 text-left min-h-[56px] py-3 border-b last:border-b-0 transition-all duration-100 active:scale-[0.99]"
                style={{ borderColor: COLORS.line }}
              >
                <span className="shrink-0" style={{ color: COLORS.starText }}><IconIdea size={20} /></span>
                <span className="flex-1 text-[15px] leading-snug" style={{ color: COLORS.ink }}>{t.texto}</span>
                <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={16} /></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
