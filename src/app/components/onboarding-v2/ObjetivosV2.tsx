import { useEffect, useMemo, useState } from 'react';
import { Fini } from './Fini';
import { ArmarGrupoBtn, COLORS, Celebracion, Coachmark, Cta, Donut, EstadoConfianza, SegmentedTab, Titulo, TituloSeccion, fechaDisplay, fmtMoney, formatThousands, invitarAGrupo, loadV2Nombre, loadV2PerfilOnboarding, parseMoneyInput, useCountUp } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { FiniPresenta } from './FiniDice';
import * as acciones from '../../api/v2/acciones';
import { precargarCotizacion } from '../../api/v2/cotizacion';
import type { Moneda as MonedaV2 } from '../../api/v2/tipos';

// Sugerencias para arrancar cuando todavía no hay objetivos — le dan
// emoción/juego a la pantalla vacía; tocás una y abre el modal precargado.
import { IconBasura, IconCalendario, IconChevron, IconClose, IconEditar, IconGrupo, IconMas } from './FinaIcons';

// Sin emoji (guía §2/§5.4): son chips de TEXTO. La categoría se dice con la
// palabra, no con un pictograma.
const SUGERENCIAS_OBJETIVO = [
  { nombre: 'Un viaje' },
  { nombre: 'Fondo de emergencia' },
  { nombre: 'Una compra grande' },
  { nombre: 'Mudanza' },
  { nombre: 'Estudios' },
  { nombre: 'Un regalo' },
];

// REDISEÑO v2 — Objetivos: mantiene la lógica "oficial" de la app real
// (ver ObjetivosPage.tsx / GoalEditModal.tsx) pasada a la estética nueva —
// un objetivo tiene un monto total y una lista de REGISTROS ("ya lo pagué"
// / "lo separé") que van llenando el donut. Lo que falta = pendiente.
//
// El monto no siempre se sabe de entrada, así que admite 3 modos: un monto
// exacto, un rango (todavía no lo tenés cerrado), o "todavía no sé" (se
// completa más adelante). Solo el estado "nunca contestado" (viene así del
// onboarding cuando se nombra un objetivo sin más datos) se marca como
// Incompleto en rojo — "todavía no sé" es una respuesta válida, no un error.
//
// Si hay un grupo armado (ver GruposV2), un objetivo puede ser grupal: cada
// registro se etiqueta con quién lo hizo, así se ve el aporte de cada una
// aunque todavía no haya cuentas reales sincronizando esto entre celulares.

type Kind = 'paid' | 'saved';
type MontoModo = 'exacto' | 'rango' | 'desconocido';
type TipoObjetivo = 'individual' | 'grupal';
// La moneda sale del contrato de datos, no se redeclara: era `string`, y con
// eso "AR$" o cualquier typo pasaba el typecheck y llegaba a la base.
type Moneda = MonedaV2;

// Catálogo de monedas — las más usadas acá arriba (ARS/USD) y después
// cualquier otra, para el dropdown al elegir la moneda de un objetivo. Sin
// banderas (guía §2/§5.4): la moneda se identifica por su CÓDIGO en texto
// (ARS/USD…), no con un emoji de bandera. Es un demo local, así que no
// cotizamos entre monedas: cada objetivo lleva su moneda y sus montos se
// muestran en ella.
const MONEDAS: { code: Moneda; label: string }[] = [
  { code: 'ARS', label: 'Peso argentino' },
  { code: 'USD', label: 'Dólar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'BRL', label: 'Real brasileño' },
  { code: 'CLP', label: 'Peso chileno' },
  { code: 'UYU', label: 'Peso uruguayo' },
  { code: 'GBP', label: 'Libra esterlina' },
  { code: 'MXN', label: 'Peso mexicano' },
];
// Formatea un monto en la moneda dada. ARS usa el símbolo $; el resto se
// muestra con su código (ej: "USD 1.200") para no inventar símbolos.
function fmtMonto(monto: number, moneda: Moneda): string {
  if (moneda === 'ARS') return fmtMoney(monto);
  return `${moneda} ${Math.round(monto).toLocaleString('es-AR')}`;
}

// Monto de objetivo — cumple la regla dura de la guía (§3.4): TODO número
// comparable va en cifras tabulares mono. El primitivo <Monto> de shared solo
// sabe pesos; acá los objetivos pueden estar en otra moneda, así que este
// wrapper mantiene el mismo tratamiento (mono tabular, tinta neutral) y encima
// respeta la moneda. Neutral por defecto: un monto no es una alerta.
function MontoObj({
  monto, moneda, className = '', style,
}: { monto: number; moneda: Moneda; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`font-mono tabular-nums ${className}`} style={{ color: COLORS.ink, ...style }}>
      {fmtMonto(monto, moneda)}
    </span>
  );
}

// Check fino (reemplaza al ✓ emoji, guía §2/§5.4). Hereda el color del
// contenedor vía currentColor, como el resto de la iconografía de línea.
function CheckMini({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 11" fill="none" aria-hidden>
      <path d="M1 5.5L5 9.5L13 1.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Estilos scopeados que necesitan pseudo-clases (:focus / :hover) y por eso no
// se pueden poner inline. TODO color sale de COLORS (no hay hex crudo): esto
// mantiene los inputs y el menú de moneda dentro de la paleta de la guía.
const V2_STYLES = (
  <style>{`
    .ov2-input { border: 1px solid ${COLORS.line}; }
    .ov2-input:focus { border-color: ${COLORS.brand}; }
    .ov2-menu-item:hover { background: ${COLORS.brandSoft}; }
  `}</style>
);

// Aporte real de los últimos 7 días — sale de los registros que cargó la
// persona (dato DECLARADO), es el "delta" de la semana que pide la guía (§5.3)
// para que el avance chico igual se lea como avance.
function aporteUltimaSemana(o: Objetivo): number {
  const desde = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return o.contribuciones.filter((c) => c.ts >= desde).reduce((s, c) => s + c.monto, 0);
}

// Dropdown de moneda — cada opción se identifica por su código (ARS/USD…),
// sin banderas. Las más usadas ya vienen primero en MONEDAS. Se cierra al
// elegir o al tocar afuera.
function MonedaDropdown({ value, onChange }: { value: Moneda; onChange: (v: Moneda) => void }) {
  const [open, setOpen] = useState(false);
  const actual = MONEDAS.find((m) => m.code === value) ?? MONEDAS[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Moneda: ${actual.code}`}
        className="v2-focus flex items-center gap-1.5 rounded-xl px-3 py-2 text-[15px] font-semibold transition-colors"
        style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
      >
        <span>{actual.code}</span>
        <IconChevron size={14} style={{ transform: 'rotate(90deg)', color: COLORS.inkFaint }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 right-0 w-56 max-h-60 overflow-y-auto rounded-xl border shadow-[0_6px_24px_rgba(43,33,24,0.16)]" style={{ background: COLORS.surface, borderColor: COLORS.line }}>
            {MONEDAS.map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => { onChange(m.code); setOpen(false); }}
                className="ov2-menu-item v2-focus w-full flex items-center gap-2 px-3 py-2.5 text-left text-[15px] transition-colors"
                style={{ color: COLORS.ink }}
              >
                <span className="font-semibold w-9 shrink-0">{m.code}</span>
                <span className="truncate" style={{ color: COLORS.inkSoft }}>{m.label}</span>
                {value === m.code && <span className="ml-auto shrink-0 inline-flex" style={{ color: COLORS.brand }}><CheckMini /></span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
type Contribucion = { id: string; monto: number; moneda: Moneda; kind: Kind; label: string; ts: number; de: string };
type Objetivo = {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoObjetivo;
  moneda: Moneda;
  horizonte?: string | null;
  montoModo: MontoModo | null; // null = todavía no contestó nada (viene del onboarding)
  montoTotal: number; // para cálculos: el monto exacto, o el máximo del rango; 0 si desconocido/sin definir
  montoMin?: number; // solo si montoModo === 'rango'
  contribuciones: Contribucion[];
};

// Nota Tailwind: la clase completa tiene que aparecer en el archivo (aunque
// sea dentro de este string) para que el scanner de Tailwind la detecte.
const CARD_SHADOW = 'border';
// Borde + foco por CSS (ov2-input, ver V2_STYLES) para que el color salga de
// COLORS y no de un hex crudo en la clase de Tailwind. v2-focus agrega el
// anillo de foco de la guía (§11).
const inputClass = 'ov2-input v2-focus rounded-xl px-3 py-2.5 text-[16px] outline-none transition-colors';

const HORIZONTE_OPCIONES = ['Lo antes posible', 'Todavía no lo pensé'];

// Plazo del objetivo — quedó acá (ya no en el onboarding) porque cada
// objetivo puede tener el suyo propio. Si toca "elegir una fecha exacta",
// se abre un calendario real en vez de pedirlo escrito.
function HorizontePicker({ valor, setValor, fecha, setFecha }: { valor: string | null; setValor: (v: string | null) => void; fecha: string; setFecha: (v: string) => void }) {
  const fechaElegida = !!fecha;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {HORIZONTE_OPCIONES.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => { setValor(o); setFecha(''); }}
            className="v2-focus rounded-xl px-3 py-2 text-[15px] font-semibold transition-all duration-100 active:scale-95"
            style={valor === o && !fechaElegida ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
          >
            {o}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setValor(null)}
          className="v2-focus flex items-center gap-1.5 rounded-xl px-3 py-2 text-[15px] font-semibold transition-all duration-100 active:scale-95"
          style={fechaElegida || valor === null ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
        >
<IconCalendario size={15} /> Fecha exacta
        </button>
      </div>
      {(valor === null || fechaElegida) && (
        <input
          type="date"
          className={`${inputClass} w-full`}
          value={fecha}
          onChange={(e) => { setFecha(e.target.value); setValor(null); }}
        />
      )}
    </div>
  );
}

// Los objetivos salen del almacén (tabla `goals` + `goal_contributions`). Esta
// pantalla no guarda nada por su cuenta: escribe llamando a `acciones`.
//
// `montoTotal: 0` acá significa "no hay monto con el que calcular progreso" y
// se corresponde con `amount_ars = null` en la base. NO son lo mismo
// conceptualmente —$0 sería un objetivo gratis— y por eso la base guarda null
// y `modoMonto` dice por qué: 'desconocido' (no lo sabe) o null (no se
// preguntó). Ver la migración 0024.

function buildMonto(modo: MontoModo, montoTxt: string, minTxt: string): { montoModo: MontoModo; montoTotal: number; montoMin?: number } {
  if (modo === 'desconocido') return { montoModo: 'desconocido', montoTotal: 0 };
  if (modo === 'rango') {
    const min = parseMoneyInput(minTxt);
    const max = parseMoneyInput(montoTxt);
    return { montoModo: 'rango', montoTotal: max, montoMin: min || undefined };
  }
  return { montoModo: 'exacto', montoTotal: parseMoneyInput(montoTxt) };
}

// 'definido' = tiene un monto (exacto o rango) con el que calcular progreso.
// 'desconocido' = eligió "todavía no sé" a propósito — no es un error.
// 'incompleto' = nunca contestó nada (recién llegó del onboarding).
function estadoMonto(o: Objetivo): 'definido' | 'desconocido' | 'incompleto' {
  if (o.montoModo === 'desconocido') return 'desconocido';
  if (o.montoTotal > 0) return 'definido';
  return 'incompleto';
}

// Consejo para llegar más rápido a un objetivo — con lo único que ya
// sabemos de verdad (las categorías que la persona dijo que le gustaría
// recortar en el onboarding), no un cálculo de "ahorrá $X/mes" inventado.
function consejoPara(o: Objetivo, estado: 'definido' | 'desconocido' | 'incompleto'): string | null {
  if (estado !== 'definido') return null;
  const perfil = loadV2PerfilOnboarding();
  const categoria = perfil?.categoriasRecortar?.[0];
  if (!categoria) return null;
  return `Nos dijiste que querías gastar menos en ${categoria} — cada peso que ahorres ahí puede ir directo a "${o.nombre}".`;
}

function montoLabel(o: Objetivo): string {
  if (o.montoModo === 'rango' && o.montoMin) return `${fmtMonto(o.montoMin, o.moneda)}–${fmtMonto(o.montoTotal, o.moneda)}`;
  return fmtMonto(o.montoTotal, o.moneda);
}

// Selector de "cómo querés poner el monto" — se reusa al crear un objetivo
// y al completar uno que llegó incompleto desde el onboarding.
function MontoPicker({
  modo, setModo, montoTxt, setMontoTxt, minTxt, setMinTxt,
}: {
  modo: MontoModo; setModo: (m: MontoModo) => void;
  montoTxt: string; setMontoTxt: (v: string) => void;
  minTxt: string; setMinTxt: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        {([
          ['exacto', 'Monto exacto'],
          ['rango', 'Un rango'],
          ['desconocido', 'Todavía no sé'],
        ] as [MontoModo, string][]).map(([m, label]) => {
          const sel = modo === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className="v2-focus flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-[14px] font-semibold transition-all duration-100 active:scale-95"
              style={sel ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {modo === 'exacto' && (
        <div className="relative">
          <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
          <input
            className={`w-full ${inputClass} pl-8`}
            placeholder="¿Cuánto necesitás en total?"
            inputMode="decimal"
            value={montoTxt}
            onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
          />
        </div>
      )}

      {modo === 'rango' && (
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              className={`w-full ${inputClass} pl-8`}
              placeholder="Desde"
              inputMode="decimal"
              value={minTxt}
              onChange={(e) => setMinTxt(formatThousands(e.target.value))}
            />
          </div>
          <div className="relative flex-1 min-w-0">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              className={`w-full ${inputClass} pl-8`}
              placeholder="Hasta"
              inputMode="decimal"
              value={montoTxt}
              onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
            />
          </div>
        </div>
      )}

      {modo === 'desconocido' && (
        <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Buenísimo — lo vas a poder poner más adelante, cuando lo tengas más claro.</p>
      )}
    </div>
  );
}

export function ObjetivosV2() {
  const { estado: db } = useAlmacen();
  const miUserId = db.grupo?.miembros.find((m) => m.sosVos)?.userId ?? '';
  const nombrePorUserId = useMemo(
    () => new Map((db.grupo?.miembros ?? []).map((m) => [m.userId, m.nombre])),
    [db.grupo],
  );

  const objetivos = useMemo<Objetivo[]>(() => db.objetivos.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    descripcion: o.descripcion,
    tipo: o.tipo,
    moneda: o.moneda,
    horizonte: o.horizonte,
    montoModo: o.modoMonto,
    montoTotal: o.montoTotal ?? 0,
    montoMin: o.montoMin ?? undefined,
    contribuciones: o.contribuciones.map((c) => ({
      id: c.id,
      monto: c.monto,
      moneda: c.moneda,
      kind: c.kind,
      label: c.label ?? '',
      ts: c.ts,
      // En un objetivo grupal importa quién puso qué. El nombre sale de las
      // miembras del grupo; si la contribución es tuya, "Vos".
      de: c.deUserId === miUserId
        ? (loadV2Nombre() || 'Vos')
        : (nombrePorUserId.get(c.deUserId) ?? 'Alguien'),
    })),
  })), [db.objetivos, miUserId, nombrePorUserId]);

  useEffect(() => { precargarCotizacion(); }, []);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoObjetivo>('individual');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [horizonte, setHorizonte] = useState<string | null>(null);
  const [horizonteFecha, setHorizonteFecha] = useState('');
  const [invitarNombre, setInvitarNombre] = useState('');
  const [montoModo, setMontoModo] = useState<MontoModo>('exacto');
  const [montoTotal, setMontoTotal] = useState('');
  const [montoMinTxt, setMontoMinTxt] = useState('');

  const [kind, setKind] = useState<Kind>('paid');
  const [regLabel, setRegLabel] = useState('');
  const [regMonto, setRegMonto] = useState('');
  const [regMoneda, setRegMoneda] = useState<Moneda>('ARS');
  const [montoModoEdit, setMontoModoEdit] = useState<MontoModo>('exacto');
  const [montoTotalEdit, setMontoTotalEdit] = useState('');
  const [montoMinEdit, setMontoMinEdit] = useState('');

  // Editar un objetivo existente (nombre/descripción/moneda/tipo/monto).
  const [editando, setEditando] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editTipo, setEditTipo] = useState<TipoObjetivo>('individual');
  const [editMoneda, setEditMoneda] = useState<Moneda>('ARS');
  const [editHorizonte, setEditHorizonte] = useState<string | null>(null);
  const [editHorizonteFecha, setEditHorizonteFecha] = useState('');
  // Monto editable al editar el objetivo (mismo picker que al crearlo).
  const [editMontoModo, setEditMontoModo] = useState<MontoModo>('exacto');
  const [editMontoTotal, setEditMontoTotal] = useState('');
  const [editMontoMin, setEditMontoMin] = useState('');
  // Objetivo pendiente de confirmar borrado (id) → abre el diálogo sí/no.
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  // Celebración al sumar un registro (burst); `big` al llegar a la meta.
  const [celebrar, setCelebrar] = useState(false);
  const [celebrarBig, setCelebrarBig] = useState(false);

  const grupo = db.grupo;
  const [invitado, setInvitado] = useState(false);

  async function invitarGente() {
    if (!grupo) return;
    const resultado = await invitarAGrupo(grupo);
    if (resultado === 'copiado') { setInvitado(true); setTimeout(() => setInvitado(false), 1800); }
  }

  const abierto = objetivos.find((o) => o.id === openId) || null;
  useEffect(() => { if (abierto) setRegMoneda(abierto.moneda); }, [abierto?.id]);

  async function crearObjetivo() {
    if (!nombre.trim()) return;
    const monto = buildMonto(montoModo, montoTotal, montoMinTxt);
    const horizonteFinal = horizonteFecha ? new Date(horizonteFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : horizonte;
    const creado = acciones.crearObjetivo({
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      tipo,
      moneda,
      horizonte: horizonteFinal,
      modoMonto: monto.montoModo,
      // 0 no es un monto: si no lo sabe, la base guarda null.
      montoTotal: monto.montoTotal > 0 ? monto.montoTotal : null,
      montoMin: monto.montoMin ?? null,
    });

    // Objetivo en conjunto sin grupo todavía → se crea el grupo de verdad, con
    // su código, para poder invitar. Antes esto armaba un grupo de ejemplo con
    // miembras inventadas.
    if (tipo === 'grupal' && invitarNombre.trim() && !grupo) {
      await acciones.crearGrupo(invitarNombre.trim());
    }

    setNombre(''); setDescripcion(''); setMontoTotal(''); setMontoMinTxt(''); setMontoModo('exacto'); setTipo('individual');
    setMoneda('ARS'); setInvitarNombre(''); setHorizonte(null); setHorizonteFecha('');
    setCreating(false);
    setOpenId(creado.id);
  }

  function borrarObjetivo(id: string) {
    acciones.borrarObjetivo(id);
    if (openId === id) setOpenId(null);
  }

  // Acepta un objetivo explícito para poder editar desde las cards de la
  // lista (donde todavía no hay "abierto") además de desde el detalle.
  function empezarEdicion(o?: Objetivo) {
    const obj = o ?? abierto;
    if (!obj) return;
    setEditNombre(obj.nombre);
    setEditDescripcion(obj.descripcion);
    setEditTipo(obj.tipo);
    setEditMoneda(obj.moneda);
    setEditHorizonte(obj.horizonte ?? null);
    setEditHorizonteFecha('');
    // Precargamos el monto tal como estaba, para poder editarlo.
    setEditMontoModo(obj.montoModo ?? 'exacto');
    setEditMontoTotal(obj.montoTotal > 0 ? formatThousands(String(obj.montoTotal)) : '');
    setEditMontoMin(obj.montoMin ? formatThousands(String(obj.montoMin)) : '');
    setOpenId(obj.id);
    setEditando(true);
  }
  function guardarEdicion() {
    if (!abierto || !editNombre.trim()) return;
    const horizonteFinal = editHorizonteFecha ? new Date(editHorizonteFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : editHorizonte;
    const monto = buildMonto(editMontoModo, editMontoTotal, editMontoMin);
    acciones.editarObjetivo(abierto.id, {
      nombre: editNombre.trim(),
      descripcion: editDescripcion.trim(),
      tipo: editTipo,
      moneda: editMoneda,
      horizonte: horizonteFinal,
      modoMonto: monto.montoModo,
      montoTotal: monto.montoTotal > 0 ? monto.montoTotal : null,
      montoMin: monto.montoMin ?? null,
    });
    setEditando(false);
  }

  async function agregarRegistro() {
    if (!abierto) return;
    const monto = parseMoneyInput(regMonto);
    if (monto <= 0) return;

    setErrorRegistro(null);
    const r = await acciones.sumarContribucion(abierto.id, {
      monto,
      moneda: regMoneda,
      kind,
      label: regLabel.trim() || (kind === 'paid' ? 'Pago' : 'Separado'),
    });
    if (r.error !== null) { setErrorRegistro(r.error); return; }
    setRegLabel(''); setRegMonto('');
    // Celebración: burst normal, o grande si con este registro llegás a la meta.
    const prevSaved = saved(abierto);
    const total = abierto.montoTotal;
    const llegasteALaMeta = total > 0 && prevSaved < total && prevSaved + monto >= total;
    setCelebrarBig(llegasteALaMeta);
    setCelebrar(true);
    setTimeout(() => setCelebrar(false), llegasteALaMeta ? 1100 : 800);
  }

  function borrarRegistro(regId: string) {
    if (!abierto) return;
    acciones.borrarContribucion(abierto.id, regId);
  }

  function completarMontoTotal() {
    if (!abierto) return;
    const monto = buildMonto(montoModoEdit, montoTotalEdit, montoMinEdit);
    if (monto.montoModo !== 'desconocido' && monto.montoTotal <= 0) return;
    acciones.editarObjetivo(abierto.id, {
      modoMonto: monto.montoModo,
      montoTotal: monto.montoTotal > 0 ? monto.montoTotal : null,
      montoMin: monto.montoMin ?? null,
    });
    setMontoTotalEdit(''); setMontoMinEdit(''); setMontoModoEdit('exacto');
  }

  const saved = (o: Objetivo) => o.contribuciones.reduce((s, c) => s + c.monto, 0);
  const pct = (o: Objetivo) => (o.montoTotal > 0 ? Math.min(Math.round((saved(o) / o.montoTotal) * 100), 100) : 0);

  // Diálogo de confirmación de borrado — se muestra tanto en la lista como
  // en el detalle. El naranja (atención accionable) va de RELLENO con texto en
  // tinta (guía §3.3: los acentos nunca llevan texto blanco); "No" en hueco.
  const objAConfirmar = objetivos.find((o) => o.id === confirmarBorrar) || null;
  const confirmarBorrarModal = objAConfirmar && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: `${COLORS.ink}80` }} onClick={() => setConfirmarBorrar(null)}>
      <div className="w-full max-w-[320px] rounded-2xl p-5 flex flex-col gap-4" style={{ background: COLORS.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1">
          <p className="text-[18px] font-bold" style={{ color: COLORS.ink }}>¿Borrar este objetivo?</p>
          <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Se va a eliminar “{objAConfirmar.nombre}” y todos sus registros. No se puede deshacer.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmarBorrar(null)}
            className="v2-focus flex-1 rounded-xl py-2.5 text-[16px] font-bold transition-all duration-100 active:scale-95"
            style={{ background: COLORS.tint, color: COLORS.inkSoft }}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => { borrarObjetivo(objAConfirmar.id); setConfirmarBorrar(null); }}
            className="v2-focus flex-1 rounded-xl py-2.5 text-[16px] font-bold transition-all duration-100 active:scale-95"
            style={{ background: COLORS.naranja, color: COLORS.ink }}
          >
            Sí, borrar
          </button>
        </div>
      </div>
    </div>
  );

  // Valores animados del objetivo abierto (números que cuentan + dona que
  // se llena). Los hooks van SIEMPRE acá arriba, antes de cualquier return.
  const animAcum = useCountUp(abierto ? saved(abierto) : 0);
  const animPct = useCountUp(abierto ? pct(abierto) : 0);

  // ── Vista: detalle de un objetivo ──
  if (abierto) {
    const estado = estadoMonto(abierto);
    const total = abierto.montoTotal;
    const acumulado = saved(abierto);
    const restante = Math.max(total - acumulado, 0);
    const porcentaje = pct(abierto);
    const done = estado === 'definido' && acumulado >= total;
    // Aporte real de la última semana (dato declarado) → el "delta" de §5.3.
    const aporteSemana = aporteUltimaSemana(abierto);
    // Cuándo llegás: lo CALCULAMOS nosotras a partir del ritmo reciente, así
    // que es un ESTIMADO (§5.1) y se muestra como rango de semanas con su
    // marca, nunca como un número exacto (§5.2).
    const semanasEstimadas = estado === 'definido' && !done && aporteSemana > 0 && restante > 0
      ? { lo: Math.max(1, Math.floor(restante / aporteSemana)), hi: Math.ceil(restante / aporteSemana) + 1 }
      : null;

    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4 lg:max-w-2xl lg:mx-auto">
        {V2_STYLES}
        {confirmarBorrarModal}
        <div className="flex items-center justify-between">
          <button type="button" className="v2-focus inline-flex items-center gap-1 text-[15px] font-semibold" style={{ color: COLORS.inkSoft }} onClick={() => setOpenId(null)}>
            <IconChevron size={15} style={{ transform: 'rotate(180deg)' }} /> Volver
          </button>
          <div className="flex items-center gap-3">
            {abierto.tipo === 'grupal' && grupo && (
              <button type="button" className="v2-focus inline-flex items-center gap-1 text-[14px] font-semibold underline" style={{ color: COLORS.brand }} onClick={invitarGente}>{invitado ? <><CheckMini /> Copiado</> : 'Invitar'}</button>
            )}
            <button type="button" className="v2-focus text-[14px] font-semibold underline" style={{ color: COLORS.brand }} onClick={() => empezarEdicion()}>Editar</button>
            <button type="button" className="v2-focus text-[14px] font-semibold underline" style={{ color: COLORS.coralDark }} onClick={() => setConfirmarBorrar(abierto.id)}>Borrar</button>
          </div>
        </div>

        {editando ? (
          <div className="flex flex-col gap-2.5 pt-1">
            <TituloSeccion>Editar objetivo</TituloSeccion>
            <input className={inputClass} placeholder="Nombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
            <input className={inputClass} placeholder="Descripción (opcional)" value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
            <SegmentedTab
              options={[{ id: 'individual' as TipoObjetivo, label: 'Individual' }, { id: 'grupal' as TipoObjetivo, label: 'En conjunto' }]}
              value={editTipo} onChange={setEditTipo} trackColor={COLORS.gold}
            />
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Moneda</p>
              <MonedaDropdown value={editMoneda} onChange={setEditMoneda} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>¿Cuánto necesitás?</p>
            <MontoPicker
              modo={editMontoModo} setModo={setEditMontoModo}
              montoTxt={editMontoTotal} setMontoTxt={setEditMontoTotal}
              minTxt={editMontoMin} setMinTxt={setEditMontoMin}
            />
            <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>¿Para cuándo?</p>
            <HorizontePicker valor={editHorizonte} setValor={setEditHorizonte} fecha={editHorizonteFecha} setFecha={setEditHorizonteFecha} />
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setEditando(false)} className="v2-focus flex-1 rounded-xl py-2.5 text-[15px] font-semibold border" style={{ color: COLORS.ink, borderColor: COLORS.line }}>Cancelar</button>
              <button type="button" onClick={guardarEdicion} disabled={!editNombre.trim()} className="v2-focus flex-[2] rounded-xl py-2.5 text-[15px] font-bold v2-disabled transition-all duration-100 active:scale-95" style={{ background: COLORS.brand, color: COLORS.surface }}>Guardar cambios</button>
            </div>
          </div>
        ) : (
        <div className="relative py-2 flex gap-4 items-center">
          <Celebracion show={celebrar} big={celebrarBig} />
          {estado === 'definido' && (
            <Donut
              segments={[{ color: COLORS.lima, pct: Math.round(animPct) }]}
              centerLabel={done ? '¡Lograste!' : 'Logrado'}
              centerValue={`${Math.round(animPct)}%`}
              size={96}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[20px] font-bold truncate" style={{ color: COLORS.ink }}>{abierto.nombre}</p>
              {abierto.tipo === 'grupal' && (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                  <IconGrupo size={11} /> Grupal
                </span>
              )}
              {abierto.moneda !== 'ARS' && (
                <span className="text-[12px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.skySoft, color: COLORS.ink }}>
                  {abierto.moneda}
                </span>
              )}
              {/* Sin monto todavía = dato "por descubrir" (guía §5.1): una
                  invitación, nunca un error. Se marca con el trazo tenue de
                  EstadoConfianza, no con un badge de alerta. */}
              {estado !== 'definido' && <EstadoConfianza estado="por-descubrir" />}
            </div>
            {abierto.descripcion && <p className="text-[14px] mt-0.5" style={{ color: COLORS.inkSoft }}>{abierto.descripcion}</p>}
            {abierto.horizonte && (
              <p className="text-[14px] mt-0.5 flex items-center gap-1" style={{ color: COLORS.inkFaint }}><IconCalendario size={13} /> {abierto.horizonte}</p>
            )}
            {estado === 'definido' && (
              <>
                <p className="text-[15px] mt-1.5" style={{ color: COLORS.ink }}>
                  Llevás <MontoObj monto={Math.round(animAcum)} moneda={abierto.moneda} className="font-semibold" /> de <span className="font-mono tabular-nums" style={{ color: COLORS.ink }}>{montoLabel(abierto)}</span>
                </p>
                {/* El total es lo que la persona nos declaró (§5.1). */}
                <EstadoConfianza estado="declarado" className="mt-0.5" />
                {!done && <p className="text-[14px] mt-1" style={{ color: COLORS.inkSoft }}>Te falta <MontoObj monto={restante} moneda={abierto.moneda} /></p>}
                {/* Delta de la semana en LIMA: el avance chico igual se lee
                    como avance (§5.3), y el lima es el color del avance. */}
                {aporteSemana > 0 && (
                  <p className="text-[14px] mt-1 font-semibold inline-flex items-center" style={{ color: COLORS.limaText }}>
                    +<MontoObj monto={aporteSemana} moneda={abierto.moneda} style={{ color: COLORS.limaText }} />&nbsp;esta semana
                  </p>
                )}
                {/* Cuándo llegás: estimado → rango de semanas + marca. */}
                {semanasEstimadas && (
                  <span className="mt-1 flex flex-col gap-0.5">
                    <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>A este ritmo, entre {semanasEstimadas.lo} y {semanasEstimadas.hi} semanas para lograrlo.</span>
                    <EstadoConfianza estado="estimado" />
                  </span>
                )}
              </>
            )}
            {estado !== 'definido' && (
              <p className="text-[14px] mt-1" style={{ color: COLORS.inkSoft }}>Todavía no le pusimos un monto. Cuando lo tengas te muestro el progreso — y si querés lo afinamos juntas.</p>
            )}
          </div>
        </div>
        )}

        {estado !== 'definido' && (
          <div className="flex flex-col gap-2.5 pt-1">
            <TituloSeccion>¿Cuánto necesitás?</TituloSeccion>
            <MontoPicker
              modo={montoModoEdit} setModo={setMontoModoEdit}
              montoTxt={montoTotalEdit} setMontoTxt={setMontoTotalEdit}
              minTxt={montoMinEdit} setMinTxt={setMontoMinEdit}
            />
            <button
              type="button"
              onClick={completarMontoTotal}
              disabled={montoModoEdit !== 'desconocido' && parseMoneyInput(montoTotalEdit) <= 0}
              className="v2-focus rounded-xl px-4 py-2.5 font-bold v2-disabled transition-all duration-100 active:scale-95"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              Guardar
            </button>
          </div>
        )}

        {done && (
          <div className="flex flex-col items-center gap-2 py-2">
            <Fini state="logro" size={132} />
            <p className="rounded-2xl px-4 py-3.5 text-[16px] font-bold text-center" style={{ background: COLORS.lima, color: COLORS.ink }}>
              ¡Ya juntaste todo lo que necesitás para este objetivo!
            </p>
          </div>
        )}

        {!done && consejoPara(abierto, estado) && (
          <p className="text-[15px] leading-snug pl-3.5 border-l-2" style={{ color: COLORS.inkSoft, borderColor: COLORS.star }}>
            {consejoPara(abierto, estado)}
          </p>
        )}

        {/* Registrar un pago o un ahorro */}
        <div className="flex flex-col gap-2.5 pt-1">
          <TituloSeccion>Sumar un registro</TituloSeccion>
          {/* PRUEBA — un aporte guardado es un logro chico: Fini salta una vez
              y se va. Se engancha al `celebrar` que ya existía, así no hay otro
              temporizador. `key` fuerza el remontaje para que se vuelva a
              disparar cada vez, que es lo que pide el paquete para los estados
              de una sola pasada. */}
          {celebrar && !celebrarBig && (
            <div className="flex justify-center">
              <Fini key={`prog-${abierto.contribuciones.length}`} state="progreso" size={96} once />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(['paid', 'saved'] as const).map((k) => {
              const sel = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className="v2-focus py-2 rounded-xl text-[15px] font-semibold transition-all duration-100 active:scale-95"
                  style={sel ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                >
                  {k === 'paid' ? 'Ya lo pagué' : 'Lo separé'}
                </button>
              );
            })}
          </div>
          <input
            className={inputClass}
            placeholder={kind === 'paid' ? '¿Qué pagaste? (opcional)' : 'Nota (opcional)'}
            value={regLabel}
            onChange={(e) => setRegLabel(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className={`flex-1 min-w-0 ${inputClass}`}
              placeholder="Monto"
              inputMode="decimal"
              value={regMonto}
              onChange={(e) => setRegMonto(formatThousands(e.target.value))}
            />
            <div className="shrink-0"><MonedaDropdown value={regMoneda} onChange={setRegMoneda} /></div>
            <button
              type="button"
              onClick={() => void agregarRegistro()}
              disabled={parseMoneyInput(regMonto) <= 0}
              aria-label="Sumar registro"
              className="v2-focus rounded-xl px-4 flex items-center justify-center font-bold v2-disabled transition-all duration-100 active:scale-95 shrink-0"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              <IconMas size={18} />
            </button>
          </div>
          {errorRegistro && (
            <p role="alert" className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>{errorRegistro}</p>
          )}
        </div>

        {/* Historial de registros */}
        <div className="flex flex-col gap-2">
          <TituloSeccion>Registros</TituloSeccion>
          {abierto.contribuciones.length === 0 && <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste nada.</p>}
          {abierto.contribuciones.map((c) => (
            <div key={c.id} className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${CARD_SHADOW}`} style={{ background: COLORS.surface, borderColor: COLORS.line }}>
              <span
                className="text-[12px] font-bold rounded-full px-2 py-0.5 shrink-0"
                style={{ background: c.kind === 'paid' ? COLORS.greenSoft : COLORS.goldSoft, color: COLORS.ink }}
              >
                {c.kind === 'paid' ? 'Pagado' : 'Separado'}
              </span>
              <span className="flex-1 min-w-0 truncate">
                <span className="text-[15px]" style={{ color: COLORS.ink }}>{c.label}</span>
              </span>
              <span className="text-[14px] shrink-0" style={{ color: COLORS.inkSoft }}>{fechaDisplay(c.ts)}</span>
              <MontoObj monto={c.monto} moneda={c.moneda} className="font-semibold text-[15px] shrink-0" />
              <button type="button" onClick={() => borrarRegistro(c.id)} className="v2-focus shrink-0 w-8 h-8 flex items-center justify-center rounded-full" style={{ color: COLORS.inkFaint }} aria-label="Borrar registro"><IconBasura size={18} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Modal: crear objetivo — un box flotante sobre Objetivos, no otra
  // pantalla, para que quede claro que es "agregar uno más" acá mismo.
  const modalCrear = creating && (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-5" style={{ background: `${COLORS.ink}73` }} onClick={() => setCreating(false)}>
      <div className="w-full max-w-[380px] max-h-[85vh] overflow-y-auto rounded-[24px] p-5 flex flex-col gap-3.5" style={{ background: COLORS.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <Titulo>Nuevo objetivo</Titulo>
          <button type="button" onClick={() => setCreating(false)} aria-label="Cerrar" className="v2-focus w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90" style={{ background: COLORS.tint, color: COLORS.inkSoft }}><IconClose size={16} /></button>
        </div>
        <input className={`${inputClass} rounded-2xl py-3 text-[18px]`} placeholder="Ej: Viaje a Bariloche" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className={`${inputClass} rounded-2xl py-3 text-[18px]`} placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>¿Individual o en conjunto?</p>
          <SegmentedTab
            options={[
              { id: 'individual', label: 'Individual' },
              { id: 'grupal', label: grupo ? `En conjunto (${grupo.nombre})` : 'En conjunto' },
            ]}
            value={tipo}
            onChange={setTipo}
            trackColor={COLORS.gold}
          />
          {tipo === 'grupal' && !grupo && (
            <div className="flex flex-col gap-1.5 mt-1">
              <input className={inputClass} placeholder="Nombre del grupo" value={invitarNombre} onChange={(e) => setInvitarNombre(e.target.value)} />
              <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Armamos el grupo con este nombre y vas a poder invitar gente apenas lo crees.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>¿Para cuándo?</p>
          <HorizontePicker valor={horizonte} setValor={setHorizonte} fecha={horizonteFecha} setFecha={setHorizonteFecha} />
        </div>

        <div className="flex items-center justify-between -mb-1">
          <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>¿Cuánto necesitás?</p>
          <MonedaDropdown value={moneda} onChange={setMoneda} />
        </div>
        <MontoPicker
          modo={montoModo} setModo={setMontoModo}
          montoTxt={montoTotal} setMontoTxt={setMontoTotal}
          minTxt={montoMinTxt} setMinTxt={setMontoMinTxt}
        />
        <Cta label="Agregar objetivo" disabled={!nombre.trim() || (tipo === 'grupal' && !grupo && !invitarNombre.trim())} onClick={() => void crearObjetivo()} />
        {tipo === 'grupal' && !grupo && !invitarNombre.trim() && (
          <p className="text-[14px] text-center" style={{ color: COLORS.coralDark }}>Ponele nombre al grupo para poder invitar gente.</p>
        )}
      </div>
    </div>
  );

  // ── Vista: lista ──
  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4 lg:max-w-4xl lg:mx-auto">
      {V2_STYLES}
      {modalCrear}
      {confirmarBorrarModal}

      {/* Banda editorial full-bleed (desencajonado). Fini acompaña en el
          encabezado (§6: onboarding/estados vacíos) — sin montos ni progreso
          al lado, así que no compite con ningún dato. */}
      <header className="pb-1 mb-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <Titulo>Tus objetivos</Titulo>
          <p className="text-[15px] mt-1.5" style={{ color: COLORS.inkSoft }}>
            {objetivos.length > 0
              ? `Vas por ${objetivos.length} objetivo${objetivos.length > 1 ? 's' : ''}, a tu ritmo.`
              : 'Ponéle nombre a eso que querés lograr. Lo hacemos juntas, a tu ritmo.'}
          </p>
        </div>
      </header>

      {/* Desktop: 2 columnas (lista principal + barra lateral). Mobile: apilado. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start">
      {/* Columna principal */}
      <div className="flex flex-col gap-4 lg:flex-1 lg:min-w-0">

      {/* Estado vacío con onda: sugerencias para arrancar (abren el modal).
          Fini acompaña acá y no en la lista con objetivos: §6 lo deja en
          onboarding y estados vacíos, lejos de los montos y los progresos.
          UN solo personaje, con el globo saliendo de él: antes había el de la
          franja y además el centrado que ya estaba, o sea Fini dos veces en la
          misma pantalla mirándose. */}
      {objetivos.length === 0 && (
        <div className="flex flex-col gap-3 pt-1">
          <FiniPresenta
            dice="¿Qué es eso que querés lograr? Empezá por ponerle nombre — el monto lo vemos después."
            state="vacio"
            size={124}
          />
          <TituloSeccion>¿Con qué arrancás?</TituloSeccion>
          {/* Grilla en vez de chips que envuelven: seis sugerencias de largos
              distintos quedaban en escalera (2 + 3 + 1). En dos columnas se
              llenan tres filas exactas. */}
          <div className="grid grid-cols-2 gap-2.5">
            {SUGERENCIAS_OBJETIVO.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => { setNombre(s.nombre); setCreating(true); }}
                className="v2-focus min-h-[52px] rounded-2xl px-3 py-3 text-[16px] font-semibold leading-snug transition-all duration-100 active:scale-[0.97]"
                style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {objetivos.map((o) => {
        const estado = estadoMonto(o);
        return (
          <div key={o.id} className="relative w-full py-4 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
            <button
              type="button"
              onClick={() => setOpenId(o.id)}
              className="v2-focus w-full flex items-center gap-3.5 text-left"
            >
              {estado === 'definido' ? (
                <Donut
                  segments={[{ color: COLORS.lima, pct: pct(o) }]}
                  centerLabel=""
                  centerValue={`${pct(o)}%`}
                  size={56}
                />
              ) : (
                // Sin monto = "por descubrir": contorno tenue, sin relleno,
                // sin color de alerta (guía §5.1). Mismo trato para "todavía
                // no sé" y para el que llegó sin completar del onboarding.
                <span className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center text-[12px] text-center font-semibold shrink-0 px-1 leading-tight" style={{ borderColor: COLORS.lineStrong, color: COLORS.inkSoft }}>
                  a<br />definir
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[18px] truncate" style={{ color: COLORS.ink }}>{o.nombre}</p>
                  {o.tipo === 'grupal' && (
                    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                      <IconGrupo size={12} />
                    </span>
                  )}
                </div>
                {estado === 'definido' ? (
                  <>
                    <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Llevás <MontoObj monto={saved(o)} moneda={o.moneda} className="text-[14px]" /> de <span className="font-mono tabular-nums" style={{ color: COLORS.ink }}>{montoLabel(o)}</span></p>
                    <EstadoConfianza estado="declarado" className="mt-0.5" />
                  </>
                ) : (
                  // Invitación, no error (§5.1).
                  <EstadoConfianza estado="por-descubrir" className="mt-0.5" />
                )}
              </div>
            </button>
            {/* Acciones rápidas del objetivo (editar / sumar registro / borrar).
                En su propia fila: sobre el texto se pisaban los targets. */}
            <div className="mt-1 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => empezarEdicion(o)}
                aria-label="Editar objetivo"
                className="v2-focus w-11 h-11 rounded-full flex items-center justify-center transition-all duration-100 active:scale-90"
                style={{ color: COLORS.brand }}
              >
                <IconEditar size={18} />
              </button>
              <button
                type="button"
                onClick={() => setOpenId(o.id)}
                aria-label="Sumar un registro"
                className="v2-focus w-11 h-11 rounded-full flex items-center justify-center transition-all duration-100 active:scale-90"
                style={{ color: COLORS.brand }}
              >
                <IconMas size={20} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmarBorrar(o.id)}
                aria-label="Borrar objetivo"
                className="v2-focus w-11 h-11 rounded-full flex items-center justify-center transition-all duration-100 active:scale-90"
                style={{ color: COLORS.naranjaText }}
              >
                <IconBasura size={15} />
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="v2-focus w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dashed py-4 text-[18px] font-bold transition-all duration-100 active:scale-[0.99]"
        style={{ borderColor: COLORS.lineStrong, color: COLORS.ink }}
      >
        <IconMas size={17} /> Agregar objetivo
      </button>
      </div>{/* /columna principal */}

      {/* Barra lateral */}
      <div className="flex flex-col gap-4 lg:w-[300px] lg:shrink-0">
        {objetivos.length > 0 && (
          <div className="hidden lg:flex flex-col gap-2.5 rounded-2xl p-4 border" style={{ background: COLORS.surface, borderColor: COLORS.line }}>
            <TituloSeccion>¿Sumás otro?</TituloSeccion>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS_OBJETIVO.slice(0, 4).map((s) => (
                <button
                  key={s.nombre}
                  type="button"
                  onClick={() => { setNombre(s.nombre); setCreating(true); }}
                  className="v2-focus rounded-full px-3 py-1.5 text-[14px] font-semibold transition-all duration-100 active:scale-95"
                  style={{ background: COLORS.tint, color: COLORS.ink }}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
        <ArmarGrupoBtn />
      </div>
      </div>{/* /2 columnas */}
    </div>
  );
}
