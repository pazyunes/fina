import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { Fini } from './Fini';
import { MisVisualizaciones } from './MisVisualizaciones';
import { useNavigate } from 'react-router';
import { Celebracion, COLORS, consumirFiniAterriza, EstadoConfianza, FONTS, Fila, Monto, Titulo, TituloSeccion, fechaDisplay, formatThousands, loadV2Foto, loadV2Grupo, loadV2Nombre, loadV2Reserva, parseMoneyInput, saludoDelDia, saveV2Reserva, vistaGastos, vistaInversiones, vistaObjetivos } from './shared';
import { IconChevron, IconFuego, IconGastos, IconGrupo, IconInversiones, IconObjetivos, IconPerfil, IconReserva } from './FinaIcons';
import { usePasoDelDia } from '../../api/v2/PasoDelDiaProvider';
import { pasoPorClave } from '../../api/v2/pasos';
import { WHATSAPP_URL } from '../WhatsAppFab';


// El paso del día y la racha salen de PasoDelDiaProvider (api/v2). Antes Home
// calculaba los dos acá: el "próximo paso" era siempre el mismo hasta hacerlo,
// y la racha contaba días con gastos. Ahora toca un paso distinto cada día, y
// la racha cuenta los días en que se cumplió.

// ── Anillo de bienestar financiero (estilo Headspace/Apple Watch) ──────
// Le da un lugar visual a "Cuidá tu bienestar financiero" del checklist
// del onboarding. Cada arco solo se calcula con datos reales — si una
// sección todavía no tiene nada que decir, ese arco directamente no se
// dibuja (no es "0% = mal", es "todavía no hay nada que mostrar acá"), y
// si NINGÚN arco tiene datos, el anillo entero no aparece: en una pantalla
// de celular, no vale la pena el espacio de algo que no dice nada todavía.
function datosBienestar() {
  const g = vistaGastos();
  const objetivos = vistaObjetivos();
  const inv = vistaInversiones();

  let gastosPct: number | null = null;
  let gastosTexto = '';
  {
    // Un tope es POR PERÍODO: "$25.000 por mes" se compara contra lo gastado
    // este mes, no contra todo el historial. Antes se sumaba todo, así que a
    // los pocos meses cualquier sección quedaba excedida para siempre y el
    // indicador se clavaba en 0%.
    const inicioDe = (periodo: 'semana' | 'mes') => {
      const d = new Date();
      if (periodo === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const dia = (d.getDay() + 6) % 7; // lunes = 0
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dia).getTime();
    };
    const conTope = g.categorias.filter((c) => g.topes[c.id]);
    if (conTope.length > 0) {
      const dentro = conTope.filter((c) => {
        const tope = g.topes[c.id];
        const desde = inicioDe(tope.periodo);
        // En pesos: el tope está en pesos, así que un gasto en dólares tiene
        // que compararse por su equivalente y no por el número que se tipeó.
        const gastado = g.gastos
          .filter((x) => x.categoriaId === c.id && (x.ts ?? 0) >= desde)
          .reduce((s, x) => s + x.montoArs, 0);
        return gastado <= tope.monto;
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
  if (inv.aportes.length > 0) {
    const ahora = new Date();
    const esteMes = inv.aportes.some((a) => {
      const d = new Date(a.ts);
      return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    });
    inversionPct = esteMes ? 100 : 35;
    inversionTexto = esteMes ? 'Aportaste a tus inversiones este mes' : 'Hace tiempo que no le sumás a tus inversiones';
  }

  // `gastosPct` es null por DOS motivos distintos, y la etiqueta de Home los
  // confundía: decía "Registrá el primero" a quien ya tenía cuatro gastos
  // cargados pero ninguna sección con tope. Lo que le falta es el tope, no el
  // gasto.
  const gastosFalta: 'gasto' | 'tope' | null =
    gastosPct !== null ? null : (g.gastos.length === 0 ? 'gasto' : 'tope');

  return { gastosPct, gastosTexto, gastosFalta, objetivosPct, objetivosTexto, inversionPct, inversionTexto };
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
  const b = datosBienestar();
  const { paso, cumplido, racha } = usePasoDelDia();
  const [rachaAbierta, setRachaAbierta] = useState(false);

  // Reserva ("alcancía") — se movió acá desde Gastos.
  // PRUEBA — "Fini aterriza en el avatar", estilo Netflix. La animación la
  // hace Home y no el onboarding, porque el destino es ESTE avatar y solo acá
  // se puede medir dónde cae de verdad: en desktop el sidebar mide 240px y el
  // contenido va centrado, así que cualquier coordenada calculada desde la
  // pantalla anterior erraba.
  const avatarRef = useRef<HTMLButtonElement>(null);
  const [aterrizando, setAterrizando] = useState(false);
  const [vuelo, setVuelo] = useState<{ left: number; top: number; lado: number; dx: number; dy: number; escala: number } | null>(null);

  useEffect(() => {
    if (!consumirFiniAterriza()) return;
    const el = avatarRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const desde = 190; // tamaño de salida, parecido al de la pantalla final
    setVuelo({
      left: r.left,
      top: r.top,
      lado: r.width,
      // Se arranca en el centro de la pantalla y se termina exactamente sobre
      // el avatar, así el aterrizaje calza al pixel en cualquier viewport.
      dx: window.innerWidth / 2 - (r.left + r.width / 2),
      dy: window.innerHeight / 2 - (r.top + r.height / 2),
      escala: desde / r.width,
    });
    setAterrizando(true);
  }, []);

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
    { Icon: IconGastos, label: 'Gastos', to: '/onboarding-v2/gastos', metric: b.gastosPct !== null ? `${b.gastosPct}% en tope` : (b.gastosFalta === 'gasto' ? 'Registrá el primero' : 'Ponéle un tope') },
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
      {/* Fini aterrizando en el avatar. Sale del centro en grande y termina
          justo sobre el avatar, en su tamaño. */}
      {aterrizando && vuelo && (
        <div
          className="fixed z-40 pointer-events-none v2-fini-aterriza"
          style={{
            left: vuelo.left,
            top: vuelo.top,
            width: vuelo.lado,
            height: vuelo.lado,
            ['--fini-dx' as string]: `${vuelo.dx}px`,
            ['--fini-dy' as string]: `${vuelo.dy}px`,
            ['--fini-k' as string]: String(vuelo.escala),
          }}
          onAnimationEnd={() => setAterrizando(false)}
          aria-hidden
        >
          <Fini state="idle" size="100%" />
        </div>
      )}

      {/* Saludo. El nombre pasa a ser el título de la pantalla, en Baloo 2:
          antes decía "Tu FINA" en 19px y el nombre iba arriba en gris chico,
          o sea que lo genérico pesaba más que lo personal. */}
      <header data-franja className="mb-2 flex items-center gap-3.5">
        <button
          type="button"
          ref={avatarRef}
          onClick={() => navigate('/onboarding-v2/perfil')}
          className="v2-focus w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center transition-transform duration-100 active:scale-95"
          style={foto ? undefined : { background: COLORS.starSoft }}
          aria-label="Ver tu perfil"
        >
          {foto
            ? <img src={foto} alt="" className="w-full h-full object-cover" />
            // Mientras Fini está volando el avatar va vacío, así no se ve dos
            // veces al mismo personaje.
            : <span style={{ opacity: aterrizando ? 0 : 1 }}><Fini state="idle" size={40} /></span>}
        </button>
        <div className="flex-1 min-w-0">
          {/* Saludo y nombre en una sola línea. "Tu FINA" era el fallback sin
              nombre y terminaba siendo lo que veías: genérico donde tendría
              que estar lo personal. */}
          <Titulo className="!text-[24px] lg:!text-[28px]">
            {saludoDelDia()}{nombre ? `, ${nombre}` : ''}
          </Titulo>
        </div>
        {/* Racha. Con 0 días todavía no es un dato: se muestra tenue como
            invitación (por-descubrir), no como un cero que parece un error. */}
        {racha.dias > 0 ? (
          <button
            type="button"
            onClick={() => setRachaAbierta((v) => !v)}
            aria-expanded={rachaAbierta}
            className="v2-focus flex flex-col items-center shrink-0 min-h-[44px] px-1 rounded-xl"
            style={{ color: COLORS.brand }}
          >
            <span className="flex items-center gap-1 text-[20px] font-bold leading-none"><IconFuego size={16} /> <span className="font-mono tabular-nums">{racha.dias}</span></span>
            <span className="text-[12px] font-semibold" style={{ color: COLORS.inkSoft }}>{racha.dias === 1 ? 'día' : 'días'}</span>
          </button>
        ) : (
          <div className="flex flex-col items-center shrink-0" style={{ color: COLORS.inkFaint }} aria-label="Todavía no arrancaste tu racha">
            <IconFuego size={16} />
            <span className="text-[12px] font-semibold leading-none mt-1">Racha</span>
          </div>
        )}
      </header>

      {/* Detalle de la racha: qué sumó cada día. Un número que no se puede
          abrir es un puntaje; abriéndolo es un dato. */}
      {rachaAbierta && racha.dias > 0 && (
        <section className="flex flex-col gap-2 -mt-4">
          <TituloSeccion>Tu racha, día por día</TituloSeccion>
          {/* El comodín se explica acá y no en un tutorial: es donde la persona
              lo ve funcionar. */}
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            {racha.comodinDisponible
              ? 'Tenés un comodín esta semana: si se te pasa un día, te lo salva solo.'
              : 'Ya usaste el comodín de esta semana. El lunes tenés otro.'}
          </p>
          <div className="flex flex-col">
            {racha.detalle.map((d) => (
              <div key={d.dia} className="flex items-baseline gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                <span className="w-16 shrink-0 text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                  {fechaDisplay(Date.parse(`${d.dia}T12:00:00-03:00`))}
                </span>
                <span className="flex-1 min-w-0 text-[14px]" style={{ color: d.tipo === 'comodin' ? COLORS.inkFaint : COLORS.inkSoft }}>
                  {d.tipo === 'paso' && (pasoPorClave(d.paso ?? '')?.titulo ?? 'Cumpliste tu paso')}
                  {d.tipo === 'whatsapp' && 'Le contaste un gasto a FINA por WhatsApp'}
                  {d.tipo === 'comodin' && 'El comodín te salvó el día'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LA tarjeta elevada de la app. Es la única, y por eso funciona: cuando
          todo era tarjeta, ser tarjeta no significaba nada. */}
      {/* PRUEBA — el próximo paso lo dice Fini, no una tarjeta. Se saca el
          contorno y el ícono de chispita: queda el personaje, lo que hay que
          hacer, y el botón. El CTA va en LIMA, que es el color que la guía
          reserva para el momento de valor (§3.3) — y como el lima tiene 1.43
          de contraste sobre el papel, el texto encima va en TINTA, nunca en
          blanco: sobre relleno de color el texto es tinta (§3.3). */}
      {/* Fini grande (92 → 132 → 164) y alineado con el globo, no con el botón.
          A 92 quedaba del tamaño de un ícono al lado de un cartel de 19px: se
          leía como una decoración pegada al borde y no como el personaje que te
          está hablando. Es el segundo elemento en peso de la pantalla, después
          del saludo. Como a este tamaño se lleva casi la mitad del ancho en un
          celular, el globo se aprieta un poco menos: gap más chico y el
          personaje sale del margen izquierdo. */}
      {/* EL PASO DE HOY. Uno por día, distinto cada día. Se cumple solo
          cuando los datos lo muestran: no hay botón de "listo", porque con uno
          la racha se inflaría tocándolo. */}
      <section className="flex items-start gap-1 pt-1">
        <div className="shrink-0 -ml-4 -mt-4">
          {/* Fini festeja cuando está cumplido. `logro` es de una pasada: salta
              una vez y vuelve a quedarse quieto, no queda saltando al lado de
              algo que ya pasó. */}
          <Fini state={cumplido ? 'logro' : paso ? 'idle' : 'pensando'} size={164} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3 pt-3">
          <div
            className="relative rounded-[20px] rounded-tl-md px-4 py-3.5"
            style={{ background: cumplido ? COLORS.limaSoft : COLORS.surface, border: `1.5px solid ${cumplido ? COLORS.lima : COLORS.line}` }}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: cumplido ? COLORS.limaText : COLORS.inkSoft, fontFamily: FONTS.mono }}>
              {cumplido ? 'Paso de hoy · listo' : 'Tu paso de hoy'}
            </p>
            {!paso ? (
              <p className="text-[15px] leading-snug mt-1" style={{ color: COLORS.inkSoft }}>Preparando tu paso de hoy…</p>
            ) : cumplido ? (
              <>
                <p className="font-bold text-[19px] leading-tight mt-1" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>¡Listo por hoy!</p>
                <p className="text-[15px] leading-snug mt-1" style={{ color: COLORS.inkSoft }}>
                  {paso.titulo}. Mañana te toca otro
                  {racha.dias > 1 ? ` — ya van ${racha.dias} días seguidos.` : '.'}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-[19px] leading-tight mt-1" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{paso.titulo}</p>
                <p className="text-[15px] leading-snug mt-1" style={{ color: COLORS.inkSoft }}>{paso.msg}</p>
                {/* Un gasto por WhatsApp salva el día aunque el paso sea otro.
                    Se dice, para que no parezca que la racha depende sólo de
                    este paso — y sin empujar a no hacerlo. */}
                {racha.hoyCumplido && (
                  <p className="text-[14px] leading-snug mt-2 font-semibold" style={{ color: COLORS.limaText }}>
                    Tu racha de hoy ya está a salvo por WhatsApp.
                  </p>
                )}
              </>
            )}
          </div>
          {paso && !cumplido && (
            paso.destino === 'whatsapp' ? (
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="v2-focus w-full rounded-2xl py-3.5 text-[18px] font-bold text-center transition-transform duration-100 active:scale-[0.99]"
                style={{ background: COLORS.lima, color: COLORS.ink }}
              >
                {paso.cta}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => navigate(paso.destino)}
                className="v2-focus w-full rounded-2xl py-3.5 text-[18px] font-bold transition-transform duration-100 active:scale-[0.99]"
                style={{ background: COLORS.lima, color: COLORS.ink }}
              >
                {paso.cta}
              </button>
            )
          )}
        </div>
      </section>

      {/* Las tres secciones en UNA línea. Con iconos de línea, no emojis:
          se vuelve a la migración que ya estaba hecha (§2.1 pide iconografía
          monolineal, y hay un commit entero que saca los emojis de la UI). */}
      <section className="flex flex-col gap-2">
        <TituloSeccion>Tus secciones</TituloSeccion>
        <div className="grid grid-cols-3 gap-2">
          {secciones.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => navigate(s.to)}
              className="v2-focus flex flex-col items-center gap-1 min-h-[88px] justify-center rounded-2xl px-1.5 py-3 transition-all duration-100 active:scale-[0.97]"
              style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}
            >
              <span style={{ color: COLORS.brand }}><s.Icon size={24} /></span>
              <span className="text-[14px] font-bold leading-tight text-center" style={{ color: COLORS.ink }}>{s.label}</span>
              <span className="text-[12px] leading-tight text-center" style={{ color: COLORS.inkSoft }}>{s.metric}</span>
            </button>
          ))}
        </div>
      </section>

      {/* PRUEBA — gráficos armados con los datos que ya hay guardados. */}
      <MisVisualizaciones />

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
            onClick={() => navigate('/onboarding-v2/grupos', { state: { from: '/onboarding-v2/home' } })}
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

    </div>
  );
}
