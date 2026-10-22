import { useEffect, useMemo, useState } from 'react';
import * as acciones from '../../../api/v2/acciones';
import type { PosicionInversion } from '../../../api/v2/tipos';
import { nombreProducto, type ProductoId } from '../../../lib/inversiones/catalogo';
import { fmtPesos, listaConY, pct } from '../../../lib/inversiones/formato';
import { fechaCorta, fechaLarga } from '../../../lib/inversiones/mercadoTipos';
import { generarNovedades, queHayHoy } from '../../../lib/inversiones/seguimiento';
import { useMercado } from '../../../lib/inversiones/useMercado';
import { useNoticias } from '../../../lib/inversiones/useNoticias';
import { IconChevron } from '../FinaIcons';
import { COLORS, Cta, EstadoConfianza, TituloSeccion } from '../shared';
import { Desplegable } from './Desplegable';
import { DatoFila, Hoja, Parrafo } from './Hoja';

const ETIQUETAS_DETALLE: Record<string, string> = {
  fondo: 'Fondo', clase: 'Clase', ticker: 'Ticker', renuevaSolo: 'Se renueva solo', precancelable: 'Precancelable',
  tipoDolar: 'Tipo de dólar', comision: 'Comisión (en pesos)', comisionPct: 'Comisión', tipoFondo: 'Tipo de fondo', rescate: 'Plazo de rescate',
};
const TIPOS_DE_FONDO: Record<string, string> = { money_market: 'Money market', renta_fija: 'Renta fija', renta_variable: 'Renta variable', mixto: 'Mixto u otro' };
const RESCATES: Record<string, string> = { 'mismo-dia': 'El mismo día', '24hs': '24 hs', '48hs': '48 hs', otro: 'Otro' };

function valorDetalle(clave: string, v: string | number | boolean): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (clave === 'comision' && typeof v === 'number') return fmtPesos(v);
  if (clave === 'comisionPct' && typeof v === 'number') return pct(v, 1);
  if (clave === 'tipoFondo') return TIPOS_DE_FONDO[String(v)] ?? String(v);
  if (clave === 'rescate') return RESCATES[String(v)] ?? String(v);
  if (clave === 'tipoDolar') return String(v).toUpperCase() === 'MEP' ? 'MEP' : String(v).charAt(0).toUpperCase() + String(v).slice(1);
  return String(v);
}

// Un color por tipo para la barra. El nombre y el monto van siempre al lado: el
// color solo no alcanza para distinguir (guía §11).
const COLOR_TIPO: Record<PosicionInversion['tipo'], string> = {
  cuenta_remunerada: COLORS.lima,
  fci: COLORS.star,
  plazo_fijo: COLORS.lila,
  plazo_fijo_uva: COLORS.brandSoft,
  letra: COLORS.naranja,
  dolar: COLORS.limaViz,
  cedear: COLORS.brand,
};

type ObjetivoDeInversion = { nombre: string; montoTotal: number | null; juntado: number };

// "Mis inversiones": lo que la persona registró. Arriba, cómo se reparte su plata;
// y al tocar cada una, todo lo que hay para decirle sobre ESA inversión: qué pasa
// hoy, novedades, noticias del día y dónde ver cómo viene.
export function MisInversiones({
  posiciones, objetivosPorId, onRegistrar, legacy,
}: {
  posiciones: PosicionInversion[];
  /** Los objetivos por id, para decir para cuál es cada inversión. */
  objetivosPorId: Record<string, ObjetivoDeInversion>;
  onRegistrar: () => void;
  /** Los registros viejos (sólo "cuánto y en qué"), que se siguen pudiendo ver y editar. */
  legacy: React.ReactNode;
}) {
  const { estado } = useMercado();
  const mercado = estado.tipo === 'listo' ? estado.mercado : null;
  const [abierta, setAbierta] = useState<PosicionInversion | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [confirmarCerrar, setConfirmarCerrar] = useState(false);
  // Lo último que hizo, para poder deshacerlo unos segundos.
  const [deshacer, setDeshacer] = useState<{ tipo: 'cerrada' | 'borrada'; pos: PosicionInversion } | null>(null);

  useEffect(() => {
    if (!deshacer) return;
    const t = setTimeout(() => setDeshacer(null), 8000);
    return () => clearTimeout(t);
  }, [deshacer]);

  const activas = posiciones.filter((p) => p.estado === 'activa');
  const cerradas = posiciones.filter((p) => p.estado === 'cerrada');
  const total = activas.reduce((a, p) => a + p.monto, 0);

  const porTipo = useMemo(() => {
    const m = new Map<PosicionInversion['tipo'], number>();
    for (const p of activas) m.set(p.tipo, (m.get(p.tipo) ?? 0) + p.monto);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [activas]);
  const lugares = [...new Set(activas.map((p) => p.proveedor).filter(Boolean))];

  const objetivoDe = (p: PosicionInversion): ObjetivoDeInversion | null => {
    const id = p.detalle.objetivoId;
    return typeof id === 'string' ? (objetivosPorId[id] ?? null) : null;
  };

  const fila = (p: PosicionInversion) => (
    <button
      key={p.id}
      type="button"
      onClick={() => { setAbierta(p); setConfirmarBorrar(false); setConfirmarCerrar(false); }}
      className="v2-focus w-full text-left flex items-center justify-between gap-3 min-h-[64px] py-3 border-b last:border-b-0 transition-all duration-100 active:scale-[0.99]"
      style={{ borderColor: COLORS.line }}
      aria-label={`Ver ${nombreProducto(p.tipo)} en ${p.proveedor}`}
    >
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[16px] font-semibold truncate" style={{ color: COLORS.ink }}>{nombreProducto(p.tipo)}{p.proveedor ? ` · ${p.proveedor}` : ''}</span>
        <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>
          Desde el {fechaLarga(p.inicio)}{p.vencimiento ? ` · vence el ${fechaLarga(p.vencimiento)}` : ''}{objetivoDe(p) ? ` · para ${objetivoDe(p)!.nombre}` : ''}
        </span>
      </span>
      <span className="text-[16px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtPesos(p.monto)}</span>
      <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={16} /></span>
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        {activas.length > 0 ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Tenés registrado en inversiones</p>
              <p className="font-mono tabular-nums text-[32px] font-bold leading-none" style={{ color: COLORS.ink }}>{fmtPesos(total)}</p>
              <EstadoConfianza estado="declarado" />
            </div>

            <div className="flex flex-col gap-2" aria-label="Cómo se reparte tu plata">
              <div className="flex h-3 rounded-full overflow-hidden" style={{ background: COLORS.tint }} role="img"
                aria-label={`Reparto: ${porTipo.map(([t, m]) => `${nombreProducto(t)} ${pct((m / total) * 100, 0)}`).join(', ')}`}>
                {porTipo.map(([t, m]) => (
                  <span key={t} style={{ width: `${(m / total) * 100}%`, background: COLOR_TIPO[t] }} />
                ))}
              </div>
              <ul className="flex flex-col gap-1">
                {porTipo.map(([t, m]) => (
                  <li key={t} className="flex items-center justify-between gap-3 text-[14px]" style={{ color: COLORS.inkSoft }}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_TIPO[t] }} aria-hidden />
                      <span className="truncate">{nombreProducto(t)}</span>
                    </span>
                    <span className="font-mono tabular-nums shrink-0">{pct((m / total) * 100, 0)} · {fmtPesos(m)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
                Cómo viene cada inversión, día a día, lo ves en la app donde la hiciste{lugares.length > 0 ? ` (${listaConY(lugares)})` : ''}. Acá te mostramos lo que anotaste vos y qué hacer con eso.
              </p>
            </div>

            <div className="flex flex-col">{activas.map(fila)}</div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <TituloSeccion>Todavía no registraste ninguna inversión</TituloSeccion>
            <Parrafo>
              Cuando hagas la primera, acá vas a ver cuándo vence, cuánto va rindiendo y qué alternativas tenés después. Podés empezar por Alternativas, o anotar algo que ya tengas.
            </Parrafo>
          </div>
        )}
        <Cta label={activas.length > 0 ? '+ Registrar otra inversión' : 'Registrar una inversión'} onClick={onRegistrar} />
      </section>

      {cerradas.length > 0 && (
        <Desplegable titulo={`Inversiones cerradas (${cerradas.length})`}>
          <div className="flex flex-col">{cerradas.map(fila)}</div>
        </Desplegable>
      )}

      {legacy}

      {deshacer && (
        <div
          role="status"
          className="fixed left-4 right-4 bottom-4 z-40 mx-auto max-w-[420px] flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{ background: COLORS.ink, color: COLORS.surface }}
        >
          <span className="text-[15px]">{deshacer.tipo === 'cerrada' ? 'Inversión cerrada.' : 'Inversión borrada.'}</span>
          <button
            type="button"
            onClick={() => {
              if (deshacer.tipo === 'cerrada') acciones.reabrirPosicion(deshacer.pos.id);
              else acciones.restaurarPosicion(deshacer.pos);
              setDeshacer(null);
            }}
            className="v2-focus min-h-[44px] px-3 text-[15px] font-bold"
            style={{ color: COLORS.star }}
          >
            Deshacer
          </button>
        </div>
      )}

      {abierta && (
        <FichaPosicion
          pos={abierta}
          objetivo={objetivoDe(abierta)}
          invertidoEnEl={objetivoDe(abierta) ? activas.filter((x) => x.detalle.objetivoId === abierta.detalle.objetivoId).reduce((a, x) => a + x.monto, 0) : 0}
          confirmarCerrar={confirmarCerrar}
          confirmarBorrar={confirmarBorrar}
          onConfirmarCerrar={setConfirmarCerrar}
          onConfirmarBorrar={setConfirmarBorrar}
          onCerrarla={() => { acciones.cerrarPosicion(abierta.id); setDeshacer({ tipo: 'cerrada', pos: abierta }); setAbierta(null); }}
          onBorrarla={() => { acciones.borrarPosicion(abierta.id); setDeshacer({ tipo: 'borrada', pos: abierta }); setAbierta(null); }}
          onSalir={() => setAbierta(null)}
        />
      )}
    </div>
  );
}

// Todo lo que hay para esta inversión, con ella adelante: sus datos, qué pasa hoy,
// novedades, noticias del día y dónde ver cómo viene.
function FichaPosicion({
  pos, objetivo, invertidoEnEl, confirmarCerrar, confirmarBorrar, onConfirmarCerrar, onConfirmarBorrar, onCerrarla, onBorrarla, onSalir,
}: {
  pos: PosicionInversion;
  objetivo: ObjetivoDeInversion | null;
  /** Cuánto hay anotado en inversiones activas para ese mismo objetivo. */
  invertidoEnEl: number;
  confirmarCerrar: boolean;
  confirmarBorrar: boolean;
  onConfirmarCerrar: (v: boolean) => void;
  onConfirmarBorrar: (v: boolean) => void;
  onCerrarla: () => void;
  onBorrarla: () => void;
  onSalir: () => void;
}) {
  const { estado } = useMercado();
  const mercado = estado.tipo === 'listo' ? estado.mercado : null;
  const noticias = useNoticias(pos.tipo as ProductoId);
  const hoy = useMemo(() => queHayHoy(pos, mercado), [pos, mercado]);
  const novedades = useMemo(
    () => generarNovedades({ posiciones: [pos], mercado }).filter((n) => n.posicionId === pos.id),
    [pos, mercado],
  );

  return (
    <Hoja titulo={nombreProducto(pos.tipo)} onCerrar={onSalir}>
      <div className="flex flex-col">
        <DatoFila etiqueta="Dónde" valor={pos.proveedor || '—'} />
        <DatoFila etiqueta="Monto" valor={fmtPesos(pos.monto)} />
        <DatoFila etiqueta="Desde" valor={fechaLarga(pos.inicio)} />
        {pos.vencimiento && <DatoFila etiqueta="Vence" valor={fechaLarga(pos.vencimiento)} />}
        {pos.plazoDias && <DatoFila etiqueta="Plazo" valor={`${pos.plazoDias} días`} />}
        {pos.tna !== null && <DatoFila etiqueta="Tasa anual (TNA)" valor={pct(pos.tna * 100, 2)} />}
        {pos.cantidad !== null && <DatoFila etiqueta="Cantidad" valor={pos.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 4 })} />}
        {pos.precioUnitario !== null && <DatoFila etiqueta="Precio por unidad" valor={fmtPesos(pos.precioUnitario)} />}
        {Object.entries(pos.detalle).map(([k, v]) => (v === null || v === '' ? null : <DatoFila key={k} etiqueta={ETIQUETAS_DETALLE[k] ?? k} valor={valorDetalle(k, v)} />))}
      </div>
      <EstadoConfianza estado="declarado" />
      <p className="text-[13px] -mt-3" style={{ color: COLORS.inkFaint }}>
        {pos.origen === 'captura' ? 'Leído de una captura y confirmado por vos.' : 'Cargado por vos.'}
      </p>

      {objetivo && (
        <section className="flex flex-col gap-1.5">
          <TituloSeccion>Para tu objetivo “{objetivo.nombre}”</TituloSeccion>
          <Parrafo>
            Tenés anotado {fmtPesos(invertidoEnEl)} en inversiones para este objetivo
            {objetivo.montoTotal ? `, de los ${fmtPesos(objetivo.montoTotal)} que necesitás` : ''}. Lo que ya aportaste a mano al objetivo: {fmtPesos(objetivo.juntado)}.
          </Parrafo>
        </section>
      )}

      {(hoy.length > 0 || novedades.length > 0) && (
        <section className="flex flex-col gap-3">
          <TituloSeccion>Qué pasa hoy con esta inversión</TituloSeccion>
          {hoy.map((t) => (
            <p key={t} className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>{t}</p>
          ))}
          {novedades.map((n) => (
            <article key={n.id} className="flex flex-col gap-1 pl-3.5 border-l-2" style={{ borderColor: n.tono === 'decision' ? COLORS.star : COLORS.brandSoft }}>
              <h3 className="text-[16px] font-bold leading-snug" style={{ color: COLORS.ink }}>{n.titulo}</h3>
              <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>{n.texto}</p>
              <EstadoConfianza estado={n.confianza} />
            </article>
          ))}
        </section>
      )}

      {noticias.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Noticias de hoy">
          <TituloSeccion>Noticias de hoy que pueden afectarla</TituloSeccion>
          {noticias.map((n) => (
            <article key={n.enlace} className="flex flex-col gap-1 pl-3.5 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
              {n.queSignifica && <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.ink }}>{n.queSignifica}</p>}
              <a
                href={n.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="v2-focus text-[14px] leading-snug underline underline-offset-2"
                style={{ color: COLORS.inkSoft }}
              >
                {n.titular}
              </a>
              <span className="text-[12px]" style={{ color: COLORS.inkFaint }}>{n.fuente} · {fechaCorta(n.fecha.slice(0, 10))}</span>
            </article>
          ))}
          <p className="text-[12px] leading-snug" style={{ color: COLORS.inkFaint }}>
            Es un resumen automático de los titulares, no la nota completa: abrí el enlace para leerla. No es un consejo de qué hacer con tu plata.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        <TituloSeccion>Cómo viene</TituloSeccion>
        <Parrafo>
          La evolución día a día de esta inversión la ves en la app de {pos.proveedor || 'donde la hiciste'}. FINA no se conecta a tu cuenta: acá ves lo que anotaste.
        </Parrafo>
      </section>

      {pos.estado === 'activa' && (
        confirmarCerrar ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>
              ¿Ya la cobraste o la cerraste? Si confirmás, esta inversión se va a borrar de tu lista. Si te arrepentís, vas a poder deshacerlo enseguida.
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => onConfirmarCerrar(false)} className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold" style={{ color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` }}>Cancelar</button>
              <button type="button" onClick={onCerrarla} className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold" style={{ background: COLORS.brand, color: COLORS.surface }}>
                Sí, confirmar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onConfirmarCerrar(true)}
            className="v2-focus min-h-[48px] rounded-2xl text-[16px] font-bold"
            style={{ border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink }}
          >
            Ya la cobré / la cerré
          </button>
        )
      )}
      {confirmarBorrar ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>¿Borramos este registro? Es como si nunca lo hubieras anotado. Vas a poder deshacerlo enseguida.</p>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => onConfirmarBorrar(false)} className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold" style={{ color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` }}>Cancelar</button>
            <button type="button" onClick={onBorrarla} className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold" style={{ background: COLORS.naranja, color: COLORS.ink }}>Sí, borrar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => onConfirmarBorrar(true)} className="v2-focus min-h-[44px] text-[15px] font-semibold" style={{ color: COLORS.naranjaText }}>
          Borrar este registro
        </button>
      )}
    </Hoja>
  );
}
