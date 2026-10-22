import { useMemo, useState } from 'react';
import type { PosicionInversion } from '../../../api/v2/tipos';
import { PRODUCTOS, type PerfilRiesgo, type ProductoId, type ProveedorId } from '../../../lib/inversiones/catalogo';
import type { Colchon, SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { pct } from '../../../lib/inversiones/formato';
import { recomendar, textoVeredicto, type Recomendacion, type Veredicto } from '../../../lib/inversiones/motor';
import type { Valores } from '../../../lib/inversiones/registro';
import { useMercado } from '../../../lib/inversiones/useMercado';
import { IconChevron } from '../FinaIcons';
import { COLORS, TituloSeccion } from '../shared';
import { CuantoPoner } from './CuantoPoner';
import { DetalleProducto } from './DetalleProducto';
import { GuiaPasoAPaso } from './GuiaPasoAPaso';
import { Parrafo } from './Hoja';
import { MercadoHoy } from './MercadoHoy';

const PUNTO: Record<Veredicto, string> = {
  'le-gana': COLORS.lima,
  empata: COLORS.star,
  pierde: COLORS.naranja,
  variable: COLORS.tint,
  'sin-dato': COLORS.tint,
};

// La pestaña de recomendaciones. Todo sale de los datos de mercado de hoy: si no
// hay datos, no hay recomendación (se dice, no se inventa una).
export function RecomendacionesTab({
  perfil, horizonteMeses, usa, posiciones, productosQuiz, sugerencia, colchon, onRegistrar,
}: {
  perfil: PerfilRiesgo;
  horizonteMeses: number | null;
  usa: ProveedorId[];
  posiciones: PosicionInversion[];
  /** Lo que dijo en el quiz que ya hace, además de lo que tiene registrado. */
  productosQuiz: ProductoId[];
  sugerencia: SugerenciaMonto;
  colchon: Colchon | null;
  onRegistrar: (tipo: PosicionInversion['tipo'], previos: Partial<Valores>) => void;
}) {
  const { estado, reintentar } = useMercado();
  const [detalle, setDetalle] = useState<Recomendacion | null>(null);
  const [guia, setGuia] = useState<{ rec: Recomendacion; proveedor: ProveedorId } | null>(null);

  const mercado = estado.tipo === 'listo' ? estado.mercado : null;
  const yaInvierteEn = useMemo(
    () => [...new Set([...productosQuiz, ...posiciones.filter((p) => p.estado === 'activa').map((p) => p.tipo as ProductoId)])],
    [posiciones, productosQuiz],
  );
  const resultado = useMemo(
    () => (mercado
      ? recomendar({ mercado, perfil, horizonteMeses, usa, yaInvierteEn, necesitaCaja: !colchon?.cubierto })
      : null),
    [mercado, perfil, horizonteMeses, usa, yaInvierteEn, colchon],
  );

  if (estado.tipo === 'cargando') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Trayendo los datos de hoy">
        {[0, 1, 2].map((i) => <div key={i} className="h-[72px] rounded-2xl" style={{ background: COLORS.tint }} />)}
        <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Trayendo los datos de hoy…</p>
      </div>
    );
  }
  if (estado.tipo === 'error' || !mercado || !resultado) {
    return (
      <div className="flex flex-col gap-3">
        <TituloSeccion>No pudimos traer los datos de hoy</TituloSeccion>
        <Parrafo>Sin los números del mercado no te recomendamos nada: preferimos no decirte algo que no podemos respaldar. Probá de nuevo en un momento.</Parrafo>
        <button type="button" onClick={reintentar} className="v2-focus self-start min-h-[44px] rounded-full px-5 text-[15px] font-bold" style={{ border: `1.5px solid ${COLORS.brand}`, color: COLORS.brand }}>
          Reintentar
        </button>
      </div>
    );
  }
  if (resultado.sinBase || !resultado.inflacion) {
    return (
      <div className="flex flex-col gap-3">
        <TituloSeccion>Todavía no podemos recomendarte</TituloSeccion>
        <Parrafo>No tenemos un dato de inflación al día, y sin eso no se puede saber si una opción le gana o no. Apenas lo tengamos te mostramos las opciones.</Parrafo>
        <MercadoHoy mercado={mercado} />
      </div>
    );
  }
  const inflacion = resultado.inflacion;

  return (
    <div className="flex flex-col gap-6">
      {mercado.desactualizado && (
        <p className="text-[14px] leading-snug pl-3.5 border-l-2" style={{ color: COLORS.inkSoft, borderColor: COLORS.star }}>
          No pudimos actualizar los datos y estamos mostrando los últimos que tenemos. Cada número dice de qué fecha es.
        </p>
      )}

      <section className="flex flex-col gap-1">
        <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
          Esto es lo que hoy tiene sentido para vos. La inflación de referencia es{' '}
          <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{pct(inflacion.mensual * 100, 1)}</span> por mes, y solo te mostramos lo que no pierde contra eso.
        </p>
        {resultado.recomendaciones.length === 0 && (
          <Parrafo>Hoy no hay una opción que te recomendemos con seguridad. Abajo te contamos por qué.</Parrafo>
        )}
        {resultado.recomendaciones.map((r) => (
          <button
            key={r.producto.id}
            type="button"
            onClick={() => setDetalle(r)}
            className="v2-focus w-full text-left flex items-center gap-3 py-4 border-b last:border-b-0 transition-all duration-100 active:scale-[0.99]"
            style={{ borderColor: COLORS.line }}
          >
            <span className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[17px]" style={{ color: COLORS.ink }}>{r.producto.nombre}</span>
                {r.yaLoHace && (
                  <span className="text-[12px] font-semibold rounded-full px-2 py-0.5" style={{ background: COLORS.limaSoft, color: COLORS.limaText }}>Ya lo hacés</span>
                )}
              </span>
              <span className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.producto.resumen}</span>
              <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: COLORS.inkFaint }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PUNTO[r.mejor.veredicto] }} aria-hidden />
                {textoVeredicto(r.mejor.veredicto)} · {r.mejorConLoQueUsa ? `con lo que usás: ${nombreProveedor(r.mejorConLoQueUsa.proveedor)}` : `hoy lo mejor: ${nombreProveedor(r.mejor.proveedor)}`}
              </span>
            </span>
            <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={18} /></span>
          </button>
        ))}
      </section>

      <CuantoPoner sugerencia={sugerencia} colchon={colchon} />

      <MercadoHoy mercado={mercado} />

      {resultado.descartadas.length > 0 && (
        <details>
          <summary className="v2-focus cursor-pointer min-h-[44px] flex items-center text-[15px] font-bold" style={{ color: COLORS.brand }}>
            Lo que hoy no te recomendamos, y por qué
          </summary>
          <ul className="flex flex-col gap-2 pt-1">
            {resultado.descartadas.map((d) => (
              <li key={d.producto} className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
                <span className="font-bold" style={{ color: COLORS.ink }}>{PRODUCTOS[d.producto].nombre}.</span> {d.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
        FINA nunca mueve tu plata: te mostramos qué conviene y por qué, y vos decidís y lo hacés en tu propia app. Los rendimientos pasados no garantizan los futuros.
      </p>

      {detalle && (
        <DetalleProducto
          rec={detalle}
          inflacion={inflacion}
          usa={usa}
          onCerrar={() => setDetalle(null)}
          onElegir={(proveedor) => { setGuia({ rec: detalle, proveedor }); setDetalle(null); }}
        />
      )}
      {guia && (
        <GuiaPasoAPaso
          producto={guia.rec.producto.id}
          proveedor={guia.proveedor}
          mercado={mercado}
          evaluacion={guia.rec.opciones.find((o) => o.proveedor === guia.proveedor) ?? null}
          sugerencia={sugerencia}
          onCerrar={() => setGuia(null)}
          onRegistrar={(previos) => { const t = guia.rec.producto.id; setGuia(null); onRegistrar(t, previos); }}
        />
      )}
    </div>
  );
}

function nombreProveedor(id: ProveedorId): string {
  const nombres: Record<ProveedorId, string> = {
    mercado_pago: 'Mercado Pago', uala: 'Ualá', cocos: 'Cocos Capital', balanz: 'Balanz', banco: 'tu banco',
  };
  return nombres[id];
}
