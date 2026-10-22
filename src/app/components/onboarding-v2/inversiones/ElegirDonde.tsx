import { useMemo } from 'react';
import { PROVEEDORES, type ProductoId, type ProveedorId } from '../../../lib/inversiones/catalogo';
import { nombrePropio, pct } from '../../../lib/inversiones/formato';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import { bancosOrdenados, type Evaluacion } from '../../../lib/inversiones/motor';
import { BotonFantasma, COLORS, Cta, TituloSeccion } from '../shared';
import { Hoja, Parrafo } from './Hoja';

/**
 * El mini comentario de cada opción: lo que la distingue de las otras, nada más.
 * Si todas son lo mismo (los dos brokers venden el mismo dólar, por ejemplo),
 * no se dice nada.
 */
export function comentarioDeOpcion(o: Evaluacion, todas: Evaluacion[]): string | null {
  const central = (e: Evaluacion): number | null => (e.tna ? (e.tna.min + e.tna.max) / 2 : null);
  const mio = central(o);
  if (mio === null) return null;
  const valores = todas.map(central).filter((x): x is number => x !== null);
  if (valores.length < 2 || Math.max(...valores) - Math.min(...valores) < 0.005) return null;
  return `Hoy rinde cerca de ${pct(mio * 100, 0)} anual`;
}

// Elegir dónde hacerlo: las opciones una al lado de la otra. En un plazo fijo, en
// cambio, se elige el banco de una lista con lo que paga cada uno.
export function ElegirDonde({
  producto, opciones, usa, mercado, proveedor, banco, onProveedor, onBanco, onSeguir, onVolver, onCerrar,
}: {
  producto: ProductoId;
  opciones: Evaluacion[];
  usa: ProveedorId[];
  mercado: Mercado;
  proveedor: ProveedorId | null;
  banco: string | null;
  onProveedor: (p: ProveedorId) => void;
  onBanco: (b: string | null) => void;
  onSeguir: () => void;
  onVolver: () => void;
  onCerrar: () => void;
}) {
  const esPlazo = producto === 'plazo_fijo' || producto === 'plazo_fijo_uva';
  const bancos = useMemo(() => bancosOrdenados(mercado).slice(0, 12), [mercado]);

  return (
    <Hoja titulo="¿Dónde lo hacés?" onCerrar={onCerrar}>
      {esPlazo ? (
        <>
          <Parrafo>Lo más simple es usar el banco donde ya tenés cuenta. Estas son las tasas de hoy (son para clientes del banco).</Parrafo>
          <select
            aria-label="Banco"
            className="v2-focus w-full rounded-2xl px-4 py-3 text-[16px] outline-none"
            style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
            value={banco ?? ''}
            onChange={(e) => onBanco(e.target.value || null)}
          >
            <option value="">Mi banco (no está en la lista)</option>
            {bancos.map((b) => (
              <option key={b.entidad} value={b.entidad}>{nombrePropio(b.entidad)} — {pct(b.tna * 100, 1)} anual a 30 días</option>
            ))}
          </select>
        </>
      ) : (
        <>
          <TituloSeccion>Elegí dónde</TituloSeccion>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Dónde hacerlo">
            {opciones.map((o) => {
              const prov = PROVEEDORES[o.proveedor];
              const sel = proveedor === o.proveedor;
              const comentario = comentarioDeOpcion(o, opciones);
              return (
                <button
                  key={o.proveedor}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => onProveedor(o.proveedor)}
                  className="v2-focus flex flex-col items-start gap-1 text-left rounded-2xl px-4 py-4 min-h-[88px] transition-all duration-100 active:scale-[0.98]"
                  style={sel
                    ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                    : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                >
                  <span className="text-[17px] font-bold leading-snug">{prov.nombre}</span>
                  {comentario && <span className="text-[13px] leading-snug" style={{ color: sel ? COLORS.surface : COLORS.inkSoft }}>{comentario}</span>}
                  {usa.includes(o.proveedor) && <span className="text-[12px] font-semibold" style={{ color: sel ? COLORS.surface : COLORS.limaText }}>Ya lo usás</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Cta label="Seguir" disabled={!esPlazo && !proveedor} onClick={onSeguir} />
        <BotonFantasma label="Atrás" onClick={onVolver} />
      </div>
    </Hoja>
  );
}
