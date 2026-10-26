import { useMemo, useRef, useState } from 'react';
import * as acciones from '../../../api/v2/acciones';
import { leerCaptura } from '../../../api/v2/capturas';
import type { TipoPosicion } from '../../../api/v2/tipos';
import { MAX_COMISION, MAX_TASA, MAX_TASA_EXTRA_UVA, MAX_UNIDADES, MAX_USD, maxPesos } from '../../../lib/inversiones/limites';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import {
  FORMULARIOS, esObligatorio, hoyISO, lecturaAValores, leerNumero, opcionesDe, procesarRegistro, soloNumeros, valoresIniciales,
  type Borrador, type CampoDef, type Opcion, type Valores,
} from '../../../lib/inversiones/registro';
import { COLORS, Cta, formatThousands, OpcionesGrid } from '../shared';

/** Cuántos caracteres admite cada tipo de campo: así no se pueden escribir infinitos ceros. */
const LARGO_MAXIMO = { monto: 15, numero: 12, porcentaje: 6, texto: 40 } as const;

/**
 * El formulario para anotar una inversión. Se usa suelto (desde "Mis inversiones") y adentro del último paso del paso a
 * paso. Lo que ya se eligió en los pasos (`bloqueados`) se muestra apagado y no se puede cambiar: la persona sólo
 * completa lo que no se puede saber de afuera. También se puede subir una captura o un PDF y leerlo por ella.
 */
export function FormularioRegistro({
  tipo, previos, bloqueados = [], mercado, onGuardado, onCambiarTipo, leidosIniciales = [],
}: {
  tipo: TipoPosicion;
  previos?: Partial<Valores>;
  bloqueados?: string[];
  mercado: Mercado | null;
  onGuardado: (borrador: Borrador) => void;
  /** Si se leyó un archivo que es de otro tipo de inversión, se le avisa a quien armó el formulario para que lo rearme. */
  onCambiarTipo?: (tipo: TipoPosicion, valores: Valores, leidos: string[]) => void;
  /** Los campos que ya vienen leídos de un archivo (al cambiar de tipo). */
  leidosIniciales?: string[];
}) {
  const [valores, setValores] = useState<Valores>(() => valoresIniciales(tipo, previos));
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [leidos, setLeidos] = useState<string[]>(leidosIniciales);
  const [captura, setCaptura] = useState<{ estado: 'quieta' | 'leyendo' | 'aviso'; mensaje?: string }>({ estado: 'quieta' });
  const archivo = useRef<HTMLInputElement>(null);

  const resultado = useMemo(
    () => procesarRegistro(tipo, valores, mercado, leidos.length > 0 ? 'captura' : 'manual'),
    [tipo, valores, mercado, leidos],
  );

  function cambiar(id: string, val: string) {
    // Nada de números extremos: lo que pasa el tope no se puede ni escribir (por ejemplo, infinitos ceros).
    const campo = FORMULARIOS[tipo].campos.find((c) => c.id === id);
    if (campo && val) {
      const n = leerNumero(val);
      if (campo.tipo === 'monto' && n !== null && n > maxPesos(mercado)) return;
      if (campo.tipo === 'numero' && n !== null && n > (tipo === 'dolar' && id === 'cantidad' ? MAX_USD : MAX_UNIDADES)) return;
      if (campo.tipo === 'porcentaje' && n !== null && n > (tipo === 'plazo_fijo_uva' ? MAX_TASA_EXTRA_UVA : id === 'comision' ? MAX_COMISION : MAX_TASA)) return;
    }
    setValores((v) => {
      const nuevo = { ...v, [id]: val };
      // Lo que depende de lo elegido (el fondo depende de dónde lo compró) se ajusta solo.
      for (const c of FORMULARIOS[tipo].campos) {
        if (typeof c.opciones !== 'function' || c.id === id || bloqueados.includes(c.id)) continue;
        const lista = opcionesDe(c, nuevo, mercado);
        if (lista.length === 1) nuevo[c.id] = lista[0].id;
        else if (lista.length > 1 && !lista.some((o) => o.id === nuevo[c.id])) nuevo[c.id] = '';
      }
      return nuevo;
    });
    // Si ella corrige un campo leído de la captura, deja de ser "leído": ahora lo puso ella.
    setLeidos((l) => l.filter((x) => x !== id));
  }

  async function subirCaptura(f: File) {
    setCaptura({ estado: 'leyendo' });
    const r = await leerCaptura(f);
    if (r.error !== null) { setCaptura({ estado: 'aviso', mensaje: 'Hubo un error al leer el archivo. Probá de nuevo más tarde o completá los datos a mano.' }); return; }
    const res = r.data;
    if (res.estado === 'no_configurado') { setCaptura({ estado: 'aviso', mensaje: 'La lectura de capturas todavía no está activada. Completá los datos a mano.' }); return; }
    if (res.estado === 'no_es_inversion') { setCaptura({ estado: 'aviso', mensaje: 'Eso no parece ser de una inversión. Probá con el comprobante o la pantalla del saldo.' }); return; }
    if (res.estado === 'no_se_pudo') { setCaptura({ estado: 'aviso', mensaje: 'No se leyó bien. Probá con un archivo más nítido, o completá a mano.' }); return; }
    const conv = lecturaAValores(res.lectura);
    if (!conv.tipo) { setCaptura({ estado: 'aviso', mensaje: 'Lo leímos pero no pudimos saber de qué inversión es. Completá a mano.' }); return; }
    // Lo ya elegido en los pasos manda: sólo se completa lo que falta.
    const mezcla: Valores = { ...conv.valores };
    for (const id of bloqueados) if (previos?.[id]) mezcla[id] = previos[id] as string;
    if (conv.tipo !== tipo) {
      // Es de otro tipo de inversión: si se puede cambiar (formulario suelto), se rearma; si no (dentro de los pasos), se avisa.
      if (onCambiarTipo) { onCambiarTipo(conv.tipo, conv.valores, conv.leidos); return; }
      setCaptura({ estado: 'aviso', mensaje: 'Eso parece ser de otra inversión distinta a la que estás anotando. Probá con el comprobante correcto.' });
      return;
    }
    setValores(mezcla);
    setLeidos(conv.leidos.filter((id) => !bloqueados.includes(id)));
    setCaptura({ estado: 'aviso', mensaje: 'Lo leímos. Revisá que cada dato esté bien antes de guardar: el archivo no se guarda.' });
  }

  async function guardar() {
    setIntentado(true);
    if (!resultado.borrador) return;
    setGuardando(true);
    setErrorGuardado(null);
    const r = await acciones.registrarPosicion(resultado.borrador);
    setGuardando(false);
    if (r.error !== null) { setErrorGuardado(r.error); return; }
    onGuardado(resultado.borrador);
  }

  const campos = FORMULARIOS[tipo].campos;
  return (
    <>
      <div className="flex flex-col gap-1">
        <input
          ref={archivo}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          aria-label="Subir una captura o un PDF de tu inversión"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirCaptura(f); e.target.value = ''; }}
        />
        <button
          type="button"
          onClick={() => archivo.current?.click()}
          disabled={captura.estado === 'leyendo'}
          className="v2-focus w-full min-h-[36px] rounded-2xl text-[13px] font-bold transition-all duration-100 active:scale-[0.98]"
          style={{ border: `1.5px dashed ${COLORS.lineStrong}`, color: COLORS.brand }}
        >
          {captura.estado === 'leyendo' ? 'Leyendo…' : 'Subí una captura o un PDF y lo leemos por vos'}
        </button>
        {captura.mensaje && <p role="status" className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>{captura.mensaje}</p>}
      </div>

      {/* Los campos cortos van de a dos, así el formulario entra en una pantalla. */}
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5">
        {campos.map((c) => {
          const opciones = opcionesDe(c, valores, mercado);
          const mitad = c.tipo === 'numero' || c.tipo === 'porcentaje' || c.tipo === 'fecha' || (c.tipo === 'opcion' && opciones.length > 0 && opciones.length <= 3);
          return (
            <div key={c.id} className={mitad ? 'col-span-1' : 'col-span-2'}>
              <Campo
                campo={c}
                valor={valores[c.id] ?? ''}
                opciones={opciones}
                sugerencias={c.sugerencias ? c.sugerencias(valores, mercado) : []}
                obligatorio={esObligatorio(c, valores)}
                bloqueado={bloqueados.includes(c.id) && !!valores[c.id]}
                error={intentado ? resultado.errores[c.id] : undefined}
                leido={leidos.includes(c.id)}
                onCambiar={(v) => cambiar(c.id, v)}
              />
            </div>
          );
        })}
      </div>

      {resultado.resumen.length > 0 && (
        <div className="flex flex-col gap-1 pl-3 border-l-2" style={{ borderColor: COLORS.lima }}>
          {resultado.resumen.map((r) => <p key={r} className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>{r}</p>)}
        </div>
      )}
      {resultado.avisos.map((a) => (
        <p key={a} className="text-[13px] leading-snug pl-3 border-l-2" style={{ color: COLORS.inkSoft, borderColor: COLORS.star }}>
          {a} Si está bien, podés guardarlo igual.
        </p>
      ))}

      {errorGuardado && <p role="alert" className="text-[13px] font-semibold" style={{ color: COLORS.naranjaText }}>{errorGuardado}</p>}

      <Cta label={guardando ? 'Guardando…' : 'Guardar'} disabled={guardando} onClick={() => void guardar()} />
    </>
  );
}

function Campo({
  campo, valor, opciones, sugerencias, obligatorio, bloqueado, error, leido, onCambiar,
}: {
  campo: CampoDef;
  valor: string;
  opciones: Opcion[];
  sugerencias: Opcion[];
  obligatorio: boolean;
  bloqueado: boolean;
  error?: string;
  leido: boolean;
  onCambiar: (v: string) => void;
}) {
  const id = `reg-${campo.id}`;
  const [enfocado, setEnfocado] = useState(false);
  const claseInput = 'v2-focus w-full rounded-2xl px-3 py-2 text-[15px] outline-none';
  const estilo = { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${error ? COLORS.naranja : COLORS.lineStrong}` };
  const numerico = campo.tipo === 'monto' || campo.tipo === 'numero' || campo.tipo === 'porcentaje';
  const etiquetaDe = (v: string) => opciones.find((o) => o.id === v)?.label ?? v;

  return (
    <div className="flex flex-col gap-1" onFocus={() => setEnfocado(true)} onBlur={() => setEnfocado(false)}>
      <label htmlFor={id} className="text-[13px] font-bold leading-tight" style={{ color: COLORS.ink }}>
        {campo.etiqueta}{!obligatorio && <span className="font-normal" style={{ color: COLORS.inkFaint }}> (opcional)</span>}
      </label>

      {bloqueado ? (
        // Ya se eligió en los pasos: se ve apagado y no se toca.
        <div
          id={id}
          aria-readonly
          className="rounded-2xl px-3 py-2 text-[15px] select-none truncate"
          style={{ background: COLORS.tint, color: COLORS.inkSoft, opacity: 0.7, border: `1.5px solid ${COLORS.line}`, filter: 'blur(0.4px)' }}
        >
          {campo.tipo === 'porcentaje' ? `${valor}%` : etiquetaDe(valor)}
        </div>
      ) : campo.tipo === 'opcion' && opciones.length > 6 ? (
        <select id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} className={claseInput} style={estilo}>
          <option value="">Elegí una opción</option>
          {opciones.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : campo.tipo === 'opcion' && opciones.length > 0 ? (
        <OpcionesGrid opciones={opciones} valor={valor || null} onElegir={(v) => onCambiar(v)} />
      ) : campo.tipo === 'fecha' ? (
        <input id={id} type="date" max={hoyISO()} value={valor} onChange={(e) => onCambiar(e.target.value)} className={claseInput} style={estilo} />
      ) : (
        <div className="relative">
          {campo.tipo === 'monto' && <span className="absolute top-1/2 -translate-y-1/2 left-3" style={{ color: COLORS.inkSoft }}>$</span>}
          <input
            id={id}
            value={valor}
            list={sugerencias.length > 0 ? `${id}-lista` : undefined}
            placeholder={campo.placeholder}
            maxLength={LARGO_MAXIMO[campo.tipo === 'monto' ? 'monto' : campo.tipo === 'numero' ? 'numero' : campo.tipo === 'porcentaje' ? 'porcentaje' : 'texto']}
            inputMode={numerico ? 'decimal' : 'text'}
            onChange={(e) => onCambiar(campo.tipo === 'monto' ? formatThousands(e.target.value) : numerico ? soloNumeros(e.target.value) : e.target.value)}
            className={`${claseInput} ${numerico ? 'font-mono tabular-nums' : ''} ${campo.tipo === 'monto' ? 'pl-7' : ''} ${campo.tipo === 'porcentaje' ? 'pr-8' : ''}`}
            style={estilo}
            aria-invalid={error ? true : undefined}
          />
          {campo.tipo === 'porcentaje' && <span className="absolute top-1/2 -translate-y-1/2 right-3" style={{ color: COLORS.inkSoft }}>%</span>}
          {sugerencias.length > 0 && (
            <datalist id={`${id}-lista`}>
              {sugerencias.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </datalist>
          )}
        </div>
      )}

      {/* La ayuda aparece cuando se toca el campo (o si hay un error): así el formulario no se hace enorme. */}
      {!bloqueado && (enfocado || !!error) && <p className="text-[12px] leading-snug" style={{ color: COLORS.inkFaint }}>{campo.ayuda}</p>}
      {!bloqueado && enfocado && campo.tambien && <p className="text-[12px] leading-snug" style={{ color: COLORS.inkFaint }}>También lo encontrás como: {campo.tambien}</p>}
      {leido && <p className="text-[12px] font-semibold" style={{ color: COLORS.limaText }}>Leído de tu archivo: revisalo.</p>}
      {error && <p role="alert" className="text-[12px] font-semibold" style={{ color: COLORS.naranjaText }}>{error}</p>}
    </div>
  );
}
