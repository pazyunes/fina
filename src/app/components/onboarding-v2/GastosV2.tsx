import { useEffect, useMemo, useRef, useState } from 'react';
import { llevarA, useAlLlegar } from './alLlegar';
import { ArmarGrupoBtn, COLORS, Donut, EstadoConfianza, FONTS, Monto, SegmentedTab, Titulo, TituloSeccion, fechaDisplay, fmtMoney, aInputFechaHora, deInputFechaHora, formatMontoInicial, formatThousands, parseMoneyInput, slug } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { precargarCotizacion } from '../../api/v2/cotizacion';
import { diaArgentina } from '../../api/v2/pasos';
import { Fini } from './Fini';
import { IconBasura, IconChat, IconChevron, IconEditar, IconLupa } from './FinaIcons';
import { LinkWhatsApp } from './LinkWhatsApp';
import { IngresosVsGastos, lunesAtras, mesAtras } from './IngresosVsGastos';
import { CamposGastoFijo, ListaGastosFijos, opcionFijoInicial, opcionFijoValida, type OpcionFijo } from './GastosFijos';
import { FUENTES_INGRESO, type FuenteIngreso, type PagoMixto } from '../../api/v2/tipos';
import { IconClose } from './FinaIcons';
import { VerTodos, recortar } from './VerTodos';

// REDISEÑO v2 — Mis Gastos. El objetivo de la pantalla es uno: cuánta plata
// tenés disponible. Ese número va arriba y grande; debajo, las dos acciones
// (agregar gasto, agregar plata), lo que entra contra lo que sale, la
// distribución por tipo, las secciones con su tope y el buscador. La torta y
// las barras por medio de pago se sacaron (DEBT GA2); unir medios vive en
// Perfil (MediosDePago.tsx).
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
type Gasto = { id: string; monto: number; montoArs: number; moneda: Moneda; descripcion: string; categoriaId: string; tipo: TipoGasto; tipoOtro?: string; ts: number; metodoPago?: string; pagos?: PagoMixto[]; origen: 'web' | 'whatsapp' | 'manual' };
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
function fmtPagos(pagos: PagoMixto[]): string {
  return pagos.map((p) => `${p.medio} (${fmtMoney(p.monto)})`).join(' + ');
}
// Una fila del editor de "pagado con varios medios". `medio === 'otro'` usa
// `otro` en vez del nombre — mismo patrón que el desplegable de medio único.
type FilaPago = { medio: string; otro: string; monto: string };
function filaPagoVacia(): FilaPago {
  return { medio: '', otro: '', monto: '' };
}
// Lo que la persona escribió antes en un "otro", sin repetir (ignora
// mayúsculas), del más reciente al más viejo. Sale de los propios movimientos:
// no hay tabla aparte. Los movimientos ya vienen ordenados del más nuevo al más
// viejo, así que alcanza con quedarse con la primera aparición de cada texto.
function recientes(valores: (string | undefined)[], max = 6): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const v of valores) {
    const t = v?.trim();
    if (!t || vistos.has(t.toLowerCase())) continue;
    vistos.add(t.toLowerCase());
    salida.push(t);
    if (salida.length >= max) break;
  }
  return salida;
}
function medioDeFila(f: FilaPago): string {
  return (f.medio === 'otro' ? f.otro : f.medio).trim();
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
  // Se guarda 'impulsivo' (el dato no cambia), pero se dice "Gusto":
  // "impulsivo" juzga el gasto y la app no moraliza el consumo (regla 3).
  impulsivo: { label: 'Gusto', color: COLORS.gold },
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
  'Suscripciones', 'Compras online', 'Farmacia', 'Regalos', 'Deporte',
];

// Medios de pago sugeridos, para la primera vez que no hay ninguno cargado.
const METODOS_SUGERIDOS = ['Efectivo', 'Débito', 'Crédito', 'Mercado Pago', 'Transferencia'];

// Hues categóricos por sección — identidad para el donut y los puntitos. Los
// montos nunca toman estos colores: siempre tinta neutral.
// Seis colores bien distintos entre sí: antes `sky` y `lila` eran las dos
// variantes de violeta de la guía y quedaban muy cerca de `brand` (también
// violeta) — con seis secciones, la mitad de la rueda terminaba emparentada.
const CAT_COLORS = [COLORS.brand, COLORS.naranja, COLORS.star, COLORS.lima, COLORS.azul, COLORS.magenta];

// Tratamiento de contenedores (§3.5): variedad, no card-grid spam. Una sola
// sombra suave basada en tinta; hairline para listas; tint para bloques
// agrupados; elevada SOLO para el dato central.
const CARD_ELEVADA: React.CSSProperties = { background: COLORS.surface, boxShadow: '0 2px 8px rgba(43,33,24,0.08)' };
const INPUT_STYLE: React.CSSProperties = { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}` };

// Desplegable nativo. En el celular abre el selector del sistema, que es lo más
// cómodo para elegir de una lista larga con el dedo — antes todas las secciones
// y todos los medios aparecían como botones a la vez y el formulario ocupaba
// tres pantallas.
function Desplegable({ id, label, value, onChange, children }: {
  id: string; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="v2-focus w-full appearance-none rounded-xl pl-3.5 pr-10 min-h-[48px] text-[15px] transition-colors"
          // Sin nada elegido, el texto va tenue como un placeholder.
          style={{ ...INPUT_STYLE, color: value ? COLORS.ink : COLORS.inkFaint }}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} aria-hidden>
          <IconChevron size={16} style={{ transform: 'rotate(90deg)' }} />
        </span>
      </div>
    </div>
  );
}

const OPCION: React.CSSProperties = { color: COLORS.ink };

// Borrar pide confirmación en el mismo renglón: no se puede deshacer, y el
// tachito está al lado del monto, donde un toque de más es fácil.
function BotonBorrar({ gasto, abierto, onClick }: { gasto: Gasto; abierto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Borrar ${gasto.descripcion}`}
      aria-expanded={abierto}
      className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
      style={{ color: abierto ? COLORS.ink : COLORS.inkFaint }}
    >
      <IconBasura size={18} />
    </button>
  );
}

function BotonEditar({ gasto, onClick }: { gasto: Gasto; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar ${gasto.descripcion}`}
      className="v2-focus w-11 h-11 -my-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
      style={{ color: COLORS.inkFaint }}
    >
      <IconEditar size={18} />
    </button>
  );
}

function ConfirmarBorrado({ gasto, onCancelar }: { gasto: Gasto; onCancelar: () => void }) {
  return (
    <div className="mt-2 mb-1 rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado">
      <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
        ¿Borrar "{gasto.descripcion}" de <span className="font-mono tabular-nums">{fmtGasto(gasto)}</span>?
        {gasto.pagos?.length ? ` La plata vuelve a ${fmtPagos(gasto.pagos)}.` : gasto.metodoPago ? ` La plata vuelve a ${gasto.metodoPago}.` : ''}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          autoFocus
          onClick={onCancelar}
          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-semibold"
          style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { onCancelar(); acciones.borrarGasto(gasto.id); }}
          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-bold transition-all duration-100 active:scale-95"
          style={{ background: COLORS.ink, color: COLORS.paper }}
        >
          Sí, borrar
        </button>
      </div>
    </div>
  );
}

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
      // Si llegó sin descripción, o con una variable sin completar del bot
      // ("{{vars.expense_description}}"), se muestra el nombre de la sección:
      // un renglón vacío o con código no dice qué gasto es.
      descripcion: !g.descripcion.trim() || /\{\{.*\}\}/.test(g.descripcion)
        ? (db.secciones.find((s) => s.id === g.seccionId)?.nombre ?? 'Gasto sin descripción')
        : g.descripcion,
      categoriaId: g.seccionId ?? '',
      tipo: g.tipo,
      tipoOtro: g.tipoOtro,
      ts: g.ts,
      metodoPago: g.metodoPago ?? undefined,
      pagos: g.pagos,
      origen: g.origen,
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
  const { categorias, gastos, topes } = estado;

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
  const [ngFechaHora, setNgFechaHora] = useState(() => aInputFechaHora(Date.now()));
  const [ngDesc, setNgDesc] = useState('');
  // Gasto que se está editando (null = el formulario abierto es para uno nuevo).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Sin sección elegida de entrada: con la primera ya marcada, era fácil
  // registrar un gasto en la sección equivocada sin darse cuenta.
  const [ngCatId, setNgCatId] = useState<string | null>(null);
  const [ngNuevaCat, setNgNuevaCat] = useState('');
  const [ngCreandoCat, setNgCreandoCat] = useState(false);
  // El gasto que se está por borrar (uno a la vez).
  const [borrando, setBorrando] = useState<string | null>(null);
  const [ngTipo, setNgTipo] = useState<TipoGasto>('necesario');
  // Lo que se escribe cuando el tipo es "otro".
  const [ngTipoOtro, setNgTipoOtro] = useState('');
  const [ngMetodo, setNgMetodo] = useState<string | null>(null);
  const [ngMetodoOtro, setNgMetodoOtro] = useState('');
  // Pagado con más de un medio: cada fila es un medio + su parte del total.
  // La suma de las filas tiene que dar el monto del gasto.
  const [ngDividido, setNgDividido] = useState(false);
  const [ngPagos, setNgPagos] = useState<FilaPago[]>([filaPagoVacia(), filaPagoVacia()]);
  const [ngFijo, setNgFijo] = useState<OpcionFijo>(opcionFijoInicial);
  // Medio con el que se carga la plata disponible.
  const [addDispMetodo, setAddDispMetodo] = useState<string | null>(null);
  const [addDispMetodoOtro, setAddDispMetodoOtro] = useState('');
  // ¿Es plata que ENTRÓ (un ingreso: cuenta para "cuánto entra contra cuánto
  // sale") o plata que ya tenía (sólo se carga el saldo)? Por defecto, que entró:
  // es lo más común una vez que la persona ya cargó lo que tenía.
  const [addDispEsIngreso, setAddDispEsIngreso] = useState(true);
  const [addDispFuente, setAddDispFuente] = useState<FuenteIngreso | ''>('');
  // Lo que se escribe cuando la fuente es "otro".
  const [addDispFuenteOtra, setAddDispFuenteOtra] = useState('');
  // Ventana del donut: "este mes" o "esta semana".
  const [ventana, setVentana] = useState<Periodo>('mes');
  // Sólo aplica con ventana === 'mes': 0 es el mes en curso, 1 el anterior, etc.
  // "Esta semana" no navega — no lo pidieron y complica menos que sumarle offset.
  const [mesOffset, setMesOffset] = useState(0);
  // Lo mismo para "Esta semana": 0 es la semana en curso, 1 la pasada, etc.
  const [semanaOffset, setSemanaOffset] = useState(0);

  // Buscador por nombre + orden. Los filtros por sección y por tipo se sacaron:
  // las secciones ya están separadas arriba, así que filtrar la lista por
  // sección duplicaba el mismo trabajo, y las dos filas de chips ocupaban más
  // pantalla que la lista que filtraban.
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'recientes' | 'monto'>('recientes');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  // Con esto en true, "Tus gastos" deja de truncar en 6. Buscar por nombre o
  // filtrar por fecha ya implica querer ver la lista completa que matchea.
  const [verTodos, setVerTodos] = useState(false);
  // Sección abierta con todos sus gastos a la vista (si no, los primeros 5).
  const [seccionCompleta, setSeccionCompleta] = useState<string | null>(null);
  // Editar secciones: renombrar o borrar. Una a la vez.
  const [editandoSecciones, setEditandoSecciones] = useState(false);
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [borrandoSeccionId, setBorrandoSeccionId] = useState<string | null>(null);

  // El total y el donut miran una VENTANA, no todo el historial: "gastado"
  // sin período no se puede comparar con nada, y un tope es por semana o por
  // mes. Se toma el mes o la semana en curso, no los últimos 30/7 días: es lo
  // que la persona tiene en la cabeza cuando piensa "cuánto gasté este mes".
  const desdeVentana = (() => {
    const d = new Date();
    if (ventana === 'mes') return new Date(d.getFullYear(), d.getMonth() - mesOffset, 1).getTime();
    // La semana va de lunes a domingo, en días de Argentina — los mismos que
    // usa el gráfico de barras, para que torta, lista y gráfico hablen de lo
    // mismo.
    return Date.parse(`${lunesAtras(semanaOffset)}T00:00:00-03:00`);
  })();
  // Un mes pasado necesita también un límite de arriba: si no, "julio" incluye
  // agosto, septiembre... hasta hoy. El mes en curso y la semana no lo necesitan,
  // porque ya terminan hoy.
  const hastaVentana = ventana === 'mes' && mesOffset > 0
    ? (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - mesOffset + 1, 1).getTime(); })()
    : ventana === 'semana' && semanaOffset > 0
      ? desdeVentana + 7 * 86_400_000
      : Infinity;
  const gastosVentana = gastos.filter((g) => g.ts >= desdeVentana && g.ts < hastaVentana);
  // Nombre del mes elegido, para el centro del donut y el selector de arriba.
  const nombreMesOffset = (offset: number) => {
    if (offset === 0) return 'Este mes';
    const hoy = new Date();
    const objetivo = new Date(hoy.getFullYear(), hoy.getMonth() - offset, 1);
    const nombre = objetivo.toLocaleDateString('es-AR', { month: 'long' });
    const conAño = objetivo.getFullYear() !== hoy.getFullYear() ? `${nombre} ${objetivo.getFullYear()}` : nombre;
    return conAño.charAt(0).toUpperCase() + conAño.slice(1);
  };

  // Cómo se llama la semana que se mira: "Esta semana", "Semana pasada" o el
  // rango de lunes a domingo ("10 – 16 sep").
  const etiquetaSemana = (offset: number) => {
    if (offset === 0) return 'Esta semana';
    if (offset === 1) return 'Semana pasada';
    const lunes = new Date(`${lunesAtras(offset)}T12:00:00Z`);
    const domingo = new Date(lunes);
    domingo.setUTCDate(domingo.getUTCDate() + 6);
    const f = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
    return `${f(lunes)} – ${f(domingo)}`;
  };
  const etiquetaVentana = ventana === 'mes' ? nombreMesOffset(mesOffset) : etiquetaSemana(semanaOffset);
  const offsetVentana = ventana === 'mes' ? mesOffset : semanaOffset;

  const totalGastado = gastosVentana.reduce((s, g) => s + g.montoArs, 0);
  // Lo que SOBRÓ de los meses anteriores en cada medio de pago, que se suma al
  // disponible del mes que se mira. Sólo pasa lo que sobra: un mes que cierra
  // en negativo en un medio no arrastra la deuda, el siguiente arranca en cero.
  // Se arrastra mes a mes (lo que sobró en agosto entra a septiembre, y lo que
  // sobre al cierre de septiembre entra a octubre). Los gastos sin medio no se
  // pueden asignar a ninguno y no arrastran nada. Con "Esta semana" no se
  // arrastra: la semana se mira sola.
  const sobranteAnterior = (() => {
    const sobra = new Map<string, number>();
    if (ventana !== 'mes') return sobra;
    const claveVista = mesAtras(mesOffset);
    const netos = new Map<string, Map<string, number>>(); // mes → medio → neto
    const sumar = (ts: number, medio: string, delta: number) => {
      const mes = diaArgentina(ts).slice(0, 7);
      const deMes = netos.get(mes) ?? new Map<string, number>();
      deMes.set(medio, (deMes.get(medio) ?? 0) + delta);
      netos.set(mes, deMes);
    };
    for (const i of db.ingresos) if (i.medio) sumar(i.ts, i.medio, i.montoArs);
    for (const c of db.cargas) sumar(c.ts, c.medio, c.montoArs);
    for (const g of gastos) {
      if (g.pagos?.length) for (const p of g.pagos) sumar(g.ts, p.medio, -p.monto);
      else if (g.metodoPago) sumar(g.ts, g.metodoPago, -g.montoArs);
    }
    for (const mes of [...netos.keys()].sort()) {
      if (mes >= claveVista) break;
      for (const [medio, neto] of netos.get(mes)!) sobra.set(medio, Math.max(0, (sobra.get(medio) ?? 0) + neto));
    }
    return sobra;
  })();

  // Cuánto queda en cada medio de pago EN EL PERÍODO que se está mirando (el
  // mes o la semana de la torta): lo que sobró de antes, más lo que entró en
  // ese medio, menos lo que salió de él en esos días. Un gasto dividido resta
  // a cada medio lo suyo. Las barras se comparan contra el medio con más
  // margen; un resultado en cero o negativo queda con la barra vacía y se dice
  // con el número, sin alerta (regla 3: gastar más de lo que entró por un
  // medio es un dato, no un error).
  const mediosVentana = (() => {
    const mapa = new Map<string, { previo: number; entro: number; salio: number }>();
    const de = (nombre: string) => {
      let v = mapa.get(nombre);
      if (!v) { v = { previo: 0, entro: 0, salio: 0 }; mapa.set(nombre, v); }
      return v;
    };
    for (const [medio, v] of sobranteAnterior) if (v > 0) de(medio).previo = v;
    let sinMedioEntro = 0;
    for (const i of db.ingresos) {
      if (i.ts < desdeVentana || i.ts >= hastaVentana) continue;
      if (i.medio) de(i.medio).entro += i.montoArs;
      else sinMedioEntro += i.montoArs;
    }
    // Lo cargado como "Ya la tenía" también cuenta en el mes en que se cargó.
    for (const c of db.cargas) {
      if (c.ts >= desdeVentana && c.ts < hastaVentana) de(c.medio).entro += c.montoArs;
    }
    let sinMedio = 0;
    for (const g of gastosVentana) {
      if (g.pagos?.length) for (const p of g.pagos) de(p.medio).salio += p.monto;
      else if (g.metodoPago) de(g.metodoPago).salio += g.montoArs;
      else sinMedio += g.montoArs;
    }
    const filas = [...mapa.entries()]
      .map(([nombre, v]) => ({ nombre, previo: v.previo, entro: v.entro, salio: v.salio, quedan: v.previo + v.entro - v.salio }))
      .sort((x, y) => y.quedan - x.quedan);
    // Lo que entró o salió sin elegir medio también cuenta en el mes: se
    // muestra aparte, al final, para que las filas sumen lo mismo que el
    // número de arriba.
    if (sinMedio > 0 || sinMedioEntro > 0) {
      filas.push({ nombre: 'Sin medio elegido', previo: 0, entro: sinMedioEntro, salio: sinMedio, quedan: sinMedioEntro - sinMedio });
    }
    return filas;
  })();
  // Dinero disponible DEL PERÍODO: lo que sobró de los meses anteriores, más lo
  // cargado ("Me entró" y "Ya la tenía"), menos lo gastado en el mes (o la
  // semana) que se está mirando. Es la suma de las filas de abajo. En cero y no
  // en negativo: gastar más de lo que se cargó suele ser que falta cargar
  // ingresos, y se ve en cada medio.
  const previoTotal = mediosVentana.reduce((t, m) => t + m.previo, 0);
  const disponibleVentana = Math.max(mediosVentana.reduce((t, m) => t + m.quedan, 0), 0);
  const gastadoEn = (catId: string) => gastosVentana.filter((g) => g.categoriaId === catId).reduce((s, g) => s + g.montoArs, 0);
  const colorDe = (catId: string) => CAT_COLORS[Math.max(categorias.findIndex((c) => c.id === catId), 0) % CAT_COLORS.length];

  // ── Gráfico principal: de lo que entró, cuánto se fue en cada sección y
  // cuánto te queda. "Lo que entró" es lo que sobró del mes anterior más lo
  // registrado en el período (Me entró y Ya la tenía): el disponible se arma
  // solo con lo que registrás, sin tener que actualizarlo a mano. Sin nada
  // registrado como entrada, el anillo muestra sólo cómo se reparten los gastos
  // entre secciones (no hace falta cargar el ingreso para usar Gastos).
  const plataDelPeriodo = mediosVentana.reduce((t, m) => t + m.previo + m.entro, 0);
  const conIngreso = plataDelPeriodo > 0;
  const porSeccion = [
    ...categorias.map((c) => ({ id: c.id, nombre: c.nombre, color: colorDe(c.id), monto: gastadoEn(c.id) })),
    { id: '__sin', nombre: 'Sin sección', color: COLORS.lineStrong, monto: gastosVentana.filter((g) => !g.categoriaId).reduce((s, g) => s + g.montoArs, 0) },
  ].filter((s) => s.monto > 0).sort((a, b) => b.monto - a.monto);
  const baseAnillo = conIngreso ? Math.max(plataDelPeriodo, totalGastado) : totalGastado;
  const segmentosAnillo = [
    ...porSeccion.map((s) => ({ color: s.color, pct: baseAnillo > 0 ? (s.monto / baseAnillo) * 100 : 0 })),
    ...(conIngreso && disponibleVentana > 0 ? [{ color: COLORS.lima, pct: (disponibleVentana / baseAnillo) * 100 }] : []),
  ];
  const gastasteDeMas = conIngreso && totalGastado > plataDelPeriodo ? totalGastado - plataDelPeriodo : 0;

  // ── Con qué pagaste en el período: cada medio con lo que salió de él. Un
  // gasto dividido suma a cada medio su parte. No es el dato principal: va abajo.
  const porMedio = (() => {
    const m = new Map<string, number>();
    for (const g of gastosVentana) {
      if (g.pagos?.length) for (const p of g.pagos) m.set(p.medio, (m.get(p.medio) ?? 0) + p.monto);
      else m.set(g.metodoPago || 'Sin medio elegido', (m.get(g.metodoPago || 'Sin medio elegido') ?? 0) + g.montoArs);
    }
    return [...m.entries()].map(([nombre, monto]) => ({ nombre, monto })).filter((x) => x.monto > 0).sort((a, b) => b.monto - a.monto);
  })();
  const maxMedio = Math.max(1, ...porMedio.map((x) => x.monto));

  // El "otro" se abre por lo que la persona escribió (Salud, Mascota…): cada
  // texto es su propia fila, con el color de "otro". Los "otro" sin texto
  // siguen juntos bajo "Otro".
  type FilaTipo = { clave: string; tipo: TipoGasto; label: string; monto: number };
  const porTipo: FilaTipo[] = TIPOS.flatMap((t): FilaTipo[] => {
    const deEsteTipo = gastosVentana.filter((g) => g.tipo === t);
    if (t !== 'otro') return [{ clave: t, tipo: t, label: TIPO_INFO[t].label, monto: deEsteTipo.reduce((s, g) => s + g.montoArs, 0) }];
    const grupos = new Map<string, { label: string; monto: number }>();
    for (const g of deEsteTipo) {
      const label = g.tipoOtro?.trim() || TIPO_INFO.otro.label;
      const k = label.toLowerCase();
      grupos.set(k, { label: grupos.get(k)?.label ?? label, monto: (grupos.get(k)?.monto ?? 0) + g.montoArs });
    }
    return [...grupos.entries()].map(([k, v]) => ({ clave: `otro:${k}`, tipo: t, label: v.label, monto: v.monto }));
  }).filter((t) => t.monto > 0);

  // Sugeridas que todavía no son secciones propias.
  // Se compara por slug del NOMBRE: el id ahora es el uuid de la fila, así que
  // "¿ya tiene Delivery?" se responde por nombre, no por id.
  const sugeridasDisponibles = SECCIONES_SUGERIDAS.filter(
    (n) => !categorias.some((c) => slug(c.nombre) === slug(n)),
  );
  // Medios ofrecidos al registrar un gasto: los que ya usaste primero; si no
  // hay ninguno, los sugeridos.
  const metodosOfrecidos = (estado.metodosPago?.length ? estado.metodosPago : METODOS_SUGERIDOS);
  const tiposOtroRecientes = recientes(gastos.map((g) => g.tipoOtro));
  const fuentesOtraRecientes = recientes(db.ingresos.map((i) => i.fuenteOtra));

  // Validación del pago dividido: cada fila necesita medio y monto, y entre
  // todas tienen que sumar exactamente el total del gasto (si no, ¿de dónde
  // sale la diferencia?).
  const sumaPagos = ngPagos.reduce((s, f) => s + parseMoneyInput(f.monto), 0);
  const pagosValidos = !ngDividido || (
    ngPagos.every((f) => medioDeFila(f) && parseMoneyInput(f.monto) > 0)
    && Math.abs(sumaPagos - parseMoneyInput(ngMonto)) < 0.01
  );

  const hayFiltroFecha = !!(filtroDesde || filtroHasta);
  // Los recientes son los del período que se está mirando (el mes de las
  // flechas, o la semana): el 1 de un mes nuevo la lista arranca vacía, sin los
  // del mes anterior. Si la persona pone un rango de fechas es porque quiere
  // mirar otros días, y ahí el rango manda.
  const baseLista = hayFiltroFecha ? gastos : gastosVentana;
  const textoPeriodo = ventana === 'mes'
    ? (mesOffset === 0 ? 'este mes' : nombreMesOffset(mesOffset))
    : semanaOffset === 0 ? 'esta semana' : semanaOffset === 1 ? 'la semana pasada' : `la semana del ${etiquetaSemana(semanaOffset)}`;
  const gastosFiltrados = baseLista
    .filter((g) => !busqueda.trim() || g.descripcion.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .filter((g) => !filtroDesde || g.ts >= new Date(`${filtroDesde}T00:00:00`).getTime())
    .filter((g) => !filtroHasta || g.ts <= new Date(`${filtroHasta}T23:59:59`).getTime())
    // "Mayor monto" compara en pesos: ordenar por `monto` pondría US$20 abajo
    // de un gasto de $5.000, que es al revés.
    .sort((a, b) => (orden === 'monto' ? b.montoArs - a.montoArs : b.ts - a.ts));
  const hayBusqueda = !!busqueda.trim();
  // Mostrar todos si están buscando o filtrando (recortar lo que ya filtraron
  // sería raro), o si tocaron "Ver todos" a mano.
  const mostrarTodos = hayBusqueda || hayFiltroFecha || verTodos;

  // Desde "Tu paso de hoy" en Home:
  // · "Registrar un gasto" abre el formulario de FINA con el monto listo para
  //   escribir. No pasa por el "¿desde FINA o desde WhatsApp?": para WhatsApp
  //   hay un paso aparte, y quien tocó "registrar" acá quiere cargarlo acá.
  // · "Poner un tope" abre la sección donde más se gastó este mes (el paso dice
  //   "elegí la que más se te va") con el campo del tope listo. Si todavía no
  //   gastó en ninguna, la primera.
  const pantallaRef = useRef<HTMLDivElement>(null);
  useAlLlegar('gasto', () => {
    setChooser(false);
    setAddingGasto(true);
    llevarA(
      () => pantallaRef.current?.querySelector<HTMLElement>('[data-form-gasto]'),
      () => pantallaRef.current?.querySelector<HTMLElement>('[aria-label="Monto del gasto"]'),
    );
  });
  // Desde el aviso de vencimiento o la tarjeta de Home.
  useAlLlegar('fijos', () => {
    llevarA(() => pantallaRef.current?.querySelector<HTMLElement>('[data-gastos-fijos]'));
  });
  useAlLlegar('tope', ({ ref }) => {
    // Si el paso nombra una sección ("Ponele un tope a Delivery"), esa.
    const pedida = categorias.find((c) => c.id === ref);
    const sinTope = categorias.filter((c) => !topes[c.id]);
    const candidatas = sinTope.length ? sinTope : categorias;
    const elegida = pedida ?? [...candidatas].sort((a, b) => gastadoEn(b.id) - gastadoEn(a.id))[0];
    if (!elegida) return;
    setVentana('mes');
    setMesOffset(0);
    setOpenCatId(elegida.id);
    llevarA(
      () => pantallaRef.current?.querySelector<HTMLElement>(`[data-seccion="${elegida.id}"]`),
      () => pantallaRef.current?.querySelector<HTMLElement>(`[data-tope-de="${elegida.id}"]`),
    );
  });

  function agregarDinero() {
    const n = parseMoneyInput(addDispVal);
    if (!n) return;
    const metodo = (addDispMetodo === 'otro' ? addDispMetodoOtro.trim() : addDispMetodo) || '';
    // El medio usado sube al principio de la lista (queda con `usadoEn` de
    // ahora): al registrar un gasto se ofrecen los más recientes primero.
    if (addDispEsIngreso) void acciones.registrarIngreso({ monto: n, moneda: 'ARS', fuente: addDispFuente || null, fuenteOtra: addDispFuenteOtra, medio: metodo });
    else acciones.sumarDisponible(metodo, n);
    setAddDispVal('');
    setAddDispMetodo(null);
    setAddDispMetodoOtro('');
    setAddDispFuente('');
    setAddDispFuenteOtra('');
    setAddDispEsIngreso(true);
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
    const pagos = ngDividido ? ngPagos.map((f) => ({ medio: medioDeFila(f), monto: parseMoneyInput(f.monto) })) : undefined;

    // En dólares hay que congelar la cotización, y eso puede fallar sin red.
    // Si falla, el modal se queda abierto con lo que escribió: perder el gasto
    // que acaba de tipear sería peor que la espera.
    setErrorGasto(null);
    const datos = {
      monto,
      moneda: ngMoneda,
      descripcion: ngDesc.trim() || TIPO_INFO[ngTipo].label,
      seccionId: catId,
      tipo: ngTipo,
      metodoPago: metodo,
      ts: deInputFechaHora(ngFechaHora),
    };
    // Un gasto fijo que todavía no se pagó no se registra como gasto: sólo
    // queda anotado para avisar. Si ya se pagó, se registra y queda el próximo.
    // (La división entre medios es sólo para el gasto de una vez — un gasto
    // fijo guarda un único medio, como siempre.)
    if (!ngFijo.activo || ngFijo.yaPagado) {
      const r = await acciones.registrarGasto({ ...datos, tipoOtro: ngTipoOtro, pagos, confirmacion: ngFijo.activo ? 'Gasto fijo guardado con éxito.' : undefined });
      if (r.error !== null) { setErrorGasto(r.error); return; }
    }
    if (ngFijo.activo) {
      const diaAncla = ngFijo.frecuencia === 'mensual' || ngFijo.frecuencia === 'anual' ? Number(ngFijo.proximo.slice(8, 10)) : null;
      acciones.crearGastoFijo({ ...datos, frecuencia: ngFijo.frecuencia, proximoPago: ngFijo.proximo, diaAncla }, !ngFijo.yaPagado);
    }

    cancelarForm();
    setOpenCatId(catId);
  }

  // Precarga el formulario con lo que ya tiene el gasto y lo abre en modo
  // edición — mismo formulario que "agregar", pero sin la parte de gasto
  // fijo (eso es para crear uno nuevo, no para editar un movimiento pasado).
  function empezarEdicion(g: Gasto) {
    setEditandoId(g.id);
    setNgMonto(formatMontoInicial(g.monto));
    setNgMoneda(g.moneda);
    setNgFechaHora(aInputFechaHora(g.ts));
    setNgDesc(g.descripcion);
    setNgCatId(g.categoriaId || null);
    setNgNuevaCat(''); setNgCreandoCat(false);
    setNgTipo(g.tipo);
    setNgTipoOtro(g.tipoOtro ?? '');
    if (g.pagos?.length) {
      setNgDividido(true);
      setNgPagos(g.pagos.map((p) => ({ medio: p.medio, otro: '', monto: formatMontoInicial(p.monto) })));
      setNgMetodo(null);
    } else {
      setNgDividido(false);
      setNgPagos([filaPagoVacia(), filaPagoVacia()]);
      setNgMetodo(g.metodoPago ?? null);
    }
    setNgMetodoOtro('');
    setErrorGasto(null);
    setChooser(false);
    setAddingGasto(true);
  }

  function cancelarForm() {
    setAddingGasto(false);
    setEditandoId(null);
    setNgFijo(opcionFijoInicial());
    setNgMonto(''); setNgMoneda('ARS'); setNgFechaHora(aInputFechaHora(Date.now()));
    setNgDesc(''); setNgNuevaCat(''); setNgCreandoCat(false); setNgCatId(null); setNgTipo('necesario'); setNgTipoOtro('');
    setNgMetodo(null); setNgMetodoOtro('');
    setNgDividido(false); setNgPagos([filaPagoVacia(), filaPagoVacia()]);
  }

  async function guardarEdicion() {
    if (!editandoId) return;
    const monto = parseMoneyInput(ngMonto);
    if (monto <= 0) return;
    const catId = ngNuevaCat.trim() ? crearCategoria(ngNuevaCat.trim()) : ngCatId;
    const metodo = (ngMetodo === 'otro' ? ngMetodoOtro.trim() : ngMetodo) || null;
    const pagos = ngDividido ? ngPagos.map((f) => ({ medio: medioDeFila(f), monto: parseMoneyInput(f.monto) })) : null;
    setErrorGasto(null);
    const r = await acciones.editarGasto(editandoId, {
      monto,
      moneda: ngMoneda,
      descripcion: ngDesc.trim() || TIPO_INFO[ngTipo].label,
      seccionId: catId,
      tipo: ngTipo,
      tipoOtro: ngTipoOtro,
      metodoPago: ngDividido ? null : metodo,
      pagos,
      ts: deInputFechaHora(ngFechaHora),
    });
    if (r.error !== null) { setErrorGasto(r.error); return; }
    cancelarForm();
  }

  function guardarTope(catId: string) {
    const monto = parseMoneyInput(topeEditMonto[catId] || '');
    if (monto <= 0) return;
    const periodo = topeEditPeriodo[catId] || 'semana';
    acciones.guardarTope(catId, { monto, periodo });
  }

  return (
    <div ref={pantallaRef} className="px-[22px] pt-8 flex flex-col gap-4 pb-4 lg:max-w-4xl lg:mx-auto lg:pt-10">
      {/* Banda editorial full-bleed. Sin Fini: esta pantalla está llena de
          números y el personaje no va cerca de datos (§6). */}
      <header data-franja className="pb-1 mb-2">
        <Titulo>Mis gastos</Titulo>
      </header>

      {/* EL dato de la pantalla (§3.5). Con lo que te entró registrado: de esa
          plata, cuánto se fue en cada sección y cuánto te queda (el
          disponible, en lima, que es el valor). Sin entradas registradas: sólo
          cómo se reparten tus gastos. Es la única tarjeta elevada; los medios
          de pago no van acá, van en su propio gráfico más abajo. */}
      <section
        aria-label={conIngreso ? `Te queda, ${textoPeriodo}` : `Tus gastos, ${textoPeriodo}`}
        className="rounded-2xl px-5 py-5 flex flex-col gap-4 lg:max-w-xl"
        style={CARD_ELEVADA}
      >
        <div className="flex items-center gap-5">
          <Donut
            size={150}
            segments={segmentosAnillo}
            centerLabel={conIngreso ? 'Te queda' : 'Gastaste'}
            centerValue={fmtMoney(conIngreso ? disponibleVentana : totalGastado)}
          />
          <div className="flex-1 min-w-0 flex flex-col gap-1" aria-live="polite">
            <p className="text-[14px] font-medium" style={{ color: COLORS.inkSoft }}>
              {conIngreso ? 'Te queda' : 'Gastaste'}{ventana === 'mes' && mesOffset === 0 ? ' este mes' : `, ${textoPeriodo.toLowerCase()}`}
            </p>
            <Monto value={conIngreso ? disponibleVentana : totalGastado} size={26} className="font-bold leading-tight tracking-[-0.01em]" />
            {conIngreso && (
              <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
                De <span className="font-mono tabular-nums">{fmtMoney(plataDelPeriodo)}</span> que te entraron
              </p>
            )}
            <EstadoConfianza estado="declarado" className="mt-1" />
          </div>
        </div>

        {/* Leyenda: cada sección con su monto, y lo que queda. */}
        {(porSeccion.length > 0 || conIngreso) && (
          <ul className="flex flex-col gap-1.5">
            {porSeccion.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 text-[14px]">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} aria-hidden />
                <span className="flex-1 min-w-0 truncate" style={{ color: COLORS.ink }}>{s.nombre}</span>
                <Monto value={s.monto} className="text-[14px] font-semibold" />
              </li>
            ))}
            {porSeccion.length > 5 && (
              <li className="text-[14px] pl-[22px]" style={{ color: COLORS.inkSoft }}>
                Y {porSeccion.length - 5} secciones más, abajo
              </li>
            )}
            {conIngreso && (
              <li className="flex items-center gap-2.5 text-[14px] font-semibold">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS.lima }} aria-hidden />
                <span className="flex-1 min-w-0" style={{ color: COLORS.limaText }}>Te queda</span>
                <Monto value={disponibleVentana} className="text-[14px] font-semibold" />
              </li>
            )}
          </ul>
        )}

        {previoTotal > 0 && (
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Incluye <span className="font-mono tabular-nums">{fmtMoney(previoTotal)}</span> que sobró del mes anterior
          </p>
        )}
        {gastasteDeMas > 0 && (
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Salieron <span className="font-mono tabular-nums">{fmtMoney(gastasteDeMas)}</span> más de lo que registraste que te entró
          </p>
        )}
        {!conIngreso && totalGastado > 0 && (
          <button
            type="button"
            onClick={() => { setAddDispEsIngreso(true); setAddingDisponible(true); }}
            className="v2-focus self-start min-h-[44px] text-[14px] font-semibold"
            style={{ color: COLORS.brand }}
          >
            Sumá lo que te entró para ver cuánto te queda
          </button>
        )}
        {!conIngreso && totalGastado === 0 && (
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Cuando registres lo que te entra y lo que gastás, acá vas a ver cuánto te queda.
          </p>
        )}
      </section>

      {/* "Gastado" sin período no se puede comparar con nada, y los topes son
          por semana o por mes. Se elige una ventana y el disponible, la lista
          y la distribución por tipo la respetan. */}
      <SegmentedTab
        options={[{ id: 'mes' as Periodo, label: 'Este mes' }, { id: 'semana' as Periodo, label: 'Esta semana' }]}
        value={ventana}
        onChange={(v) => { setVentana(v); setMesOffset(0); setSemanaOffset(0); }}
        trackColor={COLORS.tint}
      />

      {/* Navegar hacia atrás: meses con "Este mes", semanas con "Esta semana". */}
      <div className="flex items-center justify-center gap-3 -mt-1">
        <button
          type="button"
          onClick={() => (ventana === 'mes' ? setMesOffset((o) => o + 1) : setSemanaOffset((o) => o + 1))}
          aria-label={ventana === 'mes' ? 'Ver mes anterior' : 'Ver semana anterior'}
          className="v2-focus w-11 h-11 rounded-full flex items-center justify-center transition-all duration-100 active:scale-90"
          style={{ color: COLORS.inkSoft }}
        >
          <IconChevron size={15} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span className="text-[14px] font-semibold min-w-[130px] text-center" style={{ color: COLORS.ink, fontFamily: FONTS.mono }}>
          {etiquetaVentana}
        </span>
        <button
          type="button"
          onClick={() => (ventana === 'mes' ? setMesOffset((o) => Math.max(0, o - 1)) : setSemanaOffset((o) => Math.max(0, o - 1)))}
          disabled={offsetVentana === 0}
          aria-label={ventana === 'mes' ? 'Ver mes siguiente' : 'Ver semana siguiente'}
          className="v2-focus w-11 h-11 rounded-full flex items-center justify-center transition-all duration-100 active:scale-90"
          style={{ color: COLORS.inkSoft, opacity: offsetVentana === 0 ? 0.3 : 1, cursor: offsetVentana === 0 ? 'default' : 'pointer' }}
        >
          <IconChevron size={15} />
        </button>
      </div>

      {/* En desktop, todo lo de abajo se acomoda en grilla; en mobile sigue
          siendo una sola columna apilada (idéntico a antes). */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-5 lg:gap-y-5 lg:grid-flow-row-dense lg:items-start">
      {/* Agregar gasto / Agregar plata — misma jerarquía, lado a lado, debajo
          del resumen y antes de los gráficos: son las dos acciones que se
          hacen todo el tiempo, así que no deberían pedir scroll. Mismo botón,
          mismo peso — el de plata va en un violeta más claro para que se
          lean como dos acciones distintas, no una principal y una secundaria. */}
      <div className="lg:col-span-3 flex flex-col gap-3">
        {!addingGasto && !addingDisponible && (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => { setChooser(true); setWaStep(false); }}
              className="v2-focus flex-1 rounded-2xl py-4 text-[15px] font-bold select-none transition-all duration-100 ease-out active:scale-[0.98]"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              + Agregar gasto
            </button>
            <button
              type="button"
              onClick={() => setAddingDisponible(true)}
              className="v2-focus flex-1 rounded-2xl py-4 text-[15px] font-bold select-none transition-all duration-100 ease-out active:scale-[0.98]"
              style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}
            >
              + Agregar plata
            </button>
          </div>
        )}

        {addingDisponible && (
          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <SegmentedTab
              options={[{ id: 'ingreso' as const, label: 'Me entró' }, { id: 'tenia' as const, label: 'Ya la tenía' }]}
              value={addDispEsIngreso ? 'ingreso' : 'tenia'}
              onChange={(v) => setAddDispEsIngreso(v === 'ingreso')}
              trackColor={COLORS.tint}
            />
            <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
              {addDispEsIngreso
                ? 'Cuenta como ingreso: se suma a lo que entró este mes.'
                : 'Sólo suma a tu dinero disponible, sin contar como ingreso.'}
            </p>
            <input
              autoFocus
              aria-label="Monto a agregar a tu dinero disponible"
              className="v2-focus w-full rounded-xl px-2.5 py-1.5 text-[14px] transition-colors"
              style={INPUT_STYLE}
              placeholder="Monto"
              inputMode="decimal"
              value={addDispVal}
              onChange={(e) => setAddDispVal(formatThousands(e.target.value))}
            />
            {addDispEsIngreso && (
              <select
                aria-label="De dónde vino la plata"
                value={addDispFuente}
                onChange={(e) => setAddDispFuente(e.target.value as FuenteIngreso | '')}
                className="v2-focus w-full rounded-xl px-2.5 py-1.5 text-[14px]"
                style={{ ...INPUT_STYLE, color: addDispFuente ? COLORS.ink : COLORS.inkFaint }}
              >
                <option value="" style={{ color: COLORS.ink }}>¿De dónde vino? (opcional)</option>
                {FUENTES_INGRESO.map((f) => <option key={f.id} value={f.id} style={{ color: COLORS.ink }}>{f.label}</option>)}
              </select>
            )}
            {addDispEsIngreso && addDispFuente === 'otro' && (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  aria-label="De dónde vino la plata, cuál"
                  maxLength={40}
                  className="v2-focus w-full rounded-xl px-2.5 py-1.5 text-[14px] transition-colors"
                  style={INPUT_STYLE}
                  placeholder="Escribí de dónde (ej: Beca, Alquiler)"
                  value={addDispFuenteOtra}
                  onChange={(e) => setAddDispFuenteOtra(e.target.value)}
                />
                {fuentesOtraRecientes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Los que escribiste antes">
                    {fuentesOtraRecientes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={addDispFuenteOtra.trim().toLowerCase() === t.toLowerCase()}
                        onClick={() => setAddDispFuenteOtra(t)}
                        className="v2-focus rounded-lg px-2.5 py-1 text-[14px] font-semibold transition-all duration-100 active:scale-95"
                        style={addDispFuenteOtra.trim().toLowerCase() === t.toLowerCase()
                          ? { background: COLORS.brandSoft, color: COLORS.brandDark }
                          : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Se pregunta el medio acá para que después, al registrar un
                gasto, se puedan ofrecer los que de verdad tenés. */}
            <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>{addDispEsIngreso ? '¿Dónde entró?' : '¿En qué lo tenés?'}</p>
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
                className="v2-focus w-full rounded-xl px-2.5 py-1.5 text-[14px] transition-colors"
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

        {addingGasto && (
          <div data-form-gasto className="py-2 flex flex-col gap-3">
            {editandoId && <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>Editar gasto</p>}
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{ngMoneda === 'USD' ? 'US$' : '$'}</span>
                <input
                  autoFocus
                  aria-label="Monto del gasto"
                  className="v2-focus w-full rounded-xl pl-10 pr-3 py-2.5 text-[15px] transition-colors"
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
              className="v2-focus rounded-xl px-3.5 py-2.5 text-[15px] transition-colors"
              style={INPUT_STYLE}
              placeholder="Descripción (ej: PedidosYa)"
              value={ngDesc}
              onChange={(e) => setNgDesc(e.target.value)}
            />
            {/* Por defecto queda en "ahora" — sólo hace falta tocarlo para
                cargar un gasto de otro momento (ej: a la noche, uno de la
                mañana). */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ng-fecha-hora" className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>Fecha y hora</label>
              <input
                id="ng-fecha-hora"
                type="datetime-local"
                className="v2-focus rounded-xl px-3.5 min-h-[48px] text-[15px] transition-colors"
                style={INPUT_STYLE}
                value={ngFechaHora}
                max={aInputFechaHora(Date.now())}
                onChange={(e) => setNgFechaHora(e.target.value)}
              />
            </div>

            {/* Sección, tipo y medio. Antes eran tres grupos de botones con TODAS
                las opciones a la vista (tus secciones, las sugeridas, cuatro
                tipos, los medios): en el celular eran tres pantallas de chips
                antes de llegar a "Agregar". Ahora las listas largas son
                desplegables y sólo el tipo, que son cuatro palabras cortas,
                queda a la vista en una fila. */}
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
              <div className="flex flex-col gap-2">
                <Desplegable
                  id="ng-seccion"
                  label="Sección"
                  value={ngCatId ? `c:${ngCatId}` : ngCreandoCat ? 'nueva' : ngNuevaCat ? `s:${ngNuevaCat}` : ''}
                  onChange={(v) => {
                    setNgCatId(v.startsWith('c:') ? v.slice(2) : null);
                    setNgNuevaCat(v.startsWith('s:') ? v.slice(2) : '');
                    setNgCreandoCat(v === 'nueva');
                  }}
                >
                  <option value="" disabled style={OPCION}>Elegí una sección</option>
                  {categorias.length > 0 && (
                    <optgroup label="Tus secciones">
                      {categorias.map((c) => <option key={c.id} value={`c:${c.id}`} style={OPCION}>{c.nombre}</option>)}
                    </optgroup>
                  )}
                  {sugeridasDisponibles.length > 0 && (
                    <optgroup label="Otras secciones">
                      {sugeridasDisponibles.map((n) => <option key={n} value={`s:${n}`} style={OPCION}>{n}</option>)}
                    </optgroup>
                  )}
                  <option value="nueva" style={OPCION}>+ Crear otra sección</option>
                </Desplegable>
                {ngCreandoCat && (
                  <input
                    autoFocus
                    aria-label="Nombre de la sección nueva"
                    className="v2-focus w-full rounded-xl px-3.5 min-h-[48px] text-[15px] transition-colors"
                    style={INPUT_STYLE}
                    placeholder="Ej: Mascota"
                    value={ngNuevaCat}
                    onChange={(e) => setNgNuevaCat(e.target.value)}
                  />
                )}
              </div>

              {/* Con qué lo pagaste. Primero los medios con los que ya cargaste
                  plata disponible; si no hay ninguno, los sugeridos. */}
              <div className="flex flex-col gap-2">
                {!ngDividido ? (
                  <>
                    <Desplegable
                      id="ng-medio"
                      label="¿Con qué lo pagaste?"
                      value={ngMetodo ?? ''}
                      onChange={(v) => { setNgMetodo(v || null); if (v !== 'otro') setNgMetodoOtro(''); }}
                    >
                      <option value="" style={OPCION}>Elegí un medio (opcional)</option>
                      {metodosOfrecidos.map((m) => <option key={m} value={m} style={OPCION}>{m}</option>)}
                      <option value="otro" style={OPCION}>+ Otro medio</option>
                    </Desplegable>
                    {ngMetodo === 'otro' && (
                      <input
                        autoFocus
                        aria-label="Con qué lo pagaste"
                        className="v2-focus w-full rounded-xl px-3.5 min-h-[48px] text-[15px] transition-colors"
                        style={INPUT_STYLE}
                        placeholder="Ej: Ualá"
                        value={ngMetodoOtro}
                        onChange={(e) => setNgMetodoOtro(e.target.value)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => { setNgDividido(true); setNgPagos([filaPagoVacia(), filaPagoVacia()]); }}
                      className="v2-focus self-start min-h-[44px] text-[14px] font-semibold underline"
                      style={{ color: COLORS.brand }}
                    >
                      Pagado con más de un medio
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setNgDividido(false); setNgPagos([filaPagoVacia(), filaPagoVacia()]); }}
                    className="v2-focus self-start min-h-[44px] text-[14px] font-semibold underline"
                    style={{ color: COLORS.inkSoft }}
                  >
                    Pagar con un solo medio
                  </button>
                )}
              </div>
            </div>

            {/* Dividido entre varios medios: una fila por medio, cada una con
                su monto — la suma tiene que dar el total de arriba. Full-width
                (no adentro de la grilla de 2 columnas) porque cada fila ya
                tiene tres campos. */}
            {ngDividido && (
              <div className="flex flex-col gap-2">
                <p className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>¿Con qué lo pagaste?</p>
                {ngPagos.map((f, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <select
                      aria-label={`Medio ${i + 1}`}
                      value={f.medio}
                      onChange={(e) => setNgPagos((v) => v.map((x, idx) => (idx === i ? { ...x, medio: e.target.value } : x)))}
                      className="v2-focus flex-1 min-w-0 rounded-xl pl-3 pr-2 min-h-[48px] text-[14px] transition-colors"
                      style={{ ...INPUT_STYLE, color: f.medio ? COLORS.ink : COLORS.inkFaint }}
                    >
                      <option value="" style={OPCION}>Medio</option>
                      {metodosOfrecidos.map((m) => <option key={m} value={m} style={OPCION}>{m}</option>)}
                      <option value="otro" style={OPCION}>+ Otro</option>
                    </select>
                    {f.medio === 'otro' && (
                      <input
                        aria-label={`Medio ${i + 1}, cuál`}
                        placeholder="Ej: Ualá"
                        value={f.otro}
                        onChange={(e) => setNgPagos((v) => v.map((x, idx) => (idx === i ? { ...x, otro: e.target.value } : x)))}
                        className="v2-focus flex-1 min-w-0 rounded-xl px-3 min-h-[48px] text-[14px] transition-colors"
                        style={INPUT_STYLE}
                      />
                    )}
                    <input
                      aria-label={`Monto pagado con el medio ${i + 1}`}
                      placeholder="Monto"
                      inputMode="decimal"
                      value={f.monto}
                      onChange={(e) => setNgPagos((v) => v.map((x, idx) => (idx === i ? { ...x, monto: formatThousands(e.target.value) } : x)))}
                      className="v2-focus w-[104px] shrink-0 rounded-xl px-2.5 min-h-[48px] text-[14px] transition-colors"
                      style={INPUT_STYLE}
                    />
                    {ngPagos.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Sacar el medio ${i + 1}`}
                        onClick={() => setNgPagos((v) => v.filter((_, idx) => idx !== i))}
                        className="v2-focus w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all duration-100 active:scale-90"
                        style={{ color: COLORS.inkFaint }}
                      >
                        <IconClose size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNgPagos((v) => [...v, filaPagoVacia()])}
                  className="v2-focus self-start min-h-[44px] text-[14px] font-semibold underline"
                  style={{ color: COLORS.brand }}
                >
                  + Agregar otro medio
                </button>
                <p className="text-[14px] tabular-nums" style={{ color: pagosValidos ? COLORS.inkSoft : COLORS.coralDark }}>
                  Sumado: {fmtMoney(sumaPagos)} de {fmtMoney(parseMoneyInput(ngMonto))}
                </p>
              </div>
            )}

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[14px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>¿Qué tipo de gasto fue?</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {TIPOS.map((t) => {
                  const sel = ngTipo === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => setNgTipo(t)}
                      className="v2-focus rounded-xl px-1 min-h-[44px] text-[14px] font-semibold transition-all duration-100 active:scale-95"
                      style={sel ? { background: TIPO_INFO[t].color, color: COLORS.ink } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                    >
                      {TIPO_INFO[t].label}
                    </button>
                  );
                })}
              </div>
              {/* "Otro" se puede escribir: queda con el nombre que le pongas
                  y se ofrece de nuevo la próxima vez, como las secciones. */}
              {ngTipo === 'otro' && (
                <div className="flex flex-col gap-2 mt-1.5">
                  <input
                    autoFocus
                    aria-label="Qué tipo de gasto fue"
                    maxLength={40}
                    className="v2-focus w-full rounded-xl px-3.5 min-h-[48px] text-[15px] transition-colors"
                    style={INPUT_STYLE}
                    placeholder="Escribí cuál (ej: Salud, Mascota)"
                    value={ngTipoOtro}
                    onChange={(e) => setNgTipoOtro(e.target.value)}
                  />
                  {tiposOtroRecientes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Los que escribiste antes">
                      {tiposOtroRecientes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={ngTipoOtro.trim().toLowerCase() === t.toLowerCase()}
                          onClick={() => setNgTipoOtro(t)}
                          className="v2-focus rounded-lg px-2.5 py-1 text-[14px] font-semibold transition-all duration-100 active:scale-95"
                          style={ngTipoOtro.trim().toLowerCase() === t.toLowerCase()
                            ? { background: COLORS.brandSoft, color: COLORS.brandDark }
                            : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </fieldset>

            {/* Un gasto que ya pasó no se puede volver "gasto fijo" desde acá:
                esto es para crear uno nuevo, no para editar un movimiento. */}
            {!editandoId && <CamposGastoFijo valor={ngFijo} onChange={setNgFijo} />}

            {errorGasto && (
              <p role="alert" className="text-[14px] font-semibold mt-1" style={{ color: COLORS.coralDark }}>{errorGasto}</p>
            )}

            <div className="flex gap-2 mt-1">
              <button type="button" onClick={cancelarForm} className="v2-focus flex-1 rounded-xl py-2.5 text-[14px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void (editandoId ? guardarEdicion() : agregarGasto())}
                disabled={parseMoneyInput(ngMonto) <= 0 || (!ngCatId && !ngNuevaCat.trim()) || (!editandoId && !opcionFijoValida(ngFijo)) || !pagosValidos}
                className="v2-focus flex-[2] rounded-xl py-2.5 text-[14px] font-bold v2-disabled transition-all duration-100 active:scale-95"
                style={{ background: COLORS.brand, color: COLORS.surface }}
              >
                {editandoId ? 'Guardar cambios' : ngFijo.activo && !ngFijo.yaPagado ? 'Guardar gasto fijo' : 'Agregar gasto'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lo que entra contra lo que sale. Debajo de las dos acciones: es la
          pregunta que sigue a "cuánto tengo" — "¿me alcanza lo que entra?". */}
      <section className="flex flex-col gap-3 lg:col-span-3">
        <TituloSeccion>Lo que entra y lo que sale</TituloSeccion>
        <IngresosVsGastos
          conLista
          mesElegido={mesAtras(ventana === 'mes' ? mesOffset : 0)}
          semana={ventana === 'semana' ? { lunes: lunesAtras(semanaOffset), etiqueta: etiquetaSemana(semanaOffset), actual: semanaOffset === 0 } : undefined}
        />
      </section>

      {/* Distribución por tipo: cuánto fue necesario, urgente, gusto u otro. */}
      {porTipo.length > 0 && (
        <div className="flex flex-col gap-2 lg:col-span-1 lg:h-full">
          <TituloSeccion>¿En qué tipo de gasto se te va?</TituloSeccion>
          <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: COLORS.surface }}>
            {porTipo.map((t) => (
              <div key={t.clave} style={{ width: `${(t.monto / totalGastado) * 100}%`, background: TIPO_INFO[t.tipo].color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1">
            {porTipo.map((t) => (
              <span key={t.clave} className="flex items-center gap-1.5 text-[14px]" style={{ color: COLORS.inkSoft }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIPO_INFO[t.tipo].color }} />
                <span>{t.label}</span>
                <Monto value={t.monto} className="text-[14px] font-semibold" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Con qué pagaste en el período. Una sola serie (cuánto salió de cada
          medio), así que un solo color; el monto en tinta. */}
      {porMedio.length > 0 && (
        <section className="flex flex-col gap-2.5 lg:col-span-2" aria-label="Con qué pagaste">
          <TituloSeccion>Con qué pagaste {ventana === 'mes' ? (mesOffset === 0 ? 'este mes' : `en ${textoPeriodo.toLowerCase()}`) : (semanaOffset === 0 ? 'esta semana' : 'esa semana')}</TituloSeccion>
          {porMedio.map((x) => (
            <div key={x.nombre} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] truncate" style={{ color: COLORS.ink }}>{x.nombre}</span>
                <Monto value={x.monto} className="text-[14px] font-semibold shrink-0" />
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
                <div className="h-full rounded-full" style={{ width: `${(x.monto / maxMedio) * 100}%`, background: COLORS.brand }} />
              </div>
            </div>
          ))}
        </section>
      )}

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
                <p className="text-[18px] font-bold" style={{ color: COLORS.ink }}>¿Cómo querés registrar el gasto?</p>
                <button
                  type="button"
                  onClick={() => { setChooser(false); setAddingGasto(true); }}
                  className="v2-focus text-left rounded-2xl p-4 flex items-start gap-3 border transition-transform active:scale-[0.99]"
                  style={{ borderColor: COLORS.line }}
                >
                  <span className="shrink-0" style={{ color: COLORS.brand }}><IconEditar size={22} /></span>
                  <span className="flex flex-col">
                    <span className="text-[16px] font-bold" style={{ color: COLORS.ink }}>Desde FINA</span>
                    <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>Lo cargás acá, a mano, en un toque.</span>
                  </span>
                </button>
                {/* Relleno lima, no hairline como la opción de al lado:
                    registrar hablando es la funcionalidad más fuerte de FINA y
                    con las dos opciones iguales quedaba escondida abajo. El
                    texto va en tinta — sobre lima nunca va blanco (regla 2). */}
                <button
                  type="button"
                  onClick={() => setWaStep(true)}
                  className="v2-focus text-left rounded-2xl p-4 flex items-start gap-3 transition-transform active:scale-[0.99]"
                  style={{ background: COLORS.lima }}
                >
                  <span className="shrink-0" style={{ color: COLORS.ink }}><IconChat size={22} /></span>
                  <span className="flex flex-col">
                    <span className="text-[16px] font-bold" style={{ color: COLORS.ink }}>Desde WhatsApp</span>
                    <span className="text-[14px]" style={{ color: COLORS.limaText }}>Se lo contás a FINA hablando, sin cargar nada.</span>
                  </span>
                </button>
                <button type="button" onClick={() => setChooser(false)} className="v2-focus text-[14px] font-semibold py-1" style={{ color: COLORS.inkSoft }}>Cancelar</button>
              </>
            ) : (
              <>
                <p className="text-[18px] font-bold" style={{ color: COLORS.ink }}>Registrá tu gasto por WhatsApp</p>
                <div className="flex flex-col gap-2.5 pl-3.5 border-l-2" style={{ borderColor: COLORS.lima }}>
                  {[
                    'Abrí el chat de FINA en WhatsApp.',
                    'Escribile tu gasto como se lo contarías a una amiga. Ej: "gasté 5.000 en el súper".',
                    'FINA lo registra solo y lo ves acá en tus gastos.',
                  ].map((t, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold" style={{ background: COLORS.lima, color: COLORS.ink }}>{i + 1}</span>
                      <span className="flex-1 text-[14px]" style={{ color: COLORS.ink }}>{t}</span>
                    </div>
                  ))}
                </div>
                <LinkWhatsApp
                  onClick={() => setChooser(false)}
                  className="v2-focus w-full rounded-2xl py-3.5 text-center text-[16px] font-bold transition-transform active:scale-[0.99]"
                  style={{ background: COLORS.lima, color: COLORS.ink }}
                >
                  Ir a WhatsApp
                </LinkWhatsApp>
                <button type="button" onClick={() => setWaStep(false)} className="v2-focus inline-flex items-center justify-center gap-1 text-[14px] font-semibold py-1" style={{ color: COLORS.inkSoft }}>
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
              <p className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Acá van a vivir tus secciones</p>
              <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
                Cuando registres tu primer gasto, cada sección aparece sola con su tope. Todavía no lo sabemos: contame un par y se arma.
              </p>
            </div>
            <EstadoConfianza estado="por-descubrir" />
          </div>
        )}
        {/* De la que más plata se llevó a la que menos — el color de cada una
            no se mueve (sigue atado al orden en que se crearon, vía `colorDe`),
            sólo el orden en que aparecen en la lista. */}
        {/* Sólo las secciones con gastos en el período que se mira: una sección
            sin nada este mes no ocupa lugar con un "sin registros". Vuelve a
            aparecer sola en cuanto se le carga un gasto. Para renombrarlas o
            borrarlas (estén o no a la vista) está "Editar secciones", abajo. */}
        {categorias.length > 0 && gastosVentana.length === 0 && (
          <p className="py-4 text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            No hay gastos en {textoPeriodo}.
          </p>
        )}
        {categorias.filter((c) => gastosVentana.some((g) => g.categoriaId === c.id)).sort((a, b) => gastadoEn(b.id) - gastadoEn(a.id)).map((cat) => {
          const open = openCatId === cat.id;
          const gastado = gastadoEn(cat.id);
          const tope = topes[cat.id];
          const movs = gastosVentana.filter((g) => g.categoriaId === cat.id);
          return (
            // Cada categoría era su propia tarjeta con borde. Con seis
            // secciones eso son seis contornos apilados, que es lo que se lee
            // como "todo encuadrado": la lista ya dice que son hermanas, el
            // contorno solo lo repite. Ahora son filas de una misma lista.
            <div key={cat.id} data-seccion={cat.id} className="py-4 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <button type="button" aria-expanded={open} className="v2-focus w-full flex items-center justify-between rounded-xl" onClick={() => setOpenCatId(open ? null : cat.id)}>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorDe(cat.id) }} />
                  <div className="text-left">
                    <p className="font-semibold text-[15px]" style={{ color: COLORS.ink }}>{cat.nombre}</p>
                    <Monto value={gastado} className="text-[14px]" />
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
                  {recortar(movs, seccionCompleta === cat.id).map((m) => (
                    <div key={m.id}>
                      <div className="flex items-center justify-between text-[14px] gap-2 min-h-[36px]" style={{ color: COLORS.ink }}>
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_INFO[m.tipo].color }} />
                          <span className="truncate">{m.descripcion}</span>
                          <span className="shrink-0 text-[14px]" style={{ color: COLORS.inkSoft }}>{fechaDisplay(m.ts)}</span>
                        </span>
                        <span className="shrink-0 flex items-center gap-1">
                          <span className="font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtGasto(m)}</span>
                          <BotonEditar gasto={m} onClick={() => empezarEdicion(m)} />
                          <BotonBorrar gasto={m} abierto={borrando === m.id} onClick={() => setBorrando(borrando === m.id ? null : m.id)} />
                        </span>
                      </div>
                      {borrando === m.id && <ConfirmarBorrado gasto={m} onCancelar={() => setBorrando(null)} />}
                    </div>
                  ))}
                  <VerTodos
                    total={movs.length}
                    abierta={seccionCompleta === cat.id}
                    onToggle={() => setSeccionCompleta(seccionCompleta === cat.id ? null : cat.id)}
                  />
                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Tope de la sección</p>
                    <div className="relative">
                      <span className="absolute top-1/2 -translate-y-1/2 left-3.5" style={{ color: COLORS.inkSoft }}>$</span>
                      <input
                        aria-label={`Tope de ${cat.nombre}`}
                        data-tope-de={cat.id}
                        className="v2-focus w-full rounded-xl pl-7 pr-3 py-2 text-[14px] transition-colors"
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

        {categorias.length > 0 && (
          <div className="pt-4 flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={editandoSecciones}
              onClick={() => { setEditandoSecciones((v) => !v); setRenombrandoId(null); setBorrandoSeccionId(null); }}
              className="v2-focus self-start text-[14px] font-semibold underline"
              style={{ color: COLORS.brand }}
            >
              {editandoSecciones ? 'Listo' : 'Editar secciones'}
            </button>

            {editandoSecciones && (
              <ul className="flex flex-col">
                {categorias.map((c) => {
                  const cantGastos = gastos.filter((g) => g.categoriaId === c.id).length;
                  return (
                    <li key={c.id} className="py-2.5 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
                      {renombrandoId === c.id ? (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            aria-label={`Nuevo nombre para ${c.nombre}`}
                            maxLength={40}
                            className="v2-focus flex-1 min-w-0 rounded-xl px-3 min-h-[44px] text-[15px]"
                            style={INPUT_STYLE}
                            value={nombreNuevo}
                            onChange={(e) => setNombreNuevo(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && nombreNuevo.trim()) { acciones.renombrarSeccion(c.id, nombreNuevo.trim()); setRenombrandoId(null); }
                            }}
                          />
                          <button
                            type="button"
                            disabled={!nombreNuevo.trim()}
                            onClick={() => { acciones.renombrarSeccion(c.id, nombreNuevo.trim()); setRenombrandoId(null); }}
                            className="v2-focus rounded-xl px-4 min-h-[44px] text-[14px] font-bold v2-disabled"
                            style={{ background: COLORS.brand, color: COLORS.surface }}
                          >
                            Guardar
                          </button>
                          <button type="button" onClick={() => setRenombrandoId(null)} className="v2-focus rounded-xl px-3 min-h-[44px] text-[14px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorDe(c.id) }} />
                          <span className="flex-1 min-w-0 truncate text-[15px] font-semibold" style={{ color: COLORS.ink }}>{c.nombre}</span>
                          <button
                            type="button"
                            onClick={() => { setNombreNuevo(c.nombre); setRenombrandoId(c.id); setBorrandoSeccionId(null); }}
                            aria-label={`Renombrar ${c.nombre}`}
                            className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                            style={{ color: COLORS.inkFaint }}
                          >
                            <IconEditar size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setBorrandoSeccionId(borrandoSeccionId === c.id ? null : c.id); setRenombrandoId(null); }}
                            aria-label={`Borrar la sección ${c.nombre}`}
                            aria-expanded={borrandoSeccionId === c.id}
                            className="v2-focus w-11 h-11 -mr-2 rounded-full flex items-center justify-center shrink-0"
                            style={{ color: borrandoSeccionId === c.id ? COLORS.ink : COLORS.inkFaint }}
                          >
                            <IconBasura size={18} />
                          </button>
                        </div>
                      )}

                      {borrandoSeccionId === c.id && (
                        <div className="rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado de la sección">
                          <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
                            ¿Borrar la sección "{c.nombre}"?
                            {cantGastos > 0
                              ? ` Sus ${cantGastos} ${cantGastos === 1 ? 'gasto no se borra' : 'gastos no se borran'}: ${cantGastos === 1 ? 'queda' : 'quedan'} sin sección.`
                              : ' No tiene gastos.'}
                          </p>
                          <div className="flex gap-2">
                            <button type="button" autoFocus onClick={() => setBorrandoSeccionId(null)} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (openCatId === c.id) setOpenCatId(null); acciones.borrarSeccion(c.id); setBorrandoSeccionId(null); }}
                              className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-bold"
                              style={{ background: COLORS.ink, color: COLORS.paper }}
                            >
                              Sí, borrar
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <ListaGastosFijos />

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
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              aria-label="Buscar gastos por nombre"
              className="v2-focus rounded-2xl px-4 py-2.5 text-[15px] transition-colors"
              style={INPUT_STYLE}
              placeholder="Buscar por nombre (ej: Rappi)"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="filtro-desde" className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Desde</label>
                <input
                  id="filtro-desde"
                  type="date"
                  aria-label="Filtrar gastos desde esta fecha"
                  className="v2-focus w-full rounded-xl px-3 py-2 text-[14px] transition-colors"
                  style={INPUT_STYLE}
                  value={filtroDesde}
                  max={filtroHasta || undefined}
                  onChange={(e) => setFiltroDesde(e.target.value)}
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="filtro-hasta" className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Hasta</label>
                <input
                  id="filtro-hasta"
                  type="date"
                  aria-label="Filtrar gastos hasta esta fecha"
                  className="v2-focus w-full rounded-xl px-3 py-2 text-[14px] transition-colors"
                  style={INPUT_STYLE}
                  value={filtroHasta}
                  min={filtroDesde || undefined}
                  onChange={(e) => setFiltroHasta(e.target.value)}
                />
              </div>
              {hayFiltroFecha && (
                <button
                  type="button"
                  onClick={() => { setFiltroDesde(''); setFiltroHasta(''); }}
                  aria-label="Sacar el filtro de fecha"
                  className="v2-focus self-end min-h-[44px] text-[14px] font-semibold underline"
                  style={{ color: COLORS.inkSoft }}
                >
                  Sacar
                </button>
              )}
            </div>
          </div>
        )}
        <SegmentedTab
          options={[{ id: 'recientes' as const, label: 'Más recientes' }, { id: 'monto' as const, label: 'Mayor monto' }]}
          value={orden}
          onChange={setOrden}
          trackColor={COLORS.tint}
        />

        {gastos.length === 0 && <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste gastos.</p>}
        {gastos.length > 0 && gastosFiltrados.length === 0 && (
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>
            {hayFiltroFecha && hayBusqueda ? 'No encontramos gastos con ese nombre en ese rango de fechas.'
              : hayFiltroFecha ? 'No encontramos gastos en ese rango de fechas.'
              : hayBusqueda ? `No encontramos gastos con ese nombre en ${textoPeriodo}.`
              : `Todavía no hay gastos en ${textoPeriodo}.`}
          </p>
        )}
        {recortar(gastosFiltrados, mostrarTodos).map((g) => {
          const cat = categorias.find((c) => c.id === g.categoriaId);
          return (
            // Idem: un movimiento no es una tarjeta, es un renglón.
            <div key={g.id} className="py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIPO_INFO[g.tipo].color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] truncate" style={{ color: COLORS.ink }}>{g.descripcion}</p>
                  <p className="text-[14px] truncate" style={{ color: COLORS.inkSoft }}>
                    {[cat?.nombre ?? 'Sin sección', g.tipoOtro, fechaDisplay(g.ts)].filter(Boolean).join(', ')}
                  </p>
                </div>
                <span className="font-mono tabular-nums text-[15px] shrink-0" style={{ color: COLORS.ink }}>{fmtGasto(g)}</span>
                {/* Todos se pueden editar y borrar, también los que llegaron por WhatsApp. */}
                <BotonEditar gasto={g} onClick={() => empezarEdicion(g)} />
                <BotonBorrar gasto={g} abierto={borrando === g.id} onClick={() => setBorrando(borrando === g.id ? null : g.id)} />
              </div>
              {borrando === g.id && <ConfirmarBorrado gasto={g} onCancelar={() => setBorrando(null)} />}
            </div>
          );
        })}
        {!hayBusqueda && !hayFiltroFecha && (
          <VerTodos total={gastosFiltrados.length} abierta={verTodos} onToggle={() => setVerTodos((v) => !v)} />
        )}
      </div>

      <div className="lg:col-span-3">
        <ArmarGrupoBtn />
      </div>
      </div>
    </div>
  );
}
