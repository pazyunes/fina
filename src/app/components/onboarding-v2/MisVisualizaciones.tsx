import { useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { COLORS, FONTS, TituloSeccion, fmtMoney, fmtMontoCompacto, vistaGastos, vistaObjetivos } from './shared';
import { diaAnterior, diaArgentina } from '../../api/v2/pasos';
import { IngresosVsGastos } from './IngresosVsGastos';
import { IconChevron } from './FinaIcons';

// "Mis visualizaciones" en Home: todos los gráficos a la vez, en una fila que se
// desliza de costado. Antes había que elegir cuál ver con unos chips, y lo que
// no se elegía no se veía nunca.
//
// Armados con los datos que ya hay guardados: nada inventado, y si no alcanzan
// los datos el gráfico lo dice en vez de dibujar una línea plana.
//
// COLOR. Se siguió la guía de dataviz y se validó con su script, no a ojo:
//
// · Las barras van en UN solo color. "Por sección" pintaba cada barra de un
//   color distinto, pero es una sola serie (cuánto por sección): el color
//   repetía lo que ya dice el largo, y hacía que cada sección pareciera una
//   categoría con significado propio. El nombre de cada barra ya está escrito.
// · La paleta anterior no pasaba la validación: el lima y el amarillo tenían
//   ΔE 1,1 para daltonismo deuteranope (el mismo color para esa persona) y 13
//   para visión normal, debajo del mínimo de 15. Y usaba naranja, que en FINA es
//   el color de "atención": "Suscripciones" salía pintada como una alerta, justo
//   lo que prohíbe la regla 3 (un gasto no es un error).
// · Los montos van en tinta, nunca en el color de la barra.

function SinDatos({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-snug pl-3.5 border-l-2 py-1" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
      {children}
    </p>
  );
}

// ── Barras horizontales ──────────────────────────────────────────────────
// La forma correcta para comparar magnitudes con nombres largos: una torta
// obligaría a comparar ángulos, que el ojo lee mucho peor que largos.
function Barras({ filas }: { filas: { label: string; valor: number }[] }) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[14.5px] truncate" style={{ color: COLORS.ink }}>{f.label}</span>
            <span className="text-[14px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtMoney(f.valor)}</span>
          </div>
          {/* La barra se escala contra la más grande, no contra el total:
              contra el total, en cuanto hay varias secciones todas quedan cortas
              y no se ve la diferencia entre ellas. */}
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
            <div className="h-full rounded-full" style={{ width: `${(f.valor / max) * 100}%`, background: COLORS.brand }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Columnas por día ─────────────────────────────────────────────────────
// El eje X es tiempo, así que la forma es columna y no barra horizontal.
function Columnas({ dias }: { dias: { etiqueta: string; valor: number }[] }) {
  const max = Math.max(...dias.map((d) => d.valor), 1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5" style={{ height: 130 }}>
        {dias.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
            {d.valor > 0 && (
              <span className="text-[10px] font-mono tabular-nums" style={{ color: COLORS.inkSoft }}>{fmtMontoCompacto(d.valor)}</span>
            )}
            <div
              className="w-full rounded-t-md"
              style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor > 0 ? 4 : 2, background: d.valor > 0 ? COLORS.brand : COLORS.line }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {dias.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[11px]" style={{ color: COLORS.inkFaint, fontFamily: FONTS.mono }}>{d.etiqueta}</span>
        ))}
      </div>
    </div>
  );
}

// ── Anillos de progreso (objetivos) ──────────────────────────────────────
// Un anillo por objetivo, no una torta con todos.
//
// Una torta muestra cómo se REPARTE un total: "de todo lo que juntaste, el 40%
// fue al viaje". Lo que se pregunta de un objetivo es otra cosa — cuánto te falta
// para ESE — y eso es una proporción contra un límite, cuya forma es un medidor.
// Además, con uno o dos objetivos una torta queda en una o dos porciones, que no
// dice nada. El anillo tiene la forma circular que se buscaba y contesta la
// pregunta correcta.
function Anillo({ pct }: { pct: number }) {
  const lado = 76;
  const grosor = 9;
  const r = (lado - grosor) / 2;
  const largo = 2 * Math.PI * r;
  return (
    <svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`} role="img" aria-label={`${pct}% juntado`}>
      <circle cx={lado / 2} cy={lado / 2} r={r} fill="none" stroke={COLORS.limaSoft} strokeWidth={grosor} />
      {pct > 0 && (
        <circle
          cx={lado / 2} cy={lado / 2} r={r} fill="none"
          stroke={COLORS.limaViz} strokeWidth={grosor} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * largo} ${largo}`}
          // Arranca arriba, como un reloj, y no a la derecha como el SVG por defecto.
          transform={`rotate(-90 ${lado / 2} ${lado / 2})`}
        />
      )}
      {/* El porcentaje va en tinta, nunca en el color del anillo. */}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="16" fontWeight="700" fill={COLORS.ink} fontFamily={FONTS.mono}>
        {pct}%
      </text>
    </svg>
  );
}

// ── Una tarjeta del carrusel ─────────────────────────────────────────────
function Tarjeta({ titulo, subtitulo, ultima, children }: { titulo: string; subtitulo: string; ultima: boolean; children: React.ReactNode }) {
  return (
    <article
      // Un slider en todos los tamaños. En el celular cada tarjeta ocupa 85% del
      // ancho: se ve asomar la siguiente, que es lo que avisa que la fila se
      // desliza sin tener que decirlo. En pantallas grandes, ancho fijo, y
      // también asoma la que sigue.
      // La última se engancha por el borde derecho: en pantallas anchas no se
      // puede alinear a la izquierda (no hay nada después), y el enganche la
      // devolvía a la anterior.
      className={`${ultima ? 'snap-end' : 'snap-start'} shrink-0 w-[85%] sm:w-[360px] lg:w-[400px] rounded-2xl p-4 flex flex-col gap-3`}
      style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}
    >
      <header className="flex flex-col gap-0.5">
        <h3 className="text-[17px] font-bold" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{titulo}</h3>
        <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>{subtitulo}</p>
      </header>
      <div className="flex-1">{children}</div>
    </article>
  );
}

export function MisVisualizaciones() {
  const g = vistaGastos();
  const objetivos = vistaObjetivos();
  const gastos = g.gastos;

  const filaRef = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const reduce = useReducedMotion();

  // ── Por sección ────────────────────────────────────────────────────────
  const porSeccion = g.categorias
    .map((c) => ({
      label: c.nombre,
      // En pesos, no en la moneda de cada gasto: sumar US$20 como "20" haría
      // que la barra de esa sección se vea 1.500 veces más chica.
      valor: gastos.filter((x) => x.categoriaId === c.id).reduce((a, x) => a + x.montoArs, 0),
    }))
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // ── Por día: los últimos 7, terminando hoy, en días de Argentina ───────
  const hoy = diaArgentina();
  const ultimos7 = Array.from({ length: 7 }, (_, k) => {
    let d = hoy;
    for (let i = 0; i < 6 - k; i++) d = diaAnterior(d);
    return d;
  });
  const porDia = ultimos7.map((dia) => ({
    etiqueta: ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'][new Date(`${dia}T12:00:00Z`).getUTCDay()],
    valor: gastos.filter((x) => x.ts && diaArgentina(x.ts) === dia).reduce((a, x) => a + x.montoArs, 0),
  }));

  // ── Por tipo ───────────────────────────────────────────────────────────
  const etiquetasTipo: Record<string, string> = { necesario: 'Necesario', urgente: 'Urgente', impulsivo: 'Impulsivo', otro: 'Otro' };
  const porTipo = Object.keys(etiquetasTipo)
    .map((t) => ({ label: etiquetasTipo[t], valor: gastos.filter((x) => x.tipo === t).reduce((a, x) => a + x.montoArs, 0) }))
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // ── Objetivos ──────────────────────────────────────────────────────────
  const conMonto = objetivos.filter((o) => o.montoTotal > 0);
  const sinMonto = objetivos.length - conMonto.length;

  const tarjetas = [
    {
      titulo: 'Entra y sale', subtitulo: 'Lo que te entró contra lo que gastaste',
      contenido: <IngresosVsGastos />,
    },
    {
      titulo: 'Por sección', subtitulo: 'En qué se te va la plata',
      contenido: gastos.length === 0
        ? <SinDatos>Cuando registres tu primer gasto, acá vas a ver en qué se te va.</SinDatos>
        : porSeccion.length === 0 ? <SinDatos>Todavía no hay gastos con sección.</SinDatos>
        : <Barras filas={porSeccion} />,
    },
    {
      titulo: 'Por día', subtitulo: 'Cuánto gastaste cada día de esta semana',
      contenido: gastos.length === 0
        ? <SinDatos>Con un par de gastos registrados vas a ver tu semana día por día.</SinDatos>
        : <Columnas dias={porDia} />,
    },
    {
      titulo: 'Por tipo', subtitulo: 'Cuánto fue necesario y cuánto impulso',
      contenido: gastos.length === 0
        ? <SinDatos>Cuando registres gastos vas a poder ver cuánto fue necesario y cuánto impulso.</SinDatos>
        : porTipo.length === 0 ? <SinDatos>Todavía no hay gastos clasificados.</SinDatos>
        : <Barras filas={porTipo} />,
    },
    {
      titulo: 'Objetivos', subtitulo: 'Cuánto juntaste para cada uno',
      contenido: conMonto.length === 0
        ? <SinDatos>Sumá un objetivo con su monto y acá vas a ver cuánto te falta para cada uno.</SinDatos>
        : (
          <div className="flex flex-col gap-3">
            {/* Pequeños múltiplos: el mismo anillo, mismo tamaño y misma escala,
                así se comparan de un vistazo. */}
            {/* Con un solo objetivo, centrado: en dos columnas quedaba contra la
                izquierda con la mitad derecha de la tarjeta vacía. */}
            <div className={conMonto.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 gap-x-3 gap-y-4'}>
              {conMonto.slice(0, 4).map((o) => {
                const juntado = o.juntado;
                const pct = Math.min(100, Math.round((juntado / o.montoTotal) * 100));
                return (
                  <div key={o.id} className="flex flex-col items-center gap-1.5 text-center min-w-0">
                    <Anillo pct={pct} />
                    <span className="text-[14px] font-semibold leading-tight w-full truncate" style={{ color: COLORS.ink }}>{o.nombre}</span>
                    <span className="text-[12px] leading-tight font-mono tabular-nums" style={{ color: COLORS.inkSoft }}>
                      {fmtMontoCompacto(juntado)} de {fmtMontoCompacto(o.montoTotal)}
                    </span>
                  </div>
                );
              })}
            </div>
            {conMonto.length > 4 && (
              <span className="text-[13px]" style={{ color: COLORS.inkFaint }}>Y {conMonto.length - 4} más en Objetivos.</span>
            )}
            {/* Un objetivo sin monto no es un 0%: todavía no se sabe cuánto
                cuesta. Se dice aparte en vez de dibujarlo vacío. */}
            {sinMonto > 0 && (
              <span className="text-[13px]" style={{ color: COLORS.inkFaint }}>
                {sinMonto === 1 ? '1 objetivo todavía no tiene monto' : `${sinMonto} objetivos todavía no tienen monto`}, así que no se puede medir su avance.
              </span>
            )}
          </div>
        ),
    },
  ];

  // Qué tarjeta está a la vista, para los puntitos.
  function alDeslizar() {
    const fila = filaRef.current;
    if (!fila) return;
    // Al final de la fila, la última: la última tarjeta no puede quedar alineada
    // al borde izquierdo (no hay nada después para empujarla), así que la cuenta
    // por ancho la daba como la anteúltima.
    if (fila.scrollLeft >= fila.scrollWidth - fila.clientWidth - 4) { setActual(tarjetas.length - 1); return; }
    const ancho = fila.firstElementChild?.getBoundingClientRect().width ?? fila.clientWidth;
    setActual(Math.min(tarjetas.length - 1, Math.max(0, Math.round(fila.scrollLeft / (ancho + 12)))));
  }

  function irA(i: number) {
    const fila = filaRef.current;
    const tarjeta = fila?.children[i] as HTMLElement | undefined;
    // Sin animación para quien pidió reducir movimiento en su teléfono.
    if (!fila || !tarjeta) return;
    // Hasta donde se puede deslizar: las últimas tarjetas no llegan a alinearse
    // a la izquierda, y ahí se muestra el final de la fila.
    const tope = fila.scrollWidth - fila.clientWidth;
    const destino = Math.min(tarjeta.offsetLeft - fila.offsetLeft, tope);
    fila.scrollTo({ left: destino, behavior: reduce ? 'auto' : 'smooth' });
    // Se marca ya, sin esperar a que termine de deslizarse: si no, dos toques
    // seguidos a la flecha llevaban las dos veces a la misma tarjeta.
    setActual(destino >= tope - 4 ? tarjetas.length - 1 : i);
  }

  // Función y no componente: definida adentro, como componente se volvía a
  // montar en cada render y el botón perdía el foco al tocarlo.
  const flecha = (hacia: 'atras' | 'adelante') => {
    const destino = hacia === 'atras' ? actual - 1 : actual + 1;
    const desactivada = destino < 0 || destino > tarjetas.length - 1;
    return (
      <button
        type="button"
        onClick={() => irA(destino)}
        disabled={desactivada}
        aria-label={hacia === 'atras' ? 'Gráfico anterior' : 'Gráfico siguiente'}
        className="v2-focus w-11 h-11 rounded-full flex items-center justify-center v2-disabled transition-transform active:scale-90"
        style={{ background: COLORS.tint, color: COLORS.brand }}
      >
        <IconChevron size={18} style={hacia === 'atras' ? { transform: 'rotate(180deg)' } : undefined} />
      </button>
    );
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Mis visualizaciones">
      <div className="flex items-center justify-between gap-2">
        <TituloSeccion>Mis visualizaciones</TituloSeccion>
        {/* Flechas sólo con mouse: en el celular se desliza con el dedo. */}
        <div className="hidden lg:flex gap-2">
          {flecha('atras')}
          {flecha('adelante')}
        </div>
      </div>
      <div
        ref={filaRef}
        onScroll={alDeslizar}
        // tabIndex para que se pueda recorrer con el teclado: una fila con
        // scroll horizontal que no toma foco es inaccesible sin mouse.
        tabIndex={0}
        className="v2-focus flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-[22px] px-[22px] scroll-pl-[22px] pb-1 lg:mx-0 lg:px-0 lg:scroll-pl-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {tarjetas.map((t, i) => (
          <Tarjeta key={t.titulo} titulo={t.titulo} subtitulo={t.subtitulo} ultima={i === tarjetas.length - 1}>{t.contenido}</Tarjeta>
        ))}
      </div>

      {/* Puntitos: dicen cuántos gráficos hay y en cuál estás. */}
      <div className="flex justify-center gap-1">
        {tarjetas.map((t, i) => (
          <button
            key={t.titulo}
            type="button"
            onClick={() => irA(i)}
            aria-label={`Ver ${t.titulo}`}
            aria-current={i === actual}
            // El área táctil es de 44px aunque el punto se vea de 8: un punto
            // de 8px es imposible de tocar con el dedo, y 44 es el mínimo que
            // usa el resto de la app (§11).
            className="v2-focus w-11 h-11 flex items-center justify-center rounded-full"
          >
            <span
              className="block rounded-full transition-all duration-200"
              style={{ width: i === actual ? 20 : 8, height: 8, background: i === actual ? COLORS.brand : COLORS.lineStrong }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
