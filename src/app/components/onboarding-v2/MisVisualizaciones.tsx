import { useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { COLORS, Donut, FONTS, TituloSeccion, fmtMoney, vistaGastos } from './shared';
import { IngresosVsGastos, mesAtras } from './IngresosVsGastos';
import { IconChevron } from './FinaIcons';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { diaArgentina } from '../../api/v2/pasos';

// Los mismos colores y en el mismo orden que el donut de Gastos (CAT_COLORS en
// GastosV2), para que una sección se reconozca en las dos pantallas.
const CAT_COLORS = [COLORS.brand, COLORS.naranja, COLORS.star, COLORS.lima, COLORS.azul, COLORS.magenta];
function colorDeSeccion(id: string, categorias: { id: string }[]): string {
  return CAT_COLORS[Math.max(categorias.findIndex((c) => c.id === id), 0) % CAT_COLORS.length];
}

// "Mis visualizaciones" en Home: todos los gráficos a la vez, en una fila que se
// desliza de costado. Antes había que elegir cuál ver con unos chips, y lo que
// no se elegía no se veía nunca.
//
// Armados con los datos que ya hay guardados: nada inventado, y si no alcanzan
// los datos el gráfico lo dice en vez de dibujar una línea plana.
//
// Los objetivos ya no van acá (DEBT I7): tienen su propio bloque en Home,
// ObjetivosEnInicio, con el avance de la semana y el próximo paso.
//
// COLOR. Se siguió la guía de dataviz y se validó con su script, no a ojo:
//
// · Las barras van en UN solo color: es una sola serie y el nombre de cada
//   barra ya está escrito. "Por sección" es la excepción porque es una torta:
//   ahí cada sección necesita su color para encontrarla en la leyenda.
// · La paleta anterior no pasaba la validación: el lima y el amarillo tenían
//   ΔE 1,1 para daltonismo deuteranope (el mismo color para esa persona) y 13
//   para visión normal, debajo del mínimo de 15. Y usaba naranja, que en FINA es
//   el color de "atención": "Suscripciones" salía pintada como una alerta, justo
//   lo que prohíbe la regla 3 (un gasto no es un error).
// · Los montos van en tinta, nunca en el color de la barra.
//
// MES. Todas las tarjetas miran UN mes, el mismo para las tres: el actual al
// entrar, y con las flechas se va a los anteriores (hasta el primero con algo
// registrado). Antes "Gastos por categoría" sumaba todo lo registrado desde
// siempre y daba más que Gastos, que mira el mes.

const mesDe = (ts: number) => diaArgentina(ts).slice(0, 7);
/** Cuántos meses hay de `desde` a `hasta` ('YYYY-MM'). */
function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}
/** "Octubre", y con el año si no es el actual: "Diciembre 2025". Como en Gastos. */
function nombreDelMes(mes: string, mesActual: string): string {
  const nombre = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' });
  const conAño = mes.slice(0, 4) !== mesActual.slice(0, 4) ? `${nombre} ${mes.slice(0, 4)}` : nombre;
  return conAño.charAt(0).toUpperCase() + conAño.slice(1);
}

// El mes que miran las tarjetas, con flechas a los costados. Va adentro de cada
// tarjeta, arriba, para que al deslizar se vea de qué mes es cada gráfico.
function SelectorMes({ etiqueta, puedeAtras, puedeAdelante, onMover }: {
  etiqueta: string; puedeAtras: boolean; puedeAdelante: boolean; onMover: (hacia: 'atras' | 'adelante') => void;
}) {
  const flecha = (hacia: 'atras' | 'adelante', puede: boolean) => (
    <button
      type="button"
      onClick={() => onMover(hacia)}
      disabled={!puede}
      aria-label={hacia === 'atras' ? 'Mes anterior' : 'Mes siguiente'}
      className="v2-focus w-11 h-11 -my-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
      style={{ color: COLORS.inkSoft, opacity: puede ? 1 : 0.3, cursor: puede ? 'pointer' : 'default' }}
    >
      <IconChevron size={16} style={hacia === 'atras' ? { transform: 'rotate(180deg)' } : undefined} />
    </button>
  );
  return (
    <div className="flex items-center justify-between -mx-2">
      {flecha('atras', puedeAtras)}
      <p className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }} aria-live="polite">{etiqueta}</p>
      {flecha('adelante', puedeAdelante)}
    </div>
  );
}

function SinDatos({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] leading-snug pl-3.5 border-l-2 py-1" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
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
            <span className="text-[13.5px] truncate" style={{ color: COLORS.ink }}>{f.label}</span>
            <span className="text-[13px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtMoney(f.valor)}</span>
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

// ── Torta por sección ────────────────────────────────────────────────────
// Por sección va en torta y no en barras: lo que se quiere ver es qué parte
// del total se lleva cada una, y una barra escalada contra la más grande no
// dice contra qué se compara. El total va en el centro y cada sección lleva su
// monto (sin porcentaje, decisión oct 2026). Los colores son
// los mismos que en Gastos, para que una sección se reconozca en las dos.
function TortaSecciones({ filas, total }: { filas: { id: string; label: string; valor: number; color: string }[]; total: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center">
        <Donut
          size={140}
          segments={filas.map((f) => ({ color: f.color, pct: total > 0 ? (f.valor / total) * 100 : 0 }))}
          centerLabel="Gastaste"
          centerValue={fmtMoney(total)}
        />
      </div>
      <ul className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto v2-sin-barra">
        {filas.map((f) => (
          <li key={f.id} className="flex items-center gap-2.5 text-[13px]">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: f.color }} aria-hidden />
            <span className="flex-1 min-w-0 truncate" style={{ color: COLORS.ink }}>{f.label}</span>
            <span className="shrink-0 font-semibold font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtMoney(f.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Una tarjeta del carrusel ─────────────────────────────────────────────
// Sin subtítulo: el título tiene que decir solo qué muestra el gráfico
// (frontend.md §5.4). Si hiciera falta explicarlo, se cambia el título.
function Tarjeta({ titulo, ultima, children }: { titulo: string; ultima: boolean; children: React.ReactNode }) {
  return (
    <article
      // Un slider en todos los tamaños. En el celular cada tarjeta ocupa 85% del
      // ancho: se ve asomar la siguiente, que es lo que avisa que la fila se
      // desliza sin tener que decirlo. En pantallas grandes, ancho fijo, y
      // también asoma la que sigue.
      // La última se engancha por el borde derecho: en pantallas anchas no se
      // puede alinear a la izquierda (no hay nada después), y el enganche la
      // devolvía a la anterior.
      // min-w-0 + overflow-hidden: nada de adentro puede empujar la tarjeta más
      // allá de su ancho (Entra y sale se salía de la pantalla en celulares).
      className={`${ultima ? 'snap-end' : 'snap-start'} shrink-0 min-w-0 overflow-hidden w-[85%] sm:w-[360px] lg:w-[400px] rounded-2xl p-4 flex flex-col gap-3`}
      style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}
    >
      <h3 className="text-[15px] font-bold" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{titulo}</h3>
      {children}
    </article>
  );
}

export function MisVisualizaciones() {
  const g = vistaGastos();
  const { estado } = useAlmacen();

  // El mes que miran las tres tarjetas: 0 es el actual. Hacia atrás, hasta el
  // primer mes con un gasto o un ingreso registrado.
  const [mesOffset, setMesOffset] = useState(0);
  const mesActual = mesAtras(0);
  const mes = mesAtras(mesOffset);
  const primerMes = [...g.gastos, ...estado.ingresos].reduce((min, x) => { const m = mesDe(x.ts); return m < min ? m : min; }, mesActual);
  const maxOffset = mesesEntre(primerMes, mesActual);
  const selector = (
    <SelectorMes
      etiqueta={nombreDelMes(mes, mesActual)}
      puedeAtras={mesOffset < maxOffset}
      puedeAdelante={mesOffset > 0}
      onMover={(hacia) => setMesOffset((o) => Math.min(maxOffset, Math.max(0, o + (hacia === 'atras' ? 1 : -1))))}
    />
  );
  const referencia = mesOffset === 0 ? 'este mes' : `en ${nombreDelMes(mes, mesActual).toLowerCase()}`;

  const gastos = g.gastos.filter((x) => mesDe(x.ts) === mes);

  const filaRef = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const reduce = useReducedMotion();

  // ── Por sección ────────────────────────────────────────────────────────
  const porSeccion = g.categorias
    .map((c) => ({
      id: c.id,
      label: c.nombre,
      color: colorDeSeccion(c.id, g.categorias),
      // En pesos, no en la moneda de cada gasto: sumar US$20 como "20" haría
      // que la barra de esa sección se vea 1.500 veces más chica.
      valor: gastos.filter((x) => x.categoriaId === c.id).reduce((a, x) => a + x.montoArs, 0),
    }))
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // ── Por tipo ───────────────────────────────────────────────────────────
  const etiquetasTipo: Record<string, string> = { necesario: 'Necesario', urgente: 'Urgente', impulsivo: 'Gusto', otro: 'Otro' };
  const porTipo = Object.keys(etiquetasTipo)
    .map((t) => ({ label: etiquetasTipo[t], valor: gastos.filter((x) => x.tipo === t).reduce((a, x) => a + x.montoArs, 0) }))
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // Sin ningún gasto registrado, se invita a anotar el primero; con gastos en
  // otros meses pero no en éste, se dice que en éste no hay.
  const sinGastosNunca = g.gastos.length === 0;
  const tarjetas = [
    {
      titulo: 'Ingresos y gastos',
      contenido: (
        <>
          {selector}
          <IngresosVsGastos explorar mesElegido={mes} onElegirMes={(m) => setMesOffset(Math.min(maxOffset, Math.max(0, mesesEntre(m, mesActual))))} />
        </>
      ),
    },
    {
      titulo: 'Gastos por categoría',
      // Puede haber muchas categorías: la leyenda se scrollea ADENTRO de su
      // propio alto en vez de estirar la tarjeta (y con ella, todas las demás
      // de la fila).
      contenido: (
        <>
          {selector}
          {sinGastosNunca
            ? <SinDatos>Anotá tu primer gasto para ver cuánto va a cada categoría.</SinDatos>
            : gastos.length === 0 ? <SinDatos>No hay gastos {referencia}.</SinDatos>
            : porSeccion.length === 0 ? <SinDatos>No hay gastos con categoría {referencia}.</SinDatos>
            : <TortaSecciones filas={porSeccion} total={porSeccion.reduce((t, f) => t + f.valor, 0)} />}
        </>
      ),
    },
    {
      titulo: 'Gastos por tipo',
      contenido: (
        <>
          {selector}
          {sinGastosNunca
            ? <SinDatos>Anotá gastos para ver cuánto fue necesario, urgente o gusto.</SinDatos>
            : gastos.length === 0 ? <SinDatos>No hay gastos {referencia}.</SinDatos>
            : porTipo.length === 0 ? <SinDatos>No hay gastos clasificados {referencia}.</SinDatos>
            : <Barras filas={porTipo} />}
        </>
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
        // items-stretch: todas las tarjetas miden lo mismo (la más alta), aunque
        // a alguna le sobre espacio. Con alturas distintas la fila se veía
        // despareja al deslizar (pedido oct 2026).
        className="v2-focus flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory -mx-[22px] px-[22px] scroll-pl-[22px] pb-1 lg:mx-0 lg:px-0 lg:scroll-pl-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {tarjetas.map((t, i) => (
          <Tarjeta key={t.titulo} titulo={t.titulo} ultima={i === tarjetas.length - 1}>{t.contenido}</Tarjeta>
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
