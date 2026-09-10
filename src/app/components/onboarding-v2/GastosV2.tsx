import { useEffect, useMemo, useState } from 'react';
import { ArmarGrupoBtn, COLORS, Cta, Donut, EstadoConfianza, Monto, SegmentedTab, Titulo, TituloSeccion, fechaDisplay, fmtMoney, fmtMontoCompacto, formatThousands, parseMoneyInput, slug } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { precargarCotizacion } from '../../api/v2/cotizacion';
import { Fini } from './Fini';
import { IconChat, IconChevron, IconEditar, IconLupa } from './FinaIcons';
import { WHATSAPP_URL } from '../WhatsAppFab';

// REDISEÑO v2 — Mis Gastos. Estructura del boceto: dinero disponible +
// gastos con sus botones de "agregar", visualización arriba (donut +
// distribución por tipo), sobres por categoría con tope editable, buscador
// de gastos, y una reserva tipo ahorro (mismo concepto que
// ReserveControl.tsx de la app real, pasado a esta estética).
//
// Alineado a la guía (src/styles/frontend.md): todo el color sale de COLORS
// (cero hex/rgba crudo salvo sombras basadas en tinta); los gastos se muestran
// NEUTRALES (montos en tinta, nunca color de alerta); cada dato declara su
// estado de confianza (§5); y se alterna el contenedor (§3.5): elevada solo
// para el dato central, hairline para las listas, tint para lo agrupado.
//
// Las categorías que la persona marcó en el onboarding ("¿en qué se te
// suele ir la plata?") ya aparecen acá como secciones — ver shared.tsx.
//
// PERSISTENCIA: esta pantalla no guarda nada por su cuenta. Lee del almacén
// (la copia en memoria de lo que hay en Supabase) y escribe llamando a
// `acciones`, que actualiza esa copia y encola la escritura contra la base.
// Antes el estado vivía en un blob de localStorage: se perdía al cambiar de
// teléfono y el bot de WhatsApp no podía verlo.

type TipoGasto = 'urgente' | 'impulsivo' | 'necesario' | 'otro';
type Periodo = 'semana' | 'mes';
type Moneda = 'ARS' | 'USD';
type Tope = { monto: number; periodo: Periodo };
type Categoria = { id: string; nombre: string };
type Gasto = { id: string; monto: number; montoArs: number; moneda: Moneda; descripcion: string; categoriaId: string; tipo: TipoGasto; ts: number; metodoPago?: string };
// Cada gasto guarda DOS montos: `monto` es lo que la persona tipeó, en su
// moneda, y `montoArs` su equivalente en pesos congelado a la cotización de
// ese día.
//
// La fila del gasto muestra `monto` con su signo (US$20, porque eso es lo que
// pasó). Todo lo que SUMA usa `montoArs`: antes un gasto de US$20 entraba al
// total como "$20" y hacía que el mes pareciera $30.780 más barato de lo que
// fue. Ahora entra como $30.800.
function fmtGasto(g: { monto: number; moneda: Moneda }): string {
  return g.moneda === 'USD' ? `US$${g.monto.toLocaleString('es-AR')}` : fmtMoney(g.monto);
}
// `metodosPago` son los medios con los que fuiste cargando plata disponible,
// del más reciente al más viejo. Al registrar un gasto se ofrecen esos, que es
// la lista corta y real de "de dónde puede haber salido".
type EstadoGastos = { categorias: Categoria[]; gastos: Gasto[]; disponible: number; reserva: number; topes: Record<string, Tope>; metodosPago?: string[] };

// El "tipo de gasto" es una CLASIFICACIÓN que eligió la persona, no un juicio:
// las etiquetas son hues categóricos de identidad (para distinguir en la barra
// y los puntitos), no estados de alerta. El monto siempre va en tinta neutral,
// así ningún gasto queda pintado como error (§3.3). Se evita el naranja acá
// —reservado a atención accionable— para que "urgente" no lea como reto.
const TIPO_INFO: Record<TipoGasto, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: COLORS.lila },
  impulsivo: { label: 'Impulsivo', color: COLORS.gold },
  necesario: { label: 'Necesario', color: COLORS.green },
  otro: { label: 'Otro', color: COLORS.sky },
};
const TIPOS: TipoGasto[] = ['necesario', 'urgente', 'impulsivo', 'otro'];

// Secciones sugeridas. Es la misma lista que ofrecía el onboarding: las que la
// persona marcó allá ya entran como suyas (ver estadoInicial), y el resto queda
// acá para no obligarla a tipear "Supermercado" a mano.
const SECCIONES_SUGERIDAS = [
  'Delivery', 'Restaurantes', 'Cafeterías', 'Salidas y entretenimiento',
  'Supermercado', 'Transporte', 'Belleza y cuidado personal', 'Ropa',
  'Suscripciones', 'Compras online', 'Farmacia', 'Regalos',
];

// Medios de pago sugeridos, para la primera vez que no hay ninguno cargado.
const METODOS_SUGERIDOS = ['Efectivo', 'Débito', 'Crédito', 'Mercado Pago', 'Transferencia'];

// Hues categóricos por sección — identidad para el donut y los puntitos. Los
// montos nunca toman estos colores: siempre tinta neutral.
const CAT_COLORS = [COLORS.brand, COLORS.coral, COLORS.gold, COLORS.sky, COLORS.green, COLORS.lila];

// Tratamiento de contenedores (§3.5): variedad, no card-grid spam. Una sola
// sombra suave basada en tinta; hairline para listas; tint para bloques
// agrupados; elevada SOLO para el dato central.
const CARD_ELEVADA: React.CSSProperties = { background: COLORS.surface, boxShadow: '0 2px 8px rgba(43,33,24,0.08)' };
const INPUT_STYLE: React.CSSProperties = { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}` };

export function GastosV2() {
  const { estado: db } = useAlmacen();

  // El estado de esta pantalla es una VISTA de lo que hay en la base, no una
  // copia aparte. Las secciones traen su tope adentro; el disponible es la
  // suma de lo que hay en cada medio de pago.
  const estado = useMemo<EstadoGastos>(() => ({
    categorias: db.secciones.map((s) => ({ id: s.id, nombre: s.nombre })),
    gastos: db.gastos.map((g) => ({
      id: g.id,
      monto: g.monto,
      montoArs: g.montoArs,
      moneda: g.moneda,
      descripcion: g.descripcion,
      categoriaId: g.seccionId ?? '',
      tipo: g.tipo,
      ts: g.ts,
      metodoPago: g.metodoPago ?? undefined,
    })),
    // Se muestra en cero y no en negativo: un disponible negativo es un dato
    // sobre los medios de pago (gastaste más de lo que cargaste en ese medio),
    // y ese detalle vive en la lista de medios, no en el número de arriba.
    disponible: Math.max(db.mediosPago.reduce((t, m) => t + m.saldo, 0), 0),
    reserva: db.perfil.reserva,
    topes: Object.fromEntries(
      db.secciones.filter((s) => s.tope !== null).map((s) => [s.id, s.tope as Tope]),
    ),
    metodosPago: db.mediosPago.map((m) => m.nombre),
  }), [db]);
  const { categorias, gastos, disponible, topes } = estado;

  // La cotización se pide al entrar, no al tocar "guardar": si la persona carga
  // un gasto en dólares, el valor ya está y no espera a la red.
  useEffect(() => { precargarCotizacion(); }, []);

  // Errores de conversión (no se pudo traer el dólar). Los de guardado los
  // reporta el almacén.
  const [errorGasto, setErrorGasto] = useState<string | null>(null);

  // Los sobres arrancan SIEMPRE cerrados (antes se abría el primero solo).
  const [openCatId, setOpenCatId] = useState<string | null>(null);
  const [topeEditMonto, setTopeEditMonto] = useState<Record<string, string>>({});
  const [topeEditPeriodo, setTopeEditPeriodo] = useState<Record<string, Periodo>>({});

  const [addingDisponible, setAddingDisponible] = useState(false);
  const [addDispVal, setAddDispVal] = useState('');

  const [addingGasto, setAddingGasto] = useState(false);
  // Popup al tocar "+ Agregar gasto": elegir registrar Desde FINA (a mano) o
  // Desde WhatsApp (mini explicación → abre el bot).
  const [chooser, setChooser] = useState(false);
  const [waStep, setWaStep] = useState(false);
  const [ngMonto, setNgMonto] = useState('');
  const [ngMoneda, setNgMoneda] = useState<Moneda>('ARS');
  const [ngDesc, setNgDesc] = useState('');
  const [ngCatId, setNgCatId] = useState<string | null>(categorias[0]?.id ?? null);
  const [ngNuevaCat, setNgNuevaCat] = useState('');
  const [ngTipo, setNgTipo] = useState<TipoGasto>('necesario');
  const [ngMetodo, setNgMetodo] = useState<string | null>(null);
  const [ngMetodoOtro, setNgMetodoOtro] = useState('');
  // Medio con el que se carga la plata disponible.
  const [addDispMetodo, setAddDispMetodo] = useState<string | null>(null);
  const [addDispMetodoOtro, setAddDispMetodoOtro] = useState('');
  // Ventana del donut: "este mes" o "esta semana".
  const [ventana, setVentana] = useState<Periodo>('mes');

  // Buscador por nombre + orden. Los filtros por sección y por tipo se sacaron:
  // las secciones ya están separadas arriba, así que filtrar la lista por
  // sección duplicaba el mismo trabajo, y las dos filas de chips ocupaban más
  // pantalla que la lista que filtraban.
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'recientes' | 'monto'>('recientes');

  // El total y el donut miran una VENTANA, no todo el historial: "gastado"
  // sin período no se puede comparar con nada, y un tope es por semana o por
  // mes. Se toma el mes o la semana en curso, no los últimos 30/7 días: es lo
  // que la persona tiene en la cabeza cuando piensa "cuánto gasté este mes".
  const desdeVentana = (() => {
    const d = new Date();
    if (ventana === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const dia = (d.getDay() + 6) % 7; // lunes = 0
    const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dia);
    return lunes.getTime();
  })();
  const gastosVentana = gastos.filter((g) => g.ts >= desdeVentana);

  const totalGastado = gastosVentana.reduce((s, g) => s + g.montoArs, 0);
  const gastadoEn = (catId: string) => gastosVentana.filter((g) => g.categoriaId === catId).reduce((s, g) => s + g.montoArs, 0);
  const colorDe = (catId: string) => CAT_COLORS[Math.max(categorias.findIndex((c) => c.id === catId), 0) % CAT_COLORS.length];

  const donutCategorias = categorias
    .map((c) => ({ color: colorDe(c.id), pct: totalGastado > 0 ? (gastadoEn(c.id) / totalGastado) * 100 : 0 }))
    .filter((s) => s.pct > 0);

  const porTipo = TIPOS.map((t) => ({
    tipo: t,
    monto: gastosVentana.filter((g) => g.tipo === t).reduce((s, g) => s + g.montoArs, 0),
  })).filter((t) => t.monto > 0);

  // Sugeridas que todavía no son secciones propias.
  // Se compara por slug del NOMBRE: el id ahora es el uuid de la fila, así que
  // "¿ya tiene Delivery?" se responde por nombre, no por id.
  const sugeridasDisponibles = SECCIONES_SUGERIDAS.filter(
    (n) => !categorias.some((c) => slug(c.nombre) === slug(n)),
  );
  // Medios ofrecidos al registrar un gasto: los que ya usaste primero; si no
  // hay ninguno, los sugeridos.
  const metodosOfrecidos = (estado.metodosPago?.length ? estado.metodosPago : METODOS_SUGERIDOS);

  const gastosFiltrados = gastos
    .filter((g) => !busqueda.trim() || g.descripcion.toLowerCase().includes(busqueda.trim().toLowerCase()))
    // "Mayor monto" compara en pesos: ordenar por `monto` pondría US$20 abajo
    // de un gasto de $5.000, que es al revés.
    .sort((a, b) => (orden === 'monto' ? b.montoArs - a.montoArs : b.ts - a.ts));
  const hayBusqueda = !!busqueda.trim();

  function agregarDinero() {
    const n = parseMoneyInput(addDispVal);
    if (!n) return;
    const metodo = (addDispMetodo === 'otro' ? addDispMetodoOtro.trim() : addDispMetodo) || '';
    // El medio usado sube al principio de la lista (queda con `usadoEn` de
    // ahora): al registrar un gasto se ofrecen los más recientes primero.
    acciones.sumarDisponible(metodo, n);
    setAddDispVal('');
    setAddDispMetodo(null);
    setAddDispMetodoOtro('');
    setAddingDisponible(false);
  }

  function crearCategoria(nombre: string): string {
    const ya = categorias.find((c) => slug(c.nombre) === slug(nombre));
    if (ya) return ya.id;
    return acciones.crearSeccion(nombre).id;
  }

  async function agregarGasto() {
    const monto = parseMoneyInput(ngMonto);
    if (monto <= 0) return;
    const catId = ngNuevaCat.trim() ? crearCategoria(ngNuevaCat.trim()) : ngCatId;
    if (!catId) return;
    const metodo = (ngMetodo === 'otro' ? ngMetodoOtro.trim() : ngMetodo) || null;

    // En dólares hay que congelar la cotización, y eso puede fallar sin red.
    // Si falla, el modal se queda abierto con lo que escribió: perder el gasto
    // que acaba de tipear sería peor que la espera.
    setErrorGasto(null);
    const r = await acciones.registrarGasto({
      monto,
      moneda: ngMoneda,
      descripcion: ngDesc.trim() || TIPO_INFO[ngTipo].label,
      seccionId: catId,
      tipo: ngTipo,
      metodoPago: metodo,
    });
    if (r.error !== null) { setErrorGasto(r.error); return; }

    setNgMonto(''); setNgMoneda('ARS'); setNgDesc(''); setNgNuevaCat(''); setNgTipo('necesario');
    setNgMetodo(null); setNgMetodoOtro('');
    setAddingGasto(false);
    setOpenCatId(catId);
  }

  function guardarTope(catId: string) {
    const monto = parseMoneyInput(topeEditMonto[catId] || '');
    if (monto <= 0) return;
    const periodo = topeEditPeriodo[catId] || 'semana';
    acciones.guardarTope(catId, { monto, periodo });
  }

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4 lg:max-w-4xl lg:mx-auto lg:pt-10">
      {/* Banda editorial full-bleed. Sin Fini: esta pantalla está llena de
          números y el personaje no va cerca de datos (§6). */}
      <header className="pb-1">
        <Titulo>Mis gastos</Titulo>
        <p className="text-[15px] mt-1.5" style={{ color: COLORS.inkSoft }}>Todo lo que registrás, en un solo lugar. Ponéle un tope a cada sección.</p>
      </header>

      {/* "Gastado" sin período no se puede comparar con nada, y los topes son
          por semana o por mes. Se elige una ventana y el donut, el total y la
          distribución por tipo la respetan. Va a lo ancho y arriba porque
          manda sobre todo el resumen, no solo sobre el donut. */}
      <SegmentedTab
        options={[{ id: 'mes' as Periodo, label: 'Este mes' }, { id: 'semana' as Periodo, label: 'Esta semana' }]}
        value={ventana}
        onChange={setVentana}
        trackColor={COLORS.tint}
      />

      {/* En desktop, todo lo de abajo se acomoda en grilla; en mobile sigue
          siendo una sola columna apilada (idéntico a antes). */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-5 lg:gap-y-5 lg:grid-flow-row-dense lg:items-start">
      {/* Resumen: donut + disponible/gastado — el DATO CENTRAL, única tarjeta elevada */}
      <div className={`rounded-2xl p-4 flex gap-4 items-center lg:h-full ${porTipo.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`} style={CARD_ELEVADA}>
        <Donut
          segments={donutCategorias}
          centerLabel={ventana === 'mes' ? 'Este mes' : 'Esta semana'}
          centerValue={fmtMontoCompacto(totalGastado)}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Dinero disponible</p>
            <Monto value={disponible} size={19} className="font-bold" />
          </div>
          {!addingDisponible ? (
            <button type="button" onClick={() => setAddingDisponible(true)} className="v2-focus self-start text-[14px] font-semibold underline" style={{ color: COLORS.brand }}>
              + Agregar dinero disponible
            </button>
          ) : (
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                aria-label="Monto a agregar a tu dinero disponible"
                className="v2-focus w-full rounded-xl px-2.5 py-1.5 text-[15px] transition-colors"
                style={INPUT_STYLE}
                placeholder="Monto"
                inputMode="decimal"
                value={addDispVal}
                onChange={(e) => setAddDispVal(formatThousands(e.target.value))}
              />
              {/* Se pregunta el medio acá para que después, al registrar un
                  gasto, se puedan ofrecer los que de verdad tenés. */}
              <p className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>¿En qué lo tenés?</p>
              <div className="flex flex-wrap gap-1.5">
                {metodosOfrecidos.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAddDispMetodo(m)}
                    className="v2-focus rounded-lg px-2.5 py-1 text-[14px] font-semibold transition-all duration-100 active:scale-95"
                    style={addDispMetodo === m
                      ? { background: COLORS.brand, color: COLORS.surface }
                      : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                  >
                    {m}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAddDispMetodo('otro')}
                  className="v2-focus rounded-lg px-2.5 py-1 text-[14px] font-semibold border border-dashed transition-all duration-100 active:scale-95"
                  style={{ background: addDispMetodo === 'otro' ? COLORS.brandSoft : COLORS.surface, color: addDispMetodo === 'otro' ? COLORS.brandDark : COLORS.ink, borderColor: COLORS.lineStrong }}
                >
                  + Otro
                </button>
              </div>
              {addDispMetodo === 'otro' && (
                <input
                  autoFocus
                  aria-label="En qué tenés esa plata"
                  className="v2-focus w-full rounded-xl px-2.5 py-1.5 text-[15px] transition-colors"
                  style={INPUT_STYLE}
                  placeholder="Ej: Ualá"
                  value={addDispMetodoOtro}
                  onChange={(e) => setAddDispMetodoOtro(e.target.value)}
                />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setAddingDisponible(false); setAddDispMetodo(null); setAddDispMetodoOtro(''); }} className="v2-focus flex-1 rounded-xl py-2 text-[14px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
                  Cancelar
                </button>
                <button type="button" onClick={agregarDinero} disabled={parseMoneyInput(addDispVal) <= 0} className="v2-focus flex-[2] rounded-xl py-2 text-[14px] font-bold v2-disabled transition-all duration-100 active:scale-95" style={{ background: COLORS.brand, color: COLORS.surface }}>
                  Agregar
                </button>
              </div>
            </div>
          )}
          {/* Total y disponible los cargó la persona → declarado (§5.1). */}
          {(disponible > 0 || totalGastado > 0) && <EstadoConfianza estado="declarado" />}
        </div>
      </div>

      {/* Distribución por tipo — bloque tintado (§3.5): cuánto es impulso vs necesidad */}
      {porTipo.length > 0 && (
        <div className="flex flex-col gap-2 lg:col-span-1 lg:h-full">
          <TituloSeccion>¿En qué tipo de gasto se te va?</TituloSeccion>
          <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: COLORS.surface }}>
            {porTipo.map((t) => (
              <div key={t.tipo} style={{ width: `${(t.monto / totalGastado) * 100}%`, background: TIPO_INFO[t.tipo].color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1">
            {porTipo.map((t) => (
              <span key={t.tipo} className="flex items-center gap-1.5 text-[14px]" style={{ color: COLORS.inkSoft }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIPO_INFO[t.tipo].color }} />
                <span>{TIPO_INFO[t.tipo].label}</span>
                <Monto value={t.monto} className="text-[14px] font-semibold" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agregar gasto */}
      <div className="lg:col-span-3">
      {!addingGasto ? (
        <Cta label="+ Agregar gasto" onClick={() => { setChooser(true); setWaStep(false); }} />
      ) : (
        <div className="py-2 flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{ngMoneda === 'USD' ? 'US$' : '$'}</span>
              <input
                autoFocus
                aria-label="Monto del gasto"
                className="v2-focus w-full rounded-xl pl-10 pr-3 py-2.5 text-[16px] transition-colors"
                style={INPUT_STYLE}
                placeholder="Monto"
                inputMode="decimal"
                value={ngMonto}
                onChange={(e) => setNgMonto(formatThousands(e.target.value))}
              />
            </div>
            <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: `1.5px solid ${COLORS.lineStrong}` }}>
              {(['ARS', 'USD'] as Moneda[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNgMoneda(m)}
                  className="v2-focus px-2.5 text-[14px] font-bold transition-colors"
                  style={ngMoneda === m ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <input
            aria-label="Descripción del gasto"
            className="v2-focus rounded-xl px-3.5 py-2.5 text-[16px] transition-colors"
            style={INPUT_STYLE}
            placeholder="Descripción (ej: PedidosYa)"
            value={ngDesc}
            onChange={(e) => setNgDesc(e.target.value)}
          />

          {/* Secciones en dos grupos: las que ya usás y las sugeridas que
              todavía no tenés. Antes había una sola fila con las tuyas y un
              "+ Nueva" que te dejaba tipeando "Supermercado" a mano. */}
          <div className="flex flex-col gap-2.5">
            <div>
              <p className="text-[14px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>Tus secciones</p>
              <div className="flex flex-wrap gap-2">
                {categorias.length === 0 && (
                  <p className="text-[14px]" style={{ color: COLORS.inkFaint }}>Todavía no tenés ninguna — elegí una de abajo.</p>
                )}
                {categorias.map((c) => {
                  const sel = ngCatId === c.id && !ngNuevaCat;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setNgCatId(c.id); setNgNuevaCat(''); }}
                      className="v2-focus rounded-xl px-3 py-1.5 text-[15px] font-semibold transition-all duration-100 active:scale-95"
                      style={sel ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                    >
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            {sugeridasDisponibles.length > 0 && (
              <div>
                <p className="text-[14px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>Otras secciones</p>
                <div className="flex flex-wrap gap-2">
                  {sugeridasDisponibles.map((nombre) => {
                    const sel = !ngCatId && ngNuevaCat.trim() === nombre;
                    return (
                      <button
                        key={nombre}
                        type="button"
                        onClick={() => { setNgCatId(null); setNgNuevaCat(nombre); }}
                        className="v2-focus rounded-xl px-3 py-1.5 text-[15px] font-semibold transition-all duration-100 active:scale-95"
                        style={sel
                          ? { background: COLORS.brand, color: COLORS.surface }
                          : { background: COLORS.surface, color: COLORS.inkSoft, border: `1.5px dashed ${COLORS.lineStrong}` }}
                      >
                        {nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="ng-nueva" className="text-[14px] font-bold mb-1.5 block" style={{ color: COLORS.inkSoft }}>O escribí una</label>
              <input
                id="ng-nueva"
                aria-label="Nombre de la sección"
                className="v2-focus w-full rounded-xl px-3 py-2 text-[15px] transition-colors"
                style={INPUT_STYLE}
                placeholder="Ej: Mascota"
                value={ngNuevaCat.trim()}
                onChange={(e) => { setNgNuevaCat(e.target.value); if (e.target.value) setNgCatId(null); }}
              />
            </div>
          </div>

          <div>
            <p className="text-[14px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>¿Qué tipo de gasto fue?</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const sel = ngTipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNgTipo(t)}
                    className="v2-focus rounded-xl px-3 py-1.5 text-[15px] font-semibold transition-all duration-100 active:scale-95"
                    style={sel ? { background: TIPO_INFO[t].color, color: COLORS.ink } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                  >
                    {TIPO_INFO[t].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Con qué lo pagaste. Se ofrecen primero los medios con los que ya
              cargaste plata disponible: es la lista corta y real de de dónde
              pudo haber salido. Si no hay ninguno todavía, van los sugeridos. */}
          <div>
            <p className="text-[14px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>¿Con qué lo pagaste?</p>
            <div className="flex flex-wrap gap-2">
              {metodosOfrecidos.map((m) => {
                const sel = ngMetodo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNgMetodo(m)}
                    className="v2-focus rounded-xl px-3 py-1.5 text-[15px] font-semibold transition-all duration-100 active:scale-95"
                    style={sel ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                  >
                    {m}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setNgMetodo('otro')}
                className="v2-focus rounded-xl px-3 py-1.5 text-[15px] font-semibold border border-dashed transition-all duration-100 active:scale-95"
                style={{ background: ngMetodo === 'otro' ? COLORS.brandSoft : COLORS.surface, color: ngMetodo === 'otro' ? COLORS.brandDark : COLORS.ink, borderColor: COLORS.lineStrong }}
              >
                + Otro
              </button>
            </div>
            {ngMetodo === 'otro' && (
              <input
                autoFocus
                aria-label="Con qué lo pagaste"
                className="v2-focus mt-2 w-full rounded-xl px-3 py-2 text-[15px] transition-colors"
                style={INPUT_STYLE}
                placeholder="Ej: Ualá"
                value={ngMetodoOtro}
                onChange={(e) => setNgMetodoOtro(e.target.value)}
              />
            )}
          </div>

          {errorGasto && (
            <p role="alert" className="text-[14px] font-semibold mt-1" style={{ color: COLORS.coralDark }}>{errorGasto}</p>
          )}

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => setAddingGasto(false)} className="v2-focus flex-1 rounded-xl py-2.5 text-[15px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void agregarGasto()}
              disabled={parseMoneyInput(ngMonto) <= 0 || (!ngCatId && !ngNuevaCat.trim())}
              className="v2-focus flex-[2] rounded-xl py-2.5 text-[15px] font-bold v2-disabled transition-all duration-100 active:scale-95"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              Agregar gasto
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Popup: ¿Desde FINA o Desde WhatsApp? Scrim = velo de tinta translúcido. */}
      {chooser && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(43,33,24,0.45)' }}
          onClick={() => setChooser(false)}
        >
          <div className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-3" style={{ background: COLORS.surface, boxShadow: '0 12px 40px -8px rgba(43,33,24,0.35)' }} onClick={(e) => e.stopPropagation()}>
            {!waStep ? (
              <>
                <p className="text-[20px] font-bold" style={{ color: COLORS.ink }}>¿Cómo querés registrar el gasto?</p>
                <button
                  type="button"
                  onClick={() => { setChooser(false); setAddingGasto(true); }}
                  className="v2-focus text-left rounded-2xl p-4 flex items-start gap-3 border transition-transform active:scale-[0.99]"
                  style={{ borderColor: COLORS.line }}
                >
                  <span className="shrink-0" style={{ color: COLORS.brand }}><IconEditar size={22} /></span>
                  <span className="flex flex-col">
                    <span className="text-[18px] font-bold" style={{ color: COLORS.ink }}>Desde FINA</span>
                    <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>Lo cargás acá, a mano, en un toque.</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setWaStep(true)}
                  className="v2-focus text-left rounded-2xl p-4 flex items-start gap-3 border transition-transform active:scale-[0.99]"
                  style={{ borderColor: COLORS.line }}
                >
                  <span className="shrink-0" style={{ color: COLORS.brand }}><IconChat size={22} /></span>
                  <span className="flex flex-col">
                    <span className="text-[18px] font-bold" style={{ color: COLORS.ink }}>Desde WhatsApp</span>
                    <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>Se lo contás a FINA hablando, sin cargar nada.</span>
                  </span>
                </button>
                <button type="button" onClick={() => setChooser(false)} className="v2-focus text-[15px] font-semibold py-1" style={{ color: COLORS.inkSoft }}>Cancelar</button>
              </>
            ) : (
              <>
                <p className="text-[20px] font-bold" style={{ color: COLORS.ink }}>Registrá tu gasto por WhatsApp</p>
                <div className="flex flex-col gap-2.5 pl-3.5 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
                  {[
                    'Abrí el chat de FINA en WhatsApp.',
                    'Escribile tu gasto como se lo contarías a una amiga. Ej: "gasté 5.000 en el súper".',
                    'FINA lo registra solo y lo ves acá en tus gastos.',
                  ].map((t, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold" style={{ background: COLORS.brand, color: COLORS.surface }}>{i + 1}</span>
                      <span className="flex-1 text-[15px]" style={{ color: COLORS.ink }}>{t}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setChooser(false)}
                  className="v2-focus w-full rounded-2xl py-3.5 text-center text-[18px] font-bold transition-transform active:scale-[0.99]"
                  style={{ background: COLORS.brand, color: COLORS.surface }}
                >
                  Ir a WhatsApp
                </a>
                <button type="button" onClick={() => setWaStep(false)} className="v2-focus inline-flex items-center justify-center gap-1 text-[15px] font-semibold py-1" style={{ color: COLORS.inkSoft }}>
                  <IconChevron size={14} style={{ transform: 'rotate(180deg)' }} /> Volver
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sobres por categoría — lista con hairline, no card-grid (§3.5) */}
      <div className="flex flex-col lg:col-span-2">
        {categorias.length === 0 && (
          // Vidriera vacía (§10): promesa, no falla. Se muestra qué va a haber
          // (en 'por-descubrir') + la acción (el CTA "+ Agregar gasto" de arriba).
          // Único lugar de esta pantalla donde Fini puede aparecer (§6).
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <Fini state="vacio" size={116} />
            <div className="flex flex-col gap-1">
              <p className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>Acá van a vivir tus secciones</p>
              <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
                Cuando registres tu primer gasto, cada sección aparece sola con su tope. Todavía no lo sabemos: contame un par y se arma.
              </p>
            </div>
            <EstadoConfianza estado="por-descubrir" />
          </div>
        )}
        {categorias.map((cat) => {
          const open = openCatId === cat.id;
          const gastado = gastadoEn(cat.id);
          const tope = topes[cat.id];
          const movs = gastos.filter((g) => g.categoriaId === cat.id);
          return (
            // Cada categoría era su propia tarjeta con borde. Con seis
            // secciones eso son seis contornos apilados, que es lo que se lee
            // como "todo encuadrado": la lista ya dice que son hermanas, el
            // contorno solo lo repite. Ahora son filas de una misma lista.
            <div key={cat.id} className="py-4 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <button type="button" aria-expanded={open} className="v2-focus w-full flex items-center justify-between rounded-xl" onClick={() => setOpenCatId(open ? null : cat.id)}>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorDe(cat.id) }} />
                  <div className="text-left">
                    <p className="font-semibold text-[16px]" style={{ color: COLORS.ink }}>{cat.nombre}</p>
                    {gastado > 0
                      ? <Monto value={gastado} className="text-[14px]" />
                      : <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Sin registros todavía</p>}
                  </div>
                </div>
                <span className="shrink-0 flex items-center gap-2">
                  {!tope && <span className="text-[14px] font-semibold" style={{ color: COLORS.brand }}>Agregar tope</span>}
                  <span style={{ color: COLORS.inkFaint }}>
                    <IconChevron size={16} style={{ transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 120ms' }} />
                  </span>
                </span>
              </button>

              {tope ? (
                <div className="mt-3">
                  {/* Barra de tope: llega hasta 100% y no más. Un tope excedido NO
                      se pinta de alerta — sigue en el hue de la sección (§3.3). */}
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min((gastado / tope.monto) * 100, 100)}%`, background: colorDe(cat.id) }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[14px]">
                    <span className="flex items-center gap-1" style={{ color: COLORS.inkSoft }}>Tope: <Monto value={tope.monto} className="text-[14px]" />/{tope.periodo === 'semana' ? 'sem' : 'mes'}</span>
                    <button type="button" className="v2-focus font-semibold underline" style={{ color: COLORS.brand }} onClick={() => setOpenCatId(cat.id)}>Editar</button>
                  </div>
                </div>
              ) : null}

              {open && (
                <div className="mt-3 pt-3 border-t border-dashed flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
                  {movs.length === 0 && <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todavía no hay movimientos acá.</p>}
                  {movs.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-[15px] gap-2" style={{ color: COLORS.ink }}>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_INFO[m.tipo].color }} />
                        <span className="truncate">{m.descripcion}</span>
                        <span className="shrink-0 text-[14px]" style={{ color: COLORS.inkSoft }}>{fechaDisplay(m.ts)}</span>
                      </span>
                      <span className="shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtGasto(m)}</span>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Tope de la sección</p>
                    <div className="relative">
                      <span className="absolute top-1/2 -translate-y-1/2 left-3.5" style={{ color: COLORS.inkSoft }}>$</span>
                      <input
                        aria-label={`Tope de ${cat.nombre}`}
                        className="v2-focus w-full rounded-xl pl-7 pr-3 py-2 text-[15px] transition-colors"
                        style={INPUT_STYLE}
                        placeholder="Monto"
                        inputMode="decimal"
                        value={topeEditMonto[cat.id] ?? (tope ? String(tope.monto) : '')}
                        onChange={(e) => setTopeEditMonto((v) => ({ ...v, [cat.id]: formatThousands(e.target.value) }))}
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <SegmentedTab
                          options={[{ id: 'semana' as Periodo, label: 'Por semana' }, { id: 'mes' as Periodo, label: 'Por mes' }]}
                          value={topeEditPeriodo[cat.id] ?? tope?.periodo ?? 'semana'}
                          onChange={(p) => setTopeEditPeriodo((v) => ({ ...v, [cat.id]: p }))}
                          trackColor={COLORS.tint}
                        />
                      </div>
                      <button
                        type="button"
                        className="v2-focus rounded-xl px-3.5 py-2.5 text-[14px] font-bold transition-all duration-100 active:scale-95 shrink-0"
                        style={{ background: COLORS.brand, color: COLORS.surface }}
                        onClick={() => guardarTope(cat.id)}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Buscador de gastos — colapsado en una lupita, no ocupa lugar hasta que se usa */}
      <div className="flex flex-col gap-2.5 lg:col-span-1">
        <div className="flex items-center justify-between">
          <TituloSeccion>Tus gastos</TituloSeccion>
          <button
            type="button"
            onClick={() => setBusquedaAbierta((v) => !v)}
            aria-label="Buscar gastos"
            aria-pressed={busquedaAbierta}
            className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
            style={busquedaAbierta ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.tint, color: COLORS.brand }}
          >
            <IconLupa size={18} />
          </button>
        </div>
        {busquedaAbierta && (
          <input
            autoFocus
            aria-label="Buscar gastos por nombre"
            className="v2-focus rounded-2xl px-4 py-2.5 text-[16px] transition-colors"
            style={INPUT_STYLE}
            placeholder="Buscar por nombre (ej: Rappi)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        )}
        <SegmentedTab
          options={[{ id: 'recientes' as const, label: 'Más recientes' }, { id: 'monto' as const, label: 'Mayor monto' }]}
          value={orden}
          onChange={setOrden}
          trackColor={COLORS.tint}
        />

        {gastos.length === 0 && <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste gastos.</p>}
        {gastos.length > 0 && gastosFiltrados.length === 0 && (
          <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>No encontramos gastos con ese nombre.</p>
        )}
        {gastosFiltrados.slice(0, hayBusqueda ? 50 : 6).map((g) => {
          const cat = categorias.find((c) => c.id === g.categoriaId);
          return (
            // Idem: un movimiento no es una tarjeta, es un renglón.
            <div key={g.id} className="flex items-center gap-2.5 py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIPO_INFO[g.tipo].color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] truncate" style={{ color: COLORS.ink }}>{g.descripcion}</p>
                <p className="text-[14px] flex items-center gap-1.5" style={{ color: COLORS.inkSoft }}>
                  <span className="truncate">{cat?.nombre ?? 'Sin sección'}</span>
                  <span className="shrink-0">{fechaDisplay(g.ts)}</span>
                </p>
              </div>
              <span className="font-mono tabular-nums text-[15px] shrink-0" style={{ color: COLORS.ink }}>{fmtGasto(g)}</span>
            </div>
          );
        })}
      </div>

      <div className="lg:col-span-3">
        <ArmarGrupoBtn />
      </div>
      </div>
    </div>
  );
}
