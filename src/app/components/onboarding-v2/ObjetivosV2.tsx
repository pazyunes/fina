import { useEffect, useState } from 'react';
import { Cta, Coachmark, COLORS, Donut, SegmentedTab, fechaDisplay, fmtMoney, formatThousands, parseMoneyInput, loadV2ObjetivosIniciales, loadV2ObjetivosState, saveV2ObjetivosState, loadV2Grupo, saveV2Grupo, crearGrupoDemo, invitarAGrupo, loadV2Nombre, loadV2PerfilOnboarding } from './shared';

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
type Moneda = 'ARS' | 'USD';
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
const CARD_SHADOW = 'shadow-[0_2px_18px_rgba(31,27,46,0.07)]';
const inputClass = 'border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-xl px-3 py-2.5 text-[14px] outline-none transition-colors';

const HORIZONTE_OPCIONES = ['Lo antes posible', 'En los próximos meses', 'Este año', 'El año que viene', 'En 2 a 5 años', 'Más de 5 años', 'Todavía no lo pensé'];

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
            className="rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-100 active:scale-95"
            style={valor === o && !fechaElegida ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
          >
            {o}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setValor(null)}
          className="rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-100 active:scale-95"
          style={fechaElegida || valor === null ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
        >
          Elegir una fecha
        </button>
      </div>
      {(valor === null || fechaElegida) && (
        <input
          type="date"
          className={inputClass}
          value={fecha}
          onChange={(e) => { setFecha(e.target.value); setValor(null); }}
        />
      )}
    </div>
  );
}

// Si ya había estado antes acá, retoma lo persistido; si no, arranca de los
// objetivos nombrados en el onboarding (sin monto todavía).
function objetivosIniciales(): Objetivo[] {
  const persistido = loadV2ObjetivosState<Objetivo[]>();
  if (persistido) return persistido;
  return loadV2ObjetivosIniciales().map((oi, i) => ({
    id: `onb-${i}-${oi.nombre}`,
    nombre: oi.nombre,
    descripcion: '',
    tipo: 'individual',
    moneda: oi.moneda,
    horizonte: oi.horizonte,
    montoModo: null,
    montoTotal: 0,
    contribuciones: [],
  }));
}

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
  return `💡 Nos dijiste que querías gastar menos en ${categoria} — cada peso que ahorres ahí puede ir directo a "${o.nombre}".`;
}

function montoLabel(o: Objetivo): string {
  if (o.montoModo === 'rango' && o.montoMin) return `${fmtMoney(o.montoMin)}–${fmtMoney(o.montoTotal)}`;
  return fmtMoney(o.montoTotal);
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
      <div className="flex flex-wrap gap-2">
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
              className="rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-100 active:scale-95"
              style={sel ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
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
            inputMode="numeric"
            value={montoTxt}
            onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
          />
        </div>
      )}

      {modo === 'rango' && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              className={`w-full ${inputClass} pl-8`}
              placeholder="Desde"
              inputMode="numeric"
              value={minTxt}
              onChange={(e) => setMinTxt(formatThousands(e.target.value))}
            />
          </div>
          <div className="relative flex-1">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              className={`w-full ${inputClass} pl-8`}
              placeholder="Hasta"
              inputMode="numeric"
              value={montoTxt}
              onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
            />
          </div>
        </div>
      )}

      {modo === 'desconocido' && (
        <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Buenísimo — lo vas a poder poner más adelante, cuando lo tengas más claro.</p>
      )}
    </div>
  );
}

export function ObjetivosV2() {
  const [objetivos, setObjetivos] = useState<Objetivo[]>(objetivosIniciales);
  useEffect(() => { saveV2ObjetivosState(objetivos); }, [objetivos]);
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

  const [grupo, setGrupoLocal] = useState(() => loadV2Grupo());
  const [invitado, setInvitado] = useState(false);
  const miNombre = loadV2Nombre() || 'Vos';

  async function invitarGente() {
    if (!grupo) return;
    const resultado = await invitarAGrupo(grupo);
    if (resultado === 'copiado') { setInvitado(true); setTimeout(() => setInvitado(false), 1800); }
  }

  const abierto = objetivos.find((o) => o.id === openId) || null;
  useEffect(() => { if (abierto) setRegMoneda(abierto.moneda); }, [abierto?.id]);

  function crearObjetivo() {
    if (!nombre.trim()) return;
    const id = String(Date.now());
    const monto = buildMonto(montoModo, montoTotal, montoMinTxt);
    const horizonteFinal = horizonteFecha ? new Date(horizonteFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : horizonte;
    setObjetivos((os) => [...os, {
      id, nombre: nombre.trim(), descripcion: descripcion.trim(), tipo, moneda, horizonte: horizonteFinal,
      contribuciones: [], ...monto,
    }]);
    if (tipo === 'grupal' && invitarNombre.trim() && !grupo) {
      const nuevoGrupo = crearGrupoDemo(invitarNombre.trim());
      saveV2Grupo(nuevoGrupo);
      setGrupoLocal(nuevoGrupo);
    }
    setNombre(''); setDescripcion(''); setMontoTotal(''); setMontoMinTxt(''); setMontoModo('exacto'); setTipo('individual');
    setMoneda('ARS'); setInvitarNombre(''); setHorizonte(null); setHorizonteFecha('');
    setCreating(false);
    setOpenId(id);
  }

  function borrarObjetivo(id: string) {
    setObjetivos((os) => os.filter((o) => o.id !== id));
    if (openId === id) setOpenId(null);
  }

  function empezarEdicion() {
    if (!abierto) return;
    setEditNombre(abierto.nombre);
    setEditDescripcion(abierto.descripcion);
    setEditTipo(abierto.tipo);
    setEditMoneda(abierto.moneda);
    setEditHorizonte(abierto.horizonte ?? null);
    setEditHorizonteFecha('');
    setEditando(true);
  }
  function guardarEdicion() {
    if (!abierto || !editNombre.trim()) return;
    const horizonteFinal = editHorizonteFecha ? new Date(editHorizonteFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : editHorizonte;
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, nombre: editNombre.trim(), descripcion: editDescripcion.trim(), tipo: editTipo, moneda: editMoneda, horizonte: horizonteFinal } : o)));
    setEditando(false);
  }

  function agregarRegistro() {
    if (!abierto) return;
    const monto = parseMoneyInput(regMonto);
    if (monto <= 0) return;
    const nuevo: Contribucion = {
      id: String(Date.now()),
      monto,
      moneda: regMoneda,
      kind,
      label: regLabel.trim() || (kind === 'paid' ? 'Pago' : 'Separado'),
      ts: Date.now(),
      de: miNombre,
    };
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, contribuciones: [nuevo, ...o.contribuciones] } : o)));
    setRegLabel(''); setRegMonto('');
  }

  function borrarRegistro(regId: string) {
    if (!abierto) return;
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, contribuciones: o.contribuciones.filter((c) => c.id !== regId) } : o)));
  }

  function completarMontoTotal() {
    if (!abierto) return;
    const monto = buildMonto(montoModoEdit, montoTotalEdit, montoMinEdit);
    if (monto.montoModo !== 'desconocido' && monto.montoTotal <= 0) return;
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, ...monto } : o)));
    setMontoTotalEdit(''); setMontoMinEdit(''); setMontoModoEdit('exacto');
  }

  const saved = (o: Objetivo) => o.contribuciones.reduce((s, c) => s + c.monto, 0);
  const pct = (o: Objetivo) => (o.montoTotal > 0 ? Math.min(Math.round((saved(o) / o.montoTotal) * 100), 100) : 0);

  // ── Vista: detalle de un objetivo ──
  if (abierto) {
    const estado = estadoMonto(abierto);
    const total = abierto.montoTotal;
    const acumulado = saved(abierto);
    const restante = Math.max(total - acumulado, 0);
    const porcentaje = pct(abierto);
    const done = estado === 'definido' && acumulado >= total;

    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-between">
          <button type="button" className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }} onClick={() => setOpenId(null)}>← Volver</button>
          <div className="flex items-center gap-3">
            {abierto.tipo === 'grupal' && grupo && (
              <button type="button" className="text-[12.5px] font-semibold underline" style={{ color: COLORS.brand }} onClick={invitarGente}>{invitado ? '✓ Copiado' : 'Invitar'}</button>
            )}
            <button type="button" className="text-[12.5px] font-semibold underline" style={{ color: COLORS.brand }} onClick={empezarEdicion}>Editar</button>
            <button type="button" className="text-[12.5px] font-semibold underline" style={{ color: COLORS.inkSoft }} onClick={() => borrarObjetivo(abierto.id)}>Borrar</button>
          </div>
        </div>

        {editando ? (
          <div className={`bg-white rounded-2xl p-4 flex flex-col gap-2.5 ${CARD_SHADOW}`}>
            <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>Editar objetivo</p>
            <input className={inputClass} placeholder="Nombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
            <input className={inputClass} placeholder="Descripción (opcional)" value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
            <SegmentedTab
              options={[{ id: 'individual' as TipoObjetivo, label: 'Individual' }, { id: 'grupal' as TipoObjetivo, label: 'En conjunto' }]}
              value={editTipo} onChange={setEditTipo} trackColor={COLORS.gold}
            />
            <SegmentedTab
              options={[{ id: 'ARS' as Moneda, label: 'Pesos' }, { id: 'USD' as Moneda, label: 'Dólares' }]}
              value={editMoneda} onChange={setEditMoneda} trackColor={COLORS.tint}
            />
            <p className="text-[12px] font-semibold" style={{ color: COLORS.inkSoft }}>¿Para cuándo?</p>
            <HorizontePicker valor={editHorizonte} setValor={setEditHorizonte} fecha={editHorizonteFecha} setFecha={setEditHorizonteFecha} />
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setEditando(false)} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold border border-[rgba(31,27,46,0.16)]" style={{ color: COLORS.ink }}>Cancelar</button>
              <button type="button" onClick={guardarEdicion} disabled={!editNombre.trim()} className="flex-[2] rounded-xl py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95" style={{ background: COLORS.brand }}>Guardar cambios</button>
            </div>
          </div>
        ) : (
        <div className={`bg-white rounded-2xl p-4 flex gap-4 items-center ${CARD_SHADOW}`}>
          {estado === 'definido' && (
            <Donut
              segments={[{ color: done ? COLORS.green : COLORS.gold, pct: porcentaje }]}
              centerLabel={done ? '¡Lograste!' : 'Logrado'}
              centerValue={`${porcentaje}%`}
              size={96}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[18px] font-bold truncate" style={{ color: COLORS.ink }}>{abierto.nombre}</p>
              {abierto.tipo === 'grupal' && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                  👥 Grupal
                </span>
              )}
              {abierto.moneda === 'USD' && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.skySoft, color: COLORS.ink }}>
                  USD
                </span>
              )}
              {estado === 'incompleto' && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.coralSoft, color: COLORS.coralDark }}>
                  Incompleto
                </span>
              )}
              {estado === 'desconocido' && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.goldSoft, color: COLORS.ink }}>
                  Por definir
                </span>
              )}
            </div>
            {abierto.descripcion && <p className="text-[12.5px] mt-0.5" style={{ color: COLORS.inkSoft }}>{abierto.descripcion}</p>}
            {abierto.horizonte && (
              <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.inkFaint }}>📅 {abierto.horizonte}</p>
            )}
            {estado === 'definido' && (
              <>
                <p className="text-[13px] mt-1.5" style={{ color: COLORS.ink }}>
                  Llevás <strong>{fmtMoney(acumulado)}</strong> de {montoLabel(abierto)}
                </p>
                {!done && <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>Te falta {fmtMoney(restante)}</p>}
              </>
            )}
            {estado === 'incompleto' && (
              <p className="text-[12.5px] mt-1 font-medium" style={{ color: COLORS.coralDark }}>Falta ponerle un monto — completalo para ver el progreso.</p>
            )}
            {estado === 'desconocido' && (
              <p className="text-[12.5px] mt-1" style={{ color: COLORS.inkSoft }}>Todavía no definiste cuánto necesitás.</p>
            )}
          </div>
        </div>
        )}

        {estado !== 'definido' && (
          <div className={`bg-white rounded-2xl p-4 flex flex-col gap-2.5 ${CARD_SHADOW}`}>
            <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>¿Cuánto necesitás?</p>
            <MontoPicker
              modo={montoModoEdit} setModo={setMontoModoEdit}
              montoTxt={montoTotalEdit} setMontoTxt={setMontoTotalEdit}
              minTxt={montoMinEdit} setMinTxt={setMontoMinEdit}
            />
            <button
              type="button"
              onClick={completarMontoTotal}
              disabled={montoModoEdit !== 'desconocido' && parseMoneyInput(montoTotalEdit) <= 0}
              className="rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95"
              style={{ background: COLORS.brand }}
            >
              Guardar
            </button>
          </div>
        )}

        {done && (
          <div className="rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-center" style={{ background: COLORS.greenSoft, color: COLORS.ink }}>
            🎉 ¡Ya juntaste todo lo que necesitás para este objetivo!
          </div>
        )}

        {!done && consejoPara(abierto, estado) && (
          <div className="rounded-2xl px-4 py-3 text-[13px] font-medium" style={{ background: COLORS.goldSoft, color: COLORS.ink }}>
            {consejoPara(abierto, estado)}
          </div>
        )}

        {/* Registrar un pago o un ahorro */}
        <div className={`bg-white rounded-2xl p-4 flex flex-col gap-2.5 ${CARD_SHADOW}`}>
          <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>Sumar un registro</p>
          <div className="grid grid-cols-2 gap-2">
            {(['paid', 'saved'] as const).map((k) => {
              const sel = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className="py-2 rounded-xl text-[13px] font-semibold transition-all duration-100 active:scale-95"
                  style={sel ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
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
              className={`flex-1 ${inputClass}`}
              placeholder="Monto"
              inputMode="numeric"
              value={regMonto}
              onChange={(e) => setRegMonto(formatThousands(e.target.value))}
            />
            <div className="flex rounded-xl overflow-hidden border border-[rgba(31,27,46,0.16)] shrink-0">
              {(['ARS', 'USD'] as Moneda[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRegMoneda(m)}
                  className="px-2.5 text-[12px] font-bold transition-colors"
                  style={regMoneda === m ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink }}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={agregarRegistro}
              disabled={parseMoneyInput(regMonto) <= 0}
              className="rounded-xl px-4 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95"
              style={{ background: COLORS.brand }}
            >
              +
            </button>
          </div>
        </div>

        {/* Historial de registros */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Registros</p>
          {abierto.contribuciones.length === 0 && <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste nada.</p>}
          {abierto.contribuciones.map((c) => (
            <div key={c.id} className={`flex items-center gap-2.5 bg-white rounded-xl px-3.5 py-2.5 ${CARD_SHADOW}`}>
              <span
                className="text-[10.5px] font-bold rounded-full px-2 py-0.5 shrink-0"
                style={{ background: c.kind === 'paid' ? COLORS.greenSoft : COLORS.goldSoft, color: COLORS.ink }}
              >
                {c.kind === 'paid' ? 'Pagado' : 'Separado'}
              </span>
              <span className="flex-1 min-w-0 truncate">
                <span className="text-[13.5px]" style={{ color: COLORS.ink }}>{c.label}</span>
              </span>
              <span className="text-[12px] shrink-0" style={{ color: COLORS.inkSoft }}>{fechaDisplay(c.ts)}</span>
              <span className="font-semibold text-[13.5px] shrink-0" style={{ color: COLORS.ink }}>{c.moneda === 'USD' ? `US$${c.monto.toLocaleString('es-AR')}` : fmtMoney(c.monto)}</span>
              <button type="button" onClick={() => borrarRegistro(c.id)} className="shrink-0" style={{ color: COLORS.inkFaint }} aria-label="Borrar registro">✕</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Modal: crear objetivo — un box flotante sobre Objetivos, no otra
  // pantalla, para que quede claro que es "agregar uno más" acá mismo.
  const modalCrear = creating && (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-5" style={{ background: 'rgba(31,27,46,0.45)' }} onClick={() => setCreating(false)}>
      <div className="w-full max-w-[380px] max-h-[85vh] overflow-y-auto bg-white rounded-[24px] p-5 flex flex-col gap-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h1 className="text-[19px] font-bold" style={{ color: COLORS.ink }}>Nuevo objetivo</h1>
          <button type="button" onClick={() => setCreating(false)} aria-label="Cerrar" className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90" style={{ background: COLORS.tint, color: COLORS.inkSoft }}>✕</button>
        </div>
        <input className={`${inputClass} rounded-2xl py-3 text-[15px]`} placeholder="Ej: Viaje a Bariloche" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className={`${inputClass} rounded-2xl py-3 text-[15px]`} placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>¿Individual o en conjunto?</p>
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
              <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>Armamos el grupo con este nombre y vas a poder invitar gente apenas lo crees.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>¿Para cuándo?</p>
          <HorizontePicker valor={horizonte} setValor={setHorizonte} fecha={horizonteFecha} setFecha={setHorizonteFecha} />
        </div>

        <div className="flex items-center justify-between -mb-1">
          <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>¿Cuánto necesitás?</p>
          <div className="w-[128px]">
            <SegmentedTab
              options={[{ id: 'ARS' as Moneda, label: 'ARS' }, { id: 'USD' as Moneda, label: 'USD' }]}
              value={moneda}
              onChange={setMoneda}
              trackColor={COLORS.tint}
            />
          </div>
        </div>
        <MontoPicker
          modo={montoModo} setModo={setMontoModo}
          montoTxt={montoTotal} setMontoTxt={setMontoTotal}
          minTxt={montoMinTxt} setMinTxt={setMontoMinTxt}
        />
        <Cta label="Agregar objetivo" disabled={!nombre.trim() || (tipo === 'grupal' && !grupo && !invitarNombre.trim())} onClick={crearObjetivo} />
        {tipo === 'grupal' && !grupo && !invitarNombre.trim() && (
          <p className="text-[12px] text-center" style={{ color: COLORS.coral }}>Ponele nombre al grupo para poder invitar gente.</p>
        )}
      </div>
    </div>
  );

  // ── Vista: lista ──
  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4">
      {modalCrear}
      <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Objetivos</h1>
      <Coachmark id="objetivos">Acá armás lo que querés lograr — solo o con tu grupo de amigas — y vas anotando lo que pagás o separás para cada uno.</Coachmark>
      {objetivos.length === 0 && <p className="text-[13.5px]" style={{ color: COLORS.inkSoft }}>Todavía no armaste ningún objetivo.</p>}
      {objetivos.map((o) => {
        const estado = estadoMonto(o);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setOpenId(o.id)}
            className={`w-full flex items-center gap-3.5 text-left bg-white rounded-2xl p-4 ${CARD_SHADOW}`}
          >
            {estado === 'definido' ? (
              <Donut
                segments={[{ color: pct(o) >= 100 ? COLORS.green : COLORS.gold, pct: pct(o) }]}
                centerLabel=""
                centerValue={`${pct(o)}%`}
                size={56}
              />
            ) : estado === 'desconocido' ? (
              <span className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center text-[10px] text-center font-bold shrink-0 px-1 leading-tight" style={{ borderColor: COLORS.gold, color: COLORS.gold }}>
                por<br />definir
              </span>
            ) : (
              <span className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center text-[10px] text-center font-bold shrink-0 px-1 leading-tight" style={{ borderColor: COLORS.coral, color: COLORS.coral }}>
                falta<br />monto
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[15px] truncate" style={{ color: COLORS.ink }}>{o.nombre}</p>
                {o.tipo === 'grupal' && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                    👥
                  </span>
                )}
                {estado === 'incompleto' && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.coralSoft, color: COLORS.coralDark }}>
                    Incompleto
                  </span>
                )}
                {estado === 'desconocido' && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.goldSoft, color: COLORS.ink }}>
                    Por definir
                  </span>
                )}
              </div>
              {estado === 'definido' && <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Llevás {fmtMoney(saved(o))} de {montoLabel(o)}</p>}
              {estado === 'incompleto' && <p className="text-[12.5px] font-medium" style={{ color: COLORS.coralDark }}>Falta completar el monto</p>}
              {estado === 'desconocido' && <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Todavía no definiste cuánto necesitás</p>}
            </div>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="w-full rounded-2xl border border-dashed py-4 text-[15px] font-bold transition-all duration-100 active:scale-[0.99]"
        style={{ borderColor: 'rgba(31,27,46,0.25)', color: COLORS.ink }}
      >
        + Agregar objetivo
      </button>
    </div>
  );
}
