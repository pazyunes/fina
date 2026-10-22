import { useEffect, useMemo, useState } from 'react';
import * as acciones from '../../../api/v2/acciones';
import type { PosicionInversion } from '../../../api/v2/tipos';
import { nombreProducto } from '../../../lib/inversiones/catalogo';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { fmtPesos, pct } from '../../../lib/inversiones/formato';
import { fechaLarga } from '../../../lib/inversiones/mercadoTipos';
import { generarNovedades } from '../../../lib/inversiones/seguimiento';
import { useMercado } from '../../../lib/inversiones/useMercado';
import { IconChevron } from '../FinaIcons';
import { COLORS, Cta, EstadoConfianza, TituloSeccion } from '../shared';
import { DatoFila, Hoja, Parrafo } from './Hoja';

const ETIQUETAS_DETALLE: Record<string, string> = {
  fondo: 'Fondo', clase: 'Clase', ticker: 'Ticker', renuevaSolo: 'Se renueva solo', precancelable: 'Precancelable',
  tipoDolar: 'Tipo de dólar', comision: 'Comisión', rescate: 'Plazo de rescate',
};
const RESCATES: Record<string, string> = { 'mismo-dia': 'El mismo día', '24hs': '24 hs', '48hs': '48 hs', otro: 'Otro' };

function valorDetalle(clave: string, v: string | number | boolean): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (clave === 'comision' && typeof v === 'number') return fmtPesos(v);
  if (clave === 'rescate') return RESCATES[String(v)] ?? String(v);
  if (clave === 'tipoDolar') return String(v).toUpperCase() === 'MEP' ? 'MEP' : String(v).charAt(0).toUpperCase() + String(v).slice(1);
  return String(v);
}

// "Mis inversiones": lo que la persona registró, y lo que FINA tiene para
// decirle sobre eso. Las novedades son el seguimiento: vencimientos que se
// acercan, cuánto va ganando contra la inflación, una tasa que quedó atrás.
export function MisInversiones({
  posiciones, sugerencia, onRegistrar, legacy,
}: {
  posiciones: PosicionInversion[];
  sugerencia: SugerenciaMonto;
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
  const novedades = useMemo(() => generarNovedades({ posiciones, mercado, sugerencia }), [posiciones, mercado, sugerencia]);

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
          Desde el {fechaLarga(p.inicio)}{p.vencimiento ? ` · vence el ${fechaLarga(p.vencimiento)}` : ''}
        </span>
      </span>
      <span className="text-[16px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtPesos(p.monto)}</span>
      <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={16} /></span>
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      {novedades.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Novedades de tus inversiones">
          <TituloSeccion>Novedades</TituloSeccion>
          {novedades.map((n) => (
            <article key={n.id} className="flex flex-col gap-1 pl-3.5 border-l-2" style={{ borderColor: n.tono === 'decision' ? COLORS.star : COLORS.brandSoft }}>
              <h3 className="text-[16px] font-bold leading-snug" style={{ color: COLORS.ink }}>{n.titulo}</h3>
              <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>{n.texto}</p>
              <EstadoConfianza estado={n.confianza} />
            </article>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        {activas.length > 0 ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Tenés registrado en inversiones</p>
              <p className="font-mono tabular-nums text-[32px] font-bold leading-none" style={{ color: COLORS.ink }}>{fmtPesos(total)}</p>
              <EstadoConfianza estado="declarado" />
            </div>
            <div className="flex flex-col">{activas.map(fila)}</div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <TituloSeccion>Todavía no registraste ninguna inversión</TituloSeccion>
            <Parrafo>
              Cuando hagas la primera, acá vas a ver cuándo vence, cuánto va rindiendo contra la inflación y qué te conviene hacer después. Podés empezar por Recomendaciones, o anotar algo que ya tengas.
            </Parrafo>
          </div>
        )}
        <Cta label={activas.length > 0 ? '+ Registrar otra inversión' : 'Registrar una inversión'} onClick={onRegistrar} />
      </section>

      {cerradas.length > 0 && (
        <details>
          <summary className="v2-focus cursor-pointer min-h-[44px] flex items-center text-[15px] font-bold" style={{ color: COLORS.brand }}>
            Inversiones cerradas ({cerradas.length})
          </summary>
          <div className="flex flex-col">{cerradas.map(fila)}</div>
        </details>
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
        <Hoja titulo={nombreProducto(abierta.tipo)} onCerrar={() => setAbierta(null)}>
          <div className="flex flex-col">
            <DatoFila etiqueta="Dónde" valor={abierta.proveedor || '—'} />
            <DatoFila etiqueta="Monto" valor={fmtPesos(abierta.monto)} />
            <DatoFila etiqueta="Desde" valor={fechaLarga(abierta.inicio)} />
            {abierta.vencimiento && <DatoFila etiqueta="Vence" valor={fechaLarga(abierta.vencimiento)} />}
            {abierta.plazoDias && <DatoFila etiqueta="Plazo" valor={`${abierta.plazoDias} días`} />}
            {abierta.tna !== null && <DatoFila etiqueta="Tasa anual (TNA)" valor={pct(abierta.tna * 100, 2)} />}
            {abierta.cantidad !== null && <DatoFila etiqueta="Cantidad" valor={abierta.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 4 })} />}
            {abierta.precioUnitario !== null && <DatoFila etiqueta="Precio por unidad" valor={fmtPesos(abierta.precioUnitario)} />}
            {Object.entries(abierta.detalle).map(([k, v]) => (v === null || v === '' ? null : <DatoFila key={k} etiqueta={ETIQUETAS_DETALLE[k] ?? k} valor={valorDetalle(k, v)} />))}
          </div>
          <EstadoConfianza estado="declarado" />
          <p className="text-[13px]" style={{ color: COLORS.inkFaint }}>
            {abierta.origen === 'captura' ? 'Leído de una captura y confirmado por vos.' : 'Cargado por vos.'}
          </p>

          {abierta.estado === 'activa' && (
            confirmarCerrar ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>
                  ¿Ya la cobraste o la cerraste? Si confirmás, esta inversión se va a borrar de tu lista. Si te arrepentís, vas a poder deshacerlo enseguida.
                </p>
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setConfirmarCerrar(false)} className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold" style={{ color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` }}>Cancelar</button>
                  <button
                    type="button"
                    onClick={() => { acciones.cerrarPosicion(abierta.id); setDeshacer({ tipo: 'cerrada', pos: abierta }); setAbierta(null); }}
                    className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold"
                    style={{ background: COLORS.brand, color: COLORS.surface }}
                  >
                    Sí, confirmar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmarCerrar(true)}
                className="v2-focus min-h-[48px] rounded-2xl text-[16px] font-bold"
                style={{ border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink }}
              >
                Ya la cobré / la cerré
              </button>
            )
          )}
          {confirmarBorrar ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>¿Borramos este registro? Es como si nunca lo hubieras anotado.</p>
              <div className="flex gap-2.5">
                <button type="button" onClick={() => setConfirmarBorrar(false)} className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold" style={{ color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` }}>Cancelar</button>
                <button type="button" onClick={() => { acciones.borrarPosicion(abierta.id); setDeshacer({ tipo: 'borrada', pos: abierta }); setAbierta(null); }} className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold" style={{ background: COLORS.naranja, color: COLORS.ink }}>Sí, borrar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmarBorrar(true)} className="v2-focus min-h-[44px] text-[15px] font-semibold" style={{ color: COLORS.naranjaText }}>
              Borrar este registro
            </button>
          )}
        </Hoja>
      )}
    </div>
  );
}
