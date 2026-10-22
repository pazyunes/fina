import { useMemo, useRef, useState } from 'react';
import * as acciones from '../../../api/v2/acciones';
import { leerCaptura } from '../../../api/v2/capturas';
import type { TipoPosicion } from '../../../api/v2/tipos';
import { nombreProducto, ORDEN_PRODUCTOS } from '../../../lib/inversiones/catalogo';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import {
  FORMULARIOS, hoyISO, lecturaAValores, procesarRegistro, valoresIniciales,
  type CampoDef, type Valores,
} from '../../../lib/inversiones/registro';
import { COLORS, Cta, formatThousands, OpcionesGrid, TituloSeccion } from '../shared';
import { Hoja, Parrafo } from './Hoja';

// Registrar una inversión con lo que de verdad la define. Cada tipo pide sólo lo
// que se ve en la app después de invertir, y cada campo dice dónde encontrarlo.
// También se puede subir una captura: la leemos y la persona revisa antes de
// guardar. La imagen no se guarda.
export function RegistroPosicion({
  tipoInicial, previos, mercado, onCerrar,
}: {
  tipoInicial?: TipoPosicion;
  previos?: Partial<Valores>;
  mercado: Mercado | null;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPosicion | null>(tipoInicial ?? null);
  const [valores, setValores] = useState<Valores>(() => (tipoInicial ? valoresIniciales(tipoInicial, previos) : {}));
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [leidos, setLeidos] = useState<string[]>([]);
  const [captura, setCaptura] = useState<{ estado: 'quieta' | 'leyendo' | 'aviso'; mensaje?: string }>({ estado: 'quieta' });
  const archivo = useRef<HTMLInputElement>(null);

  const resultado = useMemo(
    () => (tipo ? procesarRegistro(tipo, valores, mercado, leidos.length > 0 ? 'captura' : 'manual') : null),
    [tipo, valores, mercado, leidos],
  );

  function elegirTipo(t: TipoPosicion) {
    setTipo(t);
    setValores(valoresIniciales(t, previos));
    setLeidos([]);
    setIntentado(false);
  }

  function cambiar(id: string, val: string) {
    setValores((v) => ({ ...v, [id]: val }));
    // Si ella corrige un campo leído de la captura, deja de ser "leído": ahora lo puso ella.
    setLeidos((l) => l.filter((x) => x !== id));
  }

  async function subirCaptura(f: File) {
    setCaptura({ estado: 'leyendo' });
    const r = await leerCaptura(f);
    if (r.error !== null) { setCaptura({ estado: 'aviso', mensaje: 'No pudimos leer la captura. Podés completar los datos a mano.' }); return; }
    const res = r.data;
    if (res.estado === 'no_configurado') { setCaptura({ estado: 'aviso', mensaje: 'La lectura de capturas todavía no está activada. Completá los datos a mano.' }); return; }
    if (res.estado === 'no_es_inversion') { setCaptura({ estado: 'aviso', mensaje: 'Esa imagen no parece ser de una inversión. Probá con el comprobante o la pantalla del saldo.' }); return; }
    if (res.estado === 'no_se_pudo') { setCaptura({ estado: 'aviso', mensaje: 'No se leyó bien. Probá con una captura más nítida, o completá a mano.' }); return; }
    const conv = lecturaAValores(res.lectura);
    if (!conv.tipo) { setCaptura({ estado: 'aviso', mensaje: 'Leímos la captura pero no pudimos saber de qué inversión es. Elegila vos.' }); return; }
    setTipo(conv.tipo);
    setValores(conv.valores);
    setLeidos(conv.leidos);
    setCaptura({ estado: 'aviso', mensaje: 'Leímos tu captura. Revisá que cada dato esté bien antes de guardar: la imagen no se guarda.' });
  }

  async function guardar() {
    setIntentado(true);
    if (!resultado?.borrador) return;
    setGuardando(true);
    setErrorGuardado(null);
    const r = await acciones.registrarPosicion(resultado.borrador);
    setGuardando(false);
    if (r.error !== null) { setErrorGuardado(r.error); return; }
    onCerrar();
  }

  const titulo = tipo ? `Registrar: ${nombreProducto(tipo)}` : 'Registrar una inversión';

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar} ancho={460}>
      <Parrafo>Es solo anotar lo que ya hiciste en tu app: FINA no mueve ni toca tu plata.</Parrafo>

      <div className="flex flex-col gap-2">
        <input
          ref={archivo}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Subir una captura de tu inversión"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirCaptura(f); e.target.value = ''; }}
        />
        <button
          type="button"
          onClick={() => archivo.current?.click()}
          disabled={captura.estado === 'leyendo'}
          className="v2-focus w-full min-h-[48px] rounded-2xl text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
          style={{ border: `1.5px dashed ${COLORS.lineStrong}`, color: COLORS.brand }}
        >
          {captura.estado === 'leyendo' ? 'Leyendo tu captura…' : 'Subir una captura y que la leamos por vos'}
        </button>
        {captura.mensaje && <p role="status" className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{captura.mensaje}</p>}
      </div>

      {!tipo && (
        <div className="flex flex-col gap-2.5">
          <TituloSeccion>¿Qué hiciste?</TituloSeccion>
          <OpcionesGrid
            opciones={ORDEN_PRODUCTOS.map((id) => ({ id, label: nombreProducto(id) }))}
            valor={null}
            onElegir={elegirTipo}
          />
        </div>
      )}

      {tipo && resultado && (
        <>
          <div className="flex flex-col gap-4">
            {FORMULARIOS[tipo].campos.map((c) => (
              <Campo
                key={c.id}
                campo={c}
                valor={valores[c.id] ?? ''}
                error={intentado ? resultado.errores[c.id] : undefined}
                leido={leidos.includes(c.id)}
                onCambiar={(v) => cambiar(c.id, v)}
              />
            ))}
          </div>

          {resultado.resumen.length > 0 && (
            <div className="flex flex-col gap-1 pl-3.5 border-l-2" style={{ borderColor: COLORS.lima }}>
              {resultado.resumen.map((r) => <p key={r} className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>{r}</p>)}
            </div>
          )}
          {resultado.avisos.map((a) => (
            <p key={a} className="text-[14px] leading-snug pl-3.5 border-l-2" style={{ color: COLORS.inkSoft, borderColor: COLORS.star }}>
              {a} Si está bien, podés guardarlo igual.
            </p>
          ))}

          {errorGuardado && <p role="alert" className="text-[14px] font-semibold" style={{ color: COLORS.naranjaText }}>{errorGuardado}</p>}

          <Cta label={guardando ? 'Guardando…' : 'Guardar'} disabled={guardando} onClick={() => void guardar()} />
          {!tipoInicial && (
            <button type="button" onClick={() => { setTipo(null); setLeidos([]); }} className="v2-focus min-h-[44px] text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>
              Cambiar el tipo de inversión
            </button>
          )}
        </>
      )}
    </Hoja>
  );
}

function Campo({
  campo, valor, error, leido, onCambiar,
}: {
  campo: CampoDef;
  valor: string;
  error?: string;
  leido: boolean;
  onCambiar: (v: string) => void;
}) {
  const id = `reg-${campo.id}`;
  const claseInput = 'v2-focus w-full rounded-2xl px-4 py-3 text-[17px] outline-none';
  const estilo = { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${error ? COLORS.naranja : COLORS.lineStrong}` };
  const numerico = campo.tipo === 'monto' || campo.tipo === 'numero' || campo.tipo === 'porcentaje';

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[16px] font-bold" style={{ color: COLORS.ink }}>
        {campo.etiqueta}{!campo.obligatorio && <span className="font-normal" style={{ color: COLORS.inkFaint }}> (opcional)</span>}
      </label>

      {campo.tipo === 'opcion' ? (
        <OpcionesGrid
          opciones={campo.opciones ?? []}
          valor={valor || null}
          onElegir={(v) => onCambiar(v)}
        />
      ) : campo.tipo === 'fecha' ? (
        <input id={id} type="date" max={hoyISO()} value={valor} onChange={(e) => onCambiar(e.target.value)} className={claseInput} style={estilo} />
      ) : (
        <div className="relative">
          {campo.tipo === 'monto' && <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>}
          <input
            id={id}
            value={valor}
            placeholder={campo.placeholder}
            inputMode={numerico ? 'decimal' : 'text'}
            onChange={(e) => onCambiar(campo.tipo === 'monto' ? formatThousands(e.target.value) : e.target.value)}
            className={`${claseInput} ${numerico ? 'font-mono tabular-nums' : ''} ${campo.tipo === 'monto' ? 'pl-8' : ''} ${campo.tipo === 'porcentaje' ? 'pr-10' : ''}`}
            style={estilo}
            aria-invalid={error ? true : undefined}
          />
          {campo.tipo === 'porcentaje' && <span className="absolute top-1/2 -translate-y-1/2 right-4" style={{ color: COLORS.inkSoft }}>%</span>}
        </div>
      )}

      <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>{campo.ayuda}</p>
      {leido && <p className="text-[13px] font-semibold" style={{ color: COLORS.limaText }}>Leído de tu captura: revisalo.</p>}
      {error && <p role="alert" className="text-[13px] font-semibold" style={{ color: COLORS.naranjaText }}>{error}</p>}
    </div>
  );
}
