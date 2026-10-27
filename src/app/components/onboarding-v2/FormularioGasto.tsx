import { useState } from 'react';
import { BORDE_FALTA, COLORS, TextoFalta, fmtMoney, formatMontoInicial, formatThousands, parseMoneyInput, slug } from './shared';
import { useFaltantes } from './useFaltantes';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { IconChevron, IconClose } from './FinaIcons';
import { CamposGastoFijo, opcionFijoInicial, opcionFijoValida, type OpcionFijo } from './GastosFijos';
import { CamposRecurrente, opcionRecurrenteInicial, type OpcionRecurrente } from './GastosRecurrentes';
import { crearRecurrente } from '../../api/v2/recurrentes';
import { diaArgentina } from '../../api/v2/pasos';
import { TIPOS, TIPO_INFO, gastosDeLaBase, recientes, type Categoria, type Gasto, type Moneda, type TipoGasto } from './datosGasto';

// El formulario de un gasto: el mismo para cargar uno nuevo y para editar uno
// (en Gastos y en Todos tus gastos). Los dos se abren en una hoja aparte,
// encima de la pantalla (CLAUDE.md regla 12): abierto debajo del renglón se
// mezclaba con la lista y no se sabía dónde terminaba.

// Secciones sugeridas. Es la misma lista que ofrecía el onboarding: las que la
// persona marcó allá ya entran como suyas, y el resto queda acá para no
// obligarla a tipear "Supermercado" a mano.
const SECCIONES_SUGERIDAS = [
  'Delivery', 'Restaurantes', 'Cafeterías', 'Salidas y entretenimiento',
  'Supermercado', 'Transporte', 'Belleza y cuidado personal', 'Ropa',
  'Suscripciones', 'Compras online', 'Farmacia', 'Regalos', 'Deporte',
];

// Sólo la fecha, sin hora (decisión oct 2026). El día va en la zona de quien
// usa la app: "YYYY-MM-DD" del input de fecha.
export function aInputFecha(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/**
 * Hoy se guarda con la hora en que se carga, así los gastos de hoy quedan en
 * el orden en que se anotaron. Otro día, al mediodía: lejos de la medianoche,
 * para que ninguna zona horaria lo corra al día de al lado.
 */
export function deInputFecha(fecha: string, original?: number): number {
  if (original !== undefined && aInputFecha(original) === fecha) return original;
  if (fecha === aInputFecha(Date.now())) return Date.now();
  return new Date(`${fecha}T12:00:00`).getTime();
}

// Medios de pago sugeridos, para la primera vez que no hay ninguno cargado.
export const METODOS_SUGERIDOS = ['Efectivo', 'Débito', 'Crédito', 'Mercado Pago', 'Transferencia'];

export const INPUT_STYLE: React.CSSProperties = { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}` };
const OPCION: React.CSSProperties = { color: COLORS.ink };

// Una fila del editor de "pagado con varios medios". `medio === 'otro'` usa
// `otro` en vez del nombre, mismo patrón que el desplegable de medio único.
type FilaPago = { medio: string; otro: string; monto: string };
function filaPagoVacia(): FilaPago {
  return { medio: '', otro: '', monto: '' };
}
function medioDeFila(f: FilaPago): string {
  return (f.medio === 'otro' ? f.otro : f.medio).trim();
}

// Desplegable nativo. En el celular abre el selector del sistema, que es lo más
// cómodo para elegir de una lista larga con el dedo.
export function Desplegable({ id, label, value, onChange, marcado = false, children }: {
  id: string; label: string; value: string; onChange: (v: string) => void; marcado?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={marcado || undefined}
          className="v2-focus w-full appearance-none rounded-xl pl-3.5 pr-10 min-h-[48px] text-[14px] transition-colors"
          // Sin nada elegido, el texto va tenue como un placeholder.
          style={{ ...INPUT_STYLE, color: value ? COLORS.ink : COLORS.inkFaint, ...(marcado ? { border: BORDE_FALTA } : {}) }}
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

/**
 * `gasto`: si viene, se edita ese gasto; si no, se carga uno nuevo.
 * `repeticion`: lo que se eligió al agregar. 'fijo' es un gasto fijo, con sus
 * campos a la vista y sin interruptor ("Gasto fijo" o "Anotar un gasto fijo").
 * Sin ella es un gasto diario, que ofrece marcarlo como recurrente;
 * 'recurrente' arranca con eso prendido ("Anotar un gasto recurrente"). Al
 * editar no hay ninguna de las dos: no aplican a un movimiento que ya pasó.
 * `onListo` recibe la sección en la que quedó el gasto.
 */
export function FormularioGasto({ gasto, repeticion, categorias, onListo, onCancelar }: {
  gasto?: Gasto;
  repeticion?: 'fijo' | 'recurrente';
  categorias: Categoria[];
  onListo: (seccionId: string | null) => void;
  onCancelar: () => void;
}) {
  const { estado: db } = useAlmacen();
  const editando = !!gasto;

  const [monto, setMonto] = useState(() => (gasto ? formatMontoInicial(gasto.monto) : ''));
  const [moneda, setMoneda] = useState<Moneda>(gasto?.moneda ?? 'ARS');
  const [fecha, setFecha] = useState(() => aInputFecha(gasto?.ts ?? Date.now()));
  const [desc, setDesc] = useState(gasto?.descripcion ?? '');
  // Sin sección elegida de entrada: con la primera ya marcada, era fácil
  // registrar un gasto en la sección equivocada sin darse cuenta.
  const [catId, setCatId] = useState<string | null>(gasto?.categoriaId || null);
  const [nuevaCat, setNuevaCat] = useState('');
  const [creandoCat, setCreandoCat] = useState(false);
  const [tipo, setTipo] = useState<TipoGasto>(gasto?.tipo ?? 'necesario');
  const [tipoOtro, setTipoOtro] = useState(gasto?.tipoOtro ?? '');
  const [metodo, setMetodo] = useState<string | null>(gasto && !gasto.pagos?.length ? gasto.metodoPago ?? null : null);
  const [metodoOtro, setMetodoOtro] = useState('');
  // Pagado con más de un medio: cada fila es un medio y su parte del total.
  // La suma de las filas tiene que dar el monto del gasto.
  const [dividido, setDividido] = useState(!!gasto?.pagos?.length);
  const [pagos, setPagos] = useState<FilaPago[]>(() => (gasto?.pagos?.length
    ? gasto.pagos.map((p) => ({ medio: p.medio, otro: '', monto: formatMontoInicial(p.monto) }))
    : [filaPagoVacia(), filaPagoVacia()]));
  const [fijo, setFijo] = useState<OpcionFijo>(() => ({ ...opcionFijoInicial(), activo: repeticion === 'fijo' }));
  // Un gasto diario que se repite seguido (el colectivo, el café): queda para
  // registrarlo con un toque.
  const [recurrente, setRecurrente] = useState<OpcionRecurrente>(() => ({ ...opcionRecurrenteInicial(), activo: repeticion === 'recurrente' }));
  // Errores de conversión (no se pudo traer el dólar). Los de guardado los
  // reporta el almacén.
  const [error, setError] = useState<string | null>(null);

  const sugeridasDisponibles = SECCIONES_SUGERIDAS.filter((n) => !categorias.some((c) => slug(c.nombre) === slug(n)));
  // Medios ofrecidos: los que ya usaste primero; si no hay ninguno, los sugeridos.
  const mediosUsados = db.mediosPago.map((m) => m.nombre);
  const metodosOfrecidos = mediosUsados.length ? mediosUsados : METODOS_SUGERIDOS;
  const tiposOtroRecientes = recientes(gastosDeLaBase(db).map((g) => g.tipoOtro));

  const sumaPagos = pagos.reduce((s, f) => s + parseMoneyInput(f.monto), 0);
  const pagosValidos = !dividido || (
    pagos.every((f) => medioDeFila(f) && parseMoneyInput(f.monto) > 0)
    && Math.abs(sumaPagos - parseMoneyInput(monto)) < 0.01
  );
  // En el orden de la pantalla: al tocar Agregar con algo sin completar, se
  // marca y la vista va al primero (useFaltantes).
  const faltantes = useFaltantes({
    monto: parseMoneyInput(monto) <= 0,
    categoria: !catId && !nuevaCat.trim(),
    pagos: !pagosValidos,
    fijo: !editando && !opcionFijoValida(fijo),
  });

  // Un gasto fijo no pregunta qué tipo de gasto es: se toma como necesario.
  const esFijo = !editando && fijo.activo;

  function seccionElegida(): string | null {
    if (!nuevaCat.trim()) return catId;
    const ya = categorias.find((c) => slug(c.nombre) === slug(nuevaCat.trim()));
    return ya ? ya.id : acciones.crearSeccion(nuevaCat.trim()).id;
  }

  async function guardar() {
    const n = parseMoneyInput(monto);
    if (n <= 0) return;
    const seccionId = seccionElegida();
    if (!seccionId) return;
    const medio = (metodo === 'otro' ? metodoOtro.trim() : metodo) || null;
    const pagosFinal = dividido ? pagos.map((f) => ({ medio: medioDeFila(f), monto: parseMoneyInput(f.monto) })) : undefined;
    setError(null);
    const tipoFinal: TipoGasto = esFijo ? 'necesario' : tipo;
    // Un gasto fijo sin nombre se llama como su categoría: es como se reconoce
    // en la lista y en el aviso, y "Necesario" no dice qué es.
    const nombreSeccion = categorias.find((c) => c.id === seccionId)?.nombre ?? nuevaCat.trim();
    const datos = {
      monto: n,
      moneda,
      descripcion: desc.trim() || (esFijo ? nombreSeccion : '') || TIPO_INFO[tipoFinal].label,
      seccionId,
      tipo: tipoFinal,
      metodoPago: medio,
      ts: deInputFecha(fecha, gasto?.ts),
    };

    if (gasto) {
      const r = await acciones.editarGasto(gasto.id, { ...datos, tipoOtro, metodoPago: dividido ? null : medio, pagos: pagosFinal ?? null });
      if (r.error !== null) { setError(r.error); return; }
      onListo(seccionId);
      return;
    }

    // En dólares hay que congelar la cotización, y eso puede fallar sin red.
    // Si falla, el formulario se queda abierto con lo que escribió: perder el
    // gasto que acaba de tipear sería peor que la espera.
    // Un gasto fijo que todavía no se pagó no se registra como gasto: sólo
    // queda anotado para avisar. Si ya se pagó, se registra y queda el próximo.
    // El cartel de "Gasto fijo guardado" lo da el gasto fijo, cuando la base lo
    // confirma: si lo diera el gasto, diría "guardado como fijo" aunque el fijo
    // no se hubiera guardado.
    if (!fijo.activo || fijo.yaPagado) {
      const r = await acciones.registrarGasto({ ...datos, tipoOtro, pagos: pagosFinal, confirmacion: recurrente.activo ? 'Gasto registrado y guardado como recurrente.' : undefined });
      if (r.error !== null) { setError(r.error); return; }
      if (recurrente.activo && !fijo.activo) {
        const dia = new Date(datos.ts);
        const esDeHoy = fecha === aInputFecha(Date.now());
        crearRecurrente({
          descripcion: desc.trim() || undefined,
          seccionId, monto: n, moneda, tipo: tipoFinal, metodoPago: dividido ? null : medio,
          frecuencia: recurrente.frecuencia, hora: recurrente.hora,
          dia: recurrente.frecuencia === 'semanal' ? dia.getDay() : recurrente.frecuencia === 'mensual' ? dia.getDate() : null,
          // Si el gasto es de hoy, hoy ya está registrado: no vuelve a aparecer.
          ultimoDia: esDeHoy ? diaArgentina() : null,
          ultimoGastoId: esDeHoy ? r.gasto?.id ?? null : null,
        });
      }
    }
    if (fijo.activo) {
      const diaAncla = fijo.frecuencia === 'mensual' || fijo.frecuencia === 'anual' ? Number(fijo.proximo.slice(8, 10)) : null;
      acciones.crearGastoFijo({ ...datos, frecuencia: fijo.frecuencia, proximoPago: fijo.proximo, diaAncla });
    }
    onListo(seccionId);
  }

  const idBase = gasto ? `g-${gasto.id}` : 'ng';

  return (
    <div ref={faltantes.ref} data-form-gasto className="py-2 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{moneda === 'USD' ? 'US$' : '$'}</span>
          <input
            autoFocus
            data-campo="monto"
            aria-label="Monto del gasto"
            aria-invalid={faltantes.marcado('monto') || undefined}
            className="v2-focus w-full rounded-xl pl-10 pr-3 py-2.5 text-[14px] transition-colors"
            style={{ ...INPUT_STYLE, ...(faltantes.marcado('monto') ? { border: BORDE_FALTA } : {}) }}
            placeholder="Monto"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(formatThousands(e.target.value))}
          />
        </div>
        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: `1.5px solid ${COLORS.lineStrong}` }}>
          {(['ARS', 'USD'] as Moneda[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMoneda(m)}
              className="v2-focus px-2.5 text-[13px] font-bold transition-colors"
              style={moneda === m ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {faltantes.marcado('monto') && <TextoFalta>Falta el monto.</TextoFalta>}
      <input
        aria-label="Descripción del gasto"
        className="v2-focus rounded-xl px-3.5 py-2.5 text-[14px] transition-colors"
        style={INPUT_STYLE}
        placeholder="Descripción (ej: PedidosYa)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      {/* Por defecto queda en hoy: sólo hace falta tocarlo para cargar un
          gasto de otro día. Sin hora: con el día alcanza. Un gasto fijo que
          todavía no se pagó no tiene fecha de gasto: tiene la de vencimiento,
          más abajo. */}
      {!(esFijo && !fijo.yaPagado) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idBase}-fecha`} className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>Fecha</label>
          <input
            id={`${idBase}-fecha`}
            type="date"
            className="v2-focus w-full min-w-0 rounded-xl px-3.5 min-h-[48px] text-[14px] transition-colors"
            style={INPUT_STYLE}
            value={fecha}
            max={aInputFecha(Date.now())}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      )}

      {/* Sección y medio en desplegables: con todas las opciones como botones
          el formulario ocupaba tres pantallas en el celular. */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
        {/* Con una categoría nueva a medio escribir, lo que se marca y recibe
            el foco es el nombre, no el desplegable. */}
        <div data-campo={creandoCat ? undefined : 'categoria'} className="flex flex-col gap-2">
          <Desplegable
            id={`${idBase}-seccion`}
            label="Categoría"
            marcado={faltantes.marcado('categoria') && !creandoCat}
            value={catId ? `c:${catId}` : creandoCat ? 'nueva' : nuevaCat ? `s:${nuevaCat}` : ''}
            onChange={(v) => {
              setCatId(v.startsWith('c:') ? v.slice(2) : null);
              setNuevaCat(v.startsWith('s:') ? v.slice(2) : '');
              setCreandoCat(v === 'nueva');
            }}
          >
            <option value="" disabled style={OPCION}>Elegí una categoría</option>
            {categorias.length > 0 && (
              <optgroup label="Tus categorías">
                {categorias.map((c) => <option key={c.id} value={`c:${c.id}`} style={OPCION}>{c.nombre}</option>)}
              </optgroup>
            )}
            {sugeridasDisponibles.length > 0 && (
              <optgroup label="Sugeridas">
                {sugeridasDisponibles.map((n) => <option key={n} value={`s:${n}`} style={OPCION}>{n}</option>)}
              </optgroup>
            )}
            <option value="nueva" style={OPCION}>+ Nueva categoría</option>
          </Desplegable>
          {creandoCat && (
            <input
              autoFocus
              data-campo="categoria"
              aria-label="Nombre de la categoría nueva"
              aria-invalid={faltantes.marcado('categoria') || undefined}
              className="v2-focus w-full rounded-xl px-3.5 min-h-[48px] text-[14px] transition-colors"
              style={{ ...INPUT_STYLE, ...(faltantes.marcado('categoria') ? { border: BORDE_FALTA } : {}) }}
              placeholder="Ej: Mascota"
              value={nuevaCat}
              onChange={(e) => setNuevaCat(e.target.value)}
            />
          )}
          {faltantes.marcado('categoria') && <TextoFalta>{creandoCat ? 'Falta el nombre de la categoría.' : 'Falta la categoría.'}</TextoFalta>}
        </div>

        <div className="flex flex-col gap-2">
          {!dividido ? (
            <>
              <Desplegable
                id={`${idBase}-medio`}
                label="¿Con qué lo pagaste?"
                value={metodo ?? ''}
                onChange={(v) => { setMetodo(v || null); if (v !== 'otro') setMetodoOtro(''); }}
              >
                <option value="" style={OPCION}>Elegí un medio (opcional)</option>
                {metodosOfrecidos.map((m) => <option key={m} value={m} style={OPCION}>{m}</option>)}
                <option value="otro" style={OPCION}>+ Otro medio</option>
              </Desplegable>
              {metodo === 'otro' && (
                <input
                  autoFocus
                  aria-label="Con qué lo pagaste"
                  className="v2-focus w-full rounded-xl px-3.5 min-h-[48px] text-[14px] transition-colors"
                  style={INPUT_STYLE}
                  placeholder="Ej: Ualá"
                  value={metodoOtro}
                  onChange={(e) => setMetodoOtro(e.target.value)}
                />
              )}
              <button
                type="button"
                onClick={() => { setDividido(true); setPagos([filaPagoVacia(), filaPagoVacia()]); }}
                className="v2-focus self-start min-h-[44px] text-[13px] font-semibold underline"
                style={{ color: COLORS.brand }}
              >
                Dividir en varios medios
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setDividido(false); setPagos([filaPagoVacia(), filaPagoVacia()]); }}
              className="v2-focus self-start min-h-[44px] text-[13px] font-semibold underline"
              style={{ color: COLORS.inkSoft }}
            >
              Usar un solo medio
            </button>
          )}
        </div>
      </div>

      {/* Dividido entre varios medios: una fila por medio, cada una con su
          monto; la suma tiene que dar el total de arriba. */}
      {dividido && (
        <div data-campo="pagos" className="flex flex-col gap-2">
          <p className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>¿Con qué lo pagaste?</p>
          {pagos.map((f, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <select
                aria-label={`Medio ${i + 1}`}
                aria-invalid={(faltantes.marcado('pagos') && !medioDeFila(f)) || undefined}
                value={f.medio}
                onChange={(e) => setPagos((v) => v.map((x, idx) => (idx === i ? { ...x, medio: e.target.value } : x)))}
                className="v2-focus flex-1 min-w-0 rounded-xl pl-3 pr-2 min-h-[48px] text-[13px] transition-colors"
                style={{ ...INPUT_STYLE, color: f.medio ? COLORS.ink : COLORS.inkFaint, ...(faltantes.marcado('pagos') && !medioDeFila(f) ? { border: BORDE_FALTA } : {}) }}
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
                  onChange={(e) => setPagos((v) => v.map((x, idx) => (idx === i ? { ...x, otro: e.target.value } : x)))}
                  className="v2-focus flex-1 min-w-0 rounded-xl px-3 min-h-[48px] text-[13px] transition-colors"
                  style={INPUT_STYLE}
                />
              )}
              <input
                aria-label={`Monto pagado con el medio ${i + 1}`}
                aria-invalid={(faltantes.marcado('pagos') && parseMoneyInput(f.monto) <= 0) || undefined}
                placeholder="Monto"
                inputMode="decimal"
                value={f.monto}
                onChange={(e) => setPagos((v) => v.map((x, idx) => (idx === i ? { ...x, monto: formatThousands(e.target.value) } : x)))}
                className="v2-focus w-[104px] shrink-0 rounded-xl px-2.5 min-h-[48px] text-[13px] transition-colors"
                style={{ ...INPUT_STYLE, ...(faltantes.marcado('pagos') && parseMoneyInput(f.monto) <= 0 ? { border: BORDE_FALTA } : {}) }}
              />
              {pagos.length > 2 && (
                <button
                  type="button"
                  aria-label={`Sacar el medio ${i + 1}`}
                  onClick={() => setPagos((v) => v.filter((_, idx) => idx !== i))}
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
            onClick={() => setPagos((v) => [...v, filaPagoVacia()])}
            className="v2-focus self-start min-h-[44px] text-[13px] font-semibold underline"
            style={{ color: COLORS.brand }}
          >
            + Agregar otro medio
          </button>
          <p className="text-[13px] tabular-nums" style={{ color: pagosValidos ? COLORS.inkSoft : COLORS.coralDark }}>
            Sumado: {fmtMoney(sumaPagos)} de {fmtMoney(parseMoneyInput(monto))}
          </p>
          {faltantes.marcado('pagos') && pagos.some((f) => !medioDeFila(f) || parseMoneyInput(f.monto) <= 0) && (
            <TextoFalta>Falta el medio o el monto en alguna fila.</TextoFalta>
          )}
        </div>
      )}

      {!esFijo && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>¿Qué tipo de gasto fue?</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {TIPOS.map((t) => {
              const sel = tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setTipo(t)}
                  className="v2-focus rounded-xl px-1 min-h-[44px] text-[13px] font-semibold transition-all duration-100 active:scale-95"
                  // Sin color propio por tipo: los colores son de las secciones.
                  style={sel ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                >
                  {TIPO_INFO[t].label}
                </button>
              );
            })}
          </div>
          {/* "Otro" se puede escribir: queda con el nombre que le pongas y se
              ofrece de nuevo la próxima vez, como las secciones. */}
          {tipo === 'otro' && (
            <div className="flex flex-col gap-2 mt-1.5">
              <input
                autoFocus
                aria-label="Qué tipo de gasto fue"
                maxLength={40}
                className="v2-focus w-full rounded-xl px-3.5 min-h-[48px] text-[14px] transition-colors"
                style={INPUT_STYLE}
                placeholder="Escribí cuál (ej: Salud, Mascota)"
                value={tipoOtro}
                onChange={(e) => setTipoOtro(e.target.value)}
              />
              {tiposOtroRecientes.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Los que escribiste antes">
                  {tiposOtroRecientes.map((t) => {
                    const sel = tipoOtro.trim().toLowerCase() === t.toLowerCase();
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => setTipoOtro(t)}
                        className="v2-focus rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-all duration-100 active:scale-95"
                        style={sel
                          ? { background: COLORS.brandSoft, color: COLORS.brandDark }
                          : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </fieldset>
      )}

      {/* Un gasto que ya pasó no se puede volver "gasto fijo" ni "recurrente":
          esto es para crear uno nuevo, no para editar un movimiento. */}
      {esFijo && <CamposGastoFijo valor={fijo} onChange={setFijo} marcado={faltantes.marcado('fijo')} siempre />}
      {!editando && !esFijo && (
        <CamposRecurrente valor={recurrente} onChange={setRecurrente} fecha={new Date(deInputFecha(fecha))} />
      )}

      {error && <p role="alert" className="text-[13px] font-semibold mt-1" style={{ color: COLORS.coralDark }}>{error}</p>}

      <div className="flex gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="v2-focus flex-1 rounded-xl py-2.5 min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => faltantes.intentar(() => void guardar())}
          className="v2-focus flex-[2] rounded-xl py-2.5 min-h-[44px] text-[13px] font-bold transition-all duration-100 active:scale-95"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          {editando ? 'Guardar cambios' : esFijo ? 'Guardar gasto fijo' : recurrente.activo ? 'Guardar gasto recurrente' : 'Agregar gasto'}
        </button>
      </div>
    </div>
  );
}
